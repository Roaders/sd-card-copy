import { Module } from '@nestjs/common';
import { AppController } from './controllers/start-copy.controller';
import { CopyService } from './services/copy.service';
import { WinstonModule } from 'nest-winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as winston from 'winston';
import { ConfigService } from './services';

@Module({
    imports: [
        WinstonModule.forRoot({
            level: 'debug',
            transports: [new DailyRotateFile({ filename: 'data/logs/log.txt' }), new winston.transports.Console()],
        }),
    ],
    controllers: [AppController],
    providers: [CopyService, ConfigService],
})
export class AppModule {}
