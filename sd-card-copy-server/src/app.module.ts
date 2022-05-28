import { Logger, Module } from '@nestjs/common';
import { CopyPathController } from './controllers/start-copy.controller';
import { CopyService } from './services/copy.service';
import { ConfigService } from './services';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from 'nestjs-logging-interceptor';
import { DateStrategies } from './strategies';
import { TimestampProvider } from './providers';
import cluster from "cluster"

@Module({
    controllers: [CopyPathController],
    providers: [
        CopyService,
        ConfigService,
        Logger,
        {
            provide: APP_INTERCEPTOR,
            useValue: new LoggingInterceptor({context: cluster.worker != null ?  `worker:${cluster.worker?.id}` : undefined}),
        },
        DateStrategies,
        TimestampProvider,
    ],
})
export class AppModule {}
