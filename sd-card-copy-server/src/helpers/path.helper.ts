import { resolve, isAbsolute, relative, sep, dirname } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Creates a new folder at path, or at path-2, path-3... if it already exists, and returns the folder created.
 * Creating the folder claims it, so two copies started together never share a folder.
 */
export async function createUniqueFolder(targetPath: string): Promise<string> {
    const path = resolve(targetPath); // drops a trailing separator
    await mkdir(dirname(path), { recursive: true });

    for (let count = 1; ; count++) {
        const folder = count === 1 ? path : `${path}-${count}`;
        try {
            await mkdir(folder);
            return folder;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw err;
            }
        }
    }
}

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
