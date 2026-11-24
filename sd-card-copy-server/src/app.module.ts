import { Logger, Module } from '@nestjs/common';
import { CopyPathController } from './controllers/start-copy.controller';
import { CopyService } from './services/copy.service';
import { ConfigService, SessionService } from './services';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from 'nestjs-logging-interceptor';
import { DateStrategies } from './strategies';
import { TimestampProvider } from './providers';

@Module({
    controllers: [CopyPathController],
    providers: [
        CopyService,
        ConfigService,
        SessionService,
        Logger,
        {
            provide: APP_INTERCEPTOR,
            useValue: new LoggingInterceptor(LoggingInterceptor.name),
        },
        DateStrategies,
        TimestampProvider,
    ],
})
export class AppModule {}
