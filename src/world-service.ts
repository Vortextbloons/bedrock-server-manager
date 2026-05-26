import fs from 'fs';
import path from 'path';
import { parse as parseNbt } from 'prismarine-nbt';
import { getPaths } from './config';
import { readProperties, writeProperties } from './properties-service';
import type { WorldEntry, LevelDatInfo } from '../shared/worlds';

function getActiveWorldName(): string | null {
  try {
    const props = readProperties();
    return props.entries['level-name']?.value || null;
  } catch {
    return null;
  }
}

function getWorldSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getWorldSize(fullPath);
      } else {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // ignore permission errors on individual files
  }
  return size;
}

function listWorlds(): { worlds: WorldEntry[]; activeWorld: string | null } {
  const { serverCore } = getPaths();
  const worldsDir = path.join(serverCore, 'worlds');
  const activeWorld = getActiveWorldName();

  if (!fs.existsSync(worldsDir)) return { worlds: [], activeWorld };

  const worlds: WorldEntry[] = [];
  for (const name of fs.readdirSync(worldsDir)) {
    const worldPath = path.join(worldsDir, name);
    if (!fs.statSync(worldPath).isDirectory()) continue;

    const levelDatPath = path.join(worldPath, 'level.dat');
    const hasLevelDat = fs.existsSync(levelDatPath);
    let modifiedAt: string | null = null;
    let sizeBytes = 0;
    try {
      const stat = fs.statSync(worldPath);
      modifiedAt = stat.mtime.toISOString();
      sizeBytes = getWorldSize(worldPath);
    } catch {
      // skip worlds we can't stat
    }

    worlds.push({
      name,
      isActive: name === activeWorld,
      sizeBytes,
      modifiedAt,
      hasLevelDat,
    });
  }

  return { worlds, activeWorld };
}

function activateWorld(name: string): void {
  const { serverCore } = getPaths();
  const worldPath = path.join(serverCore, 'worlds', name);
  if (!fs.existsSync(worldPath)) {
    throw new Error(`World not found: ${name}`);
  }
  writeProperties({ 'level-name': name });
}

function renameWorld(from: string, to: string): void {
  const { serverCore } = getPaths();
  const worldsDir = path.join(serverCore, 'worlds');
  const fromPath = path.join(worldsDir, from);
  const toPath = path.join(worldsDir, to);

  if (!fs.existsSync(fromPath)) throw new Error(`World not found: ${from}`);
  if (fs.existsSync(toPath)) throw new Error(`World already exists: ${to}`);
  if (getActiveWorldName() === from) {
    writeProperties({ 'level-name': to });
  }
  fs.renameSync(fromPath, toPath);
}

function nbtInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const v = (value as { value: unknown }).value;
    return typeof v === 'number' ? v : undefined;
  }
  return undefined;
}

function nbtLong(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const v = (value as { value: unknown }).value;
    if (typeof v === 'number') return v;
    if (typeof v === 'bigint') return Number(v);
    if (Array.isArray(v) && v.length > 0) return Number(v[0]);
  }
  return undefined;
}

async function readLevelDat(worldName: string): Promise<LevelDatInfo> {
  const { serverCore } = getPaths();
  const levelDatPath = path.join(serverCore, 'worlds', worldName, 'level.dat');
  const hasLevelDat = fs.existsSync(levelDatPath);

  const props = readProperties();
  const propertiesOverlap = {
    levelSeed: props.entries['level-seed']?.value,
    levelType: props.entries['level-type']?.value,
    gamemode: props.entries['gamemode']?.value,
    difficulty: props.entries['difficulty']?.value,
  };

  const info: LevelDatInfo = {
    editable: false,
    hasLevelDat,
    propertiesOverlap,
  };

  if (!hasLevelDat) return info;

  try {
    const buffer = fs.readFileSync(levelDatPath);
    const { parsed } = await parseNbt(buffer, 'little');
    const root = parsed.value as Record<string, unknown>;

    info.seed = nbtLong(root.RandomSeed);
    info.gameType = nbtInt(root.GameType);
    info.difficulty = nbtInt(root.Difficulty);
    info.spawnX = nbtInt(root.SpawnX);
    info.spawnY = nbtInt(root.SpawnY);
    info.spawnZ = nbtInt(root.SpawnZ);

    const generator = nbtInt(root.Generator);
    if (generator !== undefined) {
      info.generatorName = String(generator);
    }
  } catch {
    // NBT parse failed — still return properties overlap
  }

  return info;
}

function resolveDimensionPath(worldPath: string, dimension: 'nether' | 'end'): string | null {
  const folders = dimension === 'nether' ? ['DIM-1'] : ['DIM1', 'DIM2'];
  for (const folder of folders) {
    const dimPath = path.join(worldPath, folder);
    if (fs.existsSync(dimPath)) return dimPath;
  }
  return null;
}

export {
  listWorlds,
  activateWorld,
  renameWorld,
  readLevelDat,
  getActiveWorldName,
  getWorldSize,
  resolveDimensionPath,
};
