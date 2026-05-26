import fs from 'fs';
import path from 'path';
import { getPaths } from './config';

function getBdsVersion(): string {
  const { serverCore } = getPaths();

  const versionFiles = ['version.txt', 'CURRENT_VERSION.txt', 'release-notes.txt'];
  for (const file of versionFiles) {
    const filePath = path.join(serverCore, file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const match = raw.match(/(\d+\.\d+(?:\.\d+)?)/);
      if (match) return match[1];
    } catch {
      // try next file
    }
  }

  try {
    for (const name of fs.readdirSync(serverCore)) {
      const match = name.match(/bedrock-server-(\d+\.\d+(?:\.\d+)?)/i);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }

  return 'unknown';
}

export { getBdsVersion };
