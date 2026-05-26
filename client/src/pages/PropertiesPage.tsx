import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useEventLog } from '@/context/EventLogContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PropertiesGetResponse, EditablePropertyKey } from '@shared/properties';

const BOOL_KEYS = new Set(['online-mode', 'allow-cheats']);

export function PropertiesEditor() {
  const { data: status } = useServerStatus();
  const { log } = useEventLog();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<PropertiesGetResponse>('/properties'),
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const key of data.editable) {
      next[key] = data.entries[key]?.value ?? '';
    }
    setValues(next);
  }, [data]);

  const serverRunning = status?.running ?? false;

  async function save() {
    if (serverRunning) {
      toast.error('Stop the server before saving properties');
      return;
    }
    setSaving(true);
    try {
      await api.put('/properties', { updates: values as Partial<Record<EditablePropertyKey, string>> });
      log('server.properties saved.', 'success');
      toast.success('Properties saved');
      await refetch();
    } catch (e) {
      log(`Save failed: ${(e as Error).message}`, 'error');
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading server.properties...</p>;
  }

  return (
    <div className="space-y-6">
      {serverRunning && (
        <p className="text-sm text-amber-300">Stop the server to edit server.properties.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Only allowlisted keys are shown</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {data?.editable.map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{key}</Label>
              {BOOL_KEYS.has(key) ? (
                <div className="flex items-center gap-2">
                  <Switch
                    id={key}
                    checked={values[key] === 'true'}
                    disabled={serverRunning}
                    onCheckedChange={(checked) =>
                      setValues((v) => ({ ...v, [key]: checked ? 'true' : 'false' }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">{values[key] ?? 'false'}</span>
                </div>
              ) : (
                <Input
                  id={key}
                  value={values[key] ?? ''}
                  disabled={serverRunning}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={serverRunning || saving} className="gap-2">
        <Save className="h-4 w-4" /> Save Properties
      </Button>
    </div>
  );
}

/** @deprecated Use ConfigurationPage */
export function PropertiesPage() {
  return <PropertiesEditor />;
}
