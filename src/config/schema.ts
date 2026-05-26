import type { ManagerConfig } from '../../shared/config';

const DEFAULT_CONFIG: ManagerConfig = {
  port: 8080,
  paths: {
    serverCore: './server-core',
    backups: './backups',
    updateDrop: './update-drop',
    packDrop: './pack-drop',
    managerData: './manager-data',
  },
  server: {
    executable: 'bedrock_server.exe',
    stopCommand: 'stop',
    gracefulTimeoutMs: 30000,
    forceKillTimeoutMs: 10000,
  },
  protected: [
    'worlds/',
    'server.properties',
    'permissions.json',
    'allowlist.json',
    'valid_known_packs.json',
  ],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: unknown): T {
  const result = { ...base } as Record<string, unknown>;
  if (!isObject(override)) return result as T;

  for (const key of Object.keys(override)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const overrideVal = override[key];
    if (isObject(baseVal) && isObject(overrideVal) && !Array.isArray(overrideVal)) {
      result[key] = deepMerge(baseVal as Record<string, unknown>, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

function validateConfig(config: ManagerConfig): ManagerConfig {
  const errors: string[] = [];

  if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
    errors.push('port must be a number between 1 and 65535');
  }

  if (!isObject(config.paths)) {
    errors.push('paths must be an object');
  } else {
    for (const key of ['serverCore', 'backups', 'updateDrop', 'packDrop', 'managerData'] as const) {
      if (typeof config.paths[key] !== 'string' || !config.paths[key].trim()) {
        errors.push(`paths.${key} must be a non-empty string`);
      }
    }
  }

  if (!isObject(config.server)) {
    errors.push('server must be an object');
  } else if (typeof config.server.executable !== 'string' || !config.server.executable.trim()) {
    errors.push('server.executable must be a non-empty string');
  }

  if (!Array.isArray(config.protected)) {
    errors.push('protected must be an array of path patterns');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid manager-config.json:\n- ${errors.join('\n- ')}`);
  }

  return config;
}

function normalizeConfig(raw: unknown): ManagerConfig {
  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, raw || {}) as unknown as ManagerConfig;
  return validateConfig(merged);
}

export { DEFAULT_CONFIG, deepMerge, normalizeConfig, validateConfig };
