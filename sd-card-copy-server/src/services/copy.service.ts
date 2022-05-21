import { Injectable, Logger } from '@nestjs/common';
import { CopyParams, TokenReplacementStrategy } from '../contracts';
import copyProgress, {
    configureFileCopyProgressFunction,
    mapFileStats,
    streamScanPathResults,
    isIFilesProgress,
} from 'copy-progress';
import { filter, last, map } from 'rxjs';
import { DateStrategies } from '../strategies/date.strategy';
import { applyTokenReplacementsStrategies } from '../helpers';

@Injectable()
export class CopyService {
    private readonly defaultTokenReplacementStrategies: TokenReplacementStrategy[];

    constructor(dateStrategies: DateStrategies) {
        this.defaultTokenReplacementStrategies = [
            dateStrategies.formattedDateStrategy,
            dateStrategies.timestampStrategy,
        ];
    }

    private logger = new Logger(CopyService.name);

    startCopy(params: CopyParams) {
        const targetPath = applyTokenReplacementsStrategies(params.targetPath, this.defaultTokenReplacementStrategies);

        this.logger.log(`Copying ${params.sourcePath} -> ${targetPath}`);

        const filesStream = streamScanPathResults(params.sourcePath).pipe(
            map((file) => mapFileStats({ file, outDir: targetPath, sourceDir: params.sourcePath }))
        );

        copyProgress(filesStream, {
            concurrentCopy: 1,
            copyFunction: configureFileCopyProgressFunction({ force: true, highWaterMark: 1024 * 1024 * 1000 }),
        })
            .pipe(filter(isIFilesProgress), last())
            .subscribe({
                next: (lastValue) =>
                    this.logger.log(
                        `Copied ${lastValue.totalFiles} files (${lastValue.totalBytes}b) ${params.sourcePath} -> ${targetPath} in ${lastValue.elapsed}ms`
                    ),
                error: (err) => this.logger.error(`ERR: `, err),
            });
    }
}
