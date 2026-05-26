import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, AlertTriangle, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useEventLog } from '@/context/EventLogContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConfigGetResponse, ConfigSaveResponse } from '@shared/config-api';
import type { ManagerConfig } from '@shared/config';

export function SettingsPage() {
  const { log } = useEventLog();
  const { theme, toggle } = useTheme();
  const [config, setConfig] = useState<ManagerConfig | null>(null);
  const [protectedText, setProtectedText] = useState('');
  const [requiresRestart, setRequiresRestart] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<ConfigGetResponse>('/config'),
  });

  useEffect(() => {
    if (data?.config) {
      setConfig(data.config);
      setProtectedText(data.config.protected.join('\n'));
    }
  }, [data]);

  function patch<K extends keyof ManagerConfig>(key: K, value: ManagerConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  function patchPath(key: keyof ManagerConfig['paths'], value: string) {
    setConfig((c) => (c ? { ...c, paths: { ...c.paths, [key]: value } } : c));
  }

  function patchServer(key: keyof ManagerConfig['server'], value: string | number) {
    setConfig((c) => (c ? { ...c, server: { ...c.server, [key]: value } } : c));
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const payload: ManagerConfig = {
        ...config,
        protected: protectedText.split('\n').map((l) => l.trim()).filter(Boolean),
      };
      const result = await api.put<ConfigSaveResponse>('/config', payload);
      setConfig(result.config);
      setRequiresRestart(result.requiresRestart);
      log('Configuration saved.', 'success');
      toast.success(
        result.requiresRestart
          ? 'Saved. Restart the dashboard (npm start) to apply port/path changes.'
          : 'Configuration saved',
      );
      await refetch();
    } catch (e) {
      log(`Config save failed: ${(e as Error).message}`, 'error');
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !config) {
    return <p className="text-muted-foreground">Loading configuration...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Manager Settings</h2>
        <p className="text-sm text-muted-foreground">Edit manager-config.json</p>
      </div>

      {(requiresRestart || data?.validation.valid === false) && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {requiresRestart && (
              <p>Restart the Node process (npm start) to apply port or path changes.</p>
            )}
            {!data?.validation.valid && (
              <p className="mt-1">Server validation: {data?.validation.error}</p>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Paths</CardTitle>
          <CardDescription>
            Resolved: {data?.resolvedPaths.serverCore}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Dashboard port</Label>
            <Input
              type="number"
              value={config.port}
              onChange={(e) => patch('port', parseInt(e.target.value, 10) || 8080)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>serverCore</Label>
            <Input value={config.paths.serverCore} onChange={(e) => patchPath('serverCore', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>backups</Label>
            <Input value={config.paths.backups} onChange={(e) => patchPath('backups', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>updateDrop</Label>
            <Input value={config.paths.updateDrop} onChange={(e) => patchPath('updateDrop', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server Process</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>executable</Label>
            <Input
              value={config.server.executable}
              onChange={(e) => patchServer('executable', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>stopCommand</Label>
            <Input
              value={config.server.stopCommand}
              onChange={(e) => patchServer('stopCommand', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>gracefulTimeoutMs</Label>
            <Input
              type="number"
              value={config.server.gracefulTimeoutMs}
              onChange={(e) => patchServer('gracefulTimeoutMs', parseInt(e.target.value, 10))}
            />
          </div>
          <div className="space-y-2">
            <Label>forceKillTimeoutMs</Label>
            <Input
              type="number"
              value={config.server.forceKillTimeoutMs}
              onChange={(e) => patchServer('forceKillTimeoutMs', parseInt(e.target.value, 10))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Toggle between dark and light theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-sm">{theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</span>
            <Button variant="outline" onClick={toggle}>
              Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protected paths</CardTitle>
          <CardDescription>One pattern per line, skipped during updates</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="min-h-32 w-full rounded-md border border-input bg-input p-3 font-mono text-sm"
            value={protectedText}
            onChange={(e) => setProtectedText(e.target.value)}
          />
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" /> Save Configuration
      </Button>
    </div>
  );
}
