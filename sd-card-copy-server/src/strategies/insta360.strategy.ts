import { AfterCopyAction, CAMERA_NAME_TOKEN, TokenReplacementStrategy } from '../contracts';
import { getUsbDevice, UsbPort } from '../helpers';
import { Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { posix, resolve } from 'path';
import { setTimeout } from 'timers/promises';
import { promisify } from 'util';
import ms from 'ms';

export const INSTA360_MODEL_TOKEN = 'INSTA360_MODEL';
export const INSTA360_SERIAL_TOKEN = 'INSTA360_SERIAL';

const INSTA360_USB_VENDOR_ID = '2e1a';

const logger = new Logger('Insta360PowerCycle');
const execFileAsync = promisify(execFile);

/**
 * How long to wait after a drive has finished before turning the power off: the camera's drives are mounted and
 * requested a few seconds apart, so an empty or refused first drive finishes before the second has started
 */
const SETTLE_MS = 60 * 1000;

/**
 * hub ports with a power cycle waiting or running, so the camera's second drive does not start another
 */
const pendingPorts = new Set<string>();

/**
 * An afterCopy action. When the source is a drive on an Insta360 camera plugged in over USB and delete-source was set,
 * it turns off the camera's hub port with uhubctl once none of the camera's drives are being copied (whether they were
 * copied, failed or refused), so the camera leaves file transfer mode and goes to sleep. After offMinutes it turns the
 * port back on so the camera charges. Ejecting the drives is not enough: the camera stays awake while it has USB power.
 * Copies from other ports carry on. Needs a hub that supports per-port power switching and the container to have
 * access to /dev/bus/usb and write access to /sys/devices.
 */
export function insta360PowerCycle(options: { offMinutes?: number } = {}): AfterCopyAction {
    const offMs = (options.offMinutes ?? 5) * 60 * 1000;

    return async ({ sourcePath, deleteSource }, getActiveSourcePaths) => {
        if (!deleteSource) {
            return;
        }

        const device = await getUsbDevice(sourcePath);

        if (device?.vendorId !== INSTA360_USB_VENDOR_ID) {
            return;
        }

        const portName = `hub ${device.hub} port ${device.port}`;

        if (pendingPorts.has(portName)) {
            return;
        }

        pendingPorts.add(portName);

        try {
            await setTimeout(SETTLE_MS);

            // the camera has two drives (internal and SD card): the last one to finish turns the power off
            for (const activePath of getActiveSourcePaths()) {
                const activeDevice = await getUsbDevice(activePath);
                if (activeDevice?.hub === device.hub && activeDevice.port === device.port) {
                    logger.log(`Not powering off ${portName} yet: still copying ${activePath}`);
                    return;
                }
            }

            await execFileAsync('sync');
            logger.log(`Powering off Insta360 (${sourcePath}) on ${portName} for ${ms(offMs)}`);
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

/**
 * Index of the recordings on the card written by the camera (seen on an X6).
 * A protobuf message: each field 1 is a recording, whose field 2 holds the camera details:
 * field 1 serial number, field 2 model (e.g. "Insta360 X6"), field 3 firmware
 */
const fileInfoPath = 'DCIM/fileinfo_list.list';

/**
 * Handles INSTA360_MODEL ("Insta360 X6"), INSTA360_SERIAL and CAMERA_NAME ("Insta360_X6_<serial>")
 */
export const insta360Camera: TokenReplacementStrategy = async (
    token: string,
    _tokenArguments: string[] | undefined,
    _token: string,
    _target: string,
    sourcePath: string
) => {
    if (token !== INSTA360_MODEL_TOKEN && token !== INSTA360_SERIAL_TOKEN && token !== CAMERA_NAME_TOKEN) {
        return undefined;
    }

    const camera = await getInsta360Camera(sourcePath);

    if (camera == null) {
        return undefined;
    }

    switch (token) {
        case INSTA360_MODEL_TOKEN:
            return camera.model;
        case INSTA360_SERIAL_TOKEN:
            return camera.serial;
        default:
            return `${camera.model}_${camera.serial}`.replace(/\s+/g, '_');
    }
};

async function getInsta360Camera(sourcePath: string): Promise<{ model: string; serial: string } | undefined> {
    const fileInfo = await readFile(resolve(sourcePath, fileInfoPath)).catch<Buffer | undefined>(() => undefined);

    if (fileInfo == null) {
        return undefined;
    }

    try {
        const recording = getField(fileInfo, 1);
        const details = recording != null ? getField(recording, 2) : undefined;
        const serial = details != null ? getField(details, 1)?.toString() : undefined;
        const model = details != null ? getField(details, 2)?.toString() : undefined;

        return serial && model ? { serial, model } : undefined;
    } catch {
        // not the format we expect
        return undefined;
    }
}

/**
 * Returns the first length-delimited (string or message) protobuf field with the given number
 */
function getField(message: Buffer, fieldNumber: number): Buffer | undefined {
    let position = 0;

    const readVarint = () => {
        let value = 0;
        let multiplier = 1;
        for (;;) {
            if (position >= message.length) {
                throw new Error('Unexpected end of protobuf message');
            }
            const byte = message[position++];
            value += (byte & 0x7f) * multiplier;
            if ((byte & 0x80) === 0) {
                return value;
            }
            multiplier *= 128;
        }
    };

    while (position < message.length) {
        const key = readVarint();
        const field = Math.floor(key / 8);
        const wireType = key % 8;

        switch (wireType) {
            case 0:
                readVarint();
                break;
            case 1:
                position += 8;
                break;
            case 5:
                position += 4;
                break;
            case 2: {
                const length = readVarint();
                if (position + length > message.length) {
                    throw new Error('Protobuf field runs past the end of the message');
                }
                const value = message.subarray(position, position + length);
                position += length;
                if (field === fieldNumber) {
                    return value;
                }
                break;
            }
            default:
                throw new Error(`Unsupported protobuf wire type ${wireType}`);
        }
    }

    return undefined;
}
