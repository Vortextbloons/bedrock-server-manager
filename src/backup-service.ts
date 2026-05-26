import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { EventEmitter } from 'events';
import { getConfig, getPaths } from './config';
import type { BackupResult, BackupInfo } from '../shared/pipeline';

function addDirectoryToZip(zip: AdmZip, dirPath: string, zipPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryPath = path.join(zipPath, entry.name);
    if (entry.isDirectory()) {
      zip.addFile(entryPath, Buffer.alloc(0), '');
      addDirectoryToZip(zip, fullPath, entryPath);
    } else {
      zip.addLocalFile(fullPath, zipPath);
    }
  }
}

function zipWorldFolder(worldName: string, outputPath: string): void {
  const { serverCore } = getPaths();
  const worldDir = path.join(serverCore, 'worlds', worldName);

  if (!fs.existsSync(worldDir)) {
    throw new Error(`World folder not found: ${worldName}`);
  }

  const zip = new AdmZip();
  addDirectoryToZip(zip, worldDir, worldName);
  zip.writeZip(outputPath);
}

class BackupService extends EventEmitter {
  active = false;

  constructor() {
    super();
  }

  createBackup(): Promise<BackupResult> {
    const { serverCore, backups } = getPaths();

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupName = `backup_${timestamp}.zip`;
    const backupPath = path.join(backups, backupName);

    return new Promise((resolve, reject) => {
      try {
        this.emit('progress', { step: 'backup', message: 'Creating backup...' });

        const zip = new AdmZip();
        const protectedItems: string[] = ['server.properties'];

        const jsonFiles = fs.readdirSync(serverCore)
          .filter(f => f.endsWith('.json'));
        protectedItems.push(...jsonFiles);

        for (const item of protectedItems) {
          const itemPath = path.join(serverCore, item);
          if (fs.existsSync(itemPath)) {
            const stat = fs.statSync(itemPath);
            if (stat.isFile()) {
              zip.addLocalFile(itemPath);
            }
          }
        }

        const worldsDir = path.join(serverCore, 'worlds');
        if (fs.existsSync(worldsDir)) {
          addDirectoryToZip(zip, worldsDir, 'worlds');
        }

        this.emit('progress', { step: 'backup', message: 'Writing backup file...' });
        zip.writeZip(backupPath);

        const size = fs.statSync(backupPath).size;

        this.emit('progress', { step: 'backup', message: `Backup created: ${backupName}`, detail: backupName, size });

        resolve({ name: backupName, path: backupPath, size });
      } catch (err) {
        reject(new Error(`Backup failed: ${(err as Error).message}`));
      }
    });
  }

  async restoreBackup(name: string): Promise<void> {
    const { serverCore, backups } = getPaths();
    const safeName = path.basename(name);
    const backupPath = path.join(backups, safeName);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${safeName}`);
    }

    this.active = true;
    try {
      this.emit('progress', { step: 'restore', message: `Restoring from ${safeName}...` });
      const zip = new AdmZip(backupPath);
      zip.extractAllTo(serverCore, true);
      this.emit('progress', { step: 'restore', message: `Restore complete: ${safeName}` });
    } finally {
      this.active = false;
    }
  }

  deleteBackup(name: string): void {
    const { backups } = getPaths();
    const safeName = path.basename(name);
    const backupPath = path.join(backups, safeName);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${safeName}`);
    }

    fs.unlinkSync(backupPath);
  }

  listBackups(): BackupInfo[] {
    const { backups } = getPaths();

    if (!fs.existsSync(backups)) {
      fs.mkdirSync(backups, { recursive: true });
      return [];
    }

    const items: BackupInfo[] = [];

    for (const name of fs.readdirSync(backups)) {
      if (!name.toLowerCase().endsWith('.zip')) continue;

      const filePath = path.join(backups, name);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        items.push({
          name,
          size: stat.size,
          date: stat.mtime.toISOString(),
        });
      } catch {
        // skip unreadable entries
      }
    }

    return items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }
}

let instance: BackupService | null = null;

function getInstance(): BackupService {
  if (!instance) {
    instance = new BackupService();
  }
  return instance;
}

export { getInstance, BackupService, zipWorldFolder, addDirectoryToZip };
