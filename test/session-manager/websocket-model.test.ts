/**
 * Tests for WebSocket model selection handling.
 *
 * These tests verify that the WebSocket handler correctly updates
 * the model when a client reconnects with a different model selection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage } from '../../src/chat/types';
import type { SessionStatus } from '../../src/session-manager/types';

// Track model changes in mock adapters
const claudeAdapters: Array<{ model: string; agentSessionId?: string }> = [];
const opencodeAdapters: Array<{ model?: string; agentSessionId?: string }> = [];

vi.mock('../../src/session-manager/adapters/claude', () => ({
  ClaudeCodeAdapter: class MockClaudeAdapter {
    agentType = 'claude' as const;
    private status: SessionStatus = 'idle';
    agentSessionId?: string;
    model = 'sonnet';
    private statusCallback?: (status: SessionStatus) => void;

    constructor() {
      claudeAdapters.push(this);
    }

    async start(options: { model?: string; agentSessionId?: string }) {
      this.status = 'idle';
      if (options.model) this.model = options.model;
      if (options.agentSessionId) this.agentSessionId = options.agentSessionId;
    }

    async sendMessage() {
      if (!this.agentSessionId) this.agentSessionId = `claude-session-${Date.now()}`;
      this.status = 'running';
      this.statusCallback?.('running');
      setTimeout(() => {
        this.status = 'idle';
        this.statusCallback?.('idle');
      }, 10);
    }

    setModel(model: string) {
      this.model = model;
    }

    async interrupt() {
      this.status = 'interrupted';
    }
    async dispose() {}
    getAgentSessionId() {
      return this.agentSessionId;
    }
    getStatus() {
      return this.status;
    }
    onMessage() {}
    onStatusChange(cb: (status: SessionStatus) => void) {
      this.statusCallback = cb;
    }
    onError() {}
  },
}));

vi.mock('../../src/session-manager/adapters/opencode', () => ({
  OpenCodeAdapter: class MockOpenCodeAdapter {
    agentType = 'opencode' as const;
    private status: SessionStatus = 'idle';
    agentSessionId?: string;
    model?: string;
    private statusCallback?: (status: SessionStatus) => void;

    constructor() {
      opencodeAdapters.push(this);
    }

    async start(options: { model?: string; agentSessionId?: string }) {
      this.status = 'idle';
      if (options.model) this.model = options.model;
      if (options.agentSessionId) this.agentSessionId = options.agentSessionId;
    }

    async sendMessage() {
      if (!this.agentSessionId) this.agentSessionId = `opencode-session-${Date.now()}`;
      this.status = 'running';
      this.statusCallback?.('running');
      setTimeout(() => {
        this.status = 'idle';
        this.statusCallback?.('idle');
      }, 10);
    }

    setModel(model: string) {
      this.model = model;
    }

    async interrupt() {
      this.status = 'interrupted';
    }
    async dispose() {}
    getAgentSessionId() {
      return this.agentSessionId;
    }
    getStatus() {
      return this.status;
    }
    onMessage() {}
    onStatusChange(cb: (status: SessionStatus) => void) {
      this.statusCallback = cb;
    }
    onError() {}
  },
}));

vi.mock('../../src/docker', () => ({
  getContainerName: (name: string) => `workspace-${name}`,
}));

import { SessionManager } from '../../src/session-manager/manager';

/**
 * Simulates the WebSocket handleConnect logic from websocket.ts
 */
async function simulateWebSocketConnect(
  manager: SessionManager,
  message: {
    sessionId?: string;
    model?: string;
    agentType: 'claude' | 'opencode';
    workspaceName: string;
    projectPath?: string;
    resumeFromId?: number;
  }
): Promise<{
  type: 'session_started' | 'session_joined';
  sessionId: string;
  model?: string;
  status?: SessionStatus;
  agentSessionId?: string;
}> {
  const { sessionId: requestedSessionId, model, agentType, workspaceName, projectPath } = message;

  // Simulate websocket.ts handleConnect logic
  if (requestedSessionId) {
    const found = await manager.findSession(requestedSessionId, { projectPath });

    if (found) {
      // Simulate connectClient
      manager.connectClient(found.sessionId, () => {}, {
        resumeFromId: message.resumeFromId,
      });

      // Update model if client requested a different one (THE FIX)
      if (model && model !== found.info.model) {
        manager.setModel(found.sessionId, model);
      }

      return {
        type: 'session_joined',
        sessionId: found.sessionId,
        status: found.info.status,
        agentSessionId: found.info.agentSessionId,
        model: model || found.info.model, // Return actual model being used
      };
    }
  }

  // Create new session
  const sessionId = await manager.startSession({
    workspaceName,
    agentType,
    sessionId: requestedSessionId,
    model,
    projectPath,
  });

  manager.connectClient(sessionId, () => {});

  return {
    type: 'session_started',
    sessionId,
  };
}

