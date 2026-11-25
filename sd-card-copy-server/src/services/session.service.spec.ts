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

    it('records the speed every second: the total for 30 minutes and each active session since it started', () => {
        const first = start('/media/usb0');
        first.addFile('/media/usb0/a.insv', 100000 * mb);
        first.startFile('/media/usb0/a.insv');
        for (let second = 1; second <= 31 * 60; second++) {
            vi.advanceTimersByTime(1000);
            first.addBytes('/media/usb0/a.insv', 10 * mb);
        }

        let history = service.getSpeedHistory();
        expect(history.total).toHaveLength(30 * 60);
        expect(history.total[0][0]).toBe(60 * 1000 + 1000);
        // sampled just before that second's 10MB arrives, so the 3 second window holds 20MB
        expect(history.total.at(-1)).toEqual([31 * 60 * 1000, (20 * mb) / 3]);
        expect(history.sessions[1].at(-1)).toEqual(history.total.at(-1));
        expect(history.sessions[1]).toHaveLength(31 * 60);
        expect(history.sessions[1][0][0]).toBe(1000);

        const second = start('/media/usb1');
        vi.advanceTimersByTime(2000);
        first.finish('complete');

        history = service.getSpeedHistory();
        expect(Object.keys(history.sessions)).toEqual([String(second.id)]);
        expect(history.sessions[second.id]).toEqual([
            [31 * 60 * 1000 + 1000, 0],
            [31 * 60 * 1000 + 2000, 0],
        ]);
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
