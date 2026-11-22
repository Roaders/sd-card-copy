import { resolve, isAbsolute, relative, sep } from 'path';

/**
 * true if path is one of the parent paths or is inside one of them
 */
export function isWithinPaths(path: string, parentPaths: string[]): boolean {
    return parentPaths.some((parentPath) => {
        const relativePath = relative(resolve(parentPath), resolve(path));
        return relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
    });
}

export function getPath(path: string): string {
    if (isAbsolute(path)) {
        return path;
    }
    return resolve('../data', path);
}
