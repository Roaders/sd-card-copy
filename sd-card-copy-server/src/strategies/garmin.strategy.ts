import { TokenReplacementStrategy } from '../contracts';
import { xml2js, Element } from 'xml-js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export const GARMIN_DEVICE_NAME_TOKEN = 'GARMIN_DEVICE_NAME';
export const GARMIN_DEVICE_ID_TOKEN = 'GARMIN_DEVICE_ID';
export const GARMIN_MODEL_NAME_TOKEN = 'GARMIN_MODEL_NAME';

const devicePath = `Garmin/GarminDevice.xml`;

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
    if (token !== GARMIN_MODEL_NAME_TOKEN) {
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

function isTextNode(input: unknown): input is Element & { text: string } {
    return true;
}
