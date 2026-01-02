import type {
  WorkspaceInfo,
  CreateWorkspaceRequest,
  HealthResponse,
  InfoResponse,
  ApiError,
} from '../shared/types';

export interface ApiClientOptions {
  baseUrl: string;
  timeout?: number;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: ApiError | null = null;
        try {
          errorData = (await response.json()) as ApiError;
        } catch {
          // Response wasn't JSON
        }

        throw new ApiClientError(
          errorData?.error || `Request failed with status ${response.status}`,
          response.status,
          errorData?.code
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as T;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ApiClientError) {
        throw err;
      }

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new ApiClientError('Request timed out', 0, 'TIMEOUT');
        }
        if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
          throw new ApiClientError(
            `Cannot connect to agent at ${this.baseUrl}`,
            0,
            'CONNECTION_FAILED'
          );
        }
        throw new ApiClientError(err.message, 0, 'UNKNOWN');
      }

      throw err;
    }
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  async info(): Promise<InfoResponse> {
    return this.request<InfoResponse>('GET', '/api/v1/info');
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    return this.request<WorkspaceInfo[]>('GET', '/api/v1/workspaces');
  }

  async getWorkspace(name: string): Promise<WorkspaceInfo> {
    return this.request<WorkspaceInfo>('GET', `/api/v1/workspaces/${encodeURIComponent(name)}`);
  }

  async createWorkspace(request: CreateWorkspaceRequest): Promise<WorkspaceInfo> {
    return this.request<WorkspaceInfo>('POST', '/api/v1/workspaces', request);
  }

  async deleteWorkspace(name: string): Promise<void> {
    return this.request<void>('DELETE', `/api/v1/workspaces/${encodeURIComponent(name)}`);
  }

  async startWorkspace(name: string): Promise<WorkspaceInfo> {
    return this.request<WorkspaceInfo>(
      'POST',
      `/api/v1/workspaces/${encodeURIComponent(name)}/start`
    );
  }

  async stopWorkspace(name: string): Promise<WorkspaceInfo> {
    return this.request<WorkspaceInfo>(
      'POST',
      `/api/v1/workspaces/${encodeURIComponent(name)}/stop`
    );
  }

  async getLogs(name: string, tail?: number): Promise<string> {
    const query = tail ? `?tail=${tail}` : '';
    return this.request<string>(
      'GET',
      `/api/v1/workspaces/${encodeURIComponent(name)}/logs${query}`
    );
  }

  getTerminalUrl(name: string): string {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}/api/v1/workspaces/${encodeURIComponent(name)}/terminal`;
  }
}

export function createApiClient(worker: string, port?: number): ApiClient {
  let baseUrl: string;

  if (worker.includes('://')) {
    baseUrl = worker;
  } else if (worker.includes(':')) {
    baseUrl = `http://${worker}`;
  } else {
    const effectivePort = port || 7391;
    baseUrl = `http://${worker}:${effectivePort}`;
  }

  return new ApiClient({ baseUrl });
}
