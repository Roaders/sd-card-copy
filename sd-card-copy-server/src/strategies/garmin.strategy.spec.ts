import {
    garminDeviceId,
    garminDeviceName,
    garminModelName,
    GARMIN_DEVICE_ID_TOKEN,
    GARMIN_DEVICE_NAME_TOKEN,
    GARMIN_MODEL_NAME_TOKEN,
} from './garmin.strategy';
import { join } from 'path';
import { CAMERA_NAME_TOKEN, TokenReplacementStrategy } from '../contracts';

describe(`garmin.strategy`, () => {
    const tests: { strategy: TokenReplacementStrategy; token: string; source: string; expected: string | undefined }[] =
        [
            { strategy: garminDeviceName, token: 'incorrectToken', source: `deviceOne`, expected: undefined },
            { strategy: garminDeviceName, token: GARMIN_DEVICE_NAME_TOKEN, source: `deviceOne`, expected: 'VIRB360' },
            { strategy: garminDeviceName, token: GARMIN_DEVICE_NAME_TOKEN, source: `deviceTwo`, expected: 'Ultra' },
            { strategy: garminDeviceName, token: CAMERA_NAME_TOKEN, source: `deviceOne`, expected: 'VIRB360' },
            { strategy: garminDeviceName, token: CAMERA_NAME_TOKEN, source: `deviceTwo`, expected: 'Ultra' },
            { strategy: garminDeviceName, token: CAMERA_NAME_TOKEN, source: `insta360X6`, expected: undefined },
            { strategy: garminDeviceId, token: 'incorrectToken', source: `deviceOne`, expected: undefined },
            { strategy: garminDeviceId, token: GARMIN_DEVICE_ID_TOKEN, source: `deviceOne`, expected: '9876543' },
            { strategy: garminDeviceId, token: GARMIN_DEVICE_ID_TOKEN, source: `deviceTwo`, expected: '12345678' },
            { strategy: garminModelName, token: 'incorrectToken', source: `deviceOne`, expected: undefined },
            { strategy: garminModelName, token: GARMIN_MODEL_NAME_TOKEN, source: `deviceOne`, expected: 'VIRB 360' },
            {
                strategy: garminModelName,
                token: GARMIN_MODEL_NAME_TOKEN,
                source: `deviceTwo`,
                expected: 'VIRB Ultra 30',
            },
        ];

    tests.forEach(({ expected, source, strategy, token }) => {
        it(`${strategy.name} should return ${expected} when passed token '${token}' and source '${source}'`, async () => {
            const sourcePath = join(__dirname, '../../../mockDevices', source);
            const result = await strategy(token, [], `{${token}}`, 'target', sourcePath);

            expect(result).toBe(expected);
        });
    });
});
