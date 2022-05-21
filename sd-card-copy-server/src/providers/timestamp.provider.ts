import { Injectable } from '@nestjs/common';

/**
 * This class is just here to be replaced with a mock version when testing
 */
@Injectable()
export class TimestampProvider {
    public getTimeStamp(): number {
        return Date.now();
    }
}
