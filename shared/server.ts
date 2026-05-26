export type ServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ServerStatus {
  state: ServerState;
  running: boolean;
  pid: number | null;
  uptime: number | null;
  startTime?: number | null;
  operationActive?: boolean;
}

export interface StateChangePayload {
  state: ServerState;
  pid?: number;
  exitCode?: number;
}
