import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import { relative } from 'path';
import { CopyParams } from '../contracts';
import {
    CopySessionState,
    ICompletedSessions,
    ICopyFile,
    ICopySession,
    ISpeedHistory,
    IStatus,
    SpeedSample,
} from '../status.contracts';

const maxCompletedSessions = 100;

/**
 * Speeds are recorded this often for the graphs
 */
const speedSampleMs = 1000;

/**
 * How long the total speed is kept for. Each active session keeps its speed for the whole session.
 */
const totalSpeedHistoryMs = 30 * 60 * 1000;

/**
 * File speeds are measured over this period so they follow the current speed rather than the average since the start
 */
const speedWindowMs = 3000;

type FileProgress = ICopyFile & { samples: { time: number; bytes: number }[] };

/**
 * Records the progress of copying one drive
 */
export class CopySession {
    private readonly files = new Map<string, FileProgress>();
    private state: CopySessionState = 'scanning';
    private targetPath: string | undefined;
    private message: string | undefined;
    private readonly started = Date.now();
    private finished: number | undefined;
    public readonly speedHistory: SpeedSample[] = [];

    constructor(
        public readonly id: number,
        private readonly params: CopyParams,
        private readonly onChange: () => void,
        private readonly onFinish: (session: CopySession) => void
    ) {}

    public setTargetPath(targetPath: string) {
        this.targetPath = targetPath;
        this.onChange();
    }

    public addFile(source: string, size: number) {
        const path = relative(this.params.sourcePath, source);
        this.files.set(source, { path, size, copiedBytes: 0, state: 'pending', samples: [] });
        this.onChange();
    }

    public startFile(source: string) {
        this.updateFile(source, (file) => {
            file.state = 'copying';
            file.samples = [{ time: Date.now(), bytes: 0 }];
        });
        this.state = 'copying';
        this.onChange();
    }

    /**
     * Not reported as a change: progress is picked up when the status is next read
     */
    public addBytes(source: string, bytes: number) {
        this.updateFile(source, (file) => {
            const now = Date.now();
            file.copiedBytes += bytes;
            file.samples.push({ time: now, bytes: file.copiedBytes });
            // keep the last sample from before the window as the starting point
            while (file.samples.length > 1 && file.samples[1].time <= now - speedWindowMs) {
                file.samples.shift();
            }
        });
    }

    public completeFile(source: string) {
        this.endFile(source, 'complete');
    }

    public failFile(source: string) {
        this.endFile(source, 'failed');
    }

    public deleting() {
        this.state = 'deleting';
        this.onChange();
    }

    public finish(state: 'complete' | 'failed' | 'refused', message?: string) {
        if (this.finished != null) {
            return;
        }
        this.state = state;
        this.message = message;
        this.finished = Date.now();
        this.onFinish(this);
    }

    public toJSON(): ICopySession {
        const now = Date.now();

        return {
            id: this.id,
            sourcePath: this.params.sourcePath,
            targetPath: this.targetPath,
            deleteSource: this.params.deleteSource,
            state: this.state,
            message: this.message,
            started: this.started,
            finished: this.finished,
            files: [...this.files.values()].map(({ samples, ...file }) => {
                if (file.state !== 'copying') {
                    return file;
                }
                // the last sample from before the window, so a file that has stopped receiving data slows to 0
                const start = samples.findLast((sample) => sample.time <= now - speedWindowMs) ?? samples[0];
                const elapsed = now - start.time;
                return { ...file, speed: elapsed > 0 ? ((file.copiedBytes - start.bytes) / elapsed) * 1000 : 0 };
            }),
        };
    }

    private endFile(source: string, state: 'complete' | 'failed') {
        this.updateFile(source, (file) => {
            file.state = state;
            file.samples = [];
        });
        this.onChange();
    }

    private updateFile(source: string, update: (file: FileProgress) => void) {
        const file = this.files.get(source);
        if (file != null) {
            update(file);
        }
    }
}

/**
 * Keeps the copy sessions in memory: the ones running and the last 100 completed
 */
@Injectable()
export class SessionService implements OnModuleDestroy {
    private nextId = 1;
    private readonly totalSpeedHistory: SpeedSample[] = [];
    private readonly sampleTimer = setInterval(() => this.sampleSpeeds(), speedSampleMs);
    private readonly activeSessions: CopySession[] = [];
    private readonly completedSessions: ICopySession[] = [];

    /**
     * emits when a session starts, finishes or changes state, or a file is found, starts or finishes
     */
    public readonly changes = new Subject<void>();

    public start(params: CopyParams): CopySession {
        const session = new CopySession(
            this.nextId++,
            params,
            () => this.changes.next(),
            (finished) => this.finish(finished)
        );
        this.activeSessions.unshift(session);
        this.changes.next();
        return session;
    }

    public getStatus(): IStatus {
        const activeSessions = this.activeSessions.map((session) => session.toJSON());
        const totalSpeed = activeSessions.reduce((total, session) => total + sessionSpeed(session), 0);

        return {
            time: Date.now(),
            activeSessions,
            completedCount: this.completedSessions.length,
            lastCompletedId: this.completedSessions[0]?.id,
            totalSpeed,
        };
    }

    public getCompleted(offset: number, limit: number): ICompletedSessions {
        return {
            sessions: this.completedSessions.slice(offset, offset + limit),
            total: this.completedSessions.length,
        };
    }

    /**
     * The recorded speeds for the graphs. The status gives the latest speeds to add to them.
     */
    public getSpeedHistory(): ISpeedHistory {
        return {
            total: this.totalSpeedHistory,
            sessions: Object.fromEntries(this.activeSessions.map((session) => [session.id, session.speedHistory])),
        };
    }

    public onModuleDestroy() {
        clearInterval(this.sampleTimer);
    }

    private sampleSpeeds() {
        const { time, activeSessions, totalSpeed } = this.getStatus();
        activeSessions.forEach((snapshot, index) =>
            this.activeSessions[index].speedHistory.push([time, sessionSpeed(snapshot)])
        );
        this.totalSpeedHistory.push([time, totalSpeed]);
        while (this.totalSpeedHistory[0][0] <= time - totalSpeedHistoryMs) {
            this.totalSpeedHistory.shift();
        }
    }

    private finish(session: CopySession) {
        this.activeSessions.splice(this.activeSessions.indexOf(session), 1);
        this.completedSessions.unshift(session.toJSON());
        this.completedSessions.splice(maxCompletedSessions);
        this.changes.next();
    }
}

function sessionSpeed(session: ICopySession): number {
    return session.files.reduce((total, file) => total + (file.speed ?? 0), 0);
}
