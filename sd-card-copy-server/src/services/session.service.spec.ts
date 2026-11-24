import { SessionService } from './session.service';

describe('SessionService', () => {
    const mb = 1000 * 1000;
    let service: SessionService;

    beforeEach(() => {
        vi.useFakeTimers({ now: 0 });
        service = new SessionService();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const start = (sourcePath = '/media/usb0') => service.start({ sourcePath, targetPath: '/mnt', deleteSource: true });

    it('gives the speed of a file over the last 3 seconds rather than since it started', () => {
        const session = start();
        session.addFile('/media/usb0/DCIM/a.mp4', 200 * mb);
        session.startFile('/media/usb0/DCIM/a.mp4');

        // 100MB in the first second, then 10MB a second for 4 seconds: 35MB/s on average since the start
        vi.advanceTimersByTime(1000);
        session.addBytes('/media/usb0/DCIM/a.mp4', 100 * mb);
        for (let second = 0; second < 4; second++) {
            vi.advanceTimersByTime(1000);
            session.addBytes('/media/usb0/DCIM/a.mp4', 10 * mb);
        }

        const [file] = service.getStatus().activeSessions[0].files;
        expect(file).toMatchObject({ path: expect.stringMatching(/^DCIM[\\/]a\.mp4$/), state: 'copying' });
        expect(file.copiedBytes).toBe(140 * mb);
        expect(file.speed).toBe(10 * mb);
    });

    it('slows to 0 when a file stops receiving data', () => {
        const session = start();
        session.addFile('/media/usb0/a.mp4', 100 * mb);
        session.startFile('/media/usb0/a.mp4');
        vi.advanceTimersByTime(1000);
        session.addBytes('/media/usb0/a.mp4', 10 * mb);

        vi.advanceTimersByTime(10000);

        expect(service.getStatus().activeSessions[0].files[0].speed).toBe(0);
    });

    it('totals the speed of the files being copied in every session, not pending or finished files', () => {
        const first = start('/media/usb0');
        const second = start('/media/usb1');
        first.addFile('/media/usb0/done.mp4', mb);
        first.addFile('/media/usb0/copying.mp4', 100 * mb);
        first.addFile('/media/usb0/pending.mp4', 100 * mb);
        second.addFile('/media/usb1/copying.mp4', 100 * mb);
        first.startFile('/media/usb0/done.mp4');
        first.completeFile('/media/usb0/done.mp4');
        first.startFile('/media/usb0/copying.mp4');
        second.startFile('/media/usb1/copying.mp4');

        vi.advanceTimersByTime(1000);
        first.addBytes('/media/usb0/copying.mp4', 30 * mb);
        second.addBytes('/media/usb1/copying.mp4', 5 * mb);

        const status = service.getStatus();
        expect(status.activeSessions.map((session) => session.sourcePath)).toEqual(['/media/usb1', '/media/usb0']);
        expect(status.activeSessions[1].files.map((file) => [file.state, file.speed])).toEqual([
            ['complete', undefined],
            ['copying', 30 * mb],
            ['pending', undefined],
        ]);
        expect(status.totalSpeed).toBe(35 * mb);
    });

    it('moves finished sessions to the completed list, newest first, keeping the last 100', () => {
        start('/media/active');
        for (let index = 1; index <= 105; index++) {
            start(`/media/usb${index}`).finish(
                index === 105 ? 'refused' : 'complete',
                index === 105 ? 'why' : undefined
            );
        }

        const status = service.getStatus();
        expect(status.activeSessions.map((session) => session.sourcePath)).toEqual(['/media/active']);
        expect(status.completedCount).toBe(100);
        expect(status.lastCompletedId).toBe(106);

        const page = service.getCompleted(10, 10);
        expect(page.total).toBe(100);
        expect(page.sessions.map((session) => session.sourcePath)).toEqual(
            [95, 94, 93, 92, 91, 90, 89, 88, 87, 86].map((index) => `/media/usb${index}`)
        );
        expect(service.getCompleted(0, 1).sessions[0]).toMatchObject({ state: 'refused', message: 'why' });
        expect(service.getCompleted(95, 10).sessions.at(-1)?.sourcePath).toBe('/media/usb6');
    });
});
