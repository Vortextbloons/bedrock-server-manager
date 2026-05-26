import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import type { PlayersGetResponse } from '@shared/players';

type PlayerAction = 'tp' | 'give' | 'kill';

export function PlayerActionsPanel({ running }: { running: boolean }) {
  const [action, setAction] = useState<PlayerAction | ''>('');
  const [targetPlayer, setTargetPlayer] = useState('');
  const [tpMode, setTpMode] = useState<'player' | 'coords'>('player');
  const [destPlayer, setDestPlayer] = useState('');
  const [coordX, setCoordX] = useState('');
  const [coordY, setCoordY] = useState('');
  const [coordZ, setCoordZ] = useState('');
  const [giveItem, setGiveItem] = useState('');
  const [giveAmount, setGiveAmount] = useState('1');
  const [giveData, setGiveData] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const { data: playersData } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get<PlayersGetResponse>('/players'),
    enabled: running,
    refetchInterval: running ? 5000 : false,
  });

  const players = playersData?.players ?? [];
  const onlinePlayers = players.filter((p) => p.online);

  const actionMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ output?: string }>('/server/actions', body),
    onSuccess: (data: { output?: string }) => {
      const out = typeof data === 'string' ? data : (data?.output ?? JSON.stringify(data, null, 2));
      setResult(out);
      toast.success('Action executed');
    },
    onError: (e: Error) => {
      setResult(`Error: ${e.message}`);
      toast.error(e.message);
    },
  });

  function resetForm() {
    setTargetPlayer('');
    setDestPlayer('');
    setCoordX('');
    setCoordY('');
    setCoordZ('');
    setGiveItem('');
    setGiveAmount('1');
    setGiveData('');
    setResult(null);
  }

  function handleActionChange(value: PlayerAction | '') {
    setAction(value);
    resetForm();
  }

  function handleSubmit() {
    if (!targetPlayer) {
      toast.error('Please select a target player');
      return;
    }

    switch (action) {
      case 'tp': {
        if (tpMode === 'player') {
          if (!destPlayer) {
            toast.error('Please select a destination player');
            return;
          }
          actionMutation.mutate({
            action: 'tp',
            target: targetPlayer,
            destination: destPlayer,
          });
        } else {
          const x = parseFloat(coordX);
          const y = parseFloat(coordY);
          const z = parseFloat(coordZ);
          if (isNaN(x) || isNaN(y) || isNaN(z)) {
            toast.error('Coordinates must be valid numbers');
            return;
          }
          actionMutation.mutate({ action: 'tp', target: targetPlayer, x, y, z });
        }
        break;
      }
      case 'give': {
        if (!giveItem.trim()) {
          toast.error('Please enter an item name');
          return;
        }
        const amount = parseInt(giveAmount, 10);
        if (isNaN(amount) || amount < 1) {
          toast.error('Amount must be a positive number');
          return;
        }
        const body: Record<string, unknown> = {
          action: 'give',
          target: targetPlayer,
          item: giveItem.trim(),
          amount,
        };
        if (giveData.trim()) {
          const data = parseInt(giveData, 10);
          if (!isNaN(data)) body.data = data;
        }
        actionMutation.mutate(body);
        break;
      }
      case 'kill': {
        actionMutation.mutate({ action: 'kill', target: targetPlayer });
        break;
      }
    }
  }

  if (!running) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Start the server to use live player actions (teleport, give, kill).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Live Player Actions</CardTitle>
          <CardDescription>Teleport, give items, or kill players</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="target-player">Target Player</Label>
            <select
              id="target-player"
              className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={targetPlayer}
              onChange={(e) => setTargetPlayer(e.target.value)}
              disabled={onlinePlayers.length === 0}
            >
              <option value="">Select a player...</option>
              {onlinePlayers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {onlinePlayers.length} player{onlinePlayers.length !== 1 ? 's' : ''} online
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action-type">Action</Label>
            <select
              id="action-type"
              className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={action}
              onChange={(e) => handleActionChange(e.target.value as PlayerAction | '')}
            >
              <option value="">Select an action...</option>
              <option value="tp">Teleport</option>
              <option value="give">Give Item</option>
              <option value="kill">Kill</option>
            </select>
          </div>

          {action === 'tp' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label>Teleport Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={tpMode === 'player' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTpMode('player')}
                  >
                    To Player
                  </Button>
                  <Button
                    variant={tpMode === 'coords' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTpMode('coords')}
                  >
                    To Coordinates
                  </Button>
                </div>
              </div>
              {tpMode === 'player' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="dest-player">Destination Player</Label>
                  <select
                    id="dest-player"
                    className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm"
                    value={destPlayer}
                    onChange={(e) => setDestPlayer(e.target.value)}
                  >
                    <option value="">Select a player...</option>
                    {onlinePlayers
                      .filter((p) => p.name !== targetPlayer)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="coord-x">X</Label>
                    <Input
                      id="coord-x"
                      type="number"
                      placeholder="0"
                      value={coordX}
                      onChange={(e) => setCoordX(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="coord-y">Y</Label>
                    <Input
                      id="coord-y"
                      type="number"
                      placeholder="0"
                      value={coordY}
                      onChange={(e) => setCoordY(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="coord-z">Z</Label>
                    <Input
                      id="coord-z"
                      type="number"
                      placeholder="0"
                      value={coordZ}
                      onChange={(e) => setCoordZ(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {action === 'give' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="give-item">Item Name</Label>
                <Input
                  id="give-item"
                  placeholder="minecraft:diamond"
                  value={giveItem}
                  onChange={(e) => setGiveItem(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="give-amount">Amount</Label>
                  <Input
                    id="give-amount"
                    type="number"
                    min="1"
                    value={giveAmount}
                    onChange={(e) => setGiveAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="give-data">Data (optional)</Label>
                  <Input
                    id="give-data"
                    type="number"
                    placeholder="0"
                    value={giveData}
                    onChange={(e) => setGiveData(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {action === 'kill' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This will kill <strong>{targetPlayer || 'the selected player'}</strong>. This
                action cannot be undone.
              </p>
            </div>
          )}

          {action && (
            <>
              {action === 'kill' ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full gap-2"
                      variant="destructive"
                      disabled={!targetPlayer || actionMutation.isPending}
                    >
                      <Zap className="h-4 w-4" />
                      Kill Player
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Kill {targetPlayer}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will immediately kill <strong>{targetPlayer}</strong> on the server.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleSubmit}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Kill {targetPlayer}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  className="w-full gap-2"
                  disabled={!targetPlayer || actionMutation.isPending}
                  onClick={handleSubmit}
                >
                  <Zap className="h-4 w-4" />
                  {actionMutation.isPending
                    ? 'Executing...'
                    : `Execute ${action === 'tp' ? 'Teleport' : 'Give'}`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>Command output appears here</CardDescription>
        </CardHeader>
        <CardContent>
          {result !== null ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-mono text-sm">
              {result}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Execute an action to see the result.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
