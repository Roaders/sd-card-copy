import { Logger, Module } from '@nestjs/common';
import { CopyPathController } from './controllers/start-copy.controller';
import { StatusController } from './controllers/status.controller';
import { CopyService } from './services/copy.service';
import { ConfigService, SessionService } from './services';
import { DateStrategies } from './strategies';
import { TimestampProvider } from './providers';

@Module({
    controllers: [CopyPathController, StatusController],
    providers: [CopyService, ConfigService, SessionService, Logger, DateStrategies, TimestampProvider],
})
export class AppModule {}
