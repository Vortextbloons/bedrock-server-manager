import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import { getConfig, getPaths } from './config';
import type { ServerState, ServerStatus, StateChangePayload } from '../shared/server';

class ServerProcess extends EventEmitter {
  process: ChildProcess | null = null;
  state: ServerState = 'stopped';
  pid: number | null = null;
  startTime: number | null = null;
  logBuffer: string[] = [];
  maxLogLines: number = 200;
  private _stopResolve: (() => void) | null = null;
  private _forceKillHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
  }

  start(): Promise<void> {
    if (this.state === 'running' || this.state === 'starting') {
      return Promise.reject(new Error('Server is already running'));
    }

    return new Promise((resolve, reject) => {
      const { serverCore } = getPaths();
      const { executable } = getConfig().server;
      const exePath = path.join(serverCore, executable);

      this.state = 'starting';
      this.emit('stateChange', { state: this.state } satisfies StateChangePayload);

      this.process = spawn(exePath, [], {
        cwd: serverCore,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.process.on('spawn', () => {
        this.pid = this.process!.pid!;
        this.startTime = Date.now();
        this.state = 'running';
        this.emit('stateChange', { state: this.state, pid: this.pid } satisfies StateChangePayload);
        resolve();
      });

      this.process.on('error', (err: Error) => {
        this.state = 'error';
        this.pid = null;
        this.startTime = null;
        this.process = null;
        this.emit('stateChange', { state: this.state } satisfies StateChangePayload);
        reject(err);
      });

      this.process.stdout!.on('data', (data: Buffer) => {
        this._appendLog(data.toString());
      });

      this.process.stderr!.on('data', (data: Buffer) => {
        this._appendLog(data.toString());
      });

      this.process.on('exit', (code: number | null) => {
        this.state = 'stopped';
        this.pid = null;
        this.startTime = null;
        this.process = null;

        if (this._forceKillHandle) {
          clearTimeout(this._forceKillHandle);
          this._forceKillHandle = null;
        }

        this.emit('stateChange', { state: this.state, exitCode: code ?? undefined } satisfies StateChangePayload);

        if (this._stopResolve) {
          this._stopResolve();
          this._stopResolve = null;
        }

        this.emit('exit', code);
      });
    });
  }

  stop(): Promise<void> {
    if (!this.process || this.state === 'stopped' || this.state === 'error') {
      this.state = 'stopped';
      return Promise.resolve();
    }
    if (this.state === 'stopping') {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.state === 'stopped') {
            clearInterval(check);
            resolve();
          }
        }, 200);
      });
    }

    return new Promise((resolve) => {
      const { gracefulTimeoutMs, forceKillTimeoutMs, stopCommand } = getConfig().server;

      this.state = 'stopping';
      this.emit('stateChange', { state: this.state } satisfies StateChangePayload);
      this._stopResolve = resolve;

      try {
        this.process!.stdin!.write(`${stopCommand}\n`);
      } catch (e) {
        this._forceKill();
      }

      this._forceKillHandle = setTimeout(() => {
        this._forceKill();
        setTimeout(() => {
          if (this.process) {
            try { this.process.kill('SIGKILL'); } catch (e) { /* ignore */ }
          }
        }, forceKillTimeoutMs);
      }, gracefulTimeoutMs);
    });
  }

  private _forceKill(): void {
    if (this.process) {
      try { this.process.kill('SIGTERM'); } catch (e) { /* ignore */ }
    }
  }

  getStatus(): ServerStatus {
    const uptime = this.startTime ? Date.now() - this.startTime : null;
    return {
      state: this.state,
      running: this.state === 'running' || this.state === 'starting',
      pid: this.pid,
      uptime,
      startTime: this.startTime,
    };
  }

  getLogs(lines: number = 50): string {
    return this.logBuffer.slice(-lines).join('\n');
  }

  runCommand(cmd: string, options?: { timeoutMs?: number; idleWindowMs?: number }): Promise<string> {
    if (this.state !== 'running') {
      return Promise.reject(new Error('Server is not running'));
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = options?.timeoutMs ?? 5000;
      const idleWindowMs = options?.idleWindowMs ?? 500;
      const lines: string[] = [];
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      const onLog = (data: string) => {
        const incomingLines = data.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        lines.push(...incomingLines);

        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          cleanup();
          resolve(lines.join('\n'));
        }, idleWindowMs);
      };

      const cleanup = () => {
        this.removeListener('log', onLog);
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      };

      this.on('log', onLog);

      timeoutTimer = setTimeout(() => {
        cleanup();
        resolve(lines.join('\n'));
      }, timeoutMs);

      try {
        this.process!.stdin!.write(cmd + '\n');
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
  }

  parseListCommand(output: string): string[] {
    const match = output.match(/There are \d+\/\d+ players online:\s*(.*)/);
    if (!match) return [];
    const playersPart = match[1].trim();
    if (!playersPart) return [];
    return playersPart.split(',').map((name) => name.trim()).filter((name) => name.length > 0);
  }

  private _appendLog(data: string): void {
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        this.logBuffer.push(line);
        if (this.logBuffer.length > this.maxLogLines) {
          this.logBuffer.shift();
        }
      }
    }
    this.emit('log', data);
  }
}

let instance: ServerProcess | null = null;

function getInstance(): ServerProcess {
  if (!instance) {
    instance = new ServerProcess();
  }
  return instance;
}

export { getInstance, ServerProcess };
