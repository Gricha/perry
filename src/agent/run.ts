import { createServer, IncomingMessage, ServerResponse } from 'http';
import os from 'os';
import { loadAgentConfig, getConfigDir, ensureConfigDir } from '../config/loader';
import { DEFAULT_PORT, type AgentConfig } from '../shared/types';
import { WorkspaceManager } from '../workspace/manager';
import { getDockerVersion, containerRunning } from '../docker';
import { TerminalWebSocketServer } from '../terminal/websocket';

const startTime = Date.now();
const CONTAINER_PREFIX = 'workspace-';

async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function createAgentServer(configDir: string, config: AgentConfig) {
  const workspaces = new WorkspaceManager(configDir, config);

  const terminalServer = new TerminalWebSocketServer({
    getContainerName: (name) => `${CONTAINER_PREFIX}${name}`,
    isWorkspaceRunning: async (name) => {
      const containerName = `${CONTAINER_PREFIX}${name}`;
      return containerRunning(containerName);
    },
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const method = req.method;
    const pathname = url.pathname;

    try {
      if (pathname === '/health' && method === 'GET') {
        sendJson(res, 200, { status: 'ok', version: '2.0.0' });
        return;
      }

      if (pathname === '/api/v1/info' && method === 'GET') {
        let dockerVersion = 'unknown';
        try {
          dockerVersion = await getDockerVersion();
        } catch {
          dockerVersion = 'unavailable';
        }

        const allWorkspaces = await workspaces.list();

        sendJson(res, 200, {
          hostname: os.hostname(),
          uptime: Math.floor((Date.now() - startTime) / 1000),
          workspacesCount: allWorkspaces.length,
          dockerVersion,
          terminalConnections: terminalServer.getConnectionCount(),
        });
        return;
      }

      if (pathname === '/api/v1/workspaces' && method === 'GET') {
        const list = await workspaces.list();
        sendJson(res, 200, list);
        return;
      }

      if (pathname === '/api/v1/workspaces' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name || typeof body.name !== 'string') {
          sendJson(res, 400, { error: 'Name is required', code: 'MISSING_NAME' });
          return;
        }

        try {
          const workspace = await workspaces.create({
            name: body.name,
            clone: typeof body.clone === 'string' ? body.clone : undefined,
            env: typeof body.env === 'object' ? (body.env as Record<string, string>) : undefined,
          });
          sendJson(res, 201, workspace);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create workspace';
          if (message.includes('already exists')) {
            sendJson(res, 409, { error: message, code: 'ALREADY_EXISTS' });
          } else if (message.includes('not found')) {
            sendJson(res, 400, { error: message, code: 'IMAGE_NOT_FOUND' });
          } else {
            sendJson(res, 500, { error: message, code: 'CREATE_FAILED' });
          }
        }
        return;
      }

      const workspaceMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
      if (workspaceMatch) {
        const name = decodeURIComponent(workspaceMatch[1]);

        if (method === 'GET') {
          const workspace = await workspaces.get(name);
          if (!workspace) {
            sendJson(res, 404, { error: 'Workspace not found', code: 'NOT_FOUND' });
            return;
          }
          sendJson(res, 200, workspace);
          return;
        }

        if (method === 'DELETE') {
          try {
            terminalServer.closeConnectionsForWorkspace(name);
            await workspaces.delete(name);
            sendJson(res, 200, { success: true });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete workspace';
            if (message.includes('not found')) {
              sendJson(res, 404, { error: 'Workspace not found', code: 'NOT_FOUND' });
            } else {
              sendJson(res, 500, { error: message, code: 'DELETE_FAILED' });
            }
          }
          return;
        }
      }

      const actionMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/(start|stop)$/);
      if (actionMatch && method === 'POST') {
        const name = decodeURIComponent(actionMatch[1]);
        const action = actionMatch[2];

        try {
          if (action === 'stop') {
            terminalServer.closeConnectionsForWorkspace(name);
          }
          const workspace =
            action === 'start' ? await workspaces.start(name) : await workspaces.stop(name);
          sendJson(res, 200, workspace);
        } catch (err) {
          const message = err instanceof Error ? err.message : `Failed to ${action} workspace`;
          if (message.includes('not found')) {
            sendJson(res, 404, { error: 'Workspace not found', code: 'NOT_FOUND' });
          } else {
            sendJson(res, 500, { error: message, code: `${action.toUpperCase()}_FAILED` });
          }
        }
        return;
      }

      const logsMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/logs$/);
      if (logsMatch && method === 'GET') {
        const name = decodeURIComponent(logsMatch[1]);
        const tail = parseInt(url.searchParams.get('tail') || '100', 10);

        try {
          const logs = await workspaces.getLogs(name, tail);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(logs);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to get logs';
          if (message.includes('not found')) {
            sendJson(res, 404, { error: 'Workspace not found', code: 'NOT_FOUND' });
          } else {
            sendJson(res, 500, { error: message, code: 'LOGS_FAILED' });
          }
        }
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('Request error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const terminalMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/terminal$/);

    if (terminalMatch) {
      const workspaceName = decodeURIComponent(terminalMatch[1]);
      await terminalServer.handleUpgrade(request, socket, head, workspaceName);
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  return { server, terminalServer };
}

export interface StartAgentOptions {
  port?: number;
  configDir?: string;
}

export async function startAgent(options: StartAgentOptions = {}): Promise<void> {
  const configDir = options.configDir || getConfigDir();

  await ensureConfigDir(configDir);

  const config = await loadAgentConfig(configDir);
  const port =
    options.port || parseInt(process.env.WS_PORT || '', 10) || config.port || DEFAULT_PORT;

  console.log(`[agent] Config directory: ${configDir}`);
  console.log(`[agent] Starting on port ${port}...`);

  const { server, terminalServer } = createAgentServer(configDir, config);

  server.listen(port, '::', () => {
    console.log(`[agent] Agent running at http://localhost:${port}`);
    console.log(
      `[agent] WebSocket terminal available at ws://localhost:${port}/api/v1/workspaces/:name/terminal`
    );
  });

  const shutdown = () => {
    console.log('[agent] Shutting down...');
    terminalServer.close();
    server.close(() => {
      console.log('[agent] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return new Promise(() => {});
}
