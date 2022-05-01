import { Controller, Get, HttpException, HttpStatus, Inject, LoggerService, Query } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CopyParams } from '../contracts';
import { ConfigService } from '../services';
import { CopyService } from '../services/copy.service';

@Controller('copy-path')
export class AppController {
    constructor(
        private readonly copyService: CopyService,
        private readonly configService: ConfigService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
    ) {}

    @Get()
    public async copyPath(@Query('source-path') sourcePath?: string, @Query('target-path') targetPath?: string) {
        const params = await this.sanitiseParams({ sourcePath, targetPath });
        this.copyService.startCopy(params);
    }

    private async sanitiseParams(params: Partial<CopyParams>): Promise<CopyParams> {
        const sourcePath = params.sourcePath;
        if (sourcePath == null) {
            throw new HttpException('source-path must be provided as a query param', HttpStatus.BAD_REQUEST);
        }

        const targetPath = params.targetPath || (await this.configService.getConfig()).targetPath;

        if (targetPath == null) {
            const message =
                'target-path must be provided as a query param if it is not provided in the config file at app startup';
            this.logger.warn(message);
            throw new HttpException(message, HttpStatus.BAD_REQUEST);
        }

        return { sourcePath, targetPath };
    }
}
