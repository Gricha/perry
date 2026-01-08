import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

describe('User Scripts', () => {
  describe('Multiple Script Paths', () => {
    let agent: TestAgent;
    let workspaceName: string;
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-scripts-test-'));

      const script1Path = path.join(tempDir, 'script1.sh');
      await fs.writeFile(
        script1Path,
        `#!/bin/bash
echo "SCRIPT1" >> /home/workspace/.scripts-order
`
      );
      await fs.chmod(script1Path, 0o755);

      const script2Path = path.join(tempDir, 'script2.sh');
      await fs.writeFile(
        script2Path,
        `#!/bin/bash
echo "SCRIPT2" >> /home/workspace/.scripts-order
`
      );
      await fs.chmod(script2Path, 0o755);

      agent = await startTestAgent({
        config: {
          credentials: { env: {}, files: {} },
          scripts: {
            post_start: [script1Path, script2Path],
          },
        },
      });
    }, 60000);

    afterAll(async () => {
      if (agent) {
        await agent.cleanup();
      }
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    beforeEach(() => {
      workspaceName = generateTestWorkspaceName();
    });

    afterEach(async () => {
      try {
        await agent.api.deleteWorkspace(workspaceName);
      } catch {
        // Ignore
      }
    });

    it('executes multiple scripts in order', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(
        containerName,
        ['cat', '/home/workspace/.scripts-order'],
        { user: 'workspace' }
      );

      const lines = result.stdout.trim().split('\n');
      expect(lines).toEqual(['SCRIPT1', 'SCRIPT2']);
    }, 120000);
  });

  describe('Directory Scripts', () => {
    let agent: TestAgent;
    let workspaceName: string;
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-scripts-dir-test-'));

      const scriptsDir = path.join(tempDir, 'userscripts');
      await fs.mkdir(scriptsDir, { recursive: true });

      const scriptA = path.join(scriptsDir, '01-first.sh');
      await fs.writeFile(
        scriptA,
        `#!/bin/bash
echo "FIRST" >> /home/workspace/.dir-scripts-order
`
      );
      await fs.chmod(scriptA, 0o755);

      const scriptB = path.join(scriptsDir, '02-second.sh');
      await fs.writeFile(
        scriptB,
        `#!/bin/bash
echo "SECOND" >> /home/workspace/.dir-scripts-order
`
      );
      await fs.chmod(scriptB, 0o755);

      const scriptC = path.join(scriptsDir, '10-third.sh');
      await fs.writeFile(
        scriptC,
        `#!/bin/bash
echo "THIRD" >> /home/workspace/.dir-scripts-order
`
      );
      await fs.chmod(scriptC, 0o755);

      await fs.writeFile(path.join(scriptsDir, 'not-a-script.txt'), 'ignored');

      agent = await startTestAgent({
        config: {
          credentials: { env: {}, files: {} },
          scripts: {
            post_start: [scriptsDir],
          },
        },
      });
    }, 60000);

    afterAll(async () => {
      if (agent) {
        await agent.cleanup();
      }
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    beforeEach(() => {
      workspaceName = generateTestWorkspaceName();
    });

    afterEach(async () => {
      try {
        await agent.api.deleteWorkspace(workspaceName);
      } catch {
        // Ignore
      }
    });

    it('executes .sh scripts from directory in sorted order', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(
        containerName,
        ['cat', '/home/workspace/.dir-scripts-order'],
        { user: 'workspace' }
      );

      const lines = result.stdout.trim().split('\n');
      expect(lines).toEqual(['FIRST', 'SECOND', 'THIRD']);
    }, 120000);
  });

  describe('Scripts Run After File Sync', () => {
    let agent: TestAgent;
    let workspaceName: string;
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-scripts-sync-test-'));

      const syncedFile = path.join(tempDir, 'synced-data.txt');
      await fs.writeFile(syncedFile, 'SYNCED_CONTENT');

      const scriptPath = path.join(tempDir, 'check-sync.sh');
      await fs.writeFile(
        scriptPath,
        `#!/bin/bash
if [ -f /home/workspace/.synced-data.txt ]; then
  cat /home/workspace/.synced-data.txt > /home/workspace/.sync-check-result
else
  echo "FILE_NOT_FOUND" > /home/workspace/.sync-check-result
fi
`
      );
      await fs.chmod(scriptPath, 0o755);

      agent = await startTestAgent({
        config: {
          credentials: {
            env: {},
            files: {
              '~/.synced-data.txt': syncedFile,
            },
          },
          scripts: {
            post_start: [scriptPath],
          },
        },
      });
    }, 60000);

    afterAll(async () => {
      if (agent) {
        await agent.cleanup();
      }
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    beforeEach(() => {
      workspaceName = generateTestWorkspaceName();
    });

    afterEach(async () => {
      try {
        await agent.api.deleteWorkspace(workspaceName);
      } catch {
        // Ignore
      }
    });

    it('scripts can access synced files', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(
        containerName,
        ['cat', '/home/workspace/.sync-check-result'],
        { user: 'workspace' }
      );

      expect(result.stdout.trim()).toBe('SYNCED_CONTENT');
    }, 120000);
  });
});
