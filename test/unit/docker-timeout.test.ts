import { describe, it, expect, vi } from 'vitest';

vi.mock('child_process', () => {
  const spawn = vi.fn(() => {
    const stdoutHandlers: Array<(chunk: Buffer) => void> = [];
    const stderrHandlers: Array<(chunk: Buffer) => void> = [];
    const closeHandlers: Array<(code: number) => void> = [];

    const child = {
      stdout: {
        on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
          if (event === 'data') stdoutHandlers.push(cb);
        }),
      },
      stderr: {
        on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
          if (event === 'data') stderrHandlers.push(cb);
        }),
      },
      on: vi.fn((event: string, cb: (arg: unknown) => void) => {
        if (event === 'close') closeHandlers.push(cb as (code: number) => void);
      }),
      kill: vi.fn(),
      __emitStdout(chunk: string) {
        for (const cb of stdoutHandlers) cb(Buffer.from(chunk));
      },
      __emitStderr(chunk: string) {
        for (const cb of stderrHandlers) cb(Buffer.from(chunk));
      },
      __emitClose(code: number) {
        for (const cb of closeHandlers) cb(code);
      },
    };

    return child;
  });

  return { spawn };
});

describe('docker command timeouts', () => {
  it('times out docker cp when timeoutMs specified', async () => {
    vi.useFakeTimers();

    const { copyToContainer } = await import('../../src/docker');

    const promise = copyToContainer('container', '/host/file', '/dest', { timeoutMs: 10 });
    const assertion = expect(promise).rejects.toThrow(/timed out/i);

    await vi.advanceTimersByTimeAsync(11);
    await assertion;

    vi.useRealTimers();
  });
});
