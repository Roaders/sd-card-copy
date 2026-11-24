import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import { auditTime, interval, map, merge, Observable, startWith } from 'rxjs';
import { SessionService } from '../services';
import type { ICompletedSessions } from '../status.contracts';

/**
 * Read only status of the copies, served on the status port as well as the main port
 */
@Controller('api')
export class StatusController {
    constructor(private readonly sessionService: SessionService) {}

    /**
     * IStatus every second (for speeds) and whenever a session or file changes
     */
    @Sse('status')
    public status(): Observable<MessageEvent> {
        return merge(interval(1000), this.sessionService.changes.pipe(auditTime(200))).pipe(
            startWith(0),
            map(() => ({ data: this.sessionService.getStatus() }))
        );
    }

    @Get('sessions/completed')
    public completed(@Query('offset') offset?: string, @Query('limit') limit?: string): ICompletedSessions {
        const start = Math.max(0, parseInt(offset ?? '') || 0);
        const count = Math.min(100, Math.max(1, parseInt(limit ?? '') || 10));
        return this.sessionService.getCompleted(start, count);
    }
}
