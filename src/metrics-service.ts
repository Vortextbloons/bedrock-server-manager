import os from 'os';
import pidusage from 'pidusage';
import checkDiskSpace from 'check-disk-space';
import { getPaths } from './config';
import type { ServiceMap } from '../shared/services';
import type { MetricsSnapshot } from '../shared/system';

interface CpuTimes {
  idle: number;
  total: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MetricsService {
  private _lastCpuTimes: CpuTimes | null = null;

  async getSnapshot(
    serverProcess: ServiceMap['serverProcess'],
    playerCount: number | null = null,
  ): Promise<MetricsSnapshot> {
    const hostCpuPercent = await this._getCpuPercent();

    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPercent = totalRam > 0 ? (usedRam / totalRam) * 100 : 0;

    const diskInfo = await checkDiskSpace(getPaths().serverCore);
    const totalDisk = diskInfo.size;
    const freeDisk = diskInfo.free;
    const usedDisk = totalDisk - freeDisk;
    const diskPercent = totalDisk > 0 ? (usedDisk / totalDisk) * 100 : 0;

    let bds: MetricsSnapshot['bds'] = null;
    const status = serverProcess.getStatus();
    const pid = status.pid;
    if (pid) {
      try {
        const stats = await pidusage(pid);
        bds = {
          pid,
          cpuPercent: typeof stats.cpu === 'number' ? stats.cpu : null,
          ramBytes: typeof stats.memory === 'number' ? stats.memory : null,
          uptimeMs: status.uptime ?? null,
        };
      } catch {
        bds = {
          pid,
          cpuPercent: null,
          ramBytes: null,
          uptimeMs: status.uptime ?? null,
        };
      }
    }

    return {
      timestamp: Date.now(),
      hostCpuPercent,
      hostRam: {
        total: totalRam,
        free: freeRam,
        used: usedRam,
        percent: ramPercent,
      },
      disk: {
        total: totalDisk,
        free: freeDisk,
        used: usedDisk,
        percent: diskPercent,
      },
      bds,
      playerCount,
    };
  }

  private _sampleCpuTimes(): CpuTimes {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      const times = cpu.times;
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }
    return { idle, total };
  }

  private _calcPercent(prev: CpuTimes, curr: CpuTimes): number {
    const deltaTotal = curr.total - prev.total;
    const deltaIdle = curr.idle - prev.idle;
    if (deltaTotal <= 0) return 0;
    return ((deltaTotal - deltaIdle) / deltaTotal) * 100;
  }

  private async _getCpuPercent(): Promise<number> {
    const current = this._sampleCpuTimes();
    if (!this._lastCpuTimes) {
      this._lastCpuTimes = current;
      await delay(1000);
      const next = this._sampleCpuTimes();
      const percent = this._calcPercent(this._lastCpuTimes, next);
      this._lastCpuTimes = next;
      return percent;
    }
    const percent = this._calcPercent(this._lastCpuTimes, current);
    this._lastCpuTimes = current;
    return percent;
  }
}

export { MetricsService };
