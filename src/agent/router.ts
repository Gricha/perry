import { os, ORPCError } from '@orpc/server';
import * as z from 'zod';
import os_module from 'os';
import { type AgentConfig } from '../shared/types';
import { getDockerVersion, execInContainer } from '../docker';
import type { WorkspaceManager } from '../workspace/manager';
import type { TerminalWebSocketServer } from '../terminal/websocket';
import { saveAgentConfig } from '../config/loader';

const WorkspaceStatusSchema = z.enum(['running', 'stopped', 'creating', 'error']);

const WorkspacePortsSchema = z.object({
  ssh: z.number(),
  http: z.number().optional(),
});

const WorkspaceInfoSchema = z.object({
  name: z.string(),
  status: WorkspaceStatusSchema,
  containerId: z.string(),
  created: z.string(),
  repo: z.string().optional(),
  ports: WorkspacePortsSchema,
});

const CredentialsSchema = z.object({
  env: z.record(z.string(), z.string()),
  files: z.record(z.string(), z.string()),
});

const ScriptsSchema = z.object({
  post_start: z.string().optional(),
});

const CodingAgentsSchema = z.object({
  opencode: z
    .object({
      api_key: z.string().optional(),
    })
    .optional(),
  github: z
    .object({
      token: z.string().optional(),
    })
    .optional(),
  claude_code: z
    .object({
      oauth_token: z.string().optional(),
      credentials_path: z.string().optional(),
    })
    .optional(),
});

export interface RouterContext {
  workspaces: WorkspaceManager;
  config: { get: () => AgentConfig; set: (config: AgentConfig) => void };
  configDir: string;
  startTime: number;
  terminalServer: TerminalWebSocketServer;
}

function mapErrorToORPC(err: unknown, defaultMessage: string): never {
  const message = err instanceof Error ? err.message : defaultMessage;
  if (message.includes('not found')) {
    throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
  }
  if (message.includes('already exists')) {
    throw new ORPCError('CONFLICT', { message });
  }
  throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
}

