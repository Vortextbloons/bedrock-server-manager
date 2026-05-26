import fs from 'fs';
import path from 'path';
import { getPaths } from './config';
import { readProperties } from './properties-service';
import { ServerProcess } from './server-process';
import type { PlayerRow, BanEntry, TempBanOverlay, BulkImportResponse, PlayerNoteEntry, PlayerHistoryEntry, TemplateName } from '../shared/players';

type PermissionsEntry = {
  name: string;
  xuid?: string;
  permission?: string;
};

type AllowlistEntry = {
  name: string;
  xuid?: string;
  ignores_player_limit?: boolean;
};

function isOperatorPermission(permission?: string): boolean {
  if (!permission) return false;
  return permission.toLowerCase() === 'operator';
}

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildPermissionLookups(permissions: PermissionsEntry[]): {
  byName: Map<string, PermissionsEntry>;
  byXuid: Map<string, PermissionsEntry>;
} {
  const byName = new Map<string, PermissionsEntry>();
  const byXuid = new Map<string, PermissionsEntry>();
  for (const entry of permissions) {
    if (entry.name) byName.set(entry.name.toLowerCase(), entry);
    if (entry.xuid) byXuid.set(String(entry.xuid), entry);
  }
  return { byName, byXuid };
}

function resolveIsOperator(
  name: string,
  xuid: string | undefined,
  byName: Map<string, PermissionsEntry>,
  byXuid: Map<string, PermissionsEntry>,
): boolean {
  const byPlayerName = byName.get(name.toLowerCase());
  if (byPlayerName && isOperatorPermission(byPlayerName.permission)) return true;
  if (xuid) {
    const byPlayerXuid = byXuid.get(String(xuid));
    if (byPlayerXuid && isOperatorPermission(byPlayerXuid.permission)) return true;
  }
  return false;
}

function parsePermissionListOutput(output: string): Map<string, string> {
  const byName = new Map<string, string>();

  const jsonStart = output.indexOf('[');
  const jsonEnd = output.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1)) as PermissionsEntry[];
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry.name && entry.permission) {
            byName.set(entry.name.toLowerCase(), entry.permission.toLowerCase());
          }
        }
        return byName;
      }
    } catch {
      // fall through to line parsing
    }
  }

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonMatch = trimmed.match(/^([^:]+):\s*(operator|member|visitor)\s*$/i);
    if (colonMatch) {
      byName.set(colonMatch[1].trim().toLowerCase(), colonMatch[2].toLowerCase());
      continue;
    }

    const dashMatch = trimmed.match(/^([^(]+?)(?:\s*\([^)]*\))?\s*[-–]\s*(operator|member|visitor)\s*$/i);
    if (dashMatch) {
      byName.set(dashMatch[1].trim().toLowerCase(), dashMatch[2].toLowerCase());
    }
  }

  return byName;
}

async function getFilePlayers(): Promise<{
  map: Map<string, PlayerRow>;
  byName: Map<string, PermissionsEntry>;
  byXuid: Map<string, PermissionsEntry>;
}> {
  const { serverCore } = getPaths();
  const permissionsPath = path.join(serverCore, 'permissions.json');
  const allowlistPath = path.join(serverCore, 'allowlist.json');

  const permissions = readJsonArray<PermissionsEntry>(permissionsPath);
  const allowlist = readJsonArray<AllowlistEntry>(allowlistPath);
  const { byName, byXuid } = buildPermissionLookups(permissions);

  const map = new Map<string, PlayerRow>();

  for (const entry of permissions) {
    if (!entry.name) continue;
    const key = entry.name.toLowerCase();
    map.set(key, {
      name: entry.name,
      xuid: entry.xuid,
      online: false,
      isOperator: isOperatorPermission(entry.permission),
      source: ['permissions'],
    });
  }

  for (const entry of allowlist) {
    if (!entry.name) continue;
    const key = entry.name.toLowerCase();
    const existing = map.get(key);
    const xuid = entry.xuid ?? existing?.xuid;
    const isOperator = resolveIsOperator(entry.name, xuid, byName, byXuid);

    if (existing) {
      if (!existing.xuid && entry.xuid) {
        existing.xuid = entry.xuid;
      }
      if (!existing.source.includes('allowlist')) {
        existing.source.push('allowlist');
      }
      if (isOperator) existing.isOperator = true;
    } else {
      map.set(key, {
        name: entry.name,
        xuid: entry.xuid,
        online: false,
        isOperator,
        source: ['allowlist'],
      });
    }
  }

  for (const row of map.values()) {
    if (!row.isOperator) {
      row.isOperator = resolveIsOperator(row.name, row.xuid, byName, byXuid);
    }
  }

  return { map, byName, byXuid };
}

