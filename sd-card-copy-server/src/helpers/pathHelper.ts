import { join } from 'path';

export function getPath(relativePath: string): string {
    return join(process.cwd(), '../data', relativePath);
}
