export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface CommandError extends Error {
  code?: number;
  stdout: string;
  stderr: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'exited' | 'created' | 'paused' | 'dead';
  ports: PortMapping[];
}

export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: 'tcp' | 'udp';
}

export interface ContainerCreateOptions {
  name: string;
  image: string;
  detach?: boolean;
  privileged?: boolean;
  hostname?: string;
  env?: Record<string, string>;
  volumes?: VolumeMount[];
  ports?: PortMapping[];
  network?: string;
  workdir?: string;
  user?: string;
  entrypoint?: string[];
  command?: string[];
  labels?: Record<string, string>;
  restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
}

export interface VolumeMount {
  source: string;
  target: string;
  readonly?: boolean;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
}

export interface NetworkInfo {
  name: string;
  id: string;
  driver: string;
}

export interface ExecOptions {
  user?: string;
  workdir?: string;
  env?: Record<string, string>;
  interactive?: boolean;
  tty?: boolean;
}

export interface ExecResult extends CommandResult {
  exitCode: number;
}
