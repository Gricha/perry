import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { createTerminalSession, TerminalSession } from './handler';
import { isControlMessage } from './types';

interface TerminalConnection {
  ws: WebSocket;
  session: TerminalSession;
  workspaceName: string;
}

export class TerminalWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<WebSocket, TerminalConnection> = new Map();
  private getContainerName: (workspaceName: string) => string;
  private isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;

  constructor(options: {
    getContainerName: (workspaceName: string) => string;
    isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  }) {
    this.wss = new WebSocketServer({ noServer: true });
    this.getContainerName = options.getContainerName;
    this.isWorkspaceRunning = options.isWorkspaceRunning;

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    workspaceName: string
  ): Promise<void> {
    const running = await this.isWorkspaceRunning(workspaceName);
    if (!running) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.end();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as WebSocket & { workspaceName: string }).workspaceName = workspaceName;
      this.wss.emit('connection', ws, request);
    });
  }

  private handleConnection(ws: WebSocket & { workspaceName?: string }): void {
    const workspaceName = ws.workspaceName;
    if (!workspaceName) {
      ws.close(1008, 'Missing workspace name');
      return;
    }

    const containerName = this.getContainerName(workspaceName);
    const session = createTerminalSession({
      containerName,
      user: 'workspace',
    });

    const connection: TerminalConnection = {
      ws,
      session,
      workspaceName,
    };
    this.connections.set(ws, connection);

    session.setOnData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    session.setOnExit((code) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, `Process exited with code ${code}`);
      }
      this.connections.delete(ws);
    });

    ws.on('message', (data: Buffer | string) => {
      const str = typeof data === 'string' ? data : data.toString();

      if (str.startsWith('{')) {
        try {
          const message = JSON.parse(str);
          if (isControlMessage(message)) {
            session.resize({ cols: message.cols, rows: message.rows });
            return;
          }
        } catch {
          // Not valid JSON control message, pass through as input
        }
      }

      session.write(data);
    });

    ws.on('close', () => {
      session.kill();
      this.connections.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      session.kill();
      this.connections.delete(ws);
    });

    try {
      session.start();
    } catch (err) {
      console.error('Failed to start terminal session:', err);
      ws.close(1011, 'Failed to start terminal');
      this.connections.delete(ws);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionsForWorkspace(workspaceName: string): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.workspaceName === workspaceName) {
        count++;
      }
    }
    return count;
  }

  closeConnectionsForWorkspace(workspaceName: string): void {
    for (const [ws, conn] of this.connections.entries()) {
      if (conn.workspaceName === workspaceName) {
        conn.session.kill();
        ws.close(1001, 'Workspace stopped');
        this.connections.delete(ws);
      }
    }
  }

  close(): void {
    for (const [ws, conn] of this.connections.entries()) {
      conn.session.kill();
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();
    this.wss.close();
  }
}
