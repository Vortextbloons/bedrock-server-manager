export const EDITABLE_PROPERTY_KEYS = [
  'server-name',
  'gamemode',
  'difficulty',
  'max-players',
  'server-port',
  'server-portv6',
  'level-name',
  'online-mode',
  'allow-cheats',
  'view-distance',
  'tick-distance',
  'player-idle-timeout',
  'default-player-permission-level',
  'allow-list',
] as const;

export type EditablePropertyKey = (typeof EDITABLE_PROPERTY_KEYS)[number];

export interface PropertyEntry {
  value: string;
  comment?: string;
}

export interface PropertiesGetResponse {
  raw: string;
  entries: Record<string, PropertyEntry>;
  editable: EditablePropertyKey[];
}

export interface PropertiesPutRequest {
  updates: Partial<Record<EditablePropertyKey, string>>;
}
