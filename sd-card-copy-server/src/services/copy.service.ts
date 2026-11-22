import { ConflictException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { CopyParams, TokenReplacementStrategy } from '../contracts';
import copyProgress, { mapFileStats, streamScanPathResults, isIFilesProgress } from 'copy-progress';
import { filter, last, map } from 'rxjs';
import { DateStrategies } from '../strategies';
import { applyTokenReplacementsStrategies } from '../helpers';
import { ConfigService } from './config.service';
import prettyBytes from 'pretty-bytes';
import ms from 'ms';
import { readdir, rm } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { join, resolve } from 'path';

@Injectable()
export class CopyService {
    private readonly defaultReplacementStrategies: TokenReplacementStrategy[];
    private replacementStrategies: TokenReplacementStrategy[] | undefined;

    constructor(
        dateStrategies: DateStrategies,
        private configService: ConfigService
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

        try {
            await this.copy(params, () => this.activeSourcePaths.delete(sourcePath));
        } catch (err) {
            this.activeSourcePaths.delete(sourcePath);
            throw err;
        }
    }

    /**
     * Starts the copy and resolves once it has started. onComplete is called once the copy and any delete have finished or failed.
     */
    private async copy(params: CopyParams, onComplete: () => void) {
        let strategies = this.replacementStrategies;

        if (strategies == null) {
            const config = await this.configService.getConfig();

            strategies = this.replacementStrategies = [
                ...(config.strategies || []),
                ...this.defaultReplacementStrategies,
            ];
        }

        const unresolvedTokens: string[] = [];
        const targetPath = await applyTokenReplacementsStrategies(
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

        this.logger.log(`Copying ${params.sourcePath} -> ${targetPath} (delete-source: ${params.deleteSource})`);

        const filesStream = streamScanPathResults(params.sourcePath).pipe(
            filter((result) => result.stats.isFile()),
            map((file) => mapFileStats({ file, outDir: targetPath, sourceDir: params.sourcePath }))
        );

        // not copy-progress's configureFileCopyProgressFunction: it leaves read stream errors unhandled, which crashes the process
        const copyFunction = (source: string, destination: string) =>
            pipeline(createReadStream(source, { highWaterMark: 1024 * 1024 }), createWriteStream(destination));

        copyProgress(filesStream, { concurrentCopy: 1, copyFunction })
            .pipe(filter(isIFilesProgress), last(null, undefined))
            .subscribe({
                next: (lastValue) => {
                    if (lastValue == null) {
                        this.logger.log(`No files to copy in ${params.sourcePath}`);
                        onComplete();
                        return;
                    }
                    const bytes = prettyBytes(lastValue.totalBytes);
                    const time = ms(lastValue.elapsed);
                    this.logger.log(
                        `Copied ${lastValue.totalFiles} files (${bytes}) ${params.sourcePath} -> ${targetPath} in ${time}`
                    );
                    this.deleteContent(params)
                        .catch((err) => this.logger.error(`Delete of '${params.sourcePath}' failed: ${err}`))
                        .finally(onComplete);
                },
                error: (err) => {
                    this.logger.error(`Copy ${params.sourcePath} -> ${targetPath} failed: ${err}`);
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
