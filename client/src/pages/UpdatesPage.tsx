import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatSize } from '@/lib/utils';
import { useServerStatus } from '@/hooks/useServerStatus';
import { useEventLog } from '@/context/EventLogContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { EventLog } from '@/components/EventLog';
import type {
  PipelineStepEvent,
  PipelineCompleteEvent,
  PipelineErrorEvent,
} from '@shared/pipeline';

export function UpdatesPage() {
  const { data: status } = useServerStatus();
  const { log, clear } = useEventLog();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<'upload' | 'drop'>('upload');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState('');
  const [pipeline, setPipeline] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const { data: dropData, refetch: scanDrop } = useQuery({
    queryKey: ['update-check'],
    queryFn: () =>
      api.get<{ found: boolean; files: Array<{ name: string; size: number; date: string }> }>(
        '/update/check',
      ),
    enabled: source === 'drop',
  });

  const locked = pipeline || status?.operationActive;

  const canUpdate =
    !locked &&
    (source === 'upload' ? uploadedFile !== null : (dropData?.files.length ?? 0) > 0);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast.error('Only .zip files are accepted');
        return;
      }
      log(`Uploading: ${file.name} (${formatSize(file.size)})`, 'info');
      try {
        const result = await api.upload(file);
        setUploadedFile(result.filename);
        setUploadMeta(`${result.filename} (${formatSize(result.size)})`);
        log(`Uploaded: ${result.filename}`, 'success');
        toast.success('Upload complete');
      } catch (e) {
        log(`Upload failed: ${(e as Error).message}`, 'error');
        toast.error((e as Error).message);
      }
    },
    [log],
  );

  async function executeUpdate() {
    if (pipeline) return;
    setPipeline(true);
    setProgress(10);
    clear();
    log('=== UPDATE PIPELINE STARTED ===', 'info');

    const body = source === 'upload' && uploadedFile ? { filename: uploadedFile } : {};

    try {
      const { eventStream } = await api.post<{ eventStream: string }>('/update/execute', body);
      const source_es = new EventSource(eventStream);

      source_es.addEventListener('step', (e) => {
        const data = JSON.parse(e.data) as PipelineStepEvent;
        log(data.message, 'info');
        setProgress((p) => Math.min(p + 15, 90));
      });

      source_es.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data) as PipelineCompleteEvent;
        log('=== UPDATE COMPLETE ===', 'success');
        log(`Backup: ${data.backupName}`, 'success');
        log(`Files extracted: ${data.filesExtracted}, skipped: ${data.filesSkipped}`, 'info');
        toast.success('Update completed');
        setProgress(100);
        finish(source_es);
      });

      source_es.addEventListener('error', (e) => {
        const msgEvent = e as MessageEvent;
        if (msgEvent.data) {
          const data = JSON.parse(msgEvent.data) as PipelineErrorEvent;
          log(`UPDATE FAILED: ${data.message}`, 'error');
          toast.error(data.message);
        } else {
          log('Connection to update stream lost.', 'error');
        }
        finish(source_es);
      });

      source_es.onerror = () => {
        log('SSE connection error.', 'error');
        finish(source_es);
      };
    } catch (e) {
      log(`Failed to start update: ${(e as Error).message}`, 'error');
      toast.error((e as Error).message);
      setPipeline(false);
      setProgress(0);
    }
  }

  function finish(source_es: EventSource) {
    source_es.close();
    setPipeline(false);
    setUploadedFile(null);
    setUploadMeta('');
    if (fileRef.current) fileRef.current.value = '';
    setProgress(0);
    queryClient.invalidateQueries({ queryKey: ['status'] });
    queryClient.invalidateQueries({ queryKey: ['backups'] });
    scanDrop();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Update Pipeline</h2>
        <p className="text-sm text-muted-foreground">Upload or drop a BDS update zip</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={source} onValueChange={(v) => setSource(v as 'upload' | 'drop')}>
            <TabsList>
              <TabsTrigger value="upload">Upload Zip</TabsTrigger>
              <TabsTrigger value="drop">Drop Folder</TabsTrigger>
            </TabsList>
            <TabsContent value="upload">
              <div
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                  dragOver ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop .zip here or click to browse</p>
                {uploadMeta && <p className="mt-2 text-sm text-primary">{uploadMeta}</p>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            </TabsContent>
            <TabsContent value="drop">
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Files in update-drop/</span>
                  <Button variant="outline" size="sm" onClick={() => scanDrop()} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Rescan
                  </Button>
                </div>
                <div className="rounded-md border border-border p-3 text-sm">
                  {dropData?.files.length === 0 && (
                    <p className="text-muted-foreground">No .zip files found in update-drop/</p>
                  )}
                  {dropData?.files.map((f) => (
                    <div key={f.name} className="flex justify-between py-1">
                      <span>{f.name}</span>
                      <span className="text-muted-foreground">{formatSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {pipeline && <Progress value={progress} className="mt-4" />}

          <Button
            className="mt-4 w-full gap-2 sm:w-auto"
            disabled={!canUpdate}
            onClick={executeUpdate}
          >
            <Star className="h-4 w-4" />
            {pipeline ? 'Updating...' : 'Execute Update'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Log</CardTitle>
        </CardHeader>
        <CardContent>
          <EventLog className="h-64" />
        </CardContent>
      </Card>
    </div>
  );
}
