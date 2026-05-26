import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Square,
  RotateCcw,
  Terminal,
  Activity,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useServerLogs } from '@/hooks/useServerLogs';
import { useEventLog } from '@/context/EventLogContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ServerMetricsPanel } from '@/components/server/ServerMetricsPanel';
import { RawCommandPanel } from '@/components/server/RawCommandPanel';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ServerControls({
  running,
  locked,
  busy,
  onStart,
  onStop,
  onRestart,
}: {
  running: boolean;
  locked: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Controls</CardTitle>
        <CardDescription>Blocked while an update or restore is running</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={onStart} disabled={running || locked || busy} className="gap-2">
          <Play className="h-4 w-4" /> Start
        </Button>
        <Button
          variant="destructive"
          onClick={onStop}
          disabled={!running || locked || busy}
          className="gap-2"
        >
          <Square className="h-4 w-4" /> Stop
        </Button>
        <Button
          variant="outline"
          onClick={onRestart}
          disabled={!running || locked || busy}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" /> Restart
        </Button>
      </CardContent>
    </Card>
  );
}

function ServerConsole() {
  const { lines, bottomRef } = useServerLogs(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Console</CardTitle>
        <CardDescription>Server stdout/stderr stream</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[32rem] rounded-md border border-border bg-black/50 p-3 font-mono text-xs">
          <div className="space-y-0.5 text-green-400/90">
            {lines.length === 0 && (
              <p className="text-muted-foreground">No output yet. Start the server to see logs.</p>
            )}
            {lines.map((line, i) => (
              <div key={`${i}-${line}`}>{line}</div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function ServerPage() {
  const { data: status } = useServerStatus();
  const { log } = useEventLog();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const running = status?.running ?? false;
  const locked = status?.operationActive ?? false;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['status'] });
  }

  async function start() {
    setBusy(true);
    log('Starting server...', 'starting');
    try {
      await api.post('/server/start');
      log('Server start command sent.', 'success');
      toast.success('Server starting');
      await refresh();
    } catch (e) {
      const msg = (e as Error).message;
      log(`Failed to start: ${msg}`, 'error');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    log('Stopping server...', 'stopping');
    try {
      await api.post('/server/stop');
      log('Server stop command sent.', 'info');
      toast.info('Server stopping');
      setTimeout(refresh, 2000);
    } catch (e) {
      const msg = (e as Error).message;
      log(`Failed to stop: ${msg}`, 'error');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    setBusy(true);
    log('Restarting server...', 'info');
    try {
      await api.post('/server/stop');
      log('Waiting for server to stop...', 'stopping');
      await sleep(4000);
      let attempts = 0;
      while (attempts < 20) {
        const s = await api.get<{ running: boolean }>('/status');
        if (!s.running) break;
        await sleep(1000);
        attempts++;
      }
      await api.post('/server/start');
      log('Server restarted.', 'success');
      toast.success('Server restarted');
      await refresh();
    } catch (e) {
      const msg = (e as Error).message;
      log(`Restart failed: ${msg}`, 'error');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Server</h2>
        <p className="text-sm text-muted-foreground">
          Controls, console, metrics, and commands
        </p>
      </div>

      <Tabs defaultValue="control">
        <TabsList>
          <TabsTrigger value="control" className="gap-2">
            <Play className="h-4 w-4" /> Control
          </TabsTrigger>
          <TabsTrigger value="console" className="gap-2">
            <Terminal className="h-4 w-4" /> Console
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <Activity className="h-4 w-4" /> Metrics
          </TabsTrigger>
          <TabsTrigger value="command" className="gap-2">
            <Gauge className="h-4 w-4" /> Command
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="mt-4 space-y-4">
          <ServerControls
            running={running}
            locked={locked}
            busy={busy}
            onStart={start}
            onStop={stop}
            onRestart={restart}
          />
        </TabsContent>

        <TabsContent value="console" className="mt-4">
          <ServerConsole />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <ServerMetricsPanel />
        </TabsContent>

        <TabsContent value="command" className="mt-4 space-y-4">
          {!running && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Server must be running to send commands.</p>
            </div>
          )}
          <RawCommandPanel running={running} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
