import type { UsbDevice } from '../helpers';

const mocks = vi.hoisted(() => ({
    waits: [] as { ms: number; resolve: () => void }[],
    commands: [] as string[],
    devices: {} as Record<string, UsbDevice>,
}));

vi.mock('timers/promises', () => ({
    setTimeout: (ms: number) => new Promise<void>((resolve) => mocks.waits.push({ ms, resolve })),
}));

vi.mock('child_process', () => ({
    execFile: (command: string, ...rest: unknown[]) => {
        const args = rest.length > 1 ? (rest[0] as string[]) : [];
        mocks.commands.push([command, ...args].join(' '));
        (rest[rest.length - 1] as (err: null, stdout: string) => void)(null, '');
    },
}));

vi.mock('fs/promises', async (importOriginal) => ({
    ...(await importOriginal<typeof import('fs/promises')>()),
    writeFile: async (path: string, content: string) => {
        mocks.commands.push(`write ${content} > ${path}`);
    },
}));

vi.mock('../helpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helpers')>()),
    getUsbDevice: async (path: string) => mocks.devices[path],
}));

import { insta360PowerCycle } from './insta360.strategy';
import { garminPowerCycle } from './garmin.strategy';

describe('usbPowerCycle', () => {
    const camera = { vendorId: '2e1a', hub: '2-1.4', port: '4', sysfsPath: '/sys/devices/usb2/2-1/2-1.4/2-1.4.4' };
    const powerCycle = insta360PowerCycle({ offMinutes: 5 });
    const settled = () => vi.waitFor(() => expect(mocks.waits.length).toBeGreaterThan(0));
    const nextWait = async () => {
        await settled();
        return mocks.waits.shift()!;
    };

    beforeEach(() => {
        mocks.waits.length = 0;
        mocks.commands.length = 0;
        mocks.devices = {
            '/media/usb0': camera,
            '/media/usb1': camera,
            '/media/usb2': { vendorId: '056e', hub: '2-1', port: '1', sysfsPath: '/sys/devices/usb2/2-1/2-1.1' },
            '/media/usb3': {
                vendorId: '091e',
                hub: '2-1.4',
                port: '3',
                sysfsPath: '/sys/devices/usb2/2-1/2-1.4/2-1.4.3',
            },
        };
    });

    it(`waits for the camera's other drive, then turns the port off for offMinutes and back on`, async () => {
        let active = ['/media/usb1', '/media/usb2'];
        const params = (sourcePath: string) => ({ sourcePath, targetPath: '/mnt', deleteSource: true });

        // internal drive refused straight away while the SD card is still copying
        const first = powerCycle(params('/media/usb0'), () => active);
        // the SD card's own action while the first is waiting does not start a second cycle
        const duplicate = powerCycle(params('/media/usb1'), () => active);
        await duplicate;

        const firstSettle = await nextWait();
        expect(firstSettle.ms).toBe(60 * 1000);
        firstSettle.resolve();
        await first;
        expect(mocks.commands).toEqual([]);

        // SD card finishes; only the card reader on another port is still copying
        active = ['/media/usb2'];
        const last = powerCycle(params('/media/usb1'), () => active);
        (await nextWait()).resolve();

        const off = await nextWait();
        expect(off.ms).toBe(5 * 60 * 1000);
        expect(mocks.commands).toEqual([
            'sync',
            `write 0 > ${camera.sysfsPath}/authorized`,
            'uhubctl -l 2-1.4 -p 4 -a off',
        ]);

        off.resolve();
        await last;
        expect(mocks.commands.at(-1)).toBe('uhubctl -l 2-1.4 -p 4 -a on');
    });

    it(`turns a Garmin camera's port off for 7 minutes by default, leaving the Insta360 alone`, async () => {
        const garmin = garminPowerCycle();
        await garmin({ sourcePath: '/media/usb0', targetPath: '/mnt', deleteSource: true }, () => []);
        expect(mocks.waits).toEqual([]);

        const cycle = garmin({ sourcePath: '/media/usb3', targetPath: '/mnt', deleteSource: true }, () => []);
        (await nextWait()).resolve();
        const off = await nextWait();

        expect(off.ms).toBe(7 * 60 * 1000);
        expect(mocks.commands.at(-1)).toBe('uhubctl -l 2-1.4 -p 3 -a off');
        off.resolve();
        await cycle;
        expect(mocks.commands.at(-1)).toBe('uhubctl -l 2-1.4 -p 3 -a on');
    });

    it('does nothing for a drive that is not an Insta360 or when the source is not deleted', async () => {
        await powerCycle({ sourcePath: '/media/usb2', targetPath: '/mnt', deleteSource: true }, () => []);
        await powerCycle({ sourcePath: '/media/usb3', targetPath: '/mnt', deleteSource: true }, () => []);
        await powerCycle({ sourcePath: '/media/usb0', targetPath: '/mnt', deleteSource: false }, () => []);

        expect(mocks.waits).toEqual([]);
        expect(mocks.commands).toEqual([]);
    });
});
