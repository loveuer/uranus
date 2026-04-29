import { useEffect, useState, useCallback } from 'react'
import { useGcStore } from '@/stores/gc'
import { toast } from '@/stores/ui'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard, StatsCardSkeleton } from '@/components/ui/stats-card'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trash2, Activity, Clock, HardDrive, RotateCcw, Play, Beaker } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'

function truncateDigest(digest: string): string {
  if (digest.length <= 23) return digest
  return digest.slice(0, 15) + '...' + digest.slice(-8)
}

function computeDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return '-'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'completed': return 'success' as const
    case 'failed': return 'destructive' as const
    case 'running': return 'warning' as const
    default: return 'secondary' as const
  }
}

export default function GCPage() {
  const {
    history, candidates, unreferenced, autoStatus, lastResult,
    loading, running, error,
    fetchHistory, fetchCandidates, fetchUnreferenced, fetchAutoStatus,
    runGc, dryRun, restore, clearError,
  } = useGcStore()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dryRunResultOpen, setDryRunResultOpen] = useState(false)
  const [dryRunLoading, setDryRunLoading] = useState(false)

  useEffect(() => {
    fetchHistory()
    fetchCandidates()
    fetchUnreferenced()
    fetchAutoStatus()
  }, [])

  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error])

  const handleRunGc = useCallback(async () => {
    const ok = await runGc()
    setConfirmOpen(false)
    if (ok) {
      toast.success('Garbage collection completed')
      fetchUnreferenced()
    }
  }, [runGc])

  const handleDryRun = useCallback(async () => {
    setDryRunLoading(true)
    const result = await dryRun()
    setDryRunLoading(false)
    if (result) {
      setDryRunResultOpen(true)
    }
  }, [dryRun])

  const handleRestore = useCallback(async (id: number) => {
    const ok = await restore(id)
    if (ok) {
      toast.success('Blob restored successfully')
      fetchUnreferenced()
    }
  }, [restore])

  const lastRun = history.length > 0 ? history[0] : null

  // ── History columns ──
  const historyColumns = [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => (
        <Badge variant={statusBadgeVariant(info.getValue())}>
          {info.getValue()}
        </Badge>
      ),
    },
    {
      accessorKey: 'started_at',
      header: 'Started',
      cell: (info: any) => (
        <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: ({ row }: any) => (
        <span className="text-sm font-mono">
          {computeDuration(row.original.started_at, row.original.ended_at)}
        </span>
      ),
    },
    {
      accessorKey: 'marked',
      header: 'Marked',
      cell: (info: any) => <span className="font-mono text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'deleted',
      header: 'Deleted',
      cell: (info: any) => <span className="font-mono text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'freed_size',
      header: 'Freed',
      cell: (info: any) => <span className="font-mono text-sm">{formatBytes(info.getValue())}</span>,
    },
    {
      accessorKey: 'dry_run',
      header: 'Mode',
      cell: (info: any) => info.getValue()
        ? <Badge variant="outline">Dry Run</Badge>
        : <Badge variant="secondary">Live</Badge>,
    },
  ]

  // ── Candidates columns ──
  const candidateColumns = [
    {
      accessorKey: 'digest',
      header: 'Digest',
      cell: (info: any) => (
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {truncateDigest(info.getValue())}
        </code>
      ),
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: (info: any) => <span className="font-mono text-sm">{formatBytes(info.getValue())}</span>,
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: (info: any) => <Badge variant="secondary">{info.getValue()}</Badge>,
    },
    {
      accessorKey: 'repository_name',
      header: 'Repository',
    },
    {
      accessorKey: 'created_at',
      header: 'Marked At',
      cell: (info: any) => (
        <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRestore(row.original.id)}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Restore
        </Button>
      ),
    },
  ]

  // ── Unreferenced columns ──
  const unreferencedColumns = [
    {
      accessorKey: 'digest',
      header: 'Digest',
      cell: (info: any) => (
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {truncateDigest(info.getValue())}
        </code>
      ),
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: (info: any) => <span className="font-mono text-sm">{formatBytes(info.getValue())}</span>,
    },
    {
      accessorKey: 'ref_count',
      header: 'Ref Count',
      cell: (info: any) => <span className="font-mono text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: (info: any) => (
        <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Garbage Collection"
        description="Manage OCI blob garbage collection"
        breadcrumb={[
          { label: 'Dashboard', path: '/' },
          { label: 'GC' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDryRun} disabled={dryRunLoading || running}>
              <Beaker className="h-4 w-4 mr-2" />
              {dryRunLoading ? 'Running...' : 'Dry Run'}
            </Button>
            <Button variant="default" size="sm" onClick={() => setConfirmOpen(true)} disabled={running}>
              <Trash2 className="h-4 w-4 mr-2" />
              {running ? 'Running...' : 'Run GC'}
            </Button>
          </div>
        }
      />

      {/* ── Stats Cards ── */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {loading && !autoStatus ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Auto GC"
              value={autoStatus?.running ? 'Active' : 'Inactive'}
              icon={<Activity className="h-4 w-4" />}
              description="Background scheduled GC"
            />
            <StatsCard
              title="Last Run"
              value={lastRun ? formatDate(lastRun.started_at) : 'Never'}
              icon={<Clock className="h-4 w-4" />}
              description={lastRun ? `Status: ${lastRun.status}` : 'No GC runs yet'}
            />
            <StatsCard
              title="Pending Deletion"
              value={candidates.length}
              icon={<Trash2 className="h-4 w-4" />}
              description="Blobs awaiting cleanup"
            />
            <StatsCard
              title="Last Freed"
              value={lastRun ? formatBytes(lastRun.freed_size) : '0 B'}
              icon={<HardDrive className="h-4 w-4" />}
              description={lastRun?.dry_run ? '(dry run)' : 'Space reclaimed'}
            />
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">GC History</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Deletion
            {candidates.length > 0 && (
              <Badge variant="destructive" className="ml-2">{candidates.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unreferenced">Unreferenced Blobs</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>GC History</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={historyColumns} data={history} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Pending Deletion</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={candidateColumns} data={candidates} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unreferenced">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Unreferenced Blobs</CardTitle>
            </CardHeader>
            <CardContent>
              {unreferenced ? (
                <div className="mb-4 flex gap-4 text-sm text-muted-foreground">
                  <span>Count: <strong className="text-foreground">{unreferenced.count}</strong></span>
                  <span>Total Size: <strong className="text-foreground">{formatBytes(unreferenced.total_size)}</strong></span>
                </div>
              ) : null}
              <DataTable
                columns={unreferencedColumns}
                data={unreferenced?.blobs ?? []}
                loading={loading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Run GC Confirmation ── */}
      <ConfirmDialog
        open={confirmOpen}
        title="Run Garbage Collection"
        description="This will permanently delete unreferenced OCI blobs that are past the grace period. Soft-deleted blobs older than 24 hours will be removed. Continue?"
        variant="destructive"
        confirmText="Run GC"
        loading={running}
        onConfirm={handleRunGc}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* ── Dry Run Result ── */}
      <Dialog open={dryRunResultOpen} onOpenChange={setDryRunResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dry Run Result</DialogTitle>
            <DialogDescription>
              Simulated GC run — no blobs were actually deleted.
            </DialogDescription>
          </DialogHeader>
          {lastResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Marked Blobs</p>
                  <p className="text-2xl font-bold">{lastResult.marked_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Candidates</p>
                  <p className="text-2xl font-bold">{lastResult.candidate_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-2xl font-bold">{formatBytes(lastResult.total_size)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">
                    {computeDuration(lastResult.started_at, lastResult.ended_at)}
                  </p>
                </div>
              </div>
              {lastResult.candidates && lastResult.candidates.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Candidate Blobs</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {lastResult.candidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-1.5">
                        <code className="text-xs font-mono">{truncateDigest(c.digest)}</code>
                        <span className="text-muted-foreground">{formatBytes(c.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
