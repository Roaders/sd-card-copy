/**
 * Types returned by the status API, shared with the UI
 */

export type CopySessionState = 'scanning' | 'copying' | 'deleting' | 'complete' | 'failed' | 'refused';

export type CopyFileState = 'pending' | 'copying' | 'complete' | 'failed';

export interface ICopyFile {
    path: string; // relative to the session's source path
    size: number;
    copiedBytes: number;
    state: CopyFileState;
    speed?: number; // bytes per second, while copying
}

/**
 * The copy of one drive
 */
export interface ICopySession {
    id: number;
    sourcePath: string;
    targetPath?: string;
    deleteSource: boolean;
    state: CopySessionState;
    message?: string; // why the session failed or was refused
    started: number;
    finished?: number;
    files: ICopyFile[];
}

export interface IStatus {
    activeSessions: ICopySession[]; // newest first
    completedCount: number;
    lastCompletedId?: number; // changes whenever a session finishes, even once the completed list is full
    totalSpeed: number; // bytes per second of every file being copied
}

export interface ILogEntry {
    timestamp: string;
    level: string;
    context?: string;
    message: string;
}

export interface ICompletedSessions {
    sessions: ICopySession[]; // newest first
    total: number;
}
