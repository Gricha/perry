import { accessSync, constants } from 'fs';
import { BaseTerminalSession, type SpawnConfig } from './base-handler';
import type { TerminalSize } from './types';
import { homedir } from 'os';

export interface HostTerminalOptions {
  shell?: string;
  size?: TerminalSize;
  workDir?: string;
}

function shellExistsOnHost(shell: string): boolean {
  try {
    accessSync(shell, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveHostShell(preferred?: string): string {
  const fallback = '/bin/bash';
  if (!preferred) return process.env.SHELL || fallback;
  if (shellExistsOnHost(preferred)) return preferred;
  return process.env.SHELL || fallback;
}

export class HostTerminalSession extends BaseTerminalSession {
  private workDir: string;

  constructor(options: HostTerminalOptions = {}) {
    super(resolveHostShell(options.shell), options.size);
    this.workDir = options.workDir || homedir();
  }

  protected getSpawnConfig(): SpawnConfig {
    return {
      command: [this.shell, '-l'],
      cwd: this.workDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    };
  }
}

export function createHostTerminalSession(options?: HostTerminalOptions): HostTerminalSession {
  return new HostTerminalSession(options);
}
