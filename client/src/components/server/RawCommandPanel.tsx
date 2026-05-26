import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Terminal, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function RawCommandPanel({ running }: { running: boolean }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string | null>(null);

  const commandMutation = useMutation({
    mutationFn: (cmd: string) =>
      api.post<{ output: string }>('/server/command', { command: cmd }),
    onSuccess: (data: { output: string }) => {
      setOutput(data.output ?? JSON.stringify(data));
      toast.success('Command sent');
    },
    onError: (e: Error) => {
      setOutput(`Error: ${e.message}`);
      toast.error(e.message);
    },
  });

  function handleSend() {
    if (!command.trim()) return;
    commandMutation.mutate(command.trim());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Raw Command</CardTitle>
          <CardDescription>Send a command to the server console</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Prefer the Players and Configuration pages for bans, gamerules, and player actions.
              Use this for advanced commands only.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Type a server command..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={!running || commandMutation.isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!running || !command.trim() || commandMutation.isPending}
              className="shrink-0 gap-2"
            >
              <Terminal className="h-4 w-4" />
              {commandMutation.isPending ? '...' : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Output</CardTitle>
          <CardDescription>Command response</CardDescription>
        </CardHeader>
        <CardContent>
          {output !== null ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-mono text-sm">
              {output}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Send a command to see output.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