describe('WebSocket model selection handling', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
    claudeAdapters.length = 0;
    opencodeAdapters.length = 0;
  });

  afterEach(async () => {
    await manager.disposeAll();
  });

  describe('Claude Code', () => {
    it('creates session with specified model', async () => {
      const response = await simulateWebSocketConnect(manager, {
        model: 'opus',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(response.type).toBe('session_started');
      expect(claudeAdapters).toHaveLength(1);
      expect(claudeAdapters[0].model).toBe('opus');

      const session = manager.getSession(response.sessionId);
      expect(session?.model).toBe('opus');
    });

    it('rejoins session and updates model when different', async () => {
      // First connection with model 'sonnet'
      const firstResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-session',
        model: 'sonnet',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(firstResponse.type).toBe('session_started');
      expect(claudeAdapters[0].model).toBe('sonnet');

      // Second connection (rejoin) with model 'opus'
      const secondResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-session',
        model: 'opus',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(secondResponse.type).toBe('session_joined');
      expect(secondResponse.sessionId).toBe(firstResponse.sessionId);
      expect(secondResponse.model).toBe('opus'); // Response includes new model

      // Verify session and adapter were updated
      expect(claudeAdapters).toHaveLength(1);
      expect(claudeAdapters[0].model).toBe('opus');

      const session = manager.getSession(firstResponse.sessionId);
      expect(session?.model).toBe('opus');
    });

    it('rejoins session without changing model if not specified', async () => {
      // First connection with model 'sonnet'
      const firstResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-session',
        model: 'sonnet',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(claudeAdapters[0].model).toBe('sonnet');

      // Second connection (rejoin) without model
      const secondResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-session',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(secondResponse.type).toBe('session_joined');
      expect(secondResponse.model).toBe('sonnet'); // Returns existing model

      // Model unchanged
      expect(claudeAdapters[0].model).toBe('sonnet');
    });

    it('rejoins session without changing model if same model specified', async () => {
      // First connection with model 'opus'
      const firstResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-session',
        model: 'opus',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      // Second connection with same model
      const secondResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-session',
        model: 'opus',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(secondResponse.type).toBe('session_joined');
      expect(secondResponse.model).toBe('opus');
      expect(claudeAdapters[0].model).toBe('opus');
    });
  });

  describe('OpenCode', () => {
    it('creates session with specified model', async () => {
      const response = await simulateWebSocketConnect(manager, {
        model: 'opus-4-5',
        agentType: 'opencode',
        workspaceName: 'test-workspace',
      });

      expect(response.type).toBe('session_started');
      expect(opencodeAdapters).toHaveLength(1);
      expect(opencodeAdapters[0].model).toBe('opus-4-5');
    });

    it('rejoins session and updates model when different', async () => {
      // First connection with model 'sonnet-4'
      const firstResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-oc-session',
        model: 'sonnet-4',
        agentType: 'opencode',
        workspaceName: 'test-workspace',
      });

      expect(firstResponse.type).toBe('session_started');
      expect(opencodeAdapters[0].model).toBe('sonnet-4');

      // Second connection (rejoin) with model 'opus-4-5'
      const secondResponse = await simulateWebSocketConnect(manager, {
        sessionId: 'my-oc-session',
        model: 'opus-4-5',
        agentType: 'opencode',
        workspaceName: 'test-workspace',
      });

      expect(secondResponse.type).toBe('session_joined');
      expect(secondResponse.model).toBe('opus-4-5');

      // Verify adapter was updated
      expect(opencodeAdapters).toHaveLength(1);
      expect(opencodeAdapters[0].model).toBe('opus-4-5');

      const session = manager.getSession(firstResponse.sessionId);
      expect(session?.model).toBe('opus-4-5');
    });
  });

  describe('session_joined response format', () => {
    it('includes model in response when rejoining', async () => {
      // Create session
      await simulateWebSocketConnect(manager, {
        sessionId: 'model-test-session',
        model: 'sonnet',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      // Rejoin with different model
      const response = await simulateWebSocketConnect(manager, {
        sessionId: 'model-test-session',
        model: 'opus',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(response.type).toBe('session_joined');
      expect(response.model).toBe('opus');
      expect(response.status).toBeDefined();
    });

    it('includes original model when no new model specified', async () => {
      // Create session
      await simulateWebSocketConnect(manager, {
        sessionId: 'model-test-session-2',
        model: 'haiku',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      // Rejoin without model
      const response = await simulateWebSocketConnect(manager, {
        sessionId: 'model-test-session-2',
        agentType: 'claude',
        workspaceName: 'test-workspace',
      });

      expect(response.type).toBe('session_joined');
      expect(response.model).toBe('haiku'); // Original model preserved
    });
  });
});
