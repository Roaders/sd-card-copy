import { config } from 'dotenv';
import { getPath } from './helpers';

config({ path: getPath('.env'), quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import winston, { format } from 'winston';

async function bootstrap() {
    const logPath = process.env.logPath || 'logs/log.txt';
    const transports: winston.transport[] = [];

    if (process.env.logType != 'console') {
        transports.push(new DailyRotateFile({ filename: getPath(logPath) }));
    }
    if (process.env.logType != 'file') {
        transports.push(new winston.transports.Console());
    }

    const logger = WinstonModule.createLogger({
        transports,
        format: format.combine(format.timestamp(), format.json()),
    });

    const port = process.env.port != null ? parseInt(process.env.port) : 3000;

    const app = await NestFactory.create(AppModule, {
        logger,
    });

    await app.listen(port);

    logger.log(`Application started on port ${port}`);
}

bootstrap();
