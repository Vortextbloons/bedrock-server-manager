import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Trash2, RotateCcw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatSize } from '@/lib/utils';
import { useEventLog } from '@/context/EventLogContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { BackupInfo } from '@shared/pipeline';

export function BackupsSection() {
  const { log } = useEventLog();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get<{ backups: BackupInfo[] }>('/backups'),
  });

  const backups = data?.backups ?? [];

  async function createBackup() {
    setBusy(true);
    log('Creating manual backup...', 'info');
    try {
      const result = await api.post<{ backup: { name: string; size: number } }>('/backups/create');
      log(`Backup created: ${result.backup.name}`, 'success');
      toast.success(`Backup created: ${result.backup.name}`);
      await refetch();
    } catch (e) {
      log(`Backup failed: ${(e as Error).message}`, 'error');
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(name: string) {
    setBusy(true);
    log(`Restoring from ${name}...`, 'warning');
    try {
      await api.post('/backups/restore', { name });
      log(`Restored from ${name}`, 'success');
      toast.success('Restore complete');
      queryClient.invalidateQueries({ queryKey: ['status'] });
    } catch (e) {
      log(`Restore failed: ${(e as Error).message}`, 'error');
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(name: string) {
    setBusy(true);
    try {
      await api.del(`/backups/${encodeURIComponent(name)}`);
      log(`Deleted backup: ${name}`, 'info');
      toast.success('Backup deleted');
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button size="sm" onClick={createBackup} disabled={busy} className="gap-1">
            <Plus className="h-4 w-4" /> Create Backup
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" /> Archive List
          </CardTitle>
          <CardDescription>Restore replaces worlds and config from the zip</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading backups...</p>}
          {!isLoading && backups.length === 0 && (
            <p className="text-sm text-muted-foreground">No backups found.</p>
          )}
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-medium text-primary">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(b.size)} · {new Date(b.date).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={busy} className="gap-1">
                        <RotateCcw className="h-3 w-3" /> Restore
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restore backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop the server and overwrite worlds and config files with{' '}
                          <strong>{b.name}</strong>. This cannot be undone automatically.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => restore(b.name)}>Restore</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={busy} className="gap-1">
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently delete <strong>{b.name}</strong>?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(b.name)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** @deprecated Use MaintenancePage */
export function BackupsPage() {
  return <BackupsSection />;
}
