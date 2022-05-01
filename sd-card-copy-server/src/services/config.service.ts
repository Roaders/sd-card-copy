import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { IAppConfig } from '../contracts';
import { promisify } from 'util';
import { readFile } from 'fs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const asyncReadFile = promisify(readFile);

@Injectable()
export class ConfigService {
    constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

    private _config: IAppConfig | undefined;

    public async getConfig(): Promise<IAppConfig> {
        if (this._config != null) {
            return this._config;
        }

        const configPath = process.env.configPath;

        let configFile: Partial<IAppConfig> = {};

        if (configPath != null) {
            this.logger.log(`Loading config from '${configPath}'`);
            const rawFile = await asyncReadFile(configPath);

            configFile = JSON.parse(rawFile.toString());
        }

        this._config = configFile;

        return configFile;
    }
}
