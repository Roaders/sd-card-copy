import { Controller, Get, HttpException, HttpStatus, Logger, Query, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from 'nestjs-logging-interceptor';
import { CopyParams } from '../contracts';
import { isWithinPaths } from '../helpers';
import { ConfigService } from '../services';
import { CopyService } from '../services/copy.service';

@Controller('copy-path')
@UseInterceptors(new LoggingInterceptor(LoggingInterceptor.name))
export class CopyPathController {
    private logger = new Logger(CopyPathController.name);

    constructor(
        private readonly copyService: CopyService,
        private readonly configService: ConfigService
    ) {}

    @Get()
    public async copyPath(
        @Query('source-path') sourcePath?: string,
        @Query('target-path') targetPath?: string,
        @Query('delete-source') deleteSource?: string
    ) {
        const params = await this.sanitiseParams({ sourcePath, targetPath, deleteSource: deleteSource === 'true' });
        return this.copyService.startCopy(params);
    }

    private async sanitiseParams(params: Partial<CopyParams>): Promise<CopyParams> {
        const sourcePath = params.sourcePath;
        if (sourcePath == null) {
            throw new HttpException('source-path must be provided as a query param', HttpStatus.BAD_REQUEST);
        }

        const config = await this.configService.getConfig();

        if (config.allowedSourcePaths != null && !isWithinPaths(sourcePath, config.allowedSourcePaths)) {
            const message = `source-path '${sourcePath}' is not within allowedSourcePaths`;
            this.logger.warn(message);
            throw new HttpException(message, HttpStatus.BAD_REQUEST);
        }

        const targetPath = params.targetPath || config.targetPath;

        if (targetPath == null) {
            const message =
                'target-path must be provided as a query param if it is not provided in the config file at app startup';
            this.logger.warn(message);
            throw new HttpException(message, HttpStatus.BAD_REQUEST);
        }

        const deleteSource = params.deleteSource ?? false;

        return { sourcePath, targetPath, deleteSource };
    }
}
