export interface Workspace {
  name: string;
  status: WorkspaceStatus;
  containerId: string;
  created: string;
  repo?: string;
  ports: {
    ssh: number;
    http?: number;
  };
}

export type WorkspaceStatus = 'running' | 'stopped' | 'creating' | 'error';

export interface CreateWorkspaceOptions {
  name: string;
  clone?: string;
  env?: Record<string, string>;
}

export interface WorkspaceState {
  workspaces: Record<string, Workspace>;
}
