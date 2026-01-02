export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalOptions {
  containerName: string;
  user?: string;
  shell?: string;
  size?: TerminalSize;
}

export interface ControlMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export function isControlMessage(data: unknown): data is ControlMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as ControlMessage).type === 'resize' &&
    typeof (data as ControlMessage).cols === 'number' &&
    typeof (data as ControlMessage).rows === 'number'
  );
}
