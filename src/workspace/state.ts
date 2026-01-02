import { promises as fs } from 'fs';
import path from 'path';
import type { Workspace, WorkspaceState } from './types';
import { STATE_FILE } from '../shared/types';

export class StateManager {
  private statePath: string;
  private state: WorkspaceState | null = null;

  constructor(configDir: string) {
    this.statePath = path.join(configDir, STATE_FILE);
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

    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
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
}
