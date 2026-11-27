import { CopyService } from './copy.service';
import { SessionService } from './session.service';
import { ConfigService } from './config.service';
import { DateStrategies } from '../strategies';
import { IAppConfig } from '../contracts';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('CopyService sessions', () => {
    let root: string;
    let sessions: SessionService;
    let service: CopyService;
    let appConfig: IAppConfig;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'copy-service-'));
        sessions = new SessionService();
        appConfig = {};
        const config = { getConfig: async () => appConfig } as unknown as ConfigService;
        const noDates = { formattedDateStrategy: () => undefined, timestampStrategy: () => undefined };
        service = new CopyService(noDates as unknown as DateStrategies, config, sessions);
    });

    afterEach(() => rm(root, { recursive: true, force: true }));

    it('records each file of a copy and completes the session', async () => {
        const source = join(root, 'usb0');
        await cp(join(__dirname, '../../../mockDevices/insta360X6'), source, { recursive: true });

        await service.startCopy({ sourcePath: source, targetPath: join(root, 'out'), deleteSource: true });
        expect(sessions.getStatus().activeSessions).toHaveLength(1);

        await vi.waitFor(() => expect(sessions.getStatus().completedCount).toBe(1));
        const [session] = sessions.getCompleted(0, 10).sessions;
        expect(session).toMatchObject({ sourcePath: source, targetPath: join(root, 'out'), state: 'complete' });
        expect(session.files).toHaveLength(1);
        expect(session.files[0]).toMatchObject({ path: join('DCIM', 'fileinfo_list.list'), state: 'complete' });
        expect(session.files[0].copiedBytes).toBe(session.files[0].size);
        expect(session.files[0].size).toBeGreaterThan(0);
    });

    it('does not copy files matching excludeFiles, wherever they are, but still deletes them', async () => {
        appConfig = { excludeFiles: ['LRV_*.lrv'] };
        const source = join(root, 'usb0');
        await mkdir(join(source, 'DCIM', 'Camera01'), { recursive: true });
        await writeFile(join(source, 'DCIM', 'Camera01', 'LRV_20261127_061428_01_001.lrv'), 'preview');
        await writeFile(join(source, 'DCIM', 'Camera01', 'VID_20261127_061428_00_001.insv'), 'video');
        await writeFile(join(source, 'DCIM', 'Camera01', 'VID_LRV_note.lrv'), 'not a preview');

        await service.startCopy({ sourcePath: source, targetPath: join(root, 'out'), deleteSource: true });
        await vi.waitFor(() => expect(sessions.getStatus().completedCount).toBe(1));

        expect((await readdir(join(root, 'out', 'DCIM', 'Camera01'))).sort()).toEqual([
            'VID_20261127_061428_00_001.insv',
            'VID_LRV_note.lrv',
        ]);
        expect(await readdir(source)).toEqual([]);
    });

    it('records a refused copy with the reason', async () => {
        await expect(
            // not join(): on Windows its \ would escape the token
            service.startCopy({ sourcePath: root, targetPath: `${root}/{UNKNOWN}`, deleteSource: true })
        ).rejects.toThrow();

        const [session] = sessions.getCompleted(0, 10).sessions;
        expect(session.state).toBe('refused');
        expect(session.message).toContain('{UNKNOWN}');
        expect(sessions.getStatus().activeSessions).toEqual([]);
    });
});
