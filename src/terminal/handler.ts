import { spawn, ChildProcess } from 'child_process';
import type { TerminalOptions, TerminalSize } from './types';

export class TerminalSession {
  private process: ChildProcess | null = null;
  private containerName: string;
  private user: string;
  private shell: string;
  private size: TerminalSize;
  private onData: ((data: Buffer) => void) | null = null;
  private onExit: ((code: number | null) => void) | null = null;

  constructor(options: TerminalOptions) {
    this.containerName = options.containerName;
    this.user = options.user || 'workspace';
    this.shell = options.shell || '/bin/bash';
    this.size = options.size || { cols: 80, rows: 24 };
  }

  start(): void {
    if (this.process) {
      throw new Error('Terminal session already started');
    }

    const args = [
      'exec',
      '-i',
      '-u',
      this.user,
      '-e',
      `TERM=${process.env.TERM || 'xterm-256color'}`,
      '-e',
      `COLUMNS=${this.size.cols}`,
      '-e',
      `LINES=${this.size.rows}`,
      this.containerName,
      this.shell,
    ];

    this.process = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      if (this.onData) {
        this.onData(data);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      if (this.onData) {
        this.onData(data);
      }
    });

    this.process.on('exit', (code) => {
      this.process = null;
      if (this.onExit) {
        this.onExit(code);
      }
    });

    this.process.on('error', (err) => {
      console.error('Terminal process error:', err);
      this.process = null;
      if (this.onExit) {
        this.onExit(1);
      }
    });
  }

  write(data: Buffer | string): void {
    if (!this.process?.stdin) {
      return;
    }
    this.process.stdin.write(data);
  }

  resize(size: TerminalSize): void {
    this.size = size;
    if (!this.process) {
      return;
    }

    const resizeProc = spawn('docker', [
      'exec',
      this.containerName,
      'stty',
      'cols',
      String(size.cols),
      'rows',
      String(size.rows),
    ]);

    resizeProc.on('error', () => {
      // Ignore resize errors - terminal resize is best-effort
    });
  }

  setOnData(callback: (data: Buffer) => void): void {
    this.onData = callback;
  }

  setOnExit(callback: (code: number | null) => void): void {
    this.onExit = callback;
  }

  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}

export function createTerminalSession(options: TerminalOptions): TerminalSession {
  return new TerminalSession(options);
}
