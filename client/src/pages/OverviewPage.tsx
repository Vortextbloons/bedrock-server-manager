import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useServerStatus } from '@/hooks/useServerStatus';
import { formatUptime } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EventLog } from '@/components/EventLog';
import type { ServerStatus } from '@shared/server';

function statusBadge(status: ServerStatus | undefined) {
  if (!status) return { label: 'CHECKING...', variant: 'muted' as const };
  if (status.operationActive) return { label: 'UPDATING', variant: 'warning' as const };
  if (status.running) return { label: 'RUNNING', variant: 'success' as const };
  if (status.state === 'error') return { label: 'ERROR', variant: 'destructive' as const };
  return { label: 'STOPPED', variant: 'muted' as const };
}

export function OverviewPage() {
  const { data: status } = useServerStatus();
  const { data: validation } = useQuery({
    queryKey: ['validate'],
    queryFn: () => api.get<{ valid: boolean; error?: string }>('/validate'),
  });
  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: () =>
      api.get<{
        port: number;
        serverCore: string;
        dashboardUrls: string[];
        minecraftAddresses: string[];
      }>('/info'),
  });

  const badge = statusBadge(status);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Bedrock Dedicated Server manager at a glance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Server Status</CardTitle>
            <CardDescription>Live process state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={badge.variant} className="text-sm">
              {badge.label}
            </Badge>
            {status?.pid && <p className="text-sm text-muted-foreground">PID {status.pid}</p>}
            {status?.uptime != null && (
              <p className="text-sm text-accent">uptime {formatUptime(status.uptime)}</p>
            )}
            <p
              className={
                validation?.valid
                   ? 'text-sm text-green-400'
                   : 'text-sm text-amber-300'
              }
            >
              {validation?.valid
                ? 'Server executable found'
                : `WARNING: ${validation?.error ?? 'Config check failed'}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>Join addresses on your network</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Server folder: </span>
              <span className="break-all text-accent">{info?.serverCore ?? '...'}</span>
            </p>
            {info?.dashboardUrls.map((url) => (
              <p key={url}>
                <span className="text-muted-foreground">Dashboard: </span>
                <a href={url} className="text-primary hover:underline">
                  {url}
                </a>
              </p>
            ))}
            {info?.minecraftAddresses.map((addr) => (
              <p key={addr}>
                <span className="text-muted-foreground">Minecraft: </span>
                <span className="text-green-400">{addr}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>Dashboard activity</CardDescription>
        </CardHeader>
        <CardContent>
          <EventLog className="h-56" />
        </CardContent>
      </Card>
    </div>
  );
}
