import { Injectable, Logger } from '@nestjs/common';
import { IAppConfig } from '../contracts';
import { promisify } from 'util';
import { readFile } from 'fs';
import { resolve } from 'path';

const asyncReadFile = promisify(readFile);

const defaultConfigPath = 'data/config.json';

@Injectable()
export class ConfigService {
    private logger = new Logger(ConfigService.name);

    private _config: IAppConfig | undefined;

    public async getConfig(): Promise<IAppConfig> {
        if (this._config != null) {
            return this._config;
        }

        const configPath = resolve(process.env.configPath || defaultConfigPath);

        let configFile: Partial<IAppConfig> = {};

        if (configPath != null) {
            try {
                const rawFile = await asyncReadFile(configPath);
                configFile = JSON.parse(rawFile.toString());
                this.logger.log(`Config loaded from '${configPath}'`);
            } catch (e) {
                if (configPath != resolve(defaultConfigPath)) {
                    this.logger.warn(
                        `Could not load config file from '${configPath}'. Continuing with default config.`
                    );
                }
            }
        }

        this._config = configFile;

        return configFile;
    }
}
