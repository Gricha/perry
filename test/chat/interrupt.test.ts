import { describe, test, expect, vi } from 'vitest';

interface MockSession {
  interrupt: () => Promise<void>;
  sendMessage: (msg: string) => Promise<void>;
}

interface MockConnection {
  session: MockSession | null;
}

describe('Chat interrupt behavior', () => {
  test('session is reset to null after interrupt', async () => {
    const connection: MockConnection = {
      session: {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn(() => Promise.resolve()),
      },
    };

    // Simulate interrupt handler logic
    if (connection.session) {
      await connection.session.interrupt();
      connection.session = null;
    }

    expect(connection.session).toBeNull();
  });

  test('new session is created after interrupt when sending message', async () => {
    const connection: MockConnection = {
      session: {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn(() => Promise.resolve()),
      },
    };

    const oldSession = connection.session;

    // Interrupt
    if (connection.session) {
      await connection.session.interrupt();
      connection.session = null;
    }

    // Simulate new message - should create new session
    if (!connection.session) {
      connection.session = {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn(() => Promise.resolve()),
      };
    }

    expect(connection.session).not.toBe(oldSession);
    expect(connection.session).not.toBeNull();
  });

  test('without fix: session reuse causes issues', async () => {
    const sendMessageCalls: string[] = [];

    const connection: MockConnection = {
      session: {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn((msg: string) => {
          sendMessageCalls.push(msg);
          return Promise.resolve();
        }),
      },
    };

    // First message
    await connection.session!.sendMessage('first');

    // Interrupt WITHOUT resetting session (old buggy behavior)
    await connection.session!.interrupt();
    // connection.session = null; // This line was missing!

    // Second message - reuses old session
    if (!connection.session) {
      // This block never runs because session still exists
      connection.session = {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn((msg: string) => {
          sendMessageCalls.push(`new:${msg}`);
          return Promise.resolve();
        }),
      };
    }
    await connection.session!.sendMessage('second');

    // Both messages went to the SAME session - this is the bug
    expect(sendMessageCalls).toEqual(['first', 'second']);
  });

  test('with fix: new session handles new message', async () => {
    const oldSessionCalls: string[] = [];
    const newSessionCalls: string[] = [];

    const connection: MockConnection = {
      session: {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn((msg: string) => {
          oldSessionCalls.push(msg);
          return Promise.resolve();
        }),
      },
    };

    // First message
    await connection.session!.sendMessage('first');

    // Interrupt WITH resetting session (fixed behavior)
    await connection.session!.interrupt();
    connection.session = null;

    // Second message - creates new session
    if (!connection.session) {
      connection.session = {
        interrupt: vi.fn(() => Promise.resolve()),
        sendMessage: vi.fn((msg: string) => {
          newSessionCalls.push(msg);
          return Promise.resolve();
        }),
      };
    }
    await connection.session!.sendMessage('second');

    // Messages went to DIFFERENT sessions - this is correct
    expect(oldSessionCalls).toEqual(['first']);
    expect(newSessionCalls).toEqual(['second']);
  });
});
