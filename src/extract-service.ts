import path from 'path';
import fs from 'fs';
import AdmZip, { AdmZipEntry } from 'adm-zip';
import { EventEmitter } from 'events';
import { getConfig, getPaths } from './config';
import type { ExtractResult } from '../shared/pipeline';

class ExtractService extends EventEmitter {
  constructor() {
    super();
  }

  extractUpdate(zipPath: string): Promise<ExtractResult> {
    const { serverCore } = getPaths();
    const { protected: protectedList } = getConfig();

    return new Promise((resolve, reject) => {
      try {
        this.emit('progress', { step: 'extract', message: 'Opening update archive...' });

        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();

        const wrapperPrefix = this._detectWrapper(entries);

        let filesExtracted = 0;
        let filesSkipped = 0;

        this.emit('progress', {
          step: 'extract',
          message: wrapperPrefix
            ? `Detected wrapper folder: ${wrapperPrefix}. Extracting files...`
            : 'Extracting files...',
        });

        for (const entry of entries) {
          if (entry.isDirectory) continue;

          let relativePath = entry.entryName.replace(/\\/g, '/');

          if (wrapperPrefix) {
            if (!relativePath.startsWith(wrapperPrefix + '/')) continue;
            relativePath = relativePath.slice(wrapperPrefix.length + 1);
          }

          if (this._isProtected(relativePath, protectedList)) {
            filesSkipped++;
            continue;
          }

          const destPath = path.join(serverCore, relativePath);
          const destDir = path.dirname(destPath);

          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          fs.writeFileSync(destPath, entry.getData());
          filesExtracted++;
        }

        this.emit('progress', {
          step: 'extract',
          message: `Extraction complete: ${filesExtracted} files extracted, ${filesSkipped} protected files skipped.`,
          filesExtracted,
          filesSkipped,
        });

        resolve({ filesExtracted, filesSkipped });
      } catch (err) {
        reject(new Error(`Extraction failed: ${(err as Error).message}`));
      }
    });
  }

  private _detectWrapper(entries: AdmZipEntry[]): string | null {
    const topDirs = new Set<string>();
    for (const entry of entries) {
      const parts = entry.entryName.replace(/\\/g, '/').split('/');
      if (parts.length > 1) {
        topDirs.add(parts[0]);
      }
    }

    for (const dir of topDirs) {
      const hasExe = entries.some(e =>
        e.entryName.replace(/\\/g, '/') === `${dir}/bedrock_server.exe`
      );
      if (hasExe) return dir;
    }

    return null;
  }

  private _isProtected(relativePath: string, protectedList: string[]): boolean {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();

    for (const pattern of protectedList) {
      const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();

      if (normalizedPattern.endsWith('/')) {
        if (normalized.startsWith(normalizedPattern) || normalized === normalizedPattern.slice(0, -1)) {
          return true;
        }
      } else if (normalizedPattern.startsWith('*.')) {
        const ext = normalizedPattern.slice(1);
        if (normalized.endsWith(ext)) {
          const parts = normalized.split('/');
          if (parts.length === 1) {
            return true;
          }
        }
      } else {
        if (normalized === normalizedPattern) {
          return true;
        }
      }
    }

    return false;
  }
}

let instance: ExtractService | null = null;

function getInstance(): ExtractService {
  if (!instance) {
    instance = new ExtractService();
  }
  return instance;
}

export { getInstance, ExtractService };
