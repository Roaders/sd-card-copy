import { config } from 'dotenv';
import { getPath } from './helpers';

config({ path: getPath('.env'), quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import winston, { format } from 'winston';
import { createServer } from 'http';
import { LogBufferTransport } from './log-buffer';
import { join } from 'path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * the UI's page and assets, and the status API
 */
const statusPaths = /^\/(index\.html)?$|^\/assets\/|^\/api\//;

async function bootstrap() {
    const logPath = process.env.logPath || 'logs/log.txt';
    const transports: winston.transport[] = [new LogBufferTransport()];

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
    const statusPort = process.env.statusPort != null ? parseInt(process.env.statusPort) : 3001;

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger,
    });

    // the status port can be opened to the network as it only serves the status UI and API, which can't change anything
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.socket.localPort === statusPort && (req.method !== 'GET' || !statusPaths.test(req.path))) {
            res.status(404).end();
            return;
        }
        next();
    });
    // built by sd-card-copy-ui
    app.useStaticAssets(join(__dirname, '../ui'));

    await app.listen(port);
    createServer(app.getHttpAdapter().getInstance()).listen(statusPort);

    logger.log(`Application started on port ${port}, status on port ${statusPort}`);
}

bootstrap();
