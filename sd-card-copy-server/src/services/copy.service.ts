import { ConflictException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { CopyParams, TokenReplacementStrategy } from '../contracts';
import copyProgress, { mapFileStats, streamScanPathResults, isIFilesProgress } from 'copy-progress';
import { filter, last, map, tap } from 'rxjs';
import { Transform } from 'stream';
import { CopySession, SessionService } from './session.service';
import { DateStrategies } from '../strategies';
import { applyTokenReplacementsStrategies, createUniqueFolder } from '../helpers';
import { ConfigService } from './config.service';
import prettyBytes from 'pretty-bytes';
import ms from 'ms';
import { readdir, rm, rmdir } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { basename, join, matchesGlob, resolve } from 'path';

@Injectable()
export class CopyService {
    private readonly defaultReplacementStrategies: TokenReplacementStrategy[];
    private replacementStrategies: TokenReplacementStrategy[] | undefined;

    constructor(
        dateStrategies: DateStrategies,
        private configService: ConfigService,
        private sessionService: SessionService
    ) {
        this.defaultReplacementStrategies = [dateStrategies.formattedDateStrategy, dateStrategies.timestampStrategy];
    }

    private logger = new Logger(CopyService.name);

    /**
     * resolved source paths that are being copied or deleted
     */
    private readonly activeSourcePaths = new Set<string>();

    public async startCopy(params: CopyParams) {
        const sourcePath = resolve(params.sourcePath);

        if (this.activeSourcePaths.has(sourcePath)) {
            const message = `A copy from '${params.sourcePath}' is already in progress`;
            this.logger.warn(message);
            throw new ConflictException(message);
        }

        this.activeSourcePaths.add(sourcePath);
        const session = this.sessionService.start(params);

        try {
            await this.copy(params, session, () => this.onCopyComplete(sourcePath, params));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            session.finish(err instanceof UnprocessableEntityException ? 'refused' : 'failed', message);
            this.onCopyComplete(sourcePath, params);
            throw err;
        }
    }

    private onCopyComplete(sourcePath: string, params: CopyParams) {
        this.activeSourcePaths.delete(sourcePath);
        this.runAfterCopyActions(params);
    }

    private async runAfterCopyActions(params: CopyParams) {
        const { afterCopy = [] } = await this.configService.getConfig();

        for (const action of afterCopy) {
            try {
                await action(params, () => [...this.activeSourcePaths]);
            } catch (err) {
                this.logger.error(`afterCopy action for '${params.sourcePath}' failed: ${err}`);
            }
        }
    }

    /**
     * Starts the copy and resolves once it has started. onComplete is called once the copy and any delete have finished or failed.
     */
    private async copy(params: CopyParams, session: CopySession, onComplete: () => void) {
        let strategies = this.replacementStrategies;

        if (strategies == null) {
            const config = await this.configService.getConfig();

            strategies = this.replacementStrategies = [
                ...(config.strategies || []),
                ...this.defaultReplacementStrategies,
            ];
        }

        const unresolvedTokens: string[] = [];
        const replacedPath = await applyTokenReplacementsStrategies(
            params.targetPath,
            params.sourcePath,
            strategies,
            (token) => unresolvedTokens.push(token)
        );

        if (unresolvedTokens.length > 0) {
            const message = `Not copying ${params.sourcePath}: no strategy could replace ${unresolvedTokens.join(', ')} in '${params.targetPath}'`;
            this.logger.warn(message);
            throw new UnprocessableEntityException(message);
        }

        // a new folder for every copy so that files with the same name (e.g. from a camera's two drives) are not overwritten
        const targetPath = await createUniqueFolder(replacedPath);
        session.setTargetPath(targetPath);

        this.logger.log(`Copying ${params.sourcePath} -> ${targetPath} (delete-source: ${params.deleteSource})`);

        const { excludeFiles = [] } = await this.configService.getConfig();
        const filesStream = streamScanPathResults(params.sourcePath).pipe(
            filter((result) => result.stats.isFile()),
            filter((result) => !excludeFiles.some((pattern) => matchesGlob(basename(result.source), pattern))),
            tap((result) => session.addFile(result.source, result.stats.size)),
            map((file) =>
                mapFileStats({
                    file,
                    outDir: targetPath,
                    sourceDir: params.sourcePath,
                })
            )
        );

        // not copy-progress's configureFileCopyProgressFunction: it leaves read stream errors unhandled, which crashes the process
        const copyFunction = async (source: string, destination: string) => {
            session.startFile(source);
            const countBytes = new Transform({
                transform(chunk: Buffer, _encoding, callback) {
                    session.addBytes(source, chunk.length);
                    callback(null, chunk);
                },
            });
            try {
                await pipeline(
                    createReadStream(source, { highWaterMark: 1024 * 1024 }),
                    countBytes,
                    createWriteStream(destination)
                );
                session.completeFile(source);
            } catch (err) {
                session.failFile(source);
                throw err;
            }
        };

        copyProgress(filesStream, { concurrentCopy: 1, copyFunction })
            .pipe(filter(isIFilesProgress), last(null, undefined))
            .subscribe({
                next: (lastValue) => {
                    if (lastValue == null) {
                        this.logger.log(`No files to copy in ${params.sourcePath}`);
                        rmdir(targetPath).catch(() => undefined);
                        session.finish('complete');
                        onComplete();
                        return;
                    }
                    const bytes = prettyBytes(lastValue.totalBytes);
                    const time = ms(lastValue.elapsed);
                    this.logger.log(
                        `Copied ${lastValue.totalFiles} files (${bytes}) ${params.sourcePath} -> ${targetPath} in ${time}`
                    );
                    if (params.deleteSource) {
                        session.deleting();
                    }
                    this.deleteContent(params)
                        .then(
                            () => session.finish('complete'),
                            (err) => {
                                this.logger.error(`Delete of '${params.sourcePath}' failed: ${err}`);
                                session.finish('failed', `Delete failed: ${err}`);
                            }
                        )
                        .finally(onComplete);
                },
                error: (err) => {
                    this.logger.error(`Copy ${params.sourcePath} -> ${targetPath} failed: ${err}`);
                    session.finish('failed', `Copy failed: ${err}`);
                    onComplete();
                },
            });
    }

    private async deleteContent(params: CopyParams) {
        if (params.deleteSource !== true) {
            return;
        }

        this.logger.log(`Delete all files and folder in '${params.sourcePath}'`);

        const entries = await readdir(params.sourcePath);
        await Promise.all(entries.map((entry) => rm(join(params.sourcePath, entry), { recursive: true, force: true })));

        this.logger.log(`Delete of '${params.sourcePath}' complete`);
    }
}
