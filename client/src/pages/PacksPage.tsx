import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  Upload,
  Trash2,
  Search,
  FileQuestion,
  RefreshCw,
  AlertTriangle,
  Globe,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useServerStatus } from '@/hooks/useServerStatus'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { Badge } from '@/components/ui/badge'
import type {
  PackEntry,
  PacksGetResponse,
  PackType,
  PackConflict,
  PackConflictResponse,
  VersionWarning,
  PackDepsResponse,
  WorldPackInfo,
  WorldPacksResponse,
  PackReplaceResponse,
} from '@shared/packs'

interface PackDropFile {
  name: string
  size: number
  date: string
}

interface PackDropResponse {
  behavior: PackDropFile[]
  resource: PackDropFile[]
}

export function PacksPage() {
  const queryClient = useQueryClient()
  const { data: status } = useServerStatus()
  const running = status?.running ?? false

  const { data, isLoading } = useQuery({
    queryKey: ['packs'],
    queryFn: () => api.get<PacksGetResponse>('/packs'),
    refetchInterval: 10000,
  })

  const [uploading, setUploading] = useState(false)
  const [dropHover, setDropHover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('pack', file)
      const res = await fetch('/api/packs/install', { method: 'POST', body: form })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        const msg =
          typeof body?.error === 'string'
            ? body.error
            : typeof body?.errorDetail?.message === 'string'
              ? body.errorDetail.message
              : `HTTP ${res.status}`
        throw new Error(msg)
      }
      const count = Array.isArray(body?.entries) ? body.entries.length : 1
      toast.success(count === 1 ? 'Pack installed' : `Installed ${count} packs`)
      queryClient.invalidateQueries({ queryKey: ['packs'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
      setDropHover(false)
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (running) return
      const file = e.dataTransfer.files?.[0]
      if (file) handleUpload(file)
    },
    [running],
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!running) setDropHover(true)
    },
    [running],
  )

  const onDragLeave = useCallback(() => {
    setDropHover(false)
  }, [])

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleUpload(file)
      e.target.value = ''
    },
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Packs</h2>
        <p className="text-sm text-muted-foreground">Manage behavior and resource packs</p>
      </div>

      {running && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <FileQuestion className="h-4 w-4 shrink-0" />
          <p>Server must be stopped to install packs.</p>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          running
            ? 'border-muted-foreground/20 bg-muted/30 opacity-60'
            : dropHover
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:bg-muted/50',
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !running && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            !running && fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.mcpack,.mcaddon"
          className="hidden"
          onChange={onFileInputChange}
          disabled={running || uploading}
        />
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          {uploading ? 'Uploading...' : 'Drop a pack file here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground/60">.zip, .mcpack, .mcaddon</p>
      </div>

      <Tabs defaultValue="behavior">
        <TabsList>
          <TabsTrigger value="behavior" className="gap-2">
            <Package className="h-4 w-4" /> Behavior Packs
          </TabsTrigger>
          <TabsTrigger value="resource" className="gap-2">
            <Package className="h-4 w-4" /> Resource Packs
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Conflicts
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Dependencies
          </TabsTrigger>
          <TabsTrigger value="worlds" className="gap-2">
            <Globe className="h-4 w-4" /> World Packs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="behavior" className="mt-4">
          <PackList
            type="behavior"
            packs={data?.behavior ?? []}
            isLoading={isLoading}
            running={running}
          />
        </TabsContent>

        <TabsContent value="resource" className="mt-4">
          <PackList
            type="resource"
            packs={data?.resource ?? []}
            isLoading={isLoading}
            running={running}
          />
        </TabsContent>

        <TabsContent value="conflicts" className="mt-4">
          <ConflictsList />
        </TabsContent>

        <TabsContent value="dependencies" className="mt-4">
          <DepsList />
        </TabsContent>

        <TabsContent value="worlds" className="mt-4">
          <WorldPacksList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PackList({
  type,
  packs,
  isLoading,
  running,
}: {
  type: PackType
  packs: PackEntry[]
  isLoading: boolean
  running: boolean
}) {
  const queryClient = useQueryClient()

  const enableMutation = useMutation({
    mutationFn: ({ packId }: { packId: string }) => api.post('/packs/enable', { type, packId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs'] })
      toast.success('Pack enabled')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const disableMutation = useMutation({
    mutationFn: ({ packId }: { packId: string }) => api.post('/packs/disable', { type, packId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs'] })
      toast.success('Pack disabled')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (packId: string) => api.del(`/packs/${type}/${encodeURIComponent(packId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs'] })
      toast.success('Pack deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const scanMutation = useMutation({
    mutationFn: () => api.get<PackDropResponse>('/packs/drop'),
    onSuccess: (result) => {
      const total = result.behavior.length + result.resource.length
      if (total === 0) {
        toast.info('No files found in drop folder')
      } else {
        toast.success(`Found ${total} file(s) in drop folder`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const replaceMutation = useMutation({
    mutationFn: ({ packId }: { packId: string }) =>
      api.post<PackReplaceResponse>('/packs/replace', { packId, type }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['packs'] })
      toast.success(`Replaced with ${res.next.name} v${res.next.version.join('.')}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="capitalize">{type} Packs</CardTitle>
          <CardDescription>{packs.length} installed</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
        >
          <Search className="h-4 w-4" />
          Scan drop folder
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading packs...</p>
        ) : packs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No {type} packs installed.</p>
        ) : (
          <ScrollArea className="h-[24rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((pack) => (
                  <TableRow key={pack.packId}>
                    <TableCell className="font-medium">{pack.name}</TableCell>
                    <TableCell className="text-muted-foreground">{pack.version.join('.')}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {pack.packId}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={pack.enabled}
                        disabled={running || enableMutation.isPending || disableMutation.isPending}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            enableMutation.mutate({ packId: pack.packId })
                          } else {
                            disableMutation.mutate({ packId: pack.packId })
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={running || replaceMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Replace pack?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will replace <strong>{pack.name}</strong> with a newer
                                version. The existing pack folder will be deleted. This action
                                cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => replaceMutation.mutate({ packId: pack.packId })}
                              >
                                Replace
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={running || deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete pack?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove <strong>{pack.name}</strong> from the server. This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(pack.packId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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

function ConflictsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['packs', 'conflicts'],
    queryFn: () => api.get<PackConflictResponse>('/packs/conflicts'),
  })

  const conflicts = data?.conflicts ?? []

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Conflicts
          </CardTitle>
          <CardDescription>
            {conflicts.length > 0
              ? `${conflicts.length} duplicate UUID conflict(s) found`
              : 'No conflicts found'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Scanning for conflicts...</p>
        ) : conflicts.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <Badge variant="success" className="gap-2 px-4 py-2 text-sm">
              <ShieldAlert className="h-4 w-4" />
              No conflicts found
            </Badge>
          </div>
        ) : (
          <ScrollArea className="h-[24rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UUID</TableHead>
                  <TableHead>Conflicting Packs</TableHead>
                  <TableHead>Types</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.map((c) => (
                  <TableRow key={c.uuid}>
                    <TableCell className="font-mono text-xs">
                      {c.uuid.slice(0, 14)}...
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {c.names.join(', ')}
                    </TableCell>
                    <TableCell>
                      {c.types
                        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
                        .join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{c.count}</Badge>
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

function DepsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['packs', 'deps'],
    queryFn: () => api.get<PackDepsResponse>('/packs/deps'),
  })

  const warnings = data?.warnings ?? []
  const serverVersion = data?.serverVersion ?? 'unknown'

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Dependencies
          </CardTitle>
          <CardDescription>
            Server version: <span className="font-mono">{serverVersion}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Checking dependencies...</p>
        ) : warnings.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <Badge variant="success" className="gap-2 px-4 py-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              All packs compatible with server version {serverVersion}
            </Badge>
          </div>
        ) : (
          <ScrollArea className="h-[24rem]">
            <div className="space-y-3 p-6">
              {warnings.map((w) => (
                <Card
                  key={w.packId}
                  className="border-amber-500/40 bg-amber-500/10"
                >
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {w.packId}
                        </p>
                      </div>
                      <Badge variant="warning">Warning</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Min engine:{' '}
                        <span className="font-mono">
                          {w.minEngineVersion.join('.')}
                        </span>
                      </span>
                      <span>
                        Server:{' '}
                        <span className="font-mono">{w.serverVersion}</span>
                      </span>
                    </div>
                    <p className="text-sm text-amber-200">{w.warning}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function WorldPacksList() {
  const [expandedWorld, setExpandedWorld] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['packs', 'worlds'],
    queryFn: () => api.get<WorldPacksResponse>('/packs/worlds'),
  })

  const packs = data?.packs ?? []

  function toggleWorld(worldName: string) {
    setExpandedWorld((prev) => (prev === worldName ? null : worldName))
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            World Packs
          </CardTitle>
          <CardDescription>
            {packs.length > 0
              ? `${packs.length} world(s) with packs`
              : 'No worlds found'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading world packs...</p>
        ) : packs.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <Badge variant="muted" className="gap-2 px-4 py-2 text-sm">
              <Globe className="h-4 w-4" />
              No worlds found
            </Badge>
          </div>
        ) : (
          <ScrollArea className="h-[24rem]">
            <div className="space-y-3 p-6">
              {packs.map((world) => {
                const isExpanded = expandedWorld === world.worldName
                const totalPacks =
                  world.behaviorPacks.length + world.resourcePacks.length

                return (
                  <Card key={world.worldName}>
                    <button
                      className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
                      onClick={() => toggleWorld(world.worldName)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{world.worldName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            {world.behaviorPacks.length} BP
                          </Badge>
                          <Badge variant="secondary">
                            {world.resourcePacks.length} RP
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">{totalPacks} total</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t p-4 space-y-4">
                        {world.behaviorPacks.length > 0 && (
                          <div>
                            <p className="mb-2 text-sm font-medium text-muted-foreground">
                              Behavior Packs
                            </p>
                            <div className="space-y-1">
                              {world.behaviorPacks.map((bp, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                                >
                                  <span className="font-mono text-xs">
                                    {bp.pack_id}
                                  </span>
                                  <Badge variant="outline">
                                    v{bp.version.join('.')}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {world.resourcePacks.length > 0 && (
                          <div>
                            <p className="mb-2 text-sm font-medium text-muted-foreground">
                              Resource Packs
                            </p>
                            <div className="space-y-1">
                              {world.resourcePacks.map((rp, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                                >
                                  <span className="font-mono text-xs">
                                    {rp.pack_id}
                                  </span>
                                  <Badge variant="outline">
                                    v{rp.version.join('.')}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {totalPacks === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No packs assigned to this world.
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
