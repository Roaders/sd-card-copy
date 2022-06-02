import { Injectable, Logger } from '@nestjs/common';
import { CopyParams, TokenReplacementStrategy } from '../contracts';
import copyProgress, {
    configureFileCopyProgressFunction,
    mapFileStats,
    streamScanPathResults,
    isIFilesProgress,
} from 'copy-progress';
import { filter, last, map, mergeMap, Observable, shareReplay } from 'rxjs';
import { DateStrategies } from '../strategies';
import { applyTokenReplacementsStrategies, printWorkerId } from '../helpers';
import { ConfigService } from './config.service';
import prettyBytes from 'pretty-bytes';
import ms from 'ms';
import { IFileStats } from 'copy-progress/dist/src/contracts';
import { rm } from 'fs/promises';

@Injectable()
export class CopyService {
    private readonly defaultReplacementStrategies: TokenReplacementStrategy[];
    private replacementStrategies: TokenReplacementStrategy[] | undefined;

    constructor(dateStrategies: DateStrategies, private configService: ConfigService) {
        this.defaultReplacementStrategies = [dateStrategies.formattedDateStrategy, dateStrategies.timestampStrategy];
    }

    private logger = new Logger(printWorkerId(CopyService.name));

    public async startCopy(params: CopyParams) {
        let strategies = this.replacementStrategies;

        if (strategies == null) {
            const config = await this.configService.getConfig();

            strategies = this.replacementStrategies = [
                ...(config.strategies || []),
                ...this.defaultReplacementStrategies,
            ];
        }

        const targetPath = await applyTokenReplacementsStrategies(params.targetPath, params.sourcePath, strategies);

        this.logger.log(`Copying ${params.sourcePath} -> ${targetPath} (delete-source: ${params.deleteSource})`);

        const scanResults = streamScanPathResults(params.sourcePath).pipe(shareReplay());

        const filesStream = scanResults.pipe(
            filter((result) => result.stats.isFile()),
            map((file) => mapFileStats({ file, outDir: targetPath, sourceDir: params.sourcePath }))
        );

        copyProgress(filesStream, {
            concurrentCopy: 1,
            copyFunction: configureFileCopyProgressFunction({ force: true, highWaterMark: 1024 * 1024 }),
        })
            .pipe(filter(isIFilesProgress), last())
            .subscribe({
                next: (lastValue) => {
                    const bytes = prettyBytes(lastValue.totalBytes);
                    const time = ms(lastValue.elapsed);
                    this.logger.log(
                        `Copied ${lastValue.totalFiles} files (${bytes}) ${params.sourcePath} -> ${targetPath} in ${time}`
                    );
                    this.deleteContent(scanResults, params);
                },
                error: (err) => this.logger.error(`ERR: `, err),
            });
    }

    private async deleteContent(scanResults: Observable<IFileStats>, params: CopyParams) {
        if (params.deleteSource !== true) {
            return;
        }

        this.logger.log(`Delete all files and folder in '${params.sourcePath}'`);

        await this.deletePaths(scanResults);

        this.logger.log(`Delete of '${params.sourcePath}' complete`);
    }

    private async deletePaths(scanResults: Observable<IFileStats>): Promise<void> {
        return new Promise((resolve, reject) => {
            scanResults
                .pipe(mergeMap((path) => rm(path.source, { recursive: true, force: true })))
                .subscribe({ error: (err) => reject(err), complete: () => resolve() });
        });
    }
}