async function getMergedPlayers(serverProcess: ServerProcess): Promise<PlayerRow[]> {
  const { map, byName, byXuid } = await getFilePlayers();

  if (serverProcess.getStatus().running) {
    try {
      const listOutput = await serverProcess.runCommand('list');
      const onlineNames = serverProcess.parseListCommand(listOutput);

      let livePermissions = new Map<string, string>();
      try {
        const permOutput = await serverProcess.runCommand('permission list', {
          timeoutMs: 6000,
          idleWindowMs: 800,
        });
        livePermissions = parsePermissionListOutput(permOutput);
      } catch {
        // permission list may be unavailable
      }

      const freshPermissions = readJsonArray<PermissionsEntry>(
        path.join(getPaths().serverCore, 'permissions.json'),
      );
      const freshLookups = buildPermissionLookups(freshPermissions);

      for (const onlineName of onlineNames) {
        const key = onlineName.toLowerCase();
        const livePerm = livePermissions.get(key);
        const isOpFromLive = livePerm ? isOperatorPermission(livePerm) : false;
        const isOpFromFile = resolveIsOperator(
          onlineName,
          undefined,
          freshLookups.byName,
          freshLookups.byXuid,
        );

        const existing = map.get(key);
        if (existing) {
          existing.online = true;
          if (isOpFromLive || isOpFromFile) existing.isOperator = true;
          if (!existing.isOperator) {
            existing.isOperator = resolveIsOperator(
              existing.name,
              existing.xuid,
              freshLookups.byName,
              freshLookups.byXuid,
            );
          }
        } else {
          const allowlist = readJsonArray<AllowlistEntry>(
            path.join(getPaths().serverCore, 'allowlist.json'),
          );
          const allowEntry = allowlist.find((a) => a.name?.toLowerCase() === key);
          const xuid = allowEntry?.xuid;
          map.set(key, {
            name: onlineName,
            xuid,
            online: true,
            isOperator:
              isOpFromLive ||
              resolveIsOperator(onlineName, xuid, freshLookups.byName, freshLookups.byXuid),
            source: ['online-only'],
          });
        }
      }
    } catch {
      // Server may have stopped between the status check and command execution
    }
  } else {
    for (const row of map.values()) {
      if (!row.isOperator) {
        row.isOperator = resolveIsOperator(row.name, row.xuid, byName, byXuid);
      }
    }
  }

  return Array.from(map.values());
}

async function kick(name: string, serverProcess: ServerProcess): Promise<void> {
  await serverProcess.runCommand(`kick "${name}"`);
}

async function op(name: string, serverProcess: ServerProcess): Promise<void> {
  await serverProcess.runCommand(`op "${name}"`);
}

async function deop(name: string, serverProcess: ServerProcess): Promise<void> {
  await serverProcess.runCommand(`deop "${name}"`);
}

function getPermissions(): { raw: string; parsed: unknown } {
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'permissions.json');
  if (!fs.existsSync(filePath)) {
    return { raw: '', parsed: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return { raw, parsed };
  } catch {
    return { raw, parsed: [] };
  }
}

function writePermissions(content: unknown): { raw: string; parsed: unknown } {
  if (!Array.isArray(content)) {
    throw new Error('Content must be an array');
  }
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'permissions.json');
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  return getPermissions();
}

function getAllowlist(): { raw: string; parsed: unknown } {
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'allowlist.json');
  if (!fs.existsSync(filePath)) {
    return { raw: '', parsed: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return { raw, parsed };
  } catch {
    return { raw, parsed: [] };
  }
}

function writeAllowlist(content: unknown): { raw: string; parsed: unknown } {
  if (!Array.isArray(content)) {
    throw new Error('Content must be an array');
  }
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'allowlist.json');
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  return getAllowlist();
}

