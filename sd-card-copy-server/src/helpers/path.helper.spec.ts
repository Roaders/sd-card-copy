import { join, resolve } from 'path';
import { mkdir, mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { createUniqueFolder, isWithinPaths } from './path.helper';

describe('createUniqueFolder', () => {
    let root: string;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'createUniqueFolder-'));
    });

    afterEach(() => rm(root, { recursive: true, force: true }));

    it('creates the folder and any missing parents when it does not exist', async () => {
        const target = join(root, '2026', 'Insta360_X6');

        expect(await createUniqueFolder(target)).toBe(target);
        expect(await readdir(join(root, '2026'))).toEqual(['Insta360_X6']);
    });

    it('appends the next free number when the folder and earlier numbers exist', async () => {
        await mkdir(join(root, 'cam'));
        await mkdir(join(root, 'cam-2'));
        await mkdir(join(root, 'camera'));

        expect(await createUniqueFolder(join(root, 'cam'))).toBe(join(root, 'cam-3'));
    });

    it('numbers the folder rather than nesting inside it when given a trailing separator', async () => {
        await mkdir(join(root, 'cam'));

        expect(await createUniqueFolder(join(root, 'cam') + '/')).toBe(join(root, 'cam-2'));
    });

    it('gives copies started together different folders', async () => {
        const target = join(root, 'cam');
        const folders = await Promise.all([createUniqueFolder(target), createUniqueFolder(target)]);

        expect(folders.sort()).toEqual([target, `${target}-2`]);
    });
});

describe('isWithinPaths', () => {
    const media = resolve('/media');

    it.each([
        ['the allowed path itself', '/media', true],
        ['a path inside an allowed path', '/media/usb0/DCIM', true],
        ['an allowed path with a trailing separator', '/media/usb0/', true],
        ['a folder whose name starts with ..', '/media/..hidden', true],
        ['a sibling sharing the allowed path as a prefix', '/media2/usb0', false],
        ['a parent of the allowed path', '/', false],
        ['a path that escapes with ..', '/media/usb0/../../mnt/archive', false],
        ['an unrelated path', '/mnt/archive', false],
    ])('%s', (_, path, expected) => {
        expect(isWithinPaths(resolve(path), [media])).toBe(expected);
    });

    it('matches any of several allowed paths', () => {
        expect(isWithinPaths(resolve('/mnt/cards/sd1'), [media, resolve('/mnt/cards')])).toBe(true);
    });

    it('rejects everything when no paths are allowed', () => {
        expect(isWithinPaths(media, [])).toBe(false);
    });
});
