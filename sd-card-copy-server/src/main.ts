import { config } from 'dotenv';
import { getPath, printWorkerId } from 'helpers';

config({ path: getPath('.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { cpus } from 'os';
import DailyRotateFile from 'winston-daily-rotate-file';
import winston from 'winston';
import cluster from 'cluster';

async function bootstrap() {
    const logPath = process.env.logPath || 'logs/log.txt';
    const transports: winston.transport[] = [];

    if (process.env.logType != 'console') {
        transports.push(new DailyRotateFile({ filename: getPath(logPath) }));
    }
    if (process.env.logType != 'file') {
        transports.push(new winston.transports.Console());
    }

    const clusterLimit = process.env.clusterLimit != null ? parseInt(process.env.clusterLimit) : NaN;
    const logger = WinstonModule.createLogger({ transports });

    if (cluster.isPrimary && !isNaN(clusterLimit) && clusterLimit > 1) {
        const nodeCount = Math.min(cpus().length, clusterLimit);
        logger.log(`Primary node  starting ${nodeCount} workers...`);

        for (let index = 0; index < nodeCount; index++) {
            cluster.fork();
        }

        return;
    }

    const port = process.env.port != null ? parseInt(process.env.port) : 3000;

    const app = await NestFactory.create(AppModule, {
        logger,
    });

    await app.listen(port);

    logger.log(printWorkerId(`Application started on port ${port}`));
}

bootstrap();
