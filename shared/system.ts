export interface MetricsSnapshot {
  timestamp: number;
  hostCpuPercent: number;
  hostRam: {
    total: number;
    free: number;
    used: number;
    percent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    percent: number;
  };
  bds: {
    pid: number | null;
    cpuPercent: number | null;
    ramBytes: number | null;
    uptimeMs: number | null;
  } | null;
  playerCount: number | null;
}
