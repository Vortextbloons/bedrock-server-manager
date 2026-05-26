import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useServerStatus } from '@/hooks/useServerStatus'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
} from '@/components/ui/alert-dialog'
import type {
  PlayerRow,
  PlayersGetResponse,
  BanEntry,
  BanlistResponse,
  TempBanOverlay,
  PlayerHistoryEntry,
  TemplateName,
  BulkImportResponse,
  PlayerNoteEntry,
} from '@shared/players'

export function PlayersPage() {
  const queryClient = useQueryClient()
  const { data: status } = useServerStatus()
  const running = status?.running ?? false

  const { data, isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => api.get<PlayersGetResponse>('/players'),
    refetchInterval: running ? 5000 : 15000,
  })

  const players = data?.players ?? []
  const maxPlayers = data?.maxPlayers ?? 0

  const kickMutation = useMutation({
    mutationFn: (name: string) => api.post('/players/kick', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success('Player kicked')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const opMutation = useMutation({
    mutationFn: (name: string) => api.post('/players/op', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success('Player opped')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deopMutation = useMutation({
    mutationFn: (name: string) => api.post('/players/deop', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success('Player de-opped')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Players</h2>
        <p className="text-sm text-muted-foreground">
          {players.length} / {maxPlayers} players &middot; {players.filter((p) => p.online).length} online
        </p>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster" className="gap-2">
            <Users className="h-4 w-4" /> Online Roster
          </TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="banlist">Ban List</TabsTrigger>
          <TabsTrigger value="tempbans">Temp Bans</TabsTrigger>
          <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading players...</p>
              ) : players.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No players found.</p>
              ) : (
                <ScrollArea className="h-[28rem]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Name</TableHead>
                        <TableHead>XUID</TableHead>
                        <TableHead>Operator</TableHead>
                        <TableHead>Sources</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player) => (
                        <PlayerRowView
                          key={player.name}
                          player={player}
                          running={running}
                          onKick={() => kickMutation.mutate(player.name)}
                          onOp={() => opMutation.mutate(player.name)}
                          onDeop={() => deopMutation.mutate(player.name)}
                          kickBusy={kickMutation.isPending}
                          opBusy={opMutation.isPending}
                          deopBusy={deopMutation.isPending}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <PlayerFiles />
        </TabsContent>

        <TabsContent value="banlist" className="mt-4">
          <BanListTab running={running} />
        </TabsContent>

        <TabsContent value="tempbans" className="mt-4">
          <TempBansTab running={running} />
        </TabsContent>

        <TabsContent value="whitelist" className="mt-4">
          <WhitelistTab running={running} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <PlayerNotesTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesTab running={running} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PlayerRowView({
  player,
  running,
  onKick,
  onOp,
  onDeop,
  kickBusy,
  opBusy,
  deopBusy,
}: {
  player: PlayerRow
  running: boolean
  onKick: () => void
  onOp: () => void
  onDeop: () => void
  kickBusy: boolean
  opBusy: boolean
  deopBusy: boolean
}) {
  return (
    <TableRow>
      <TableCell>
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full',
            player.online ? 'bg-green-500' : 'bg-muted-foreground/40',
          )}
          title={player.online ? 'Online' : 'Offline'}
        />
      </TableCell>
      <TableCell className="font-medium">{player.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{player.xuid ?? '—'}</TableCell>
      <TableCell>
        {player.isOperator ? (
          <Badge variant="warning" className="text-[10px]">
            OP
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {player.source.map((s) => (
            <Badge key={s} variant="muted" className="text-[10px]">
              {s}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!player.online || !running || kickBusy}
            onClick={onKick}
          >
            Kick
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!running || opBusy || player.isOperator}
            onClick={onOp}
          >
            Op
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!running || deopBusy || !player.isOperator}
            onClick={onDeop}
          >
            Deop
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function PlayerFiles() {
  const queryClient = useQueryClient()
  const [permText, setPermText] = useState('')
  const [allowText, setAllowText] = useState('')
  const [permSaving, setPermSaving] = useState(false)
  const [allowSaving, setAllowSaving] = useState(false)

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ['players', 'files', 'permissions'],
    queryFn: () => api.get<{ raw: string; parsed: unknown }>('/players/permissions'),
  })

  const { data: allowData, isLoading: allowLoading } = useQuery({
    queryKey: ['players', 'files', 'allowlist'],
    queryFn: () => api.get<{ raw: string; parsed: unknown }>('/players/allowlist'),
  })

  useEffect(() => {
    if (permData?.raw !== undefined) {
      try {
        const parsed = JSON.parse(permData.raw)
        setPermText(JSON.stringify(parsed, null, 2))
      } catch {
        setPermText(permData.raw)
      }
    }
  }, [permData])

  useEffect(() => {
    if (allowData?.raw !== undefined) {
      try {
        const parsed = JSON.parse(allowData.raw)
        setAllowText(JSON.stringify(parsed, null, 2))
      } catch {
        setAllowText(allowData.raw)
      }
    }
  }, [allowData])

  function validateJson(text: string): boolean {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        toast.error('JSON must be an array')
        return false
      }
      return true
    } catch {
      toast.error('Invalid JSON')
      return false
    }
  }

  async function savePermissions() {
    if (!validateJson(permText)) return
    setPermSaving(true)
    try {
      await api.put('/players/permissions', { content: JSON.parse(permText) })
      toast.success('permissions.json saved')
      queryClient.invalidateQueries({ queryKey: ['players', 'files', 'permissions'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPermSaving(false)
    }
  }

  async function saveAllowlist() {
    if (!validateJson(allowText)) return
    setAllowSaving(true)
    try {
      await api.put('/players/allowlist', { content: JSON.parse(allowText) })
      toast.success('allowlist.json saved')
      queryClient.invalidateQueries({ queryKey: ['players', 'files', 'allowlist'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAllowSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Some permission changes may require a server restart.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>permissions.json</CardTitle>
            <CardDescription>Edit server permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {permLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <textarea
                  className="min-h-48 w-full rounded-md border border-input bg-input p-3 font-mono text-xs"
                  value={permText}
                  onChange={(e) => setPermText(e.target.value)}
                />
                <Button
                  onClick={savePermissions}
                  disabled={permSaving}
                  className="gap-2"
                  size="sm"
                >
                  <Save className="h-4 w-4" /> Save
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>allowlist.json</CardTitle>
            <CardDescription>Edit server allowlist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {allowLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <textarea
                  className="min-h-48 w-full rounded-md border border-input bg-input p-3 font-mono text-xs"
                  value={allowText}
                  onChange={(e) => setAllowText(e.target.value)}
                />
                <Button
                  onClick={saveAllowlist}
                  disabled={allowSaving}
                  className="gap-2"
                  size="sm"
                >
                  <Save className="h-4 w-4" /> Save
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================
// Ban List Tab
// ============================================================

function BanListTab({ running }: { running: boolean }) {
  const queryClient = useQueryClient()
  const [banName, setBanName] = useState('')
  const [banReason, setBanReason] = useState('')
  const [rawEditorOpen, setRawEditorOpen] = useState(false)
  const [rawText, setRawText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['players', 'banlist'],
    queryFn: () => api.get<BanlistResponse>('/players/banlist'),
  })

  const bans = data?.parsed ?? []

  const addBanMutation = useMutation({
    mutationFn: (body: { name: string; reason?: string }) => api.post('/players/ban', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'banlist'] })
      toast.success('Player banned')
      setBanName('')
      setBanReason('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pardonMutation = useMutation({
    mutationFn: (name: string) => api.post('/players/pardon', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'banlist'] })
      toast.success('Player pardoned')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openRawEditor() {
    setRawText(data?.raw ?? '')
    setRawEditorOpen(true)
  }

  async function saveRaw() {
    try {
      const parsed = JSON.parse(rawText)
      if (!Array.isArray(parsed)) {
        toast.error('JSON must be an array')
        return
      }
      await api.put('/players/banlist', { content: parsed })
      toast.success('Ban list saved')
      queryClient.invalidateQueries({ queryKey: ['players', 'banlist'] })
      setRawEditorOpen(false)
    } catch {
      toast.error('Invalid JSON')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Ban</CardTitle>
          <CardDescription>Ban a player from the server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ban-name">Player Name</Label>
              <Input
                id="ban-name"
                placeholder="Player name"
                value={banName}
                onChange={(e) => setBanName(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ban-reason">Reason (optional)</Label>
              <Input
                id="ban-reason"
                placeholder="Reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                disabled={!banName.trim() || addBanMutation.isPending}
                onClick={() => addBanMutation.mutate({ name: banName.trim(), reason: banReason || undefined })}
              >
                Ban
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Banned Players</CardTitle>
            <CardDescription>{bans.length} banned</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={openRawEditor}>
            Edit Raw JSON
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading...</p>
          ) : bans.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No banned players.</p>
          ) : (
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>XUID</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bans.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{b.xuid ?? '—'}</TableCell>
                      <TableCell className="text-sm">{b.reason ?? '—'}</TableCell>
                      <TableCell className="text-sm">{b.source ?? '—'}</TableCell>
                      <TableCell className="text-sm">{b.expires ?? 'Permanent'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={pardonMutation.isPending}
                          onClick={() => pardonMutation.mutate(b.name)}
                        >
                          Pardon
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={rawEditorOpen} onOpenChange={setRawEditorOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Ban List JSON</AlertDialogTitle>
            <AlertDialogDescription>
              Edit the raw ban list data. Must be a valid JSON array of ban entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="min-h-64 w-full rounded-md border border-input bg-input p-3 font-mono text-xs"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveRaw}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Temp Bans Tab
// ============================================================

const TEMP_BAN_DURATIONS = [
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
  { label: '1 day', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
  { label: '30 days', minutes: 43200 },
]

function formatTimeRemaining(expiresAt: string): string {
  const now = Date.now()
  const exp = new Date(expiresAt).getTime()
  const diff = exp - now
  if (diff <= 0) return 'Expired'
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h remaining`
  if (hours > 0) return `${hours}h ${minutes % 60}m remaining`
  return `${minutes}m remaining`
}

function TempBansTab({ running }: { running: boolean }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(60)

  const { data, isLoading } = useQuery({
    queryKey: ['players', 'temp-bans'],
    queryFn: () => api.get<{ bans: TempBanOverlay[] }>('/players/temp-bans'),
    refetchInterval: 15000,
  })

  const bans = data?.bans ?? []

  const addMutation = useMutation({
    mutationFn: (body: { name: string; reason?: string; durationMinutes: number }) =>
      api.post('/players/temp-ban', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'temp-bans'] })
      toast.success('Temp ban added')
      setName('')
      setReason('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (playerName: string) => api.del(`/players/temp-ban/${encodeURIComponent(playerName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'temp-bans'] })
      toast.success('Temp ban removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Temp Ban</CardTitle>
          <CardDescription>Temporarily ban a player from the server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tb-name">Player Name</Label>
              <Input
                id="tb-name"
                placeholder="Player name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tb-reason">Reason (optional)</Label>
              <Input
                id="tb-reason"
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tb-duration">Duration</Label>
              <select
                id="tb-duration"
                className="h-9 rounded-md border border-input bg-input px-3 py-1 text-sm"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {TEMP_BAN_DURATIONS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                disabled={!name.trim() || addMutation.isPending}
                onClick={() =>
                  addMutation.mutate({ name: name.trim(), reason: reason || undefined, durationMinutes: duration })
                }
              >
                Ban
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Temp Bans</CardTitle>
          <CardDescription>{bans.length} active</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading...</p>
          ) : bans.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No active temp bans.</p>
          ) : (
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>XUID</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bans.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{b.xuid ?? '—'}</TableCell>
                      <TableCell className="text-sm">{b.reason ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={new Date(b.expiresAt).getTime() < Date.now() ? 'destructive' : 'warning'}>
                          {formatTimeRemaining(b.expiresAt)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(b.name)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Whitelist Tab
// ============================================================

function WhitelistTab({ running }: { running: boolean }) {
  const queryClient = useQueryClient()
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<{ new: number; existing: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const { data: allowData } = useQuery({
    queryKey: ['players', 'files', 'allowlist'],
    queryFn: () => api.get<{ raw: string; parsed: unknown }>('/players/allowlist'),
  })

  const { data: whitelistStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['players', 'whitelist-mode'],
    queryFn: () => api.get<{ enabled: boolean }>('/players/whitelist-mode'),
  })

  const whitelistEnabled = whitelistStatus?.enabled ?? false

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => api.post('/players/whitelist-mode', { enabled }),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['players', 'whitelist-mode'] })
      toast.success(enabled ? 'Whitelist enabled' : 'Whitelist disabled')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function handlePreview() {
    if (!importText.trim()) return
    setPreviewLoading(true)
    try {
      const result = await api.post<BulkImportResponse>('/players/allowlist/import', {
        format: 'lines',
        content: importText,
      })
      setPreview({ new: result.new, existing: result.existing })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const applyMutation = useMutation({
    mutationFn: () =>
      api.post('/players/allowlist/import', {
        format: 'lines',
        content: importText,
        apply: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'files', 'allowlist'] })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success('Allowlist updated')
      setImportText('')
      setPreview(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const allowlistCount = (allowData?.parsed as unknown[] | undefined)?.length ?? 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {running && (
        <div className="col-span-full flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>Stop the server to change whitelist mode or bulk-import allowlist entries.</p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Whitelist Controls</CardTitle>
          <CardDescription>Manage server allow-list settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow-List (whitelist mode)</Label>
              <p className="text-xs text-muted-foreground">
                {whitelistEnabled ? 'Only allowlisted players can join' : 'Anyone can join'}
              </p>
            </div>
            <Switch
              checked={whitelistEnabled}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              disabled={running || statusLoading || toggleMutation.isPending}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Current allowlist: {allowlistCount} entries
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Import</CardTitle>
          <CardDescription>Import player names into the allowlist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-import">Player Names</Label>
            <p className="text-xs text-muted-foreground">One name per line or comma-separated</p>
            <textarea
              id="w-import"
              className="min-h-32 w-full rounded-md border border-input bg-input p-3 font-mono text-xs"
              placeholder="Player1&#10;Player2&#10;Player3"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value)
                setPreview(null)
              }}
            />
          </div>
          {preview && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex gap-4">
                <span>
                  <Badge variant="default">{preview.new}</Badge> new
                </span>
                <span>
                  <Badge variant="muted">{preview.existing}</Badge> already in list
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!importText.trim() || previewLoading}
              onClick={handlePreview}
            >
              Preview
            </Button>
            <Button
              size="sm"
              disabled={!preview || applyMutation.isPending || running}
              onClick={() => applyMutation.mutate()}
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Player Notes Tab
// ============================================================

function PlayerNotesTab() {
  const [playerKey, setPlayerKey] = useState('')
  const [notes, setNotes] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)

  async function loadNotes() {
    if (!playerKey.trim()) return
    setNoteLoading(true)
    try {
      const result = await api.get<PlayerNoteEntry>(`/players/notes/${encodeURIComponent(playerKey.trim())}`)
      setNotes(result.notes)
      setLoadedKey(playerKey.trim())
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setNoteLoading(false)
    }
  }

  async function saveNotes() {
    if (!playerKey.trim()) return
    try {
      await api.put(`/players/notes/${encodeURIComponent(playerKey.trim())}`, { notes })
      toast.success('Notes saved')
      setLoadedKey(playerKey.trim())
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Notes</CardTitle>
        <CardDescription>Save private notes about a player</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="note-key">Player Name or XUID</Label>
            <Input
              id="note-key"
              placeholder="Player name or XUID"
              value={playerKey}
              onChange={(e) => setPlayerKey(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!playerKey.trim() || noteLoading}
              onClick={loadNotes}
            >
              Load
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-text">
            Notes
            {loadedKey && (
              <span className="ml-2 text-xs text-muted-foreground">for {loadedKey}</span>
            )}
          </Label>
          <textarea
            id="note-text"
            className="min-h-48 w-full rounded-md border border-input bg-input p-3 font-mono text-xs"
            placeholder="Enter notes about this player..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button onClick={saveNotes} disabled={!playerKey.trim()} className="gap-2" size="sm">
          <Save className="h-4 w-4" /> Save
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// History Tab
// ============================================================

function HistoryTab() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['players', 'history', debouncedSearch],
    queryFn: () =>
      api.get<{ entries: PlayerHistoryEntry[]; total: number }>(
        `/players/history?search=${encodeURIComponent(debouncedSearch)}&limit=200`,
      ),
  })

  const entries = data?.entries ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Player History</CardTitle>
          <CardDescription>Join and leave events</CardDescription>
        </div>
        <div className="w-64">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No history entries found.</p>
        ) : (
          <ScrollArea className="h-[32rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Event</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, i) => (
                  <TableRow key={`${entry.name}-${entry.timestamp}-${i}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell>
                      <Badge variant={entry.event === 'join' ? 'default' : 'outline'}>
                        {entry.event}
                      </Badge>
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

// ============================================================
// Templates Tab
// ============================================================

const TEMPLATES: { value: TemplateName; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
]

function TemplatesTab({ running }: { running: boolean }) {
  const queryClient = useQueryClient()
  const [playerName, setPlayerName] = useState('')
  const [template, setTemplate] = useState<TemplateName>('member')

  const { data: permData } = useQuery({
    queryKey: ['players', 'files', 'permissions'],
    queryFn: () => api.get<{ raw: string; parsed: unknown }>('/players/permissions'),
  })

  const permCount = (permData?.parsed as unknown[] | undefined)?.length ?? 0

  const applyMutation = useMutation({
    mutationFn: (body: { playerName: string; template: TemplateName }) =>
      api.post('/players/permissions/apply-template', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'files', 'permissions'] })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success('Template applied')
      setPlayerName('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Apply Permission Template</CardTitle>
          <CardDescription>Apply a predefined permission set to a player</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-name">Player Name</Label>
            <Input
              id="tmpl-name"
              placeholder="Player name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-select">Template</Label>
            <select
              id="tmpl-select"
              className="h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value as TemplateName)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={!playerName.trim() || !running || applyMutation.isPending}
            onClick={() => applyMutation.mutate({ playerName: playerName.trim(), template })}
          >
            Apply Template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Permissions</CardTitle>
          <CardDescription>Overview of current permission state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{permCount}</div>
          <p className="text-sm text-muted-foreground">Total permission entries</p>
        </CardContent>
      </Card>
    </div>
  )
}
