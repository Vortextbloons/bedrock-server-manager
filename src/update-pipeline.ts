import fs from 'fs';
import { EventEmitter } from 'events';
import type { ServerProcess } from './server-process';
import type { BackupService } from './backup-service';
import type { ExtractService } from './extract-service';
import { getInstance as getServerProcess } from './server-process';
import { getInstance as getBackupService } from './backup-service';
import { getInstance as getExtractService } from './extract-service';
import type { PipelineStepEvent, PipelineCompleteEvent, PipelineErrorEvent, ExtractResult } from '../shared/pipeline';

interface UpdatePipelineDeps {
  serverProcess?: ServerProcess;
  backupService?: BackupService;
  extractService?: ExtractService;
}

class UpdatePipeline extends EventEmitter {
  active: boolean = false;
  private _server: ServerProcess;
  private _backup: BackupService;
  private _extract: ExtractService;

  constructor(deps: UpdatePipelineDeps = {}) {
    super();
    this._server = deps.serverProcess || getServerProcess();
    this._backup = deps.backupService || getBackupService();
    this._extract = deps.extractService || getExtractService();
  }

  async execute(zipPath: string): Promise<void> {
    if (this.active) {
      throw new Error('An update is already in progress');
    }

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Update zip not found: ${zipPath}`);
    }

    this.active = true;
    let backupName: string | null = null;

    try {
      const server = this._server;
      const backup = this._backup;
      const extract = this._extract;

      this.emit('step', { step: 'finding', message: 'Verifying update zip...' } satisfies PipelineStepEvent);

      this.emit('step', { step: 'stopping', message: 'Stopping Bedrock server...' } satisfies PipelineStepEvent);
      if (server.getStatus().running) {
        await server.stop();
      } else {
        this.emit('step', { step: 'stopping', message: 'Server already stopped, skipping.' } satisfies PipelineStepEvent);
      }

      backup.on('progress', (data: PipelineStepEvent) => this.emit('step', data));
      const backupResult = await backup.createBackup();
      backup.removeAllListeners('progress');
      backupName = backupResult.name;
      this.emit('step', { step: 'backup', message: `Backup saved: ${backupName} (${this._formatSize(backupResult.size)})` } satisfies PipelineStepEvent);

      extract.on('progress', (data: PipelineStepEvent) => this.emit('step', data));
      const extractResult: ExtractResult = await extract.extractUpdate(zipPath);
      extract.removeAllListeners('progress');

      this.emit('step', { step: 'starting', message: 'Starting Bedrock server...' } satisfies PipelineStepEvent);
      await server.start();
      this.emit('step', { step: 'starting', message: 'Server started successfully.' } satisfies PipelineStepEvent);

      this.emit('complete', {
        success: true,
        backupName,
        filesExtracted: extractResult.filesExtracted,
        filesSkipped: extractResult.filesSkipped,
      } satisfies PipelineCompleteEvent);
    } catch (err) {
      this.emit('error', {
        success: false,
        message: (err as Error).message,
        backupName,
      } satisfies PipelineErrorEvent);
      throw err;
    } finally {
      this.active = false;
    }
  }

  private _formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

let instance: UpdatePipeline | null = null;

function getInstance(): UpdatePipeline {
  if (!instance) {
    instance = new UpdatePipeline();
  }
  return instance;
}

export { getInstance, UpdatePipeline };
