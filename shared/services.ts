import type { ServerStatus } from './server';

export interface ServiceMap {
  serverProcess: {
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): ServerStatus;
    getLogs(lines?: number): string;
    runCommand(cmd: string, options?: { timeoutMs?: number; idleWindowMs?: number }): Promise<string>;
    parseListCommand(output: string): string[];
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    removeListener(event: string, handler: (...args: unknown[]) => void): unknown;
  };
  backupService: {
    active: boolean;
    createBackup(): Promise<{ name: string; path: string; size: number }>;
    listBackups(): Array<{ name: string; size: number; date: string }>;
    restoreBackup(name: string): Promise<void>;
    deleteBackup(name: string): void;
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    removeAllListeners(event?: string): unknown;
  };
  updatePipeline: {
    active: boolean;
    execute(zipPath: string): Promise<void>;
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    once(event: string, handler: (...args: unknown[]) => void): unknown;
    removeListener(event: string, handler: (...args: unknown[]) => void): unknown;
  };
  extractService: {
    extractUpdate(zipPath: string): Promise<{ filesExtracted: number; filesSkipped: number }>;
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    removeAllListeners(event?: string): unknown;
  };
}

export type ServiceName = keyof ServiceMap;
