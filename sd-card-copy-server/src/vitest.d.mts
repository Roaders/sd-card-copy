import 'vitest';

// ts-mocking-bird registers these matchers with vitest's expect but only declares them for jest and jasmine
declare module 'vitest' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
        wasCalled(times: number): R;
        wasCalledOnce(): R;
        wasNotCalled(): R;
        wasCalledAtLeastOnce(): R;
    }
}
