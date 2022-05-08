import { Logger, Module } from '@nestjs/common';
import { CopyPathController } from './controllers/start-copy.controller';
import { CopyService } from './services/copy.service';
import { ConfigService } from './services';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from 'nestjs-logging-interceptor';

@Module({
    controllers: [CopyPathController],
    providers: [
        CopyService,
        ConfigService,
        Logger,
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
    ],
})
export class AppModule {}
