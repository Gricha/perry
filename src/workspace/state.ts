import { promises as fs } from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';
import type { Workspace, WorkspaceState } from './types';
import { STATE_FILE } from '../shared/types';

export class StateManager {
  private statePath: string;
  private state: WorkspaceState | null = null;
  private lockfilePath: string;

  constructor(configDir: string) {
    this.statePath = path.join(configDir, STATE_FILE);
    this.lockfilePath = path.join(configDir, '.state.lock');
  }

  private async ensureLockfile(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.lockfilePath), { recursive: true });
      await fs.writeFile(this.lockfilePath, '', { flag: 'wx' });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureLockfile();
    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(this.lockfilePath, {
        retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
      });
      return await fn();
    } finally {
      if (release) {
        await release();
      }
    }
  }

  async load(): Promise<WorkspaceState> {
    if (this.state) {
      return this.state;
    }

    try {
      const content = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(content) as WorkspaceState;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.state = { workspaces: {} };
      } else {
        throw err;
      }
    }

    return this.state;
  }

  async save(): Promise<void> {
    if (!this.state) {
      return;
    }

    await this.withLock(async () => {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    });
  }

  async getWorkspace(name: string): Promise<Workspace | null> {
    const state = await this.load();
    return state.workspaces[name] || null;
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    const state = await this.load();
    return Object.values(state.workspaces);
  }

  async setWorkspace(workspace: Workspace): Promise<void> {
    const state = await this.load();
    state.workspaces[workspace.name] = workspace;
    await this.save();
  }

  async deleteWorkspace(name: string): Promise<boolean> {
    const state = await this.load();
    if (state.workspaces[name]) {
      delete state.workspaces[name];
      await this.save();
      return true;
    }
    return false;
  }

  async updateWorkspaceStatus(
    name: string,
    status: Workspace['status']
  ): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(name);
    if (!workspace) {
      return null;
    }
    workspace.status = status;
    await this.setWorkspace(workspace);
    return workspace;
  }

  async touchWorkspace(name: string): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(name);
    if (!workspace) {
      return null;
    }
    workspace.lastUsed = new Date().toISOString();
    await this.setWorkspace(workspace);
    return workspace;
  }

  async setDisplayName(name: string, displayName: string | undefined): Promise<Workspace | null> {
    const workspace = await this.getWorkspace(name);
    if (!workspace) {
      return null;
    }
    workspace.displayName = displayName || undefined;
    await this.setWorkspace(workspace);
    return workspace;
  }
}
