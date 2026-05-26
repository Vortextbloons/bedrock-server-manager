export interface PlayerRow {
  name: string;
  xuid?: string;
  online: boolean;
  isOperator: boolean;
  source: ('permissions' | 'allowlist' | 'online-only')[];
}

export interface PlayersGetResponse {
  players: PlayerRow[];
  maxPlayers: number;
}

export interface KickRequest { name: string; }
export interface OpRequest { name: string; }
export interface DeopRequest { name: string; }
export interface PermissionsPutRequest { content: unknown; }
export interface AllowlistPutRequest { content: unknown; }

// Ban-related types
export interface BanEntry {
  name: string;
  xuid?: string;
  reason?: string;
  source?: string;
  expires?: string;
}

export interface BanlistResponse {
  raw: string;
  parsed: BanEntry[];
}

export interface BanRequest {
  name: string;
  reason?: string;
}

export interface PardonRequest {
  name: string;
}

export interface TempBanOverlay {
  name: string;
  xuid?: string;
  reason?: string;
  expiresAt: string;
}

// Whitelist mode
export interface WhitelistModeRequest {
  enabled: boolean;
  sync?: boolean;
}

export interface WhitelistModeResponse {
  enabled: boolean;
}

// Bulk import
export interface BulkImportRequest {
  format: 'csv' | 'lines';
  content: string;
}

export interface BulkImportResponse {
  preview: string[];
  existing: number;
  new: number;
}

// Permission templates
export type TemplateName = 'member' | 'moderator' | 'admin';

export interface TemplateApplyRequest {
  playerName: string;
  template: TemplateName;
}

// Player notes
export interface PlayerNoteEntry {
  key: string;
  notes: string;
  updatedAt: string;
}

export interface PlayerNotesPutRequest {
  notes: string;
}

// Player history
export interface PlayerHistoryEntry {
  timestamp: string;
  name: string;
  event: 'join' | 'leave';
}

export interface PlayerHistoryResponse {
  entries: PlayerHistoryEntry[];
  total: number;
}
