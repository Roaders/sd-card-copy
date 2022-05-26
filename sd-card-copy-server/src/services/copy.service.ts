import { Injectable, Logger } from '@nestjs/common';
import { CopyParams, TokenReplacementStrategy } from '../contracts';
import copyProgress, {
    configureFileCopyProgressFunction,
    mapFileStats,
    streamScanPathResults,
    isIFilesProgress,
} from 'copy-progress';
import { filter, last, map } from 'rxjs';
import { DateStrategies } from '../strategies';
import { applyTokenReplacementsStrategies } from '../helpers';
import { ConfigService } from './config.service';

@Injectable()
export class CopyService {
    private readonly defaultReplacementStrategies: TokenReplacementStrategy[];
    private replacementStrategies: TokenReplacementStrategy[] | undefined;

    constructor(dateStrategies: DateStrategies, private configService: ConfigService) {
        this.defaultReplacementStrategies = [dateStrategies.formattedDateStrategy, dateStrategies.timestampStrategy];
    }

    private logger = new Logger(CopyService.name);

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

        this.logger.log(`Copying ${params.sourcePath} -> ${targetPath}`);

        const filesStream = streamScanPathResults(params.sourcePath).pipe(
            map((file) => mapFileStats({ file, outDir: targetPath, sourceDir: params.sourcePath }))
        );

        copyProgress(filesStream, {
            concurrentCopy: 1,
            copyFunction: configureFileCopyProgressFunction({ force: true, highWaterMark: 1024 * 1024 }),
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
