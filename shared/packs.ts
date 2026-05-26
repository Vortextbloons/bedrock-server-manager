export type PackType = 'behavior' | 'resource';

export interface PackManifest {
  header: {
    uuid: string;
    name: string;
    version: number[];
  };
  modules?: Array<{ type: string; [key: string]: unknown }>;
}

export interface PackEntry {
  packId: string;
  name: string;
  version: number[];
  type: PackType;
  enabled: boolean;
}

export interface PacksGetResponse {
  behavior: PackEntry[];
  resource: PackEntry[];
}

export interface PackEnableRequest {
  packId: string;
  type: PackType;
}

export interface PackDisableRequest {
  packId: string;
  type: PackType;
}

export interface PackInstallResponse {
  entries: PackEntry[];
}

export interface PackConflict {
  uuid: string;
  names: string[];
  types: PackType[];
  count: number;
}

export interface PackConflictResponse {
  conflicts: PackConflict[];
  totalConflicts: number;
}

export interface VersionWarning {
  packId: string;
  name: string;
  minEngineVersion: number[];
  serverVersion: string;
  warning: string;
}

export interface PackDepsResponse {
  warnings: VersionWarning[];
  serverVersion: string;
}

export interface PackReplaceRequest {
  packId: string;
  type: PackType;
}

export interface PackReplaceResponse {
  previous: PackEntry;
  next: PackEntry;
  breaking: boolean;
}

export interface WorldPackInfo {
  worldName: string;
  behaviorPacks: Array<{ pack_id: string; version: number[] }>;
  resourcePacks: Array<{ pack_id: string; version: number[] }>;
}

export interface WorldPacksResponse {
  packs: WorldPackInfo[];
}
