import cluster from "cluster";

export function printWorkerId(): string{
    return cluster.worker != null ? ` (worker:${cluster.worker.id})` : ''
}