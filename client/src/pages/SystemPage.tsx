import { useEffect, useRef, useState } from 'react'
import { Activity, Cpu, HardDrive, MemoryStick, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { MetricsSnapshot } from '@shared/system'

function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}h ${m}m ${s}s`
}

function formatBytes(bytes: number, unit: 'GB' | 'MB' = 'GB'): string {
  const divisor = unit === 'GB' ? 1024 ** 3 : 1024 ** 2
  return `${(bytes / divisor).toFixed(1)} ${unit}`
}

function Sparkline({ values, max, colorClass }: { values: number[]; max: number; colorClass: string }) {
  return (
    <div className="flex items-end gap-px h-8 mt-2">
      {values.map((v, i) => {
        const pct = Math.min(100, Math.max(0, (v / max) * 100))
        return (
          <div
            key={i}
            className={cn('flex-1 rounded-sm opacity-70', colorClass)}
            style={{ height: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}

export function SystemPage() {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null)
  const historyRef = useRef<MetricsSnapshot[]>([])

  useEffect(() => {
    const source = new EventSource('/api/system/metrics/stream')

    function handleMessage(e: MessageEvent) {
      try {
        const snapshot: MetricsSnapshot = JSON.parse(e.data)
        setMetrics(snapshot)
        historyRef.current = [...historyRef.current.slice(-59), snapshot]
      } catch {
        /* ignore */
      }
    }

    source.addEventListener('metrics', handleMessage)
    source.addEventListener('message', handleMessage)

    source.onerror = () => {
      source.close()
    }

    return () => source.close()
  }, [])

  const hist = historyRef.current
  const cpuHistory = hist.map((m) => m.hostCpuPercent)
  const ramHistory = hist.map((m) => m.hostRam.percent)
  const diskHistory = hist.map((m) => m.disk.percent)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">System</h2>
        <p className="text-sm text-muted-foreground">Live host and BDS process metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Cpu}
          title="Host CPU"
          value={metrics ? `${metrics.hostCpuPercent.toFixed(1)}%` : '—'}
          subtext="System load"
        >
          {metrics && (
            <>
              <Progress value={metrics.hostCpuPercent} className="mt-2" />
              {cpuHistory.length > 1 && (
                <Sparkline values={cpuHistory} max={100} colorClass="bg-primary" />
              )}
            </>
          )}
        </MetricCard>

        <MetricCard
          icon={MemoryStick}
          title="Host RAM"
          value={
            metrics
              ? `${formatBytes(metrics.hostRam.used)} / ${formatBytes(metrics.hostRam.total)}`
              : '—'
          }
          subtext="Memory usage"
        >
          {metrics && (
            <>
              <Progress value={metrics.hostRam.percent} className="mt-2" />
              {ramHistory.length > 1 && (
                <Sparkline values={ramHistory} max={100} colorClass="bg-emerald-500" />
              )}
            </>
          )}
        </MetricCard>

        <MetricCard
          icon={HardDrive}
          title="Disk"
          value={
            metrics
              ? `${formatBytes(metrics.disk.free)} free / ${formatBytes(metrics.disk.total)} total`
              : '—'
          }
          subtext="Storage"
        >
          {metrics && (
            <>
              <Progress value={metrics.disk.percent} className="mt-2" />
              {diskHistory.length > 1 && (
                <Sparkline values={diskHistory} max={100} colorClass="bg-amber-500" />
              )}
            </>
          )}
        </MetricCard>

        <MetricCard
          icon={Activity}
          title="BDS Process"
          value={
            metrics?.bds?.cpuPercent !== null && metrics?.bds?.cpuPercent !== undefined
              ? `${metrics.bds.cpuPercent.toFixed(1)}% CPU`
              : 'Not running'
          }
          subtext={
            metrics?.bds?.ramBytes !== null && metrics?.bds?.ramBytes !== undefined
              ? `${(metrics.bds.ramBytes / 1024 / 1024).toFixed(0)} MB RAM`
              : undefined
          }
        >
          {metrics?.bds?.uptimeMs !== null && metrics?.bds?.uptimeMs !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Uptime {formatUptime(Math.floor(metrics.bds.uptimeMs / 1000))}
            </div>
          )}
        </MetricCard>

        <MetricCard
          icon={Users}
          title="Player Count"
          value={metrics?.playerCount !== null && metrics?.playerCount !== undefined ? `${metrics.playerCount}` : '—'}
          subtext="Connected players"
        />
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtext,
  children,
}: {
  icon: React.ElementType
  title: string
  value: string
  subtext?: string
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtext && <CardDescription>{subtext}</CardDescription>}
        {children}
      </CardContent>
    </Card>
  )
}
