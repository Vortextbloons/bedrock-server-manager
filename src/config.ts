import path from 'path';
import fs from 'fs';
import { normalizeConfig } from './config/schema';
import type { ManagerConfig } from '../shared/config';
import type { ResolvedPaths, ValidationResult } from '../shared/config';

const ROOT_DIR = path.resolve(__dirname, '..');

let config: ManagerConfig | null = null;
let resolvedPaths: ResolvedPaths | null = null;

function load(): { config: ManagerConfig; resolvedPaths: ResolvedPaths; rootDir: string } {
  const configPath = path.join(ROOT_DIR, 'manager-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid manager-config.json: ${(err as Error).message}. ` +
      'Use forward slashes for Windows paths (e.g. C:/Users/you/DevServer).'
    );
  }

  config = normalizeConfig(parsed);

  resolvedPaths = {
    serverCore: path.resolve(ROOT_DIR, config.paths.serverCore),
    backups: path.resolve(ROOT_DIR, config.paths.backups),
    updateDrop: path.resolve(ROOT_DIR, config.paths.updateDrop),
    packDrop: path.resolve(ROOT_DIR, config.paths.packDrop),
    managerData: path.resolve(ROOT_DIR, config.paths.managerData),
  };

  for (const [_key, dir] of Object.entries(resolvedPaths)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const packDropBehavior = path.join(resolvedPaths.packDrop, 'behavior');
  const packDropResource = path.join(resolvedPaths.packDrop, 'resource');
  if (!fs.existsSync(packDropBehavior)) {
    fs.mkdirSync(packDropBehavior, { recursive: true });
  }
  if (!fs.existsSync(packDropResource)) {
    fs.mkdirSync(packDropResource, { recursive: true });
  }

  return { config, resolvedPaths, rootDir: ROOT_DIR };
}

function getConfig(): ManagerConfig {
  if (!config) throw new Error('Config not loaded. Call config.load() first.');
  return config;
}

function getPaths(): ResolvedPaths {
  if (!resolvedPaths) throw new Error('Config not loaded. Call config.load() first.');
  return resolvedPaths;
}

function validateServerCore(): ValidationResult {
  const { serverCore } = resolvedPaths!;
  const { executable } = config!.server;
  const exePath = path.join(serverCore, executable);

  if (!fs.existsSync(serverCore)) {
    return { valid: false, error: `Server core directory not found: ${serverCore}` };
  }
  if (!fs.existsSync(exePath)) {
    return { valid: false, error: `Server executable not found: ${exePath}` };
  }
  return { valid: true };
}

function getConfigSnapshot(): { config: ManagerConfig; resolvedPaths: ResolvedPaths } {
  if (!config || !resolvedPaths) {
    throw new Error('Config not loaded. Call config.load() first.');
  }
  return { config: { ...config, paths: { ...config.paths }, server: { ...config.server }, protected: [...config.protected] }, resolvedPaths: { ...resolvedPaths } };
}

function save(next: ManagerConfig): { requiresRestart: boolean } {
  const previous = config!;
  const previousPaths = resolvedPaths!;
  const configPath = path.join(ROOT_DIR, 'manager-config.json');

  config = normalizeConfig(next);
  resolvedPaths = {
    serverCore: path.resolve(ROOT_DIR, config.paths.serverCore),
    backups: path.resolve(ROOT_DIR, config.paths.backups),
    updateDrop: path.resolve(ROOT_DIR, config.paths.updateDrop),
    packDrop: path.resolve(ROOT_DIR, config.paths.packDrop),
    managerData: path.resolve(ROOT_DIR, config.paths.managerData),
  };

  for (const dir of Object.values(resolvedPaths)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const packDropBehavior = path.join(resolvedPaths.packDrop, 'behavior');
  const packDropResource = path.join(resolvedPaths.packDrop, 'resource');
  if (!fs.existsSync(packDropBehavior)) {
    fs.mkdirSync(packDropBehavior, { recursive: true });
  }
  if (!fs.existsSync(packDropResource)) {
    fs.mkdirSync(packDropResource, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  const requiresRestart =
    previous.port !== config.port ||
    previousPaths.serverCore !== resolvedPaths.serverCore ||
    previousPaths.backups !== resolvedPaths.backups ||
    previousPaths.updateDrop !== resolvedPaths.updateDrop ||
    previousPaths.packDrop !== resolvedPaths.packDrop ||
    previousPaths.managerData !== resolvedPaths.managerData;

  return { requiresRestart };
}

export { load, getConfig, getPaths, validateServerCore, getConfigSnapshot, save };
