import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as winston from 'winston';
import { LoggingInterceptor } from '@algoan/nestjs-logging-interceptor';

async function bootstrap() {
    const port = process.env.port != null ? parseInt(process.env.port) : 3000;

    const logger = WinstonModule.createLogger({
        transports: [new DailyRotateFile({ filename: 'data/logs/log.txt' }), new winston.transports.Console()],
    });

    const app = await NestFactory.create(AppModule, {
        logger,
    });

    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.listen(port);

    logger.log(`Application started on port ${port}`);
}
bootstrap();
