import cluster from 'cluster';

export function printWorkerId(message: string): string {
    return cluster.worker != null ? `${message} (worker:${cluster.worker.id})` : message;
}
