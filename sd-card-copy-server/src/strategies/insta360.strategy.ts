import { CAMERA_NAME_TOKEN, TokenReplacementStrategy } from '../contracts';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export const INSTA360_MODEL_TOKEN = 'INSTA360_MODEL';
export const INSTA360_SERIAL_TOKEN = 'INSTA360_SERIAL';

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
