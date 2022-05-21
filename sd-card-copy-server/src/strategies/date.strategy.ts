import { TokenReplacementStrategy } from '../contracts';
import { TimestampProvider } from '../providers';
import { format } from 'date-fns';
import { Injectable } from '@nestjs/common';

export const TIMESTAMP_TOKEN = 'TIMESTAMP';
export const DATE_TOKEN = 'DATE';

@Injectable()
export class DateStrategies {
    constructor(private readonly timestampProvider: TimestampProvider) {}

    private readonly _timestampStrategy: TokenReplacementStrategy = (token) => {
        if (token !== TIMESTAMP_TOKEN) {
            return undefined;
        }

        return this.timestampProvider.getTimeStamp().toString();
    };

    public get timestampStrategy(): TokenReplacementStrategy {
        return this._timestampStrategy.bind(this);
    }

    private readonly _formattedDateStrategy: TokenReplacementStrategy = (token, tokenArguments) => {
        if (token !== DATE_TOKEN) {
            return undefined;
        }

        const dateFormat = tokenArguments?.[0];
        const now = new Date(this.timestampProvider.getTimeStamp());

        if (dateFormat != null && dateFormat.length > 0) {
            return format(now, dateFormat);
        }

        return now.toDateString();
    };

    public get formattedDateStrategy(): TokenReplacementStrategy {
        return this._formattedDateStrategy.bind(this);
    }
}
