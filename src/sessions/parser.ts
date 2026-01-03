import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import type { SessionMetadata, SessionMessage, SessionDetail } from './types';

function decodeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/');
}

interface JsonlMessage {
  type?: string;
  subtype?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
  content?: string | Array<{ type: string; text?: string }>;
  role?: string;
  timestamp?: string;
  ts?: number;
}

function extractContent(
  content: string | Array<{ type: string; text?: string }> | undefined
): string | null {
  if (!content) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts = content.filter((c) => c.type === 'text' && c.text).map((c) => c.text);
    return textParts.join('\n') || null;
  }
  return null;
}

function parseJsonlLine(line: string): SessionMessage | null {
  try {
    const obj = JSON.parse(line) as JsonlMessage;

    if (obj.type === 'user' || obj.role === 'user') {
      const content = extractContent(obj.content || obj.message?.content);
      return {
        type: 'user',
        content: content || undefined,
        timestamp: obj.timestamp || (obj.ts ? new Date(obj.ts).toISOString() : undefined),
      };
    }

    if (obj.type === 'assistant' || obj.role === 'assistant') {
      const content = extractContent(obj.content || obj.message?.content);
      return {
        type: 'assistant',
        content: content || undefined,
        timestamp: obj.timestamp || (obj.ts ? new Date(obj.ts).toISOString() : undefined),
      };
    }

    if (obj.type === 'system' && obj.subtype !== 'init') {
      return {
        type: 'system',
        content: extractContent(obj.content) || undefined,
        timestamp: obj.timestamp,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function parseSessionFile(filePath: string): Promise<SessionMessage[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  const messages: SessionMessage[] = [];

  for (const line of lines) {
    const msg = parseJsonlLine(line);
    if (msg) {
      messages.push(msg);
    }
  }

  return messages;
}

export async function getSessionMetadata(
  filePath: string,
  agentType: 'claude-code' | 'opencode' | 'unknown'
): Promise<SessionMetadata | null> {
  try {
    const fileName = basename(filePath, '.jsonl');
    const dirName = basename(join(filePath, '..'));
    const projectPath = decodeProjectPath(dirName);

    const fileStat = await stat(filePath);
    const messages = await parseSessionFile(filePath);

    const userMessages = messages.filter((m) => m.type === 'user');
    const firstPrompt = userMessages.length > 0 ? userMessages[0].content || null : null;

    let sessionName: string | null = null;
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'system' && obj.subtype === 'session_name') {
          sessionName = obj.name || null;
          break;
        }
      } catch {
        continue;
      }
    }

    return {
      id: fileName,
      name: sessionName,
      agentType,
      projectPath,
      messageCount: messages.length,
      lastActivity: fileStat.mtime.toISOString(),
      firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
      filePath,
    };
  } catch {
    return null;
  }
}

export async function listClaudeCodeSessions(homeDir: string): Promise<SessionMetadata[]> {
  const claudeDir = join(homeDir, '.claude', 'projects');
  const sessions: SessionMetadata[] = [];

  try {
    const projectDirs = await readdir(claudeDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(claudeDir, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const files = await readdir(projectPath);
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const filePath = join(projectPath, file);
        const metadata = await getSessionMetadata(filePath, 'claude-code');
        if (metadata) {
          sessions.push(metadata);
        }
      }
    }

    sessions.sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    return sessions;
  } catch {
    return [];
  }
}

export async function getSessionDetail(
  sessionId: string,
  homeDir: string
): Promise<SessionDetail | null> {
  const claudeDir = join(homeDir, '.claude', 'projects');

  try {
    const projectDirs = await readdir(claudeDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(claudeDir, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const filePath = join(projectPath, `${sessionId}.jsonl`);
      try {
        await stat(filePath);
        const metadata = await getSessionMetadata(filePath, 'claude-code');
        if (!metadata) return null;

        const messages = await parseSessionFile(filePath);

        return {
          ...metadata,
          messages,
        };
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}
