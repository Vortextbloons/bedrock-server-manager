import os from 'os';

export function getLanIPv4Addresses(): string[] {
  const addresses: string[] = [];
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return [...new Set(addresses)];
}

export function readMinecraftPort(serverCore: string): number {
  const fs = require('fs');
  const path = require('path');
  const propsPath = path.join(serverCore, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    return 19132;
  }

  const raw = fs.readFileSync(propsPath, 'utf-8');
  const match = raw.match(/^server-port=(\d+)\s*$/m);
  return match ? Number(match[1]) : 19132;
}
