export interface WorldEntry {
  name: string;
  isActive: boolean;
  sizeBytes: number;
  modifiedAt: string | null;
  hasLevelDat: boolean;
}

export interface WorldsListResponse {
  worlds: WorldEntry[];
  activeWorld: string | null;
}

export interface ActivateWorldRequest {
  name: string;
}

export interface RenameWorldRequest {
  from: string;
  to: string;
}

export interface DeleteWorldRequest {
  confirmName: string;
  backup: boolean;
}

export interface ResetDimensionRequest {
  dimension: 'nether' | 'end';
  backup: boolean;
}

export interface LevelDatPropertiesOverlap {
  levelSeed?: string;
  levelType?: string;
  gamemode?: string;
  difficulty?: string;
}

export interface LevelDatInfo {
  seed?: number;
  generatorName?: string;
  gameType?: number;
  spawnX?: number;
  spawnY?: number;
  spawnZ?: number;
  difficulty?: number;
  editable: boolean;
  hasLevelDat: boolean;
  propertiesOverlap?: LevelDatPropertiesOverlap;
}
