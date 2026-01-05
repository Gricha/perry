import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type {
  WorkspaceInfo,
  InfoResponse,
  CreateWorkspaceRequest,
  Credentials,
  Scripts,
  CodingAgents,
  AgentType,
  SessionInfo,
  SessionInfoWithWorkspace,
  SessionMessage,
  SessionDetail,
  HostInfo,
  SSHSettings,
  SSHKeyInfo,
} from './types'

export type {
  WorkspaceInfo,
  InfoResponse,
  CreateWorkspaceRequest,
  Credentials,
  Scripts,
  CodingAgents,
  AgentType,
  SessionInfo,
  SessionInfoWithWorkspace,
  SessionMessage,
  SessionDetail,
  HostInfo,
  SSHSettings,
  SSHKeyInfo,
}

function getRpcUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/rpc`
  }
  return '/rpc'
}

const link = new RPCLink({
  url: getRpcUrl(),
})

const client = createORPCClient<{
  workspaces: {
    list: () => Promise<WorkspaceInfo[]>
    get: (input: { name: string }) => Promise<WorkspaceInfo>
    create: (input: CreateWorkspaceRequest) => Promise<WorkspaceInfo>
    delete: (input: { name: string }) => Promise<{ success: boolean }>
    start: (input: { name: string }) => Promise<WorkspaceInfo>
    stop: (input: { name: string }) => Promise<WorkspaceInfo>
    logs: (input: { name: string; tail?: number }) => Promise<string>
    sync: (input: { name: string }) => Promise<{ success: boolean }>
    syncAll: () => Promise<{ synced: number; failed: number; results: { name: string; success: boolean; error?: string }[] }>
  }
  sessions: {
    list: (input: {
      workspaceName: string
      agentType?: AgentType
      limit?: number
      offset?: number
    }) => Promise<{ sessions: SessionInfo[]; total: number; hasMore: boolean }>
    listAll: (input: {
      agentType?: AgentType
      limit?: number
      offset?: number
    }) => Promise<{ sessions: SessionInfoWithWorkspace[]; total: number; hasMore: boolean }>
    get: (input: { workspaceName: string; sessionId: string; agentType?: AgentType; limit?: number; offset?: number }) => Promise<SessionDetail & { total: number; hasMore: boolean }>
    rename: (input: { workspaceName: string; sessionId: string; name: string }) => Promise<{ success: boolean }>
    clearName: (input: { workspaceName: string; sessionId: string }) => Promise<{ success: boolean }>
  }
  info: () => Promise<InfoResponse>
  host: {
    info: () => Promise<HostInfo>
    updateAccess: (input: { enabled: boolean }) => Promise<HostInfo>
  }
  config: {
    credentials: {
      get: () => Promise<Credentials>
      update: (input: Credentials) => Promise<Credentials>
    }
    scripts: {
      get: () => Promise<Scripts>
      update: (input: Scripts) => Promise<Scripts>
    }
    agents: {
      get: () => Promise<CodingAgents>
      update: (input: CodingAgents) => Promise<CodingAgents>
    }
    ssh: {
      get: () => Promise<SSHSettings>
      update: (input: SSHSettings) => Promise<SSHSettings>
      listKeys: () => Promise<SSHKeyInfo[]>
    }
  }
}>(link)

export const api = {
  listWorkspaces: () => client.workspaces.list(),
  getWorkspace: (name: string) => client.workspaces.get({ name }),
  createWorkspace: (data: CreateWorkspaceRequest) => client.workspaces.create(data),
  deleteWorkspace: (name: string) => client.workspaces.delete({ name }),
  startWorkspace: (name: string) => client.workspaces.start({ name }),
  stopWorkspace: (name: string) => client.workspaces.stop({ name }),
  getLogs: (name: string, tail = 100) => client.workspaces.logs({ name, tail }),
  syncWorkspace: (name: string) => client.workspaces.sync({ name }),
  syncAllWorkspaces: () => client.workspaces.syncAll(),
  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.list({ workspaceName, agentType, limit, offset }),
  listAllSessions: (agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.listAll({ agentType, limit, offset }),
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.get({ workspaceName, sessionId, agentType, limit, offset }),
  renameSession: (workspaceName: string, sessionId: string, name: string) =>
    client.sessions.rename({ workspaceName, sessionId, name }),
  clearSessionName: (workspaceName: string, sessionId: string) =>
    client.sessions.clearName({ workspaceName, sessionId }),
  getInfo: () => client.info(),
  getCredentials: () => client.config.credentials.get(),
  updateCredentials: (data: Credentials) => client.config.credentials.update(data),
  getScripts: () => client.config.scripts.get(),
  updateScripts: (data: Scripts) => client.config.scripts.update(data),
  getAgents: () => client.config.agents.get(),
  updateAgents: (data: CodingAgents) => client.config.agents.update(data),
  getHostInfo: () => client.host.info(),
  updateHostAccess: (enabled: boolean) => client.host.updateAccess({ enabled }),
  getSSHSettings: () => client.config.ssh.get(),
  updateSSHSettings: (data: SSHSettings) => client.config.ssh.update(data),
  listSSHKeys: () => client.config.ssh.listKeys(),
}

export function getTerminalUrl(name: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/rpc/terminal/${encodeURIComponent(name)}`
}

export function getChatUrl(name: string, agentType: AgentType = 'claude-code'): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const endpoint = agentType === 'opencode' ? 'opencode' : 'chat'
  return `${protocol}//${window.location.host}/rpc/${endpoint}/${encodeURIComponent(name)}`
}
