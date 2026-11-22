import { getMountSource, getUsbDeviceFolder, getUsbPort } from './usb.helper';

describe(`usb.helper`, () => {
    describe(`getMountSource`, () => {
        const mountInfo = [
            '25 1 179:2 / / rw,noatime shared:1 - ext4 /dev/root rw',
            '412 30 8:1 / /media/usb0 rw,nodev,noexec shared:250 - vfat /dev/sda1 rw,uid=0',
            '413 30 8:17 / /media/usb1 rw,nodev,noexec shared:251 - exfat /dev/sdb1 rw,uid=0',
            '414 30 8:33 / /media/usb10 rw,nodev,noexec shared:252 - exfat /dev/sdc1 rw,uid=0',
            '',
        ].join('\n');

        it(`should return the source of the mount point, not a mount point it is a prefix of`, () => {
            expect(getMountSource(mountInfo, '/media/usb1')).toBe('/dev/sdb1');
        });

        it(`should ignore a trailing slash`, () => {
            expect(getMountSource(mountInfo, '/media/usb0/')).toBe('/dev/sda1');
        });

        it(`should return the latest mount when two are mounted on the same point`, () => {
            const remounted = `${mountInfo}415 30 8:49 / /media/usb0 rw shared:253 - vfat /dev/sdd1 rw\n`;
            expect(getMountSource(remounted, '/media/usb0')).toBe('/dev/sdd1');
        });

        it(`should return undefined when nothing is mounted there`, () => {
            expect(getMountSource(mountInfo, '/media/usb2')).toBeUndefined();
        });
    });

    describe(`getUsbDeviceFolder`, () => {
        it(`should return the device folder rather than the interface or a parent hub`, () => {
            const path =
                '/sys/devices/platform/scb/fd500000.pcie/pci0000:00/0000:00:00.0/0000:01:00.0/usb2/2-2/2-2.4/2-2.4:1.0/host0/target0:0:0/0:0:0:0/block/sda/sda1';
            expect(getUsbDeviceFolder(path)).toBe(
                '/sys/devices/platform/scb/fd500000.pcie/pci0000:00/0000:00:00.0/0000:01:00.0/usb2/2-2/2-2.4'
            );
        });

        it(`should return undefined for a block device that is not on USB`, () => {
            expect(
                getUsbDeviceFolder(
                    '/sys/devices/platform/emmc2bus/fe340000.mmc/mmc_host/mmc0/mmc0:aaaa/block/mmcblk0/mmcblk0p2'
                )
            ).toBeUndefined();
        });
    });

    describe(`getUsbPort`, () => {
        const tests: { device: string; hub: string; port: string }[] = [
            { device: '2-2.4', hub: '2-2', port: '4' },
            { device: '1-1.2.3', hub: '1-1.2', port: '3' },
            { device: '2-1', hub: '2', port: '1' },
            { device: '1-1.12', hub: '1-1', port: '12' },
        ];

        tests.forEach(({ device, hub, port }) => {
            it(`should return hub ${hub} port ${port} for ${device}`, () => {
                expect(getUsbPort(device)).toEqual({ hub, port });
            });
        });
    });
});