export function createRouter(ctx: RouterContext) {
  const listWorkspaces = os.handler(async () => {
    return ctx.workspaces.list();
  });

  const getWorkspace = os.input(z.object({ name: z.string() })).handler(async ({ input }) => {
    const workspace = await ctx.workspaces.get(input.name);
    if (!workspace) {
      throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
    }
    return workspace;
  });

  const createWorkspace = os
    .input(
      z.object({
        name: z.string(),
        clone: z.string().optional(),
        env: z.record(z.string(), z.string()).optional(),
      })
    )
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.create(input);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to create workspace');
      }
    });

  const deleteWorkspace = os.input(z.object({ name: z.string() })).handler(async ({ input }) => {
    try {
      ctx.terminalServer.closeConnectionsForWorkspace(input.name);
      await ctx.workspaces.delete(input.name);
      return { success: true };
    } catch (err) {
      mapErrorToORPC(err, 'Failed to delete workspace');
    }
  });

  const startWorkspace = os
    .input(z.object({ name: z.string() }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.start(input.name);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to start workspace');
      }
    });

  const stopWorkspace = os
    .input(z.object({ name: z.string() }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        ctx.terminalServer.closeConnectionsForWorkspace(input.name);
        return await ctx.workspaces.stop(input.name);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to stop workspace');
      }
    });

  const getLogs = os
    .input(z.object({ name: z.string(), tail: z.number().optional().default(100) }))
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.getLogs(input.name, input.tail);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to get logs');
      }
    });

  const getInfo = os.handler(async () => {
    let dockerVersion = 'unknown';
    try {
      dockerVersion = await getDockerVersion();
    } catch {
      dockerVersion = 'unavailable';
    }

    const allWorkspaces = await ctx.workspaces.list();

    return {
      hostname: os_module.hostname(),
      uptime: Math.floor((Date.now() - ctx.startTime) / 1000),
      workspacesCount: allWorkspaces.length,
      dockerVersion,
      terminalConnections: ctx.terminalServer.getConnectionCount(),
    };
  });

  const getCredentials = os.output(CredentialsSchema).handler(async () => {
    return ctx.config.get().credentials;
  });

  const updateCredentials = os
    .input(CredentialsSchema)
    .output(CredentialsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, credentials: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return input;
    });

  const getScripts = os.output(ScriptsSchema).handler(async () => {
    return ctx.config.get().scripts;
  });

  const updateScripts = os
    .input(ScriptsSchema)
    .output(ScriptsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, scripts: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return input;
    });

  const getAgents = os.output(CodingAgentsSchema).handler(async () => {
    return ctx.config.get().agents || {};
  });

  const updateAgents = os
    .input(CodingAgentsSchema)
    .output(CodingAgentsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, agents: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return input;
    });

  const listSessions = os
    .input(z.object({ workspaceName: z.string() }))
    .handler(async ({ input }) => {
      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;

      const listDirsResult = await execInContainer(
        containerName,
        ['bash', '-c', 'ls -1 /home/workspace/.claude/projects/ 2>/dev/null || echo ""'],
        { user: 'workspace' }
      );

      if (listDirsResult.exitCode !== 0 || !listDirsResult.stdout.trim()) {
        return { sessions: [] };
      }

      const projectDirs = listDirsResult.stdout.trim().split('\n').filter(Boolean);
      const sessions: Array<{
        id: string;
        name: string | null;
        agentType: string;
        projectPath: string;
        messageCount: number;
        lastActivity: string;
        firstPrompt: string | null;
      }> = [];

      for (const projectDir of projectDirs) {
        const listFilesResult = await execInContainer(
          containerName,
          [
            'bash',
            '-c',
            `ls -1t /home/workspace/.claude/projects/${projectDir}/*.jsonl 2>/dev/null || echo ""`,
          ],
          { user: 'workspace' }
        );

        if (listFilesResult.exitCode !== 0 || !listFilesResult.stdout.trim()) {
          continue;
        }

        const files = listFilesResult.stdout.trim().split('\n').filter(Boolean);

        for (const filePath of files) {
          const fileName = filePath.split('/').pop()?.replace('.jsonl', '') || '';

          const statResult = await execInContainer(containerName, ['stat', '-c', '%Y', filePath], {
            user: 'workspace',
          });

          const mtime =
            statResult.exitCode === 0 ? parseInt(statResult.stdout.trim(), 10) * 1000 : Date.now();

          const countResult = await execInContainer(
            containerName,
            ['bash', '-c', `wc -l < "${filePath}"`],
            { user: 'workspace' }
          );

          const messageCount =
            countResult.exitCode === 0 ? parseInt(countResult.stdout.trim(), 10) : 0;

          const headResult = await execInContainer(
            containerName,
            ['bash', '-c', `head -20 "${filePath}" | grep -m1 '"role":"user"' | head -1`],
            { user: 'workspace' }
          );

          let firstPrompt: string | null = null;
          if (headResult.exitCode === 0 && headResult.stdout.trim()) {
            try {
              const line = JSON.parse(headResult.stdout.trim());
              if (line.content) {
                const content = Array.isArray(line.content)
                  ? line.content.find((c: { type: string; text?: string }) => c.type === 'text')
                      ?.text
                  : line.content;
                firstPrompt = typeof content === 'string' ? content.slice(0, 200) : null;
              }
            } catch {
              firstPrompt = null;
            }
          }

          sessions.push({
            id: fileName,
            name: null,
            agentType: 'claude-code',
            projectPath: projectDir.replace(/-/g, '/'),
            messageCount,
            lastActivity: new Date(mtime).toISOString(),
            firstPrompt,
          });
        }
      }

      sessions.sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      return { sessions };
    });

  const getSession = os
    .input(z.object({ workspaceName: z.string(), sessionId: z.string() }))
    .handler(async ({ input }) => {
      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;

      const findResult = await execInContainer(
        containerName,
        [
          'bash',
          '-c',
          `find /home/workspace/.claude/projects -name "${input.sessionId}.jsonl" -type f 2>/dev/null | head -1`,
        ],
        { user: 'workspace' }
      );

      if (findResult.exitCode !== 0 || !findResult.stdout.trim()) {
        throw new ORPCError('NOT_FOUND', { message: 'Session not found' });
      }

      const filePath = findResult.stdout.trim();

      const catResult = await execInContainer(containerName, ['cat', filePath], {
        user: 'workspace',
      });

      if (catResult.exitCode !== 0) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Failed to read session' });
      }

      const lines = catResult.stdout.split('\n').filter(Boolean);
      const messages: Array<{
        type: string;
        content: string | null;
        timestamp: string | null;
      }> = [];

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.role === 'user' || obj.type === 'user') {
            const content = Array.isArray(obj.content)
              ? obj.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text
              : obj.content;
            messages.push({
              type: 'user',
              content: typeof content === 'string' ? content : null,
              timestamp: obj.timestamp || null,
            });
          } else if (obj.role === 'assistant' || obj.type === 'assistant') {
            const content = Array.isArray(obj.content)
              ? obj.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text
              : obj.content;
            messages.push({
              type: 'assistant',
              content: typeof content === 'string' ? content : null,
              timestamp: obj.timestamp || null,
            });
          }
        } catch {
          continue;
        }
      }

      return {
        id: input.sessionId,
        messages,
      };
    });

  return {
    workspaces: {
      list: listWorkspaces,
      get: getWorkspace,
      create: createWorkspace,
      delete: deleteWorkspace,
      start: startWorkspace,
      stop: stopWorkspace,
      logs: getLogs,
    },
    sessions: {
      list: listSessions,
      get: getSession,
    },
    info: getInfo,
    config: {
      credentials: {
        get: getCredentials,
        update: updateCredentials,
      },
      scripts: {
        get: getScripts,
        update: updateScripts,
      },
      agents: {
        get: getAgents,
        update: updateAgents,
      },
    },
  };
}

export type AppRouter = ReturnType<typeof createRouter>;
