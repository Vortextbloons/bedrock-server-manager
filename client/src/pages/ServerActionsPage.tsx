import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sliders, Zap, Terminal, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useServerStatus } from '@/hooks/useServerStatus'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
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
} from '@/components/ui/alert-dialog'
import type { PlayersGetResponse } from '@shared/players'

interface GameruleValue {
  rule: string
  currentValue: string
  type: 'bool' | 'int'
  label: string
  description?: string
  defaultValue?: string | boolean | number
}

interface GamerulesResponse {
  gamerules: GameruleValue[]
  isOnline: boolean
}

type PlayerAction = 'tp' | 'give' | 'kill'

export function ServerActionsPage() {
  const { data: status } = useServerStatus()
  const running = status?.running ?? false

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Live Tools</h2>
        <p className="text-sm text-muted-foreground">
          Gamerules, player actions, and commands &mdash; server must be running.
        </p>
      </div>

      {!running && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Server must be running to use live tools.</p>
        </div>
      )}

      <Tabs defaultValue="gamerules">
        <TabsList>
          <TabsTrigger value="gamerules" className="gap-2">
            <Sliders className="h-4 w-4" /> Gamerules
          </TabsTrigger>
          <TabsTrigger value="player-actions" className="gap-2">
            <Zap className="h-4 w-4" /> Player Actions
          </TabsTrigger>
          <TabsTrigger value="raw-command" className="gap-2">
            <Terminal className="h-4 w-4" /> Raw Command
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gamerules" className="mt-4">
          <GamerulesTab running={running} />
        </TabsContent>

        <TabsContent value="player-actions" className="mt-4">
          <PlayerActionsTab running={running} />
        </TabsContent>

        <TabsContent value="raw-command" className="mt-4">
          <RawCommandTab running={running} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GamerulesTab({ running }: { running: boolean }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})
  const [mutatingRule, setMutatingRule] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['server', 'gamerules'],
    queryFn: () => api.get<GamerulesResponse>('/server/gamerules'),
    enabled: running,
    refetchInterval: running ? 15000 : false,
  })

  const gamerules = data?.gamerules ?? []
  const isOnline = data?.isOnline ?? false

  const gameruleMutation = useMutation({
    mutationFn: ({ rule, value }: { rule: string; value: boolean | number }) =>
      api.put<{ currentValue?: string }>('/server/gamerules', { rule, value }),
    onSuccess: (data, { rule, value }) => {
      const nextValue =
        data?.currentValue ??
        (typeof value === 'boolean' ? String(value) : String(value))
      queryClient.setQueryData<GamerulesResponse>(['server', 'gamerules'], (old) => {
        if (!old) return old
        return {
          ...old,
          gamerules: old.gamerules.map((g) =>
            g.rule === rule ? { ...g, currentValue: nextValue } : g,
          ),
        }
      })
      setEditingValues((prev) => {
        const next = { ...prev }
        delete next[rule]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['server', 'gamerules'] })
      toast.success('Gamerule updated')
      setMutatingRule(null)
    },
    onError: (e: Error) => {
      toast.error(e.message)
      setMutatingRule(null)
      void queryClient.invalidateQueries({ queryKey: ['server', 'gamerules'] })
    },
  })

  const filtered = gamerules.filter((g) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return g.rule.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)
  })

  const editable = running && isOnline

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Gamerules</CardTitle>
            <CardDescription>
              {isOnline
                ? `${gamerules.length} gamerules loaded`
                : 'Server offline &mdash; values shown as "?"'}
            </CardDescription>
          </div>
          <Input
            placeholder="Search gamerules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading gamerules...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {search ? 'No gamerules match your search.' : 'No gamerules found.'}
          </p>
        ) : (
          <ScrollArea className="h-[28rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow key={g.rule}>
                    <TableCell>
                      <div className="font-medium">{g.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{g.rule}</div>
                      {g.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground/70">{g.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {g.type === 'bool' ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isOnline ? String(g.currentValue).toLowerCase() === 'true' : false}
                            disabled={!editable || gameruleMutation.isPending}
                            onCheckedChange={(checked) => {
                              setMutatingRule(g.rule)
                              gameruleMutation.mutate({ rule: g.rule, value: checked })
                            }}
                          />
                          <span className="text-sm">
                            {isOnline ? String(g.currentValue) : '?'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="h-8 w-28"
                            disabled={!editable || mutatingRule === g.rule}
                            value={
                              editingValues[g.rule] !== undefined
                                ? editingValues[g.rule]
                                : isOnline
                                  ? g.currentValue
                                  : ''
                            }
                            placeholder={isOnline ? '' : '?'}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [g.rule]: e.target.value,
                              }))
                            }
                          />
                          {isOnline && (
                            <span className="text-xs text-muted-foreground">
                              current: {g.currentValue}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {g.type === 'int' && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            !editable ||
                            mutatingRule === g.rule ||
                            (editingValues[g.rule] ?? g.currentValue) === g.currentValue
                          }
                          onClick={() => {
                            const raw = editingValues[g.rule] ?? g.currentValue
                            const val = parseInt(raw, 10)
                            if (isNaN(val)) {
                              toast.error('Value must be a number')
                              return
                            }
                            setMutatingRule(g.rule)
                            gameruleMutation.mutate({ rule: g.rule, value: val })
                          }}
                        >
                          {mutatingRule === g.rule ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function PlayerActionsTab({ running }: { running: boolean }) {
  const [action, setAction] = useState<PlayerAction | ''>('')
  const [targetPlayer, setTargetPlayer] = useState('')
  const [tpMode, setTpMode] = useState<'player' | 'coords'>('player')
  const [destPlayer, setDestPlayer] = useState('')
  const [coordX, setCoordX] = useState('')
  const [coordY, setCoordY] = useState('')
  const [coordZ, setCoordZ] = useState('')
  const [giveItem, setGiveItem] = useState('')
  const [giveAmount, setGiveAmount] = useState('1')
  const [giveData, setGiveData] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const { data: playersData } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get<PlayersGetResponse>('/players'),
    enabled: running,
    refetchInterval: running ? 5000 : false,
  })

  const players = playersData?.players ?? []
  const onlinePlayers = players.filter((p) => p.online)

  const actionMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ output?: string }>('/server/actions', body),
    onSuccess: (data: { output?: string }) => {
      const out = typeof data === 'string' ? data : data?.output ?? JSON.stringify(data, null, 2)
      setResult(out)
      toast.success('Action executed')
    },
    onError: (e: Error) => {
      setResult(`Error: ${e.message}`)
      toast.error(e.message)
    },
  })

  function resetForm() {
    setTargetPlayer('')
    setDestPlayer('')
    setCoordX('')
    setCoordY('')
    setCoordZ('')
    setGiveItem('')
    setGiveAmount('1')
    setGiveData('')
    setResult(null)
  }

  function handleActionChange(value: PlayerAction | '') {
    setAction(value)
    resetForm()
  }

  function handleSubmit() {
    if (!targetPlayer) {
      toast.error('Please select a target player')
      return
    }

    switch (action) {
      case 'tp': {
        if (tpMode === 'player') {
          if (!destPlayer) {
            toast.error('Please select a destination player')
            return
          }
          actionMutation.mutate({
            action: 'tp',
            target: targetPlayer,
            destination: destPlayer,
          })
        } else {
          const x = parseFloat(coordX)
          const y = parseFloat(coordY)
          const z = parseFloat(coordZ)
          if (isNaN(x) || isNaN(y) || isNaN(z)) {
            toast.error('Coordinates must be valid numbers')
            return
          }
          actionMutation.mutate({ action: 'tp', target: targetPlayer, x, y, z })
        }
        break
      }
      case 'give': {
        if (!giveItem.trim()) {
          toast.error('Please enter an item name')
          return
        }
        const amount = parseInt(giveAmount, 10)
        if (isNaN(amount) || amount < 1) {
          toast.error('Amount must be a positive number')
          return
        }
        const body: Record<string, unknown> = {
          action: 'give',
          target: targetPlayer,
          item: giveItem.trim(),
          amount,
        }
        if (giveData.trim()) {
          const data = parseInt(giveData, 10)
          if (!isNaN(data)) body.data = data
        }
        actionMutation.mutate(body)
        break
      }
      case 'kill': {
        actionMutation.mutate({ action: 'kill', target: targetPlayer })
        break
      }
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Player Actions</CardTitle>
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
              disabled={!running || onlinePlayers.length === 0}
            >
              <option value="">Select a player...</option>
              {onlinePlayers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            {running && (
              <p className="text-xs text-muted-foreground">
                {onlinePlayers.length} player{onlinePlayers.length !== 1 ? 's' : ''} online
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action-type">Action</Label>
            <select
              id="action-type"
              className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={action}
              onChange={(e) => handleActionChange(e.target.value as PlayerAction | '')}
              disabled={!running}
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
                    className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                This will kill <strong>{targetPlayer || 'the selected player'}</strong>. This action
                cannot be undone.
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
                      disabled={!running || !targetPlayer || actionMutation.isPending}
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
                        This action cannot be undone.
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
                  disabled={!running || !targetPlayer || actionMutation.isPending}
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
  )
}

function RawCommandTab({ running }: { running: boolean }) {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState<string | null>(null)

  const commandMutation = useMutation({
    mutationFn: (cmd: string) =>
      api.post<{ output: string }>('/server/command', { command: cmd }),
    onSuccess: (data: { output: string }) => {
      setOutput(data.output ?? JSON.stringify(data))
      toast.success('Command sent')
    },
    onError: (e: Error) => {
      setOutput(`Error: ${e.message}`)
      toast.error(e.message)
    },
  })

  function handleSend() {
    if (!command.trim()) return
    commandMutation.mutate(command.trim())
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Raw Command</CardTitle>
          <CardDescription>Send a raw command to the server console</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Covered actions (tp, give, kill, gamerule, ban, pardon) should use the dedicated UI
              tabs above. This is an escape hatch for advanced commands.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Type a server command..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={!running || commandMutation.isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
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
  )
}
