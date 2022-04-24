import { Module } from '@nestjs/common';
import { AppController } from './controllers/start-copy.controller';
import { CopyService } from './services/copy.service';

@Module({
    imports: [],
    controllers: [AppController],
    providers: [CopyService],
})
export class AppModule {}
