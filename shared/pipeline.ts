export interface PipelineStepEvent {
  step: string;
  message: string;
  detail?: string;
  size?: number;
  filesExtracted?: number;
  filesSkipped?: number;
}

export interface PipelineCompleteEvent {
  success: boolean;
  backupName: string | null;
  filesExtracted: number;
  filesSkipped: number;
}

export interface PipelineErrorEvent {
  success: false;
  message: string;
  backupName: string | null;
}

export interface BackupResult {
  name: string;
  path: string;
  size: number;
}

export interface BackupInfo {
  name: string;
  size: number;
  date: string;
}

export interface ExtractResult {
  filesExtracted: number;
  filesSkipped: number;
}
