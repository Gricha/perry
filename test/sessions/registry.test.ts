import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createSession,
  linkAgentSession,
  getSessionsForWorkspace,
  importExternalSession,
  type SessionRecord,
} from '../../src/sessions/registry';

async function readRegistryFromDisk(
  stateDir: string
): Promise<{ version: number; sessions: Record<string, SessionRecord> }> {
  try {
    const content = await readFile(join(stateDir, 'session-registry.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { version: 1, sessions: {} };
  }
}

describe('Session Registry', () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), 'perry-registry-test-'));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('creates a session with generated timestamps', async () => {
      const before = new Date().toISOString();

      const session = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const after = new Date().toISOString();

      expect(session.perrySessionId).toBe('perry-123');
      expect(session.workspaceName).toBe('my-workspace');
      expect(session.agentType).toBe('claude');
      expect(session.agentSessionId).toBeNull();
      expect(session.projectPath).toBeNull();
      expect(session.createdAt >= before).toBe(true);
      expect(session.createdAt <= after).toBe(true);
      expect(session.lastActivity).toBe(session.createdAt);
    });

    it('creates a session with optional fields', async () => {
      const session = await createSession(stateDir, {
        perrySessionId: 'perry-456',
        workspaceName: 'my-workspace',
        agentType: 'opencode',
        agentSessionId: 'agent-789',
        projectPath: '/home/workspace/project',
      });

      expect(session.agentSessionId).toBe('agent-789');
      expect(session.projectPath).toBe('/home/workspace/project');
    });

    it('persists session to disk', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const registry = await readRegistryFromDisk(stateDir);

      expect(registry.version).toBe(1);
      expect(registry.sessions['perry-123']).toBeDefined();
      expect(registry.sessions['perry-123'].workspaceName).toBe('my-workspace');
    });

    it('overwrites existing session with same ID', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'workspace-1',
        agentType: 'claude',
      });

      const updated = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'workspace-2',
        agentType: 'opencode',
      });

      expect(updated.workspaceName).toBe('workspace-2');
      expect(updated.agentType).toBe('opencode');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-123'].workspaceName).toBe('workspace-2');
    });
  });

  describe('linkAgentSession', () => {
    it('links agent session ID to existing Perry session', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      const linked = await linkAgentSession(stateDir, 'perry-123', 'claude-session-abc');

      expect(linked).not.toBeNull();
      expect(linked!.agentSessionId).toBe('claude-session-abc');
    });

    it('updates lastActivity when linking', async () => {
      const created = await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const linked = await linkAgentSession(stateDir, 'perry-123', 'claude-session-abc');

      expect(linked!.lastActivity > created.lastActivity).toBe(true);
    });

    it('returns null for non-existent session', async () => {
      const result = await linkAgentSession(stateDir, 'non-existent', 'agent-123');
      expect(result).toBeNull();
    });

    it('persists the link to disk', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-123', 'claude-session-abc');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-123'].agentSessionId).toBe('claude-session-abc');
    });
  });

  describe('getSessionsForWorkspace', () => {
    it('returns sessions for specific workspace', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });
      await createSession(stateDir, {
        perrySessionId: 'perry-2',
        workspaceName: 'workspace-a',
        agentType: 'opencode',
      });
      await createSession(stateDir, {
        perrySessionId: 'perry-3',
        workspaceName: 'workspace-b',
        agentType: 'claude',
      });

      const sessions = await getSessionsForWorkspace(stateDir, 'workspace-a');

      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.workspaceName === 'workspace-a')).toBe(true);
    });

    it('returns empty array for workspace with no sessions', async () => {
      const sessions = await getSessionsForWorkspace(stateDir, 'empty-workspace');
      expect(sessions).toEqual([]);
    });

    it('returns sessions sorted by lastActivity descending', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createSession(stateDir, {
        perrySessionId: 'perry-2',
        workspaceName: 'workspace-a',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await linkAgentSession(stateDir, 'perry-1', 'agent-1');

      const sessions = await getSessionsForWorkspace(stateDir, 'workspace-a');

      expect(sessions[0].perrySessionId).toBe('perry-1');
      expect(sessions[1].perrySessionId).toBe('perry-2');
    });
  });

  describe('importExternalSession', () => {
    it('imports external session with all fields', async () => {
      const session = await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-external-abc',
        projectPath: '/home/workspace/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-02T00:00:00.000Z',
      });

      expect(session.perrySessionId).toBe('perry-ext-123');
      expect(session.agentSessionId).toBe('claude-external-abc');
      expect(session.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(session.lastActivity).toBe('2024-01-02T00:00:00.000Z');
    });

    it('returns existing session if agent ID already imported', async () => {
      const first = await importExternalSession(stateDir, {
        perrySessionId: 'perry-1',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });

      const second = await importExternalSession(stateDir, {
        perrySessionId: 'perry-2',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-abc',
      });

      expect(second.perrySessionId).toBe('perry-1');
    });

    it('generates timestamps if not provided', async () => {
      const before = new Date().toISOString();

      const session = await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-123',
        workspaceName: 'my-workspace',
        agentType: 'opencode',
        agentSessionId: 'oc-external',
      });

      const after = new Date().toISOString();

      expect(session.createdAt >= before).toBe(true);
      expect(session.createdAt <= after).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty registry file gracefully', async () => {
      const sessions = await getSessionsForWorkspace(stateDir, 'any-workspace');
      expect(sessions).toEqual([]);
    });

    it('handles concurrent session creation', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        createSession(stateDir, {
          perrySessionId: `perry-${i}`,
          workspaceName: 'my-workspace',
          agentType: 'claude',
        })
      );

      await Promise.all(promises);

      const sessions = await getSessionsForWorkspace(stateDir, 'my-workspace');
      expect(sessions).toHaveLength(10);
    });

    it('survives server restart (data persisted)', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-123', 'claude-abc');

      const registry = await readRegistryFromDisk(stateDir);

      expect(registry.sessions['perry-123']).not.toBeUndefined();
      expect(registry.sessions['perry-123'].agentSessionId).toBe('claude-abc');
    });

    it('agent responds after client disconnects - link still persists', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-123',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-123', 'claude-abc');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-123'].agentSessionId).toBe('claude-abc');
    });

    it('merging external sessions does not duplicate', async () => {
      await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-1',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-external',
      });

      await importExternalSession(stateDir, {
        perrySessionId: 'perry-ext-2',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-external',
      });

      const sessions = await getSessionsForWorkspace(stateDir, 'my-workspace');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].perrySessionId).toBe('perry-ext-1');
    });
  });

  describe('connectivity and reconnection scenarios', () => {
    it('session exists before agent responds (pending link)', async () => {
      const session = await createSession(stateDir, {
        perrySessionId: 'perry-pending',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      expect(session.agentSessionId).toBeNull();

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-pending']).not.toBeUndefined();
      expect(registry.sessions['perry-pending'].perrySessionId).toBe('perry-pending');
    });

    it('client disconnects before agent responds, reconnects after', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-disconnect',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-disconnect', 'claude-abc-123');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-disconnect'].agentSessionId).toBe('claude-abc-123');
    });

    it('multiple link attempts are idempotent', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-multi',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-multi', 'claude-xyz');
      await linkAgentSession(stateDir, 'perry-multi', 'claude-xyz');
      await linkAgentSession(stateDir, 'perry-multi', 'claude-xyz');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-multi'].agentSessionId).toBe('claude-xyz');
    });

    it('link updates if agent provides new session ID', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-update',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await linkAgentSession(stateDir, 'perry-update', 'claude-first');
      let registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-update'].agentSessionId).toBe('claude-first');

      await linkAgentSession(stateDir, 'perry-update', 'claude-second');
      registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-update'].agentSessionId).toBe('claude-second');
    });

    it('reconnect to session started outside Perry (via import)', async () => {
      const imported = await importExternalSession(stateDir, {
        perrySessionId: 'perry-imported',
        workspaceName: 'my-workspace',
        agentType: 'claude',
        agentSessionId: 'claude-terminal-session',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      });

      expect(imported.perrySessionId).toBe('perry-imported');
      expect(imported.agentSessionId).toBe('claude-terminal-session');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-imported'].agentSessionId).toBe('claude-terminal-session');
    });

    it('session listing includes both Perry-started and imported sessions', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-native',
        workspaceName: 'test-ws',
        agentType: 'claude',
      });
      await linkAgentSession(stateDir, 'perry-native', 'claude-native');

      await importExternalSession(stateDir, {
        perrySessionId: 'perry-external',
        workspaceName: 'test-ws',
        agentType: 'claude',
        agentSessionId: 'claude-external',
      });

      const sessions = await getSessionsForWorkspace(stateDir, 'test-ws');
      expect(sessions).toHaveLength(2);

      const perryIds = sessions.map((s) => s.perrySessionId);
      expect(perryIds).toContain('perry-native');
      expect(perryIds).toContain('perry-external');
    });

    it('activity tracking persists across reconnections', async () => {
      const created = await createSession(stateDir, {
        perrySessionId: 'perry-activity',
        workspaceName: 'my-workspace',
        agentType: 'claude',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await linkAgentSession(stateDir, 'perry-activity', 'claude-active');

      const registry = await readRegistryFromDisk(stateDir);
      expect(registry.sessions['perry-activity'].lastActivity > created.lastActivity).toBe(true);
      expect(registry.sessions['perry-activity'].createdAt).toBe(created.createdAt);
    });

    it('handles rapid session creation during reconnection attempts', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          createSession(stateDir, {
            perrySessionId: `perry-rapid-${i}`,
            workspaceName: 'rapid-test',
            agentType: 'claude',
          })
        );
      }

      await Promise.all(promises);

      const sessions = await getSessionsForWorkspace(stateDir, 'rapid-test');
      expect(sessions).toHaveLength(5);
    });

    it('preserves session data through full lifecycle', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-lifecycle',
        workspaceName: 'lifecycle-ws',
        agentType: 'claude',
        projectPath: '/home/user/project',
      });

      await linkAgentSession(stateDir, 'perry-lifecycle', 'claude-lifecycle-id');

      const registry = await readRegistryFromDisk(stateDir);
      const recovered = registry.sessions['perry-lifecycle'];

      expect(recovered).not.toBeUndefined();
      expect(recovered.perrySessionId).toBe('perry-lifecycle');
      expect(recovered.workspaceName).toBe('lifecycle-ws');
      expect(recovered.agentType).toBe('claude');
      expect(recovered.agentSessionId).toBe('claude-lifecycle-id');
      expect(recovered.projectPath).toBe('/home/user/project');
    });

    it('workspace isolation - sessions from different workspaces', async () => {
      await createSession(stateDir, {
        perrySessionId: 'perry-ws1',
        workspaceName: 'workspace-1',
        agentType: 'claude',
        agentSessionId: 'claude-ws1',
      });

      await createSession(stateDir, {
        perrySessionId: 'perry-ws2',
        workspaceName: 'workspace-2',
        agentType: 'claude',
        agentSessionId: 'claude-ws2',
      });

      const ws1Sessions = await getSessionsForWorkspace(stateDir, 'workspace-1');
      const ws2Sessions = await getSessionsForWorkspace(stateDir, 'workspace-2');

      expect(ws1Sessions).toHaveLength(1);
      expect(ws2Sessions).toHaveLength(1);
      expect(ws1Sessions[0].perrySessionId).toBe('perry-ws1');
      expect(ws2Sessions[0].perrySessionId).toBe('perry-ws2');
    });
  });
});
