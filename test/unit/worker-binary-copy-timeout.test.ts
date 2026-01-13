import { describe, it, expect, vi } from 'vitest';

vi.mock('fs/promises', () => {
  return {
    default: {
      access: vi.fn(async (filePath: string) => {
        if (filePath.endsWith('.gitconfig')) {
          const err = new Error('ENOENT') as NodeJS.ErrnoException;
          err.code = 'ENOENT';
          throw err;
        }

        // Make copyPerryWorker() find the compiled worker binary.
        if (filePath.endsWith('/perry-worker')) {
          return;
        }

        const err = new Error('ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        throw err;
      }),
    },
  };
});

vi.mock('../../src/docker', () => {
  return {
    getContainerName: (name: string) => `workspace-${name}`,
    copyToContainer: vi.fn(() => {
      throw new Error('Command timed out: docker cp ...');
    }),
    execInContainer: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0, code: 0 })),
    containerRunning: vi.fn(async () => true),
    getContainerIp: vi.fn(async () => '127.0.0.1'),
  };
});

vi.mock('../../src/agents', () => ({
  syncAllAgents: vi.fn(async () => ({
    'claude-code': { copied: [], generated: [], skipped: [], errors: [] },
    opencode: { copied: [], generated: [], skipped: [], errors: [] },
    codex: { copied: [], generated: [], skipped: [], errors: [] },
  })),
}));

describe('workspace sync worker binary copy', () => {
  it('surfaces a helpful error when worker binary copy times out', async () => {
    const { WorkspaceManager } = await import('../../src/workspace/manager');

    const manager = new WorkspaceManager('/tmp/perry-test-config', {
      port: 7777,
      credentials: { env: {}, files: {} },
      scripts: {},
    });

    // Avoid touching real FS state file.
    (manager as any).state = {
      getWorkspace: vi.fn(async () => ({
        name: 'ws',
        status: 'running',
        containerId: 'abcdef',
        created: new Date().toISOString(),
        ports: { ssh: 2222 },
        lastUsed: new Date().toISOString(),
      })),
    };

    await expect(manager.sync('ws')).rejects.toThrow(/Timed out copying perry worker binary/i);
  });
});
