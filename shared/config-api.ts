import type { ManagerConfig, ResolvedPaths, ValidationResult } from './config';

export interface ConfigGetResponse {
  config: ManagerConfig;
  resolvedPaths: ResolvedPaths;
  validation: ValidationResult;
}

export interface ConfigSaveResponse {
  requiresRestart: boolean;
  config: ManagerConfig;
  resolvedPaths: ResolvedPaths;
}
