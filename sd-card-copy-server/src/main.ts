import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Logger } from '@nestjs/common';

async function bootstrap() {
    const port = process.env.port != null ? parseInt(process.env.port) : 3000;

    const app = await NestFactory.create(AppModule);
    const logger = app.get<string, Logger>(WINSTON_MODULE_NEST_PROVIDER);
    app.useLogger(logger);
    await app.listen(port);

    logger.log(`Application started on port ${port}`);
}
bootstrap();
