import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage } from '../../src/chat/types';
import type { SessionStatus } from '../../src/session-manager/types';

/**
 * Tests for model selection across session reconnections.
 *
 * These tests verify the fix for a model mismatch bug where:
 * 1. User starts a session with model 'sonnet' (default or configured)
 * 2. UI displays 'opus' as selected model (from config)
 * 3. User reconnects to the session with model 'opus' in connect message
 * 4. Backend NOW correctly updates the session to use 'opus'
 *
 * The fix includes:
 * - AgentAdapter interface now has setModel(model: string) method
 * - SessionManager.setModel() updates both session.info.model AND adapter.model
 * - SessionManager.startSession() updates model when session already exists
 * - WebSocket handleConnect calls setModel when rejoining with different model
 * - session_joined response includes the model so client knows what's being used
 */

// Track model changes in mock adapters
interface MockAdapterInstance {
  model: string;
  agentSessionId?: string;
  setModel: (model: string) => void;
}

const claudeAdapters: MockAdapterInstance[] = [];
const opencodeAdapters: MockAdapterInstance[] = [];

vi.mock('../../src/session-manager/adapters/claude', () => ({
  ClaudeCodeAdapter: class MockClaudeAdapter {
    agentType = 'claude' as const;
    private status: SessionStatus = 'idle';
    agentSessionId?: string;
    model = 'sonnet'; // Default model
    private messageCallback?: (msg: ChatMessage) => void;
    private statusCallback?: (status: SessionStatus) => void;
    private errorCallback?: (err: Error) => void;

    constructor() {
      claudeAdapters.push(this);
    }

    async start(options: { model?: string; agentSessionId?: string }) {
      this.status = 'idle';
      if (options.model) {
        this.model = options.model;
      }
      if (options.agentSessionId) {
        this.agentSessionId = options.agentSessionId;
      }
    }

    async sendMessage() {
      if (!this.agentSessionId) {
        this.agentSessionId = `claude-session-${Date.now()}`;
      }
      this.status = 'running';
      this.statusCallback?.('running');
      // Simulate completion
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
    onMessage(cb: (msg: ChatMessage) => void) {
      this.messageCallback = cb;
    }
    onStatusChange(cb: (status: SessionStatus) => void) {
      this.statusCallback = cb;
    }
    onError(cb: (err: Error) => void) {
      this.errorCallback = cb;
    }
  },
}));

vi.mock('../../src/session-manager/adapters/opencode', () => ({
  OpenCodeAdapter: class MockOpenCodeAdapter {
    agentType = 'opencode' as const;
    private status: SessionStatus = 'idle';
    agentSessionId?: string;
    model?: string;
    private messageCallback?: (msg: ChatMessage) => void;
    private statusCallback?: (status: SessionStatus) => void;
    private errorCallback?: (err: Error) => void;

    constructor() {
      opencodeAdapters.push(this);
    }

    async start(options: { model?: string; agentSessionId?: string }) {
      this.status = 'idle';
      if (options.model) {
        this.model = options.model;
      }
      if (options.agentSessionId) {
        this.agentSessionId = options.agentSessionId;
      }
    }

    async sendMessage() {
      if (!this.agentSessionId) {
        this.agentSessionId = `opencode-session-${Date.now()}`;
      }
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
    onMessage(cb: (msg: ChatMessage) => void) {
      this.messageCallback = cb;
    }
    onStatusChange(cb: (status: SessionStatus) => void) {
      this.statusCallback = cb;
    }
    onError(cb: (err: Error) => void) {
      this.errorCallback = cb;
    }
  },
}));

vi.mock('../../src/docker', () => ({
  getContainerName: (name: string) => `workspace-${name}`,
}));

import { SessionManager } from '../../src/session-manager/manager';

describe('Model selection across session reconnections', () => {
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
    it('stores model in session info when session is created', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        model: 'opus',
      });

      const session = manager.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.model).toBe('opus');
    });

    it('passes model to adapter on session start', async () => {
      await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        model: 'opus',
      });

      expect(claudeAdapters).toHaveLength(1);
      expect(claudeAdapters[0].model).toBe('opus');
    });

    it('reconnecting to existing session updates to new model', async () => {
      // Step 1: Create session with model 'sonnet'
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        sessionId: 'my-session',
        model: 'sonnet',
      });

      expect(claudeAdapters).toHaveLength(1);
      expect(claudeAdapters[0].model).toBe('sonnet');

      // Step 2: "Reconnect" with model 'opus'
      // This simulates what happens when user changes model in UI and reconnects
      const reconnectedSessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        sessionId: 'my-session',
        model: 'opus', // User wants opus now
      });

      // The session ID should be the same (rejoined existing session)
      expect(reconnectedSessionId).toBe(sessionId);

      // No new adapter was created, but the existing adapter's model is updated
      expect(claudeAdapters).toHaveLength(1);

      // FIX VERIFIED: Session model is now updated to 'opus'
      const session = manager.getSession(sessionId);
      expect(session?.model).toBe('opus');

      // FIX VERIFIED: Adapter model is also updated
      expect(claudeAdapters[0].model).toBe('opus');
    });

    it('setModel updates session model', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        model: 'sonnet',
      });

      // setModel exists but is never called in the codebase
      manager.setModel(sessionId, 'opus');

      const session = manager.getSession(sessionId);
      expect(session?.model).toBe('opus');
    });

    it('setModel should also update adapter model', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        model: 'sonnet',
      });

      expect(claudeAdapters[0].model).toBe('sonnet');

      manager.setModel(sessionId, 'opus');

      // After fix, setModel should also update the adapter
      expect(claudeAdapters[0].model).toBe('opus'); // This will fail before fix
    });
  });

  describe('OpenCode', () => {
    it('stores model in session info when session is created', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'opencode',
        model: 'opus-4-5',
      });

      const session = manager.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.model).toBe('opus-4-5');
    });

    it('passes model to adapter on session start', async () => {
      await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'opencode',
        model: 'opus-4-5',
      });

      expect(opencodeAdapters).toHaveLength(1);
      expect(opencodeAdapters[0].model).toBe('opus-4-5');
    });

    it('reconnecting to existing session updates to new model', async () => {
      // Step 1: Create session with model 'sonnet-4'
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'opencode',
        sessionId: 'my-oc-session',
        model: 'sonnet-4',
      });

      expect(opencodeAdapters).toHaveLength(1);
      expect(opencodeAdapters[0].model).toBe('sonnet-4');

      // Step 2: "Reconnect" with model 'opus-4-5'
      const reconnectedSessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'opencode',
        sessionId: 'my-oc-session',
        model: 'opus-4-5',
      });

      expect(reconnectedSessionId).toBe(sessionId);
      expect(opencodeAdapters).toHaveLength(1);

      // FIX VERIFIED: Session model is now updated to 'opus-4-5'
      const session = manager.getSession(sessionId);
      expect(session?.model).toBe('opus-4-5');

      // FIX VERIFIED: Adapter model is also updated
      expect(opencodeAdapters[0].model).toBe('opus-4-5');
    });

    it('setModel should also update adapter model', async () => {
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'opencode',
        model: 'sonnet-4',
      });

      expect(opencodeAdapters[0].model).toBe('sonnet-4');

      manager.setModel(sessionId, 'opus-4-5');

      // After fix, setModel should also update the adapter
      expect(opencodeAdapters[0].model).toBe('opus-4-5'); // This will fail before fix
    });
  });

  describe('WebSocket connect handler simulation', () => {
    /**
     * This test simulates the websocket.ts handleConnect flow:
     * 1. Client sends connect with sessionId and model
     * 2. If session exists, it rejoins (findSession + connectClient)
     * 3. But the new model is ignored!
     */
    it('setModel updates both session info and adapter model', async () => {
      // Create initial session
      const sessionId = await manager.startSession({
        workspaceName: 'test-workspace',
        agentType: 'claude',
        model: 'sonnet',
      });

      // Simulate what websocket.ts does when rejoining
      const found = await manager.findSession(sessionId);
      expect(found).not.toBeNull();
      expect(found?.info.model).toBe('sonnet');

      // Client wants to use 'opus' now
      // FIX: setModel now updates both session.info.model AND adapter.model
      manager.setModel(sessionId, 'opus');

      const session = manager.getSession(sessionId);
      expect(session?.model).toBe('opus');

      // FIX VERIFIED: Adapter model is also updated
      expect(claudeAdapters[0].model).toBe('opus');
    });
  });
});

describe('session_joined response should include model', () => {
  /**
   * When a client rejoins a session, the server sends back session_joined.
   * This response should include the session's actual model so the client
   * can update its UI to reflect what model is actually being used.
   */
  it('getSession returns model in session info', async () => {
    const manager = new SessionManager();

    const sessionId = await manager.startSession({
      workspaceName: 'test-workspace',
      agentType: 'claude',
      model: 'opus',
    });

    const session = manager.getSession(sessionId);
    expect(session?.model).toBe('opus');

    await manager.disposeAll();
  });

  it('findSession returns model in session info', async () => {
    const manager = new SessionManager();

    const sessionId = await manager.startSession({
      workspaceName: 'test-workspace',
      agentType: 'claude',
      model: 'opus',
    });

    const found = await manager.findSession(sessionId);
    expect(found?.info.model).toBe('opus');

    await manager.disposeAll();
  });
});
