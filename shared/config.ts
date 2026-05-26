export interface ServerConfig {
  executable: string;
  stopCommand: string;
  gracefulTimeoutMs: number;
  forceKillTimeoutMs: number;
}

export interface PathsConfig {
  serverCore: string;
  backups: string;
  updateDrop: string;
  packDrop: string;
  managerData: string;
}

export interface ManagerConfig {
  port: number;
  paths: PathsConfig;
  server: ServerConfig;
  protected: string[];
}

export interface ResolvedPaths {
  serverCore: string;
  backups: string;
  updateDrop: string;
  packDrop: string;
  managerData: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
