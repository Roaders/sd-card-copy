import { insta360Camera, INSTA360_MODEL_TOKEN, INSTA360_SERIAL_TOKEN } from './insta360.strategy';
import { join } from 'path';
import { CAMERA_NAME_TOKEN } from '../contracts';

describe(`insta360.strategy`, () => {
    // insta360X6 is a fileinfo_list.list from an X6 card with the serial number replaced
    const tests: { token: string; source: string; expected: string | undefined }[] = [
        { token: 'incorrectToken', source: `insta360X6`, expected: undefined },
        { token: INSTA360_MODEL_TOKEN, source: `insta360X6`, expected: 'Insta360 X6' },
        { token: INSTA360_SERIAL_TOKEN, source: `insta360X6`, expected: 'TESTSERIAL0001' },
        { token: CAMERA_NAME_TOKEN, source: `insta360X6`, expected: 'Insta360_X6_TESTSERIAL0001' },
        { token: CAMERA_NAME_TOKEN, source: `deviceOne`, expected: undefined },
        { token: INSTA360_MODEL_TOKEN, source: `deviceOne`, expected: undefined },
    ];

    tests.forEach(({ expected, source, token }) => {
        it(`should return ${expected} when passed token '${token}' and source '${source}'`, async () => {
            const sourcePath = join(__dirname, '../../../mockDevices', source);
            const result = await insta360Camera(token, [], `{${token}}`, 'target', sourcePath);

            expect(result).toBe(expected);
        });
    });
});
