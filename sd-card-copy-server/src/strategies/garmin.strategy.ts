import { AfterCopyAction, CAMERA_NAME_TOKEN, TokenReplacementStrategy } from '../contracts';
import { usbPowerCycle } from './usb-power-cycle';
import { xml2js, Element } from 'xml-js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export const GARMIN_DEVICE_NAME_TOKEN = 'GARMIN_DEVICE_NAME';
export const GARMIN_DEVICE_ID_TOKEN = 'GARMIN_DEVICE_ID';
export const GARMIN_MODEL_NAME_TOKEN = 'GARMIN_MODEL_NAME';

const devicePath = `Garmin/GarminDevice.xml`;

const GARMIN_USB_VENDOR_ID = '091e';

/**
 * An afterCopy action that turns off the USB power to a Garmin camera (written for a VIRB Ultra 30) once it has been
 * copied, then back on after offMinutes (default 7) so it charges. A card in a card reader is not affected. Set the
 * camera's Auto Off on (it turns off after 5 minutes) and External Power to charge mode, otherwise it turns itself back
 * on when the power returns and is copied and power cycled again.
 */
export function garminPowerCycle(options: { offMinutes?: number } = {}): AfterCopyAction {
    return usbPowerCycle({ cameraName: 'Garmin', vendorId: GARMIN_USB_VENDOR_ID, offMinutes: options.offMinutes ?? 7 });
}

export const garminDeviceName: TokenReplacementStrategy = async (
    token: string,
    _tokenArguments: string[] | undefined,
    _token: string,
    _target: string,
    sourcePath: string
) => {
    if (token !== GARMIN_DEVICE_NAME_TOKEN) {
        return undefined;
    }

    const device = await getGarminDevice(sourcePath);

    if (device == null) {
        return undefined;
    }

    const nameElement = device?.elements?.find((element) => element.name === 'DisplayName');
    const displayName = nameElement?.elements?.find(isTextNode)?.text;

    return displayName || 'UNKNOWN';
};

export const garminDeviceId: TokenReplacementStrategy = async (
    token: string,
    _tokenArguments: string[] | undefined,
    _token: string,
    _target: string,
    sourcePath: string
) => {
    if (token !== GARMIN_DEVICE_ID_TOKEN) {
        return undefined;
    }

    const device = await getGarminDevice(sourcePath);

    if (device == null) {
        return undefined;
    }

    const nameElement = device?.elements?.find((element) => element.name === 'Id');
    const displayName = nameElement?.elements?.find(isTextNode)?.text;

    return displayName || 'UNKNOWN';
};

export const garminModelName: TokenReplacementStrategy = async (
    token: string,
    _tokenArguments: string[] | undefined,
    _token: string,
    _target: string,
    sourcePath: string
) => {
    if (token !== GARMIN_MODEL_NAME_TOKEN && token !== CAMERA_NAME_TOKEN) {
        return undefined;
    }

    const device = await getGarminDevice(sourcePath);

    if (device == null) {
        return undefined;
    }

    const modelElement = device?.elements?.find((element) => element.name === 'Model');

    const descriptionElement = modelElement?.elements?.find((element) => element.name === 'Description');
    const description = descriptionElement?.elements?.find(isTextNode)?.text;

    return description || 'UNKNOWN';
};

async function getGarminDevice(sourcePath: string) {
    const deviceInfoPath = resolve(sourcePath, devicePath);
    const fileBuffer = await readFile(deviceInfoPath).catch<Buffer | undefined>(() => undefined);

    if (fileBuffer == null) {
        return undefined;
    }

    const fileContent = xml2js(fileBuffer.toString()) as Element;

    const device = fileContent.elements?.find(
        (element) =>
            element.name === 'Device' &&
            element.attributes?.xmlns === 'http://www.garmin.com/xmlschemas/GarminDevice/v2'
    );

    if (device == null) {
        return undefined;
    }

    return device;
}

function isTextNode(input: Element): input is Element & { text: string } {
    return input.type === 'text' && typeof input.text === 'string';
}
