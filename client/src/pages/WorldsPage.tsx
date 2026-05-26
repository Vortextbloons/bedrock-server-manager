import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Upload, Trash2, Download, AlertTriangle, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useServerStatus } from '@/hooks/useServerStatus'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { WorldEntry, WorldsListResponse, LevelDatInfo } from '@shared/worlds'

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1073741824) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(date: string | null): string {
  if (!date) return '\u2014'
  const d = new Date(date)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function WorldsPage() {
  const queryClient = useQueryClient()
  const { data: status } = useServerStatus()
  const running = status?.running ?? false

  const { data, isLoading } = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.get<WorldsListResponse>('/worlds'),
  })

  const worlds = data?.worlds ?? []
  const activeWorld = data?.activeWorld

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importName, setImportName] = useState('')
  const [importOverwrite, setImportOverwrite] = useState(false)
  const [importUploading, setImportUploading] = useState(false)
  const [dropHover, setDropHover] = useState(false)

  const activateMutation = useMutation({
    mutationFn: (name: string) => api.post('/worlds/activate', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      toast.success('World activated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const renameMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      api.post('/worlds/rename', { from, to }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] })
      toast.success('World renamed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function del(path: string, body: unknown) {
    const res = await fetch(`/api${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const msg =
        typeof json?.error === 'string'
          ? json.error
          : `HTTP ${res.status}`
      throw new Error(msg)
    }
    return json
  }

  const deleteMutation = useMutation({
    mutationFn: ({
      name,
      confirmName,
      backup,
    }: {
      name: string
      confirmName: string
      backup: boolean
    }) => del(`/worlds/${encodeURIComponent(name)}`, { confirmName, backup }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] })
      toast.success('World deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetDimensionMutation = useMutation({
    mutationFn: ({
      name,
      dimension,
      backup,
    }: {
      name: string
      dimension: 'nether' | 'end'
      backup: boolean
    }) => api.post(`/worlds/${encodeURIComponent(name)}/reset-dimension`, { dimension, backup }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worlds'] })
      toast.success('Dimension reset')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleImport = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast.error('Only .zip files are accepted')
        return
      }
      setImportUploading(true)
      try {
        const params = new URLSearchParams()
        if (importName.trim()) params.set('name', importName.trim())
        if (importOverwrite) params.set('overwrite', 'true')
        const query = params.toString()
        const path = `/worlds/import${query ? `?${query}` : ''}`
        await api.uploadTo(path, file, 'world')
        toast.success('World imported')
        setImportName('')
        setImportOverwrite(false)
        queryClient.invalidateQueries({ queryKey: ['worlds'] })
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setImportUploading(false)
        setDropHover(false)
      }
    },
    [importName, importOverwrite, queryClient],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (running) return
      const file = e.dataTransfer.files?.[0]
      if (file) handleImport(file)
    },
    [running, handleImport],
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!running) setDropHover(true)
    },
    [running],
  )

  const onDragLeave = useCallback(() => setDropHover(false), [])

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImport(file)
      e.target.value = ''
    },
    [handleImport],
  )

  async function exportWorld(name: string) {
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(name)}/export`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${name}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary">Worlds</h2>
        <p className="text-sm text-muted-foreground">
          {activeWorld ? (
            <>
              Active world:{' '}
              <span className="font-medium text-primary">{activeWorld}</span>
            </>
          ) : (
            'No active world'
          )}
        </p>
      </div>

      {running && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>Server must be stopped to create, rename, delete, or import worlds.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Import World
          </CardTitle>
          <CardDescription>Import a world from a .zip file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="import-name">World Name</Label>
              <Input
                id="import-name"
                placeholder="Leave empty to use zip filename"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                disabled={running || importUploading}
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="import-overwrite"
                  checked={importOverwrite}
                  onCheckedChange={setImportOverwrite}
                  disabled={running || importUploading}
                />
                <Label htmlFor="import-overwrite">Overwrite if exists</Label>
              </div>
            </div>
          </div>

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
            onClick={() => !running && !importUploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                !running && !importUploading && fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={onFileInputChange}
              disabled={running || importUploading}
            />
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              {importUploading
                ? 'Importing...'
                : 'Drop a world .zip file here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground/60">.zip</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> World List
          </CardTitle>
          <CardDescription>
            {worlds.length} world{worlds.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading worlds...</p>
          ) : worlds.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No worlds found.</p>
          ) : (
            <ScrollArea className="h-[32rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead>level.dat</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worlds.map((world) => (
                    <WorldRow
                      key={world.name}
                      world={world}
                      running={running}
                      isActive={world.name === activeWorld}
                      onActivate={() => activateMutation.mutate(world.name)}
                      onRename={(to) =>
                        renameMutation.mutate({ from: world.name, to })
                      }
                      onExport={() => exportWorld(world.name)}
                      onDelete={(confirmName, backup) =>
                        deleteMutation.mutate({
                          name: world.name,
                          confirmName,
                          backup,
                        })
                      }
                      onResetDimension={(dimension, backup) =>
                        resetDimensionMutation.mutate({
                          name: world.name,
                          dimension,
                          backup,
                        })
                      }
                      activateBusy={activateMutation.isPending}
                      renameBusy={renameMutation.isPending}
                      deleteBusy={deleteMutation.isPending}
                      resetBusy={resetDimensionMutation.isPending}
                    />
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

function WorldRow({
  world,
  running,
  isActive,
  onActivate,
  onRename,
  onExport,
  onDelete,
  onResetDimension,
  activateBusy,
  renameBusy,
  deleteBusy,
  resetBusy,
}: {
  world: WorldEntry
  running: boolean
  isActive: boolean
  onActivate: () => void
  onRename: (to: string) => void
  onExport: () => void
  onDelete: (confirmName: string, backup: boolean) => void
  onResetDimension: (dimension: 'nether' | 'end', backup: boolean) => void
  activateBusy: boolean
  renameBusy: boolean
  deleteBusy: boolean
  resetBusy: boolean
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTo, setRenameTo] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteBackup, setDeleteBackup] = useState(true)

  const [resetNetherOpen, setResetNetherOpen] = useState(false)
  const [resetNetherBackup, setResetNetherBackup] = useState(true)

  const [resetEndOpen, setResetEndOpen] = useState(false)
  const [resetEndBackup, setResetEndBackup] = useState(true)

  const [levelOpen, setLevelOpen] = useState(false)
  const [levelInfo, setLevelInfo] = useState<LevelDatInfo | null>(null)
  const [levelLoading, setLevelLoading] = useState(false)

  function openRenameDialog() {
    setRenameTo(world.name)
    setRenameOpen(true)
  }

  function confirmRename() {
    if (renameTo.trim() && renameTo !== world.name) {
      onRename(renameTo.trim())
    }
    setRenameOpen(false)
  }

  function openDeleteDialog() {
    setDeleteConfirm('')
    setDeleteBackup(true)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    onDelete(deleteConfirm, deleteBackup)
    setDeleteOpen(false)
  }

  function openResetNetherDialog() {
    setResetNetherBackup(true)
    setResetNetherOpen(true)
  }

  function confirmResetNether() {
    onResetDimension('nether', resetNetherBackup)
    setResetNetherOpen(false)
  }

  async function openLevelDialog() {
    setLevelOpen(true)
    setLevelLoading(true)
    setLevelInfo(null)
    try {
      const info = await api.get<LevelDatInfo>(`/worlds/${encodeURIComponent(world.name)}/level`)
      setLevelInfo(info)
    } catch (e) {
      toast.error((e as Error).message)
      setLevelOpen(false)
    } finally {
      setLevelLoading(false)
    }
  }

  function openResetEndDialog() {
    setResetEndBackup(true)
    setResetEndOpen(true)
  }

  function confirmResetEnd() {
    onResetDimension('end', resetEndBackup)
    setResetEndOpen(false)
  }

  const actionsDisabled = running || activateBusy || renameBusy || deleteBusy || resetBusy

  return (
    <TableRow>
      <TableCell className="font-medium">{world.name}</TableCell>
      <TableCell>
        {isActive ? (
          <Badge variant="default" className="text-[10px]">
            Active
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatBytes(world.sizeBytes)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(world.modifiedAt)}
      </TableCell>
      <TableCell>
        {world.hasLevelDat ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View level metadata"
            onClick={openLevelDialog}
          >
            <Check className="h-4 w-4 text-green-500" />
          </Button>
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40" />
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isActive || running || actionsDisabled}
            onClick={onActivate}
          >
            Activate
          </Button>

          <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={actionsDisabled}
                onClick={openRenameDialog}
              >
                Rename
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rename World</AlertDialogTitle>
                <AlertDialogDescription>
                  Enter a new name for <strong>{world.name}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="New world name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameTo.trim() && renameTo !== world.name) {
                    confirmRename()
                  }
                }}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmRename}
                  disabled={!renameTo.trim() || renameTo === world.name}
                >
                  Rename
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onExport}
          >
            <Download className="mr-1 h-3 w-3" /> Export
          </Button>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={actionsDisabled}
                onClick={openDeleteDialog}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete World</AlertDialogTitle>
                <AlertDialogDescription>
                  Type <strong>{world.name}</strong> to confirm deletion.
                  {deleteBackup && ' A backup will be created first.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center gap-2">
                <Switch
                  id={`delete-backup-${world.name}`}
                  checked={deleteBackup}
                  onCheckedChange={setDeleteBackup}
                />
                <Label htmlFor={`delete-backup-${world.name}`}>
                  Create backup before deleting
                </Label>
              </div>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type world name to confirm"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirm === world.name) {
                    confirmDelete()
                  }
                }}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDelete}
                  disabled={deleteConfirm !== world.name}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={resetNetherOpen} onOpenChange={setResetNetherOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={actionsDisabled}
                onClick={openResetNetherDialog}
              >
                Reset Nether
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Nether</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the Nether dimension data for{' '}
                  <strong>{world.name}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center gap-2">
                <Switch
                  id={`reset-nether-backup-${world.name}`}
                  checked={resetNetherBackup}
                  onCheckedChange={setResetNetherBackup}
                />
                <Label htmlFor={`reset-nether-backup-${world.name}`}>
                  Create backup before reset
                </Label>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmResetNether}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset Nether
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={levelOpen} onOpenChange={setLevelOpen}>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Level data — {world.name}</AlertDialogTitle>
                <AlertDialogDescription>
                  Read-only metadata from level.dat and server.properties (read-only).
                </AlertDialogDescription>
              </AlertDialogHeader>
              {levelLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : levelInfo ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="mb-2 font-medium">level.dat</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                      <dt className="text-muted-foreground">Seed</dt>
                      <dd>{levelInfo.seed ?? '—'}</dd>
                      <dt className="text-muted-foreground">Generator</dt>
                      <dd>{levelInfo.generatorName ?? '—'}</dd>
                      <dt className="text-muted-foreground">Game type</dt>
                      <dd>{levelInfo.gameType ?? '—'}</dd>
                      <dt className="text-muted-foreground">Difficulty</dt>
                      <dd>{levelInfo.difficulty ?? '—'}</dd>
                      <dt className="text-muted-foreground">Spawn</dt>
                      <dd>
                        {levelInfo.spawnX !== undefined
                          ? `${levelInfo.spawnX}, ${levelInfo.spawnY}, ${levelInfo.spawnZ}`
                          : '—'}
                      </dd>
                    </dl>
                  </div>
                  {levelInfo.propertiesOverlap && (
                    <div>
                      <p className="mb-2 font-medium">server.properties overlap</p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                        <dt className="text-muted-foreground">level-seed</dt>
                        <dd>{levelInfo.propertiesOverlap.levelSeed ?? '—'}</dd>
                        <dt className="text-muted-foreground">level-type</dt>
                        <dd>{levelInfo.propertiesOverlap.levelType ?? '—'}</dd>
                        <dt className="text-muted-foreground">gamemode</dt>
                        <dd>{levelInfo.propertiesOverlap.gamemode ?? '—'}</dd>
                        <dt className="text-muted-foreground">difficulty</dt>
                        <dd>{levelInfo.propertiesOverlap.difficulty ?? '—'}</dd>
                      </dl>
                    </div>
                  )}
                </div>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={resetEndOpen} onOpenChange={setResetEndOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={actionsDisabled}
                onClick={openResetEndDialog}
              >
                Reset End
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset End</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the End dimension data for{' '}
                  <strong>{world.name}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center gap-2">
                <Switch
                  id={`reset-end-backup-${world.name}`}
                  checked={resetEndBackup}
                  onCheckedChange={setResetEndBackup}
                />
                <Label htmlFor={`reset-end-backup-${world.name}`}>
                  Create backup before reset
                </Label>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmResetEnd}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset End
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  )
}
