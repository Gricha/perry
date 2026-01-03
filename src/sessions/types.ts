export interface SessionMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result';
  content?: string;
  timestamp?: string;
}

export interface SessionMetadata {
  id: string;
  name: string | null;
  agentType: 'claude-code' | 'opencode' | 'unknown';
  projectPath: string;
  messageCount: number;
  lastActivity: string;
  firstPrompt: string | null;
  filePath: string;
}

export interface SessionDetail extends SessionMetadata {
  messages: SessionMessage[];
}

export interface AgentSessionsResult {
  agentType: 'claude-code' | 'opencode' | 'unknown';
  sessions: SessionMetadata[];
}