function getMaxPlayers(): number {
  const props = readProperties();
  const value = props.entries['max-players']?.value;
  const num = value ? parseInt(value, 10) : NaN;
  return Number.isNaN(num) ? 10 : num;
}

function getBanlist(): { raw: string; parsed: BanEntry[] } {
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'banlist.json');
  if (!fs.existsSync(filePath)) return { raw: '', parsed: [] };
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return { raw, parsed: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { raw, parsed: [] };
  }
}

function writeBanlist(content: unknown): { raw: string; parsed: BanEntry[] } {
  if (!Array.isArray(content)) throw new Error('Content must be an array');
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'banlist.json');
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  return getBanlist();
}

function addBanEntry(name: string, reason?: string): void {
  const { parsed } = getBanlist();
  if (parsed.some(b => b.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Player "${name}" is already banned`);
  }
  const entry: BanEntry = { name };
  if (reason) entry.reason = reason;
  parsed.push(entry);
  writeBanlist(parsed);
}

function removeBanEntry(name: string): void {
  const { parsed } = getBanlist();
  const filtered = parsed.filter(b => b.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === parsed.length) {
    throw new Error(`Player "${name}" is not banned`);
  }
  writeBanlist(filtered);
}

function readTempBans(): TempBanOverlay[] {
  const { managerData } = getPaths();
  const filePath = path.join(managerData, 'temp-bans.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeTempBans(data: TempBanOverlay[]): void {
  const { managerData } = getPaths();
  fs.mkdirSync(managerData, { recursive: true });
  const filePath = path.join(managerData, 'temp-bans.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function addTempBan(overlay: TempBanOverlay): void {
  const existing = readTempBans();
  existing.push(overlay);
  writeTempBans(existing);
}

function removeTempBan(name: string): void {
  const existing = readTempBans().filter(b => b.name.toLowerCase() !== name.toLowerCase());
  writeTempBans(existing);
}

function getExpiredTempBans(): TempBanOverlay[] {
  const now = new Date().toISOString();
  return readTempBans().filter(b => b.expiresAt <= now);
}

function getPlayerNotes(): PlayerNoteEntry[] {
  const { managerData } = getPaths();
  const filePath = path.join(managerData, 'player-notes.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (typeof data === 'object' && !Array.isArray(data)) {
      return Object.entries(data as Record<string, string>).map(([key, notes]) => ({
        key,
        notes,
        updatedAt: new Date().toISOString(),
      }));
    }
    return [];
  } catch { return []; }
}

function getPlayerNote(key: string): PlayerNoteEntry | null {
  const notes = getPlayerNotes();
  return notes.find(n => n.key.toLowerCase() === key.toLowerCase()) || null;
}

function writePlayerNote(key: string, notes: string): void {
  const { managerData } = getPaths();
  const filePath = path.join(managerData, 'player-notes.json');
  const existing = getPlayerNotes();
  const idx = existing.findIndex(n => n.key.toLowerCase() === key.toLowerCase());
  const entry: PlayerNoteEntry = { key, notes, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.push(entry);
  }
  const map: Record<string, string> = {};
  for (const n of existing) {
    map[n.key] = n.notes;
  }
  fs.writeFileSync(filePath, JSON.stringify(map, null, 2) + '\n', 'utf-8');
}

const MAX_HISTORY_LINES = 10_000;

function appendHistory(entry: PlayerHistoryEntry): void {
  const { managerData } = getPaths();
  const filePath = path.join(managerData, 'player-history.jsonl');
  const line = JSON.stringify(entry) + '\n';
  fs.mkdirSync(managerData, { recursive: true });
  fs.appendFileSync(filePath, line, 'utf-8');
}

function trimHistoryFile(): void {
  const { managerData } = getPaths();
  const filePath = path.join(managerData, 'player-history.jsonl');
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  if (lines.length <= MAX_HISTORY_LINES) return;

  const kept = lines.slice(-MAX_HISTORY_LINES);
  fs.writeFileSync(filePath, kept.join('\n') + '\n', 'utf-8');
}

function getWhitelistMode(): { enabled: boolean } {
  const props = readProperties();
  const value = props.entries['allow-list']?.value?.toLowerCase();
  return { enabled: value === 'true' };
}

function syncAllowlistRoster(): { added: number } {
  const { parsed: permissions } = getPermissions();
  const { parsed: allowlist } = getAllowlist() as { parsed: AllowlistEntry[] };
  if (!Array.isArray(permissions) || !Array.isArray(allowlist)) {
    return { added: 0 };
  }

  const existing = new Set(allowlist.map((a) => a.name?.toLowerCase()).filter(Boolean));
  let added = 0;

  for (const entry of permissions) {
    if (!entry.name) continue;
    const key = entry.name.toLowerCase();
    if (existing.has(key)) continue;
    allowlist.push({ name: entry.name, xuid: entry.xuid });
    existing.add(key);
    added += 1;
  }

  if (added > 0) {
    writeAllowlist(allowlist);
  }

  return { added };
}

function getPlayerHistory(search?: string, limit = 100): { entries: PlayerHistoryEntry[]; total: number } {
  const { managerData } = getPaths();
  const filePath = path.join(managerData, 'player-history.jsonl');
  if (!fs.existsSync(filePath)) return { entries: [], total: 0 };

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const entries: PlayerHistoryEntry[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as PlayerHistoryEntry;
      if (!search || entry.name.toLowerCase().includes(search.toLowerCase())) {
        entries.push(entry);
      }
    } catch {}
  }
  const total = entries.length;
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { entries: entries.slice(0, limit), total };
}

function parseImportContent(content: string, format: 'csv' | 'lines'): string[] {
  const raw: string[] = [];
  if (format === 'csv') {
    for (const line of content.split(/[\n\r]+/)) {
      for (const cell of line.split(/[,;\t]/)) {
        const name = cell.trim();
        if (name) raw.push(name);
      }
    }
  } else {
    raw.push(...content.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean));
  }
  return [...new Set(raw)];
}

function previewBulkImport(content: string, format: 'csv' | 'lines'): BulkImportResponse {
  const names = parseImportContent(content, format);
  const { parsed: allowlist } = getAllowlist() as { parsed: AllowlistEntry[] };
  const existingNames = new Set(allowlist.map((a: AllowlistEntry) => a.name.toLowerCase()));

  const preview = names.filter(n => !existingNames.has(n.toLowerCase()));
  return { preview, existing: names.length - preview.length, new: preview.length };
}

function applyBulkImport(content: string, format: 'csv' | 'lines'): void {
  const preview = previewBulkImport(content, format);
  const { parsed: allowlist } = getAllowlist() as { parsed: AllowlistEntry[] };
  for (const name of preview.preview) {
    allowlist.push({ name });
  }
  writeAllowlist(allowlist);
}

const PERMISSION_TEMPLATES: Record<TemplateName, Partial<PermissionsEntry>> = {
  member: { permission: 'member' },
  moderator: { permission: 'operator' },
  admin: { permission: 'operator' },
};

function applyPermissionTemplate(playerName: string, template: TemplateName): void {
  const { parsed: permissions } = getPermissions();
  if (!Array.isArray(permissions)) throw new Error('Invalid permissions format');

  const templateData = PERMISSION_TEMPLATES[template];
  const idx = permissions.findIndex(
    (p: any) => p.name?.toLowerCase() === playerName.toLowerCase()
  );

  if (idx >= 0) {
    permissions[idx] = { ...permissions[idx], ...templateData };
  } else {
    permissions.push({ name: playerName, ...templateData });
  }

  writePermissions(permissions);
}

export {
  getMergedPlayers,
  kick,
  op,
  deop,
  getPermissions,
  writePermissions,
  getAllowlist,
  writeAllowlist,
  getMaxPlayers,
  getBanlist,
  writeBanlist,
  addBanEntry,
  removeBanEntry,
  readTempBans,
  writeTempBans,
  addTempBan,
  removeTempBan,
  getExpiredTempBans,
  getPlayerNotes,
  getPlayerNote,
  writePlayerNote,
  appendHistory,
  trimHistoryFile,
  getPlayerHistory,
  getWhitelistMode,
  syncAllowlistRoster,
  previewBulkImport,
  applyBulkImport,
  applyPermissionTemplate,
  PERMISSION_TEMPLATES,
};
