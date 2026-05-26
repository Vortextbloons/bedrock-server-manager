import fs from 'fs';
import path from 'path';
import { getPaths } from './config';
import {
  EDITABLE_PROPERTY_KEYS,
  type EditablePropertyKey,
  type PropertiesGetResponse,
  type PropertyEntry,
} from '../shared/properties';

function parseProperties(raw: string): Record<string, PropertyEntry> {
  const entries: Record<string, PropertyEntry> = {};
  let pendingComment: string | undefined;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      pendingComment = trimmed;
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    entries[key] = { value, comment: pendingComment };
    pendingComment = undefined;
  }

  return entries;
}

function readProperties(): PropertiesGetResponse {
  const { serverCore } = getPaths();
  const propsPath = path.join(serverCore, 'server.properties');
  const raw = fs.existsSync(propsPath) ? fs.readFileSync(propsPath, 'utf-8') : '';
  return {
    raw,
    entries: parseProperties(raw),
    editable: [...EDITABLE_PROPERTY_KEYS],
  };
}

function writeProperties(updates: Partial<Record<EditablePropertyKey, string>>): PropertiesGetResponse {
  const { serverCore } = getPaths();
  const propsPath = path.join(serverCore, 'server.properties');

  const current = readProperties();
  const lines = current.raw ? current.raw.split(/\r?\n/) : [];
  const knownKeys = new Set(Object.keys(current.entries));
  const updatedKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (key in updates) {
      updatedKeys.add(key);
      return `${key}=${updates[key as EditablePropertyKey]}`;
    }
    return line;
  });

  for (const key of EDITABLE_PROPERTY_KEYS) {
    if (key in updates && !updatedKeys.has(key) && !knownKeys.has(key)) {
      newLines.push(`${key}=${updates[key]}`);
    }
  }

  const content = newLines.join('\n').replace(/\n*$/, '') + '\n';
  fs.writeFileSync(propsPath, content, 'utf-8');
  return readProperties();
}

export { readProperties, writeProperties, parseProperties };
