import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const port = process.env.port != null ? parseInt(process.env.port) : 3000;

    const app = await NestFactory.create(AppModule);
    await app.listen(port);

    console.log(`Application started on ${port}`);
}
bootstrap();
