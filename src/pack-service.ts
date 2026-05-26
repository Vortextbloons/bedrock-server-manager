import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import { getPaths } from './config';
import { readProperties } from './properties-service';
import { getBdsVersion } from './bds-version';
import type { PackType, PackEntry, PackManifest, PackConflict, VersionWarning, WorldPackInfo } from '../shared/packs';

function getActiveWorldName(): string | null {
  try {
    const props = readProperties();
    const levelName = props.entries['level-name']?.value;
    return levelName || null;
  } catch {
    return null;
  }
}

function getWorldPackJsonPath(type: PackType): string | null {
  const { serverCore } = getPaths();
  const worldName = getActiveWorldName();
  if (!worldName) return null;
  return path.join(serverCore, 'worlds', worldName, `world_${type}_packs.json`);
}

function readWorldPackJson(type: PackType): Array<{ pack_id: string; version: number[] }> {
  const filePath = getWorldPackJsonPath(type);
  if (!filePath || !fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {
    // ignore parse errors
  }
  return [];
}

function writeWorldPackJson(type: PackType, data: Array<{ pack_id: string; version: number[] }>): void {
  const filePath = getWorldPackJsonPath(type);
  if (!filePath) throw new Error('Cannot determine world pack JSON path');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function readValidKnownPacks(): Array<{ pack_id: string; [key: string]: unknown }> {
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'valid_known_packs.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {
    // ignore parse errors
  }
  return [];
}

function writeValidKnownPacks(data: Array<{ pack_id: string; [key: string]: unknown }>): void {
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'valid_known_packs.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function scanInstalled(type: PackType): PackEntry[] {
  const { serverCore } = getPaths();
  const packsDir = path.join(serverCore, `${type}_packs`);
  if (!fs.existsSync(packsDir)) return [];

  const enabledIds = new Set(readWorldPackJson(type).map((p) => p.pack_id));

  const entries: PackEntry[] = [];
  for (const name of fs.readdirSync(packsDir)) {
    const packDir = path.join(packsDir, name);
    const manifestPath = path.join(packDir, 'manifest.json');
    if (!fs.statSync(packDir).isDirectory() || !fs.existsSync(manifestPath)) continue;

    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw) as PackManifest;
      const uuid = manifest.header?.uuid;
      const packName = manifest.header?.name;
      const version = manifest.header?.version;
      if (!uuid) continue;

      entries.push({
        packId: uuid,
        name: packName || name,
        version: Array.isArray(version) ? version : [1, 0, 0],
        type,
        enabled: enabledIds.has(uuid),
      });
    } catch {
      // skip invalid packs
    }
  }
  return entries;
}

function determinePackTypeFromManifest(manifest: PackManifest): PackType | null {
  if (Array.isArray(manifest.modules)) {
    for (const mod of manifest.modules) {
      const modType = (mod.type as string)?.toLowerCase();
      if (modType === 'data') return 'behavior';
      if (modType === 'resources') return 'resource';
    }
  }
  return null;
}

const PACK_ARCHIVE_EXTS = new Set(['.zip', '.mcpack', '.mcaddon']);

function findPackDirectory(packId: string, type: PackType): string | null {
  const { serverCore } = getPaths();
  const packsDir = path.join(serverCore, `${type}_packs`);
  if (!fs.existsSync(packsDir)) return null;

  const direct = path.join(packsDir, packId);
  if (fs.existsSync(path.join(direct, 'manifest.json'))) {
    return direct;
  }

  for (const name of fs.readdirSync(packsDir)) {
    const packDir = path.join(packsDir, name);
    if (!fs.statSync(packDir).isDirectory()) continue;
    const manifestPath = path.join(packDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PackManifest;
      if (manifest.header?.uuid === packId) return packDir;
    } catch {
      // skip invalid manifests
    }
  }
  return null;
}

function findInnerArchives(dir: string): string[] {
  const archives: string[] = [];
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (PACK_ARCHIVE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        archives.push(fullPath);
      }
    }
  }
  walk(dir);
  return archives;
}

function findManifestPaths(dir: string): string[] {
  const manifests: string[] = [];
  function search(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        search(fullPath);
      } else if (entry.name === 'manifest.json') {
        manifests.push(fullPath);
      }
    }
  }
  search(dir);
  return manifests;
}

