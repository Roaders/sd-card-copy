import { ReplaySubject } from 'rxjs';
import TransportStream from 'winston-transport';
import { ILogEntry } from './status.contracts';

/**
 * The last 500 log entries for the status page's log panel. A new subscriber receives them and then each new entry.
 */
export const logEntries = new ReplaySubject<ILogEntry>(500);

/**
 * Winston transport that writes to logEntries
 */
export class LogBufferTransport extends TransportStream {
    public log(info: { timestamp?: string; level: string; context?: string; message: unknown }, next: () => void) {
        logEntries.next({
            timestamp: info.timestamp ?? new Date().toISOString(),
            level: info.level,
            context: info.context,
            message: typeof info.message === 'string' ? info.message : JSON.stringify(info.message),
        });
        next();
    }
}
