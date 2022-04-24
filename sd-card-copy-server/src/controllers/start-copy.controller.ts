import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { CopyParams } from '../contracts';
import { CopyService } from '../services/copy.service';

@Controller('copy-path')
export class AppController {
    constructor(private readonly appService: CopyService) {}

    @Get()
    getHello(@Query('source-path') sourcePath?: string, @Query('target-path') targetPath?: string) {
        this.appService.startCopy(sanitiseParams({ sourcePath, targetPath }));
    }
}

function sanitiseParams(params: Partial<CopyParams>): CopyParams {
    const sourcePath = params.sourcePath;
    if (sourcePath == null) {
        throw new HttpException('source-path must be provided as a query param', HttpStatus.BAD_REQUEST);
    }
    const targetPath = params.targetPath || process.env.targetPath;

    if (targetPath == null) {
        throw new HttpException(
            'target-path must be provided as a query param if it is not provided as an environment variable at app startup',
            HttpStatus.BAD_REQUEST
        );
    }

    return { sourcePath, targetPath };
}
