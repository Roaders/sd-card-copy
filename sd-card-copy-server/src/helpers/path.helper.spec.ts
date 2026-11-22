import { resolve } from 'path';
import { isWithinPaths } from './path.helper';

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
