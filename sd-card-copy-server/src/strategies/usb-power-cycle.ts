import { AfterCopyAction } from '../contracts';
import { getUsbDevice, UsbPort } from '../helpers';
import { Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { writeFile } from 'fs/promises';
import { posix } from 'path';
import { setTimeout } from 'timers/promises';
import { promisify } from 'util';
import ms from 'ms';

const logger = new Logger('UsbPowerCycle');
const execFileAsync = promisify(execFile);

/**
 * How long to wait after a drive has finished before turning the power off: a camera's drives are mounted and
 * requested a few seconds apart, so an empty or refused first drive finishes before the second has started
 */
const SETTLE_MS = 60 * 1000;

/**
 * hub ports with a power cycle waiting or running, so a camera's second drive does not start another
 */
const pendingPorts = new Set<string>();

/**
 * An afterCopy action. When the source is a drive on a camera with the given USB vendor id plugged in over USB and
 * delete-source was set, it turns off the camera's hub port with uhubctl once none of the camera's drives are being
 * copied (whether they were copied, failed or refused), so the camera leaves USB mode and its auto power off turns it
 * off. After offMinutes it turns the port back on so the camera charges. Ejecting the drives is not enough: cameras
 * stay awake while they have USB power. Copies from other ports, such as a card reader, carry on. Needs a hub that
 * supports per-port power switching and the container to have access to /dev/bus/usb and write access to /sys/devices.
 */
export function usbPowerCycle(options: { cameraName: string; vendorId: string; offMinutes: number }): AfterCopyAction {
    const offMs = options.offMinutes * 60 * 1000;

    return async ({ sourcePath, deleteSource }, getActiveSourcePaths) => {
        if (!deleteSource) {
            return;
        }

        const device = await getUsbDevice(sourcePath);

        if (device?.vendorId !== options.vendorId) {
            return;
        }

        const portName = `hub ${device.hub} port ${device.port}`;

        if (pendingPorts.has(portName)) {
            return;
        }

        pendingPorts.add(portName);

        try {
            await setTimeout(SETTLE_MS);

            // a camera can have more than one drive (an Insta360 has internal and SD card): the last one to finish turns the power off
            for (const activePath of getActiveSourcePaths()) {
                const activeDevice = await getUsbDevice(activePath);
                if (activeDevice?.hub === device.hub && activeDevice.port === device.port) {
                    logger.log(`Not powering off ${portName} yet: still copying ${activePath}`);
                    return;
                }
            }

            await execFileAsync('sync');
            logger.log(`Powering off ${options.cameraName} (${sourcePath}) on ${portName} for ${ms(offMs)}`);
            // otherwise kernels before 6.0 turn the port's power straight back on. The camera is authorised again when it reconnects
            await writeFile(posix.join(device.sysfsPath, 'authorized'), '0');
            await setPortPower(device, 'off');
            try {
                await setTimeout(offMs);
            } finally {
                await setPortPower(device, 'on');
                logger.log(`Powered on ${portName}`);
            }
        } finally {
            pendingPorts.delete(portName);
        }
    };
}

async function setPortPower({ hub, port }: UsbPort, action: 'on' | 'off') {
    await execFileAsync('uhubctl', ['-l', hub, '-p', port, '-a', action]);
}
