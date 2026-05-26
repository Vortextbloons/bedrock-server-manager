#!/usr/bin/env node
/**
 * Bump or set the app version everywhere from one command.
 *
 * Usage:
 *   node scripts/update-version.mjs 1.2.3
 *   node scripts/update-version.mjs patch
 *   node scripts/update-version.mjs minor
 *   node scripts/update-version.mjs major
 *
 * Updates: version.json, package.json, package-lock.json (root package only).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = join(root, 'version.json');
const packageFile = join(root, 'package.json');
const lockFile = join(root, 'package-lock.json');

const SEMVER = /^\d+\.\d+\.\d+(-[\w.-]+)?$/;

function readVersion() {
  const data = JSON.parse(readFileSync(versionFile, 'utf8'));
  if (!data.version || !SEMVER.test(data.version)) {
    throw new Error(`Invalid version in version.json: ${data.version}`);
  }
  return data.version;
}

function bump(current, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(current);
  if (!match) throw new Error(`Cannot bump version: ${current}`);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  const suffix = match[4] ?? '';
  if (suffix) {
    console.warn(`Warning: prerelease suffix "${suffix}" will be dropped on bump.`);
  }
  switch (kind) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'patch':
      patch += 1;
      break;
    default:
      throw new Error(`Unknown bump kind: ${kind}`);
  }
  return `${major}.${minor}.${patch}`;
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function syncPackageJson(version) {
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
  pkg.version = version;
  writeJson(packageFile, pkg);
}

function syncPackageLock(version) {
  const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
  }
  writeJson(lockFile, lock);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(`Current version: ${readVersion()}\n`);
    console.error('Usage: node scripts/update-version.mjs <version|patch|minor|major>');
    process.exit(1);
  }

  const current = readVersion();
  const next = ['patch', 'minor', 'major'].includes(arg)
    ? bump(current, arg)
    : arg;

  if (!SEMVER.test(next)) {
    console.error(`Invalid semver: ${next}`);
    process.exit(1);
  }

  if (next === current) {
    console.log(`Already at v${current}`);
    return;
  }

  writeJson(versionFile, { version: next });
  syncPackageJson(next);
  syncPackageLock(next);

  console.log(`Updated v${current} → v${next}`);
  console.log('  version.json');
  console.log('  package.json');
  console.log('  package-lock.json');
  console.log('\nRebuild the client if you deploy static assets: npm run build:client');
}

main();
