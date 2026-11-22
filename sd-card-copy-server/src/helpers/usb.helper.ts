import { readFile, realpath } from 'fs/promises';
import { basename, posix } from 'path';

export type UsbPort = {
    hub: string; // uhubctl location of the hub, e.g. 2-2
    port: string; // port on that hub, e.g. 4
};

export type UsbDevice = UsbPort & {
    vendorId: string;
    sysfsPath: string; // folder of the device in /sys/devices
};

/**
 * Finds the USB device a drive is mounted from and the hub port it is plugged into, using /proc and /sys (Linux only).
 * Returns undefined when the mount point is not a USB drive.
 */
export async function getUsbDevice(mountPoint: string): Promise<UsbDevice | undefined> {
    const mountInfo = await readFile('/proc/self/mountinfo', 'utf8').catch(() => undefined);
    const source = mountInfo != null ? getMountSource(mountInfo, mountPoint) : undefined;

    if (source == null) {
        return undefined;
    }

    // e.g. /sys/devices/platform/scb/fd500000.pcie/pci0000:00/0000:00:00.0/0000:01:00.0/usb2/2-2/2-2.4/2-2.4:1.0/host0/target0:0:0/0:0:0:0/block/sda/sda1
    const sysfsPath = await realpath(`/sys/class/block/${basename(source)}`).catch(() => undefined);
    const device = sysfsPath != null ? getUsbDeviceFolder(sysfsPath) : undefined;

    if (device == null) {
        return undefined;
    }

    const vendorId = await readFile(posix.join(device, 'idVendor'), 'utf8').catch(() => undefined);

    return vendorId != null
        ? { vendorId: vendorId.trim(), sysfsPath: device, ...getUsbPort(basename(device)) }
        : undefined;
}

/**
 * Returns the source (e.g. /dev/sda1) of the mount at mountPoint from the contents of /proc/self/mountinfo
 */
export function getMountSource(mountInfo: string, mountPoint: string): string | undefined {
    const target = posix.resolve(mountPoint);
    let source: string | undefined;

    for (const line of mountInfo.split('\n')) {
        // 412 30 8:17 / /media/usb1 rw,nodev,noexec shared:250 - exfat /dev/sdb1 rw,uid=0
        const [mountFields, filesystemFields] = line.split(' - ');
        if (filesystemFields != null && mountFields.split(' ')[4] === target) {
            // a later mount over the same point hides earlier ones
            source = filesystemFields.split(' ')[1];
        }
    }

    return source;
}

/**
 * Returns the folder of the USB device (2-2.4) in a sysfs block device path rather than its interface (2-2.4:1.0)
 */
export function getUsbDeviceFolder(sysfsPath: string): string | undefined {
    const segments = sysfsPath.split('/');
    const index = segments.findLastIndex((segment) => /^\d+-\d+(\.\d+)*$/.test(segment));

    return index >= 0 ? segments.slice(0, index + 1).join('/') : undefined;
}

/**
 * Given a USB device name such as 2-2.4 returns hub 2-2, port 4. A device on a root hub port (2-1) returns hub 2, port 1
 */
export function getUsbPort(deviceName: string): UsbPort {
    const separator = Math.max(deviceName.lastIndexOf('.'), deviceName.lastIndexOf('-'));

    return {
        hub: deviceName.slice(0, separator),
        port: deviceName.slice(separator + 1),
    };
}
