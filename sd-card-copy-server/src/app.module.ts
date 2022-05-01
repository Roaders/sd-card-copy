import { Logger, Module } from '@nestjs/common';
import { CopyPathController } from './controllers/start-copy.controller';
import { CopyService } from './services/copy.service';
import { ConfigService } from './services';

@Module({
    controllers: [CopyPathController],
    providers: [CopyService, ConfigService, Logger],
})
export class AppModule {}
