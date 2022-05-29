import { resolve, isAbsolute } from 'path';

export function getPath(path: string): string {
    if (isAbsolute(path)) {
        return path;
    }
    return resolve('../data', path);
}