function copyRecursive(src: string, dest: string): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function installFromManifestPath(manifestPath: string, originalName: string): PackEntry {
  const { serverCore } = getPaths();
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw) as PackManifest;

  let type = determinePackTypeFromManifest(manifest);
  if (!type) {
    const lowerName = originalName.toLowerCase();
    if (lowerName.includes('resource')) type = 'resource';
    else if (lowerName.includes('behavior')) type = 'behavior';
    else throw new Error('Could not determine pack type from manifest or filename');
  }

  const uuid = manifest.header?.uuid;
  const name = manifest.header?.name || originalName;
  const version = Array.isArray(manifest.header?.version) ? manifest.header.version : [1, 0, 0];
  if (!uuid) {
    throw new Error('Manifest missing header.uuid');
  }

  const packRoot = path.dirname(manifestPath);
  const destDir = path.join(serverCore, `${type}_packs`, uuid);

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });
  copyRecursive(packRoot, destDir);

  return {
    packId: uuid,
    name,
    version,
    type,
    enabled: false,
  };
}

async function installPack(filePath: string, originalName: string): Promise<PackEntry[]> {
  let tempDir: string | null = null;
  try {
    const zip = new AdmZip(filePath);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-install-'));
    zip.extractAllTo(tempDir, true);

    const innerArchives = findInnerArchives(tempDir);
    if (innerArchives.length > 0) {
      const installed: PackEntry[] = [];
      for (const archivePath of innerArchives) {
        const entries = await installPack(archivePath, path.basename(archivePath));
        installed.push(...entries);
      }
      return installed;
    }

    const manifestPaths = findManifestPaths(tempDir);
    if (manifestPaths.length === 0) {
      throw new Error('No manifest.json found in archive');
    }

    return manifestPaths.map((manifestPath) => installFromManifestPath(manifestPath, originalName));
  } catch (err) {
    throw new Error(`Install failed: ${(err as Error).message}`);
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function enablePack(packId: string, type: PackType): void {
  const data = readWorldPackJson(type);
  if (!data.some((p) => p.pack_id === packId)) {
    const packDir = findPackDirectory(packId, type);
    const manifestPath = packDir ? path.join(packDir, 'manifest.json') : null;
    let version: number[] = [1, 0, 0];
    if (manifestPath && fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PackManifest;
        if (Array.isArray(manifest.header?.version)) {
          version = manifest.header.version;
        }
      } catch {
        // ignore parse errors
      }
    }
    data.push({ pack_id: packId, version });
    writeWorldPackJson(type, data);
  }
}

function disablePack(packId: string, type: PackType): void {
  const data = readWorldPackJson(type).filter((p) => p.pack_id !== packId);
  if (getWorldPackJsonPath(type)) {
    writeWorldPackJson(type, data);
  }
}

function deletePack(packId: string, type: PackType): void {
  const packDir = findPackDirectory(packId, type);
  if (packDir) {
    fs.rmSync(packDir, { recursive: true, force: true });
  }

  // Remove from world pack json
  const worldData = readWorldPackJson(type).filter((p) => p.pack_id !== packId);
  if (getWorldPackJsonPath(type)) {
    writeWorldPackJson(type, worldData);
  }

  // Remove from valid_known_packs.json
  const known = readValidKnownPacks().filter((p) => p.pack_id !== packId);
  writeValidKnownPacks(known);
}

// CONFLICT SCANNER
function scanConflicts(): { conflicts: PackConflict[]; totalConflicts: number } {
  const behavior = scanInstalled('behavior');
  const resource = scanInstalled('resource');

  const uuidMap = new Map<string, { names: string[]; types: Set<PackType> }>();

  for (const pack of [...behavior, ...resource]) {
    const existing = uuidMap.get(pack.packId);
    if (existing) {
      existing.names.push(pack.name);
      existing.types.add(pack.type);
    } else {
      uuidMap.set(pack.packId, { names: [pack.name], types: new Set([pack.type]) });
    }
  }

  const conflicts: PackConflict[] = [];
  for (const [uuid, info] of uuidMap) {
    if (info.names.length > 1) {
      conflicts.push({
        uuid,
        names: [...new Set(info.names)],
        types: [...info.types],
        count: info.names.length,
      });
    }
  }

  return { conflicts, totalConflicts: conflicts.length };
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function getServerVersion(): string {
  try {
    readProperties();
    return getBdsVersion();
  } catch {
    return 'unknown';
  }
}

function checkVersionWarnings(): { warnings: VersionWarning[]; serverVersion: string } {
  const serverVersion = getServerVersion();
  if (serverVersion === 'unknown') return { warnings: [], serverVersion };

  const serverParts = serverVersion.split('.').map(Number);
  const behavior = scanInstalled('behavior');
  const resource = scanInstalled('resource');

  const warnings: VersionWarning[] = [];

  for (const pack of [...behavior, ...resource]) {
    const packDir = findPackDirectory(pack.packId, pack.type);
    if (!packDir) continue;

    const manifestPath = path.join(packDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PackManifest;
      const minVersion = (manifest.header as any)?.min_engine_version;

      if (Array.isArray(minVersion) && minVersion.length > 0) {
        const cmp = compareVersions(minVersion, serverParts);
        if (cmp > 0) {
          warnings.push({
            packId: pack.packId,
            name: pack.name,
            minEngineVersion: minVersion,
            serverVersion,
            warning: `Pack requires min engine version ${minVersion.join('.')} but server is ${serverVersion}`,
          });
        }
      }
    } catch {}
  }

  return { warnings, serverVersion };
}

function replacePack(packId: string, type: PackType): PackEntry | null {
  const { packDrop } = getPaths();
  const dropDir = path.join(packDrop, type);
  if (!fs.existsSync(dropDir)) return null;

  const existingDir = findPackDirectory(packId, type);
  if (!existingDir) throw new Error(`Pack not found: ${packId}`);

  for (const fileName of fs.readdirSync(dropDir)) {
    const filePath = path.join(dropDir, fileName);
    const ext = path.extname(fileName).toLowerCase();
    if (!['.mcpack', '.zip', '.mcaddon'].includes(ext)) continue;
    if (!fs.statSync(filePath).isFile()) continue;

    try {
      const zip = new AdmZip(filePath);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-replace-'));
      zip.extractAllTo(tempDir, true);

      const foundManifest = findManifestPaths(tempDir)[0] || null;
      if (!foundManifest) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        continue;
      }

      const manifest = JSON.parse(fs.readFileSync(foundManifest, 'utf-8')) as PackManifest;
      if (manifest.header?.uuid !== packId) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        continue;
      }

      const packRoot = path.dirname(foundManifest);
      fs.rmSync(existingDir, { recursive: true, force: true });
      fs.mkdirSync(existingDir, { recursive: true });
      copyRecursive(packRoot, existingDir);
      fs.rmSync(tempDir, { recursive: true, force: true });

      const newVersion = Array.isArray(manifest.header?.version) ? manifest.header.version : [1, 0, 0];
      const nextEntry: PackEntry = {
        packId,
        name: manifest.header?.name || fileName,
        version: newVersion,
        type,
        enabled: readWorldPackJson(type).some((p) => p.pack_id === packId),
      };

      const known = readValidKnownPacks();
      const knownIdx = known.findIndex((p) => p.pack_id === packId);
      const knownEntry = { pack_id: packId, version: newVersion };
      if (knownIdx >= 0) {
        known[knownIdx] = { ...known[knownIdx], ...knownEntry };
      } else {
        known.push(knownEntry);
      }
      writeValidKnownPacks(known);

      return nextEntry;
    } catch {}
  }

  return null;
}

function readWorldPackJsonForWorld(worldName: string, type: PackType): Array<{ pack_id: string; version: number[] }> {
  const { serverCore } = getPaths();
  const filePath = path.join(serverCore, 'worlds', worldName, `world_${type}_packs.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getWorldPacks(): WorldPackInfo[] {
  const { serverCore } = getPaths();
  const worldsDir = path.join(serverCore, 'worlds');
  if (!fs.existsSync(worldsDir)) return [];

  const result: WorldPackInfo[] = [];
  for (const name of fs.readdirSync(worldsDir)) {
    const worldPath = path.join(worldsDir, name);
    if (!fs.statSync(worldPath).isDirectory()) continue;

    result.push({
      worldName: name,
      behaviorPacks: readWorldPackJsonForWorld(name, 'behavior'),
      resourcePacks: readWorldPackJsonForWorld(name, 'resource'),
    });
  }

  return result;
}

export {
  scanInstalled,
  installPack,
  enablePack,
  disablePack,
  deletePack,
  getActiveWorldName,
  scanConflicts,
  checkVersionWarnings,
  replacePack,
  readWorldPackJsonForWorld,
  getWorldPacks,
  copyRecursive,
};
