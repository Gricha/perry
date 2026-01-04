import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseSessionFile, getSessionMetadata } from '../../src/sessions/parser';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Session Parser', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Claude Code JSONL Format', () => {
    it('parses user messages', async () => {
      const sessionFile = path.join(tempDir, 'user-msg.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"user","message":{"role":"user","content":"Hello world"},"timestamp":"2025-01-01T12:00:00Z"}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('user');
      expect(messages[0].content).toBe('Hello world');
      expect(messages[0].timestamp).toBe('2025-01-01T12:00:00Z');
    });

    it('parses assistant messages with text content', async () => {
      const sessionFile = path.join(tempDir, 'assistant-text.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello! How can I help?"}]},"timestamp":"2025-01-01T12:00:01Z"}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('assistant');
      expect(messages[0].content).toBe('Hello! How can I help?');
    });

    it('parses assistant messages with tool_use blocks', async () => {
      const sessionFile = path.join(tempDir, 'assistant-tool.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool_123","name":"Read","input":{"file_path":"/test.txt"}}]},"timestamp":"2025-01-01T12:00:02Z"}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('tool_use');
      expect(messages[0].toolName).toBe('Read');
      expect(messages[0].toolId).toBe('tool_123');
    });

    it('parses interleaved text and tool_use in correct order', async () => {
      const sessionFile = path.join(tempDir, 'interleaved.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"assistant","message":{"content":[{"type":"text","text":"Let me read that file."},{"type":"tool_use","id":"tool_1","name":"Read","input":{"file_path":"/a.txt"}},{"type":"text","text":"Now the second one."},{"type":"tool_use","id":"tool_2","name":"Read","input":{"file_path":"/b.txt"}}]}}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(4);
      expect(messages[0].type).toBe('assistant');
      expect(messages[0].content).toBe('Let me read that file.');
      expect(messages[1].type).toBe('tool_use');
      expect(messages[1].toolName).toBe('Read');
      expect(messages[2].type).toBe('assistant');
      expect(messages[2].content).toBe('Now the second one.');
      expect(messages[3].type).toBe('tool_use');
      expect(messages[3].toolId).toBe('tool_2');
    });

    it('parses user messages with tool_result content', async () => {
      const sessionFile = path.join(tempDir, 'tool-result.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool_123","content":"File contents here"}]}}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('tool_result');
      expect(messages[0].toolId).toBe('tool_123');
      expect(messages[0].content).toBe('File contents here');
    });

    it('parses result messages with success subtype', async () => {
      const sessionFile = path.join(tempDir, 'result-success.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"result","subtype":"success","session_id":"abc123","cost_usd":0.05,"num_turns":3}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('system');
      expect(messages[0].content).toContain('Session completed');
      expect(messages[0].content).toContain('3 turns');
      expect(messages[0].content).toContain('$0.0500');
    });

    it('parses result messages with error subtype', async () => {
      const sessionFile = path.join(tempDir, 'result-error.jsonl');
      await fs.writeFile(sessionFile, '{"type":"result","subtype":"error_max_turns"}\n');

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('system');
      expect(messages[0].content).toContain('error_max_turns');
    });

    it('skips system init messages', async () => {
      const sessionFile = path.join(tempDir, 'system-init.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"system","subtype":"init","session_id":"abc123","tools":[]}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(0);
    });

    it('handles ts epoch timestamps', async () => {
      const sessionFile = path.join(tempDir, 'epoch-ts.jsonl');
      const epochSeconds = 1704110400;
      await fs.writeFile(sessionFile, `{"type":"user","content":"Hello","ts":${epochSeconds}}\n`);

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      const timestamp = new Date(messages[0].timestamp!);
      expect(timestamp.getTime()).toBe(epochSeconds * 1000);
    });
  });

  describe('Complete Session Flow', () => {
    it('parses a full terminal-started session', async () => {
      const sessionFile = path.join(tempDir, 'full-session.jsonl');
      const lines = [
        '{"type":"system","subtype":"init","session_id":"test-123","tools":["Read","Write"]}',
        '{"type":"user","message":{"role":"user","content":"Read the README"},"timestamp":"2025-01-01T12:00:00Z"}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"I\'ll read the README file."},{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"README.md"}}]}}',
        '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"# Project\\nThis is a test project."}]}}',
        '{"type":"assistant","message":{"content":[{"type":"text","text":"The README contains project information."}]}}',
        '{"type":"result","subtype":"success","cost_usd":0.01,"num_turns":2}',
      ];
      await fs.writeFile(sessionFile, lines.join('\n') + '\n');

      const messages = await parseSessionFile(sessionFile);
      expect(messages.length).toBeGreaterThanOrEqual(5);

      const userMsgs = messages.filter((m) => m.type === 'user');
      const assistantMsgs = messages.filter((m) => m.type === 'assistant');
      const toolUseMsgs = messages.filter((m) => m.type === 'tool_use');
      const toolResultMsgs = messages.filter((m) => m.type === 'tool_result');
      const systemMsgs = messages.filter((m) => m.type === 'system');

      expect(userMsgs.length).toBe(1);
      expect(assistantMsgs.length).toBe(2);
      expect(toolUseMsgs.length).toBe(1);
      expect(toolResultMsgs.length).toBe(1);
      expect(systemMsgs.length).toBe(1);
    });
  });

  describe('Legacy Format Support', () => {
    it('parses role-based format (older sessions)', async () => {
      const sessionFile = path.join(tempDir, 'legacy-role.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"role":"user","content":"Hello"}\n{"role":"assistant","content":"Hi there!"}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('user');
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].type).toBe('assistant');
      expect(messages[1].content).toBe('Hi there!');
    });

    it('parses content as string directly', async () => {
      const sessionFile = path.join(tempDir, 'string-content.jsonl');
      await fs.writeFile(sessionFile, '{"type":"user","content":"Direct string content"}\n');

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Direct string content');
    });

    it('handles array content with text blocks', async () => {
      const sessionFile = path.join(tempDir, 'array-content.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"user","content":[{"type":"text","text":"Part 1"},{"type":"text","text":"Part 2"}]}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Part 1\nPart 2');
    });
  });

  describe('Session Metadata', () => {
    it('extracts first user prompt', async () => {
      const projectDir = path.join(tempDir, 'projects', 'test-project');
      await fs.mkdir(projectDir, { recursive: true });
      const sessionFile = path.join(projectDir, 'session-abc.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"user","message":{"content":"What is the meaning of life?"}}\n{"type":"assistant","message":{"content":[{"type":"text","text":"42"}]}}\n'
      );

      const metadata = await getSessionMetadata(sessionFile, 'claude-code');
      expect(metadata).not.toBeNull();
      expect(metadata!.firstPrompt).toBe('What is the meaning of life?');
    });

    it('extracts session name from system message', async () => {
      const projectDir = path.join(tempDir, 'projects', 'named-session');
      await fs.mkdir(projectDir, { recursive: true });
      const sessionFile = path.join(projectDir, 'session-named.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"system","subtype":"session_name","name":"My Custom Session"}\n{"type":"user","content":"Hello"}\n'
      );

      const metadata = await getSessionMetadata(sessionFile, 'claude-code');
      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe('My Custom Session');
    });

    it('returns null name when no session_name message exists', async () => {
      const projectDir = path.join(tempDir, 'projects', 'unnamed');
      await fs.mkdir(projectDir, { recursive: true });
      const sessionFile = path.join(projectDir, 'session-unnamed.jsonl');
      await fs.writeFile(sessionFile, '{"type":"user","content":"Hello"}\n');

      const metadata = await getSessionMetadata(sessionFile, 'claude-code');
      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('skips malformed JSON lines', async () => {
      const sessionFile = path.join(tempDir, 'malformed.jsonl');
      await fs.writeFile(
        sessionFile,
        '{"type":"user","content":"Good line"}\nnot valid json\n{"type":"assistant","content":"Also good"}\n'
      );

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(2);
    });

    it('handles empty content gracefully', async () => {
      const sessionFile = path.join(tempDir, 'empty-content.jsonl');
      await fs.writeFile(sessionFile, '{"type":"user","content":null}\n{"type":"user"}\n');

      const messages = await parseSessionFile(sessionFile);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBeUndefined();
      expect(messages[1].content).toBeUndefined();
    });
  });
});
