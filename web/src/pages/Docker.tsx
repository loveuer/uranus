import { useEffect, useState } from 'react'
import { useOciStore } from '@/stores/oci'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Container, HardDrive, Tag, Download, Trash2, MoreHorizontal, Copy } from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function DockerPage() {
  const { fetchRepositories, fetchStats, cleanCache, deleteRepo, repositories, stats, loading, tags } = useOciStore()

  const [expandedRepo, setExpandedRepo] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)

  useEffect(() => {
    fetchRepositories()
    fetchStats()
  }, [])

  const baseUrl = window.location.origin

  const columns = [
    {
      accessorKey: 'name',
      header: 'Repository',
    },
    {
      accessorKey: 'tag_count',
      header: 'Tags',
      cell: (info: any) => <Badge variant="secondary">{info.getValue()}</Badge>,
    },
    {
      accessorKey: 'total_size',
      header: 'Size',
      cell: (info: any) => <span className="font-mono text-sm">{formatBytes(info.getValue())}</span>,
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Push',
      cell: (info: any) => <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpandedRepo(expandedRepo === row.original.name ? null : row.original.name)}
          >
            {expandedRepo === row.original.name ? '−' : '+'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`docker pull ${baseUrl}:5000/${row.original.name}:latest`)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Pull Command
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setDeleteTarget(row.original); setDeleteDialogOpen(true) }} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Docker</h1>
          <p className="text-muted-foreground">OCI container image repository</p>
        </div>
        <Button variant="outline" onClick={() => setCleanDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Cache
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Repositories" value={repositories.length} icon={<Container />} />
        <StatsCard title="Total Tags" value={repositories.reduce((acc: number, r: any) => acc + (r.tag_count || 0), 0)} icon={<Tag />} />
        <StatsCard title="Storage Used" value={formatBytes(stats?.size_bytes || 0)} icon={<HardDrive />} />
        <StatsCard title="Total Blobs" value={stats?.blob_count || 0} icon={<Download />} />
      </div>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Pull command:</span>
            <code className="flex-1 font-mono text-sm bg-background px-3 py-1.5 rounded">
              docker pull {baseUrl}:5000/{'{image}'}:{'{tag}'}
            </code>
            <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(`docker pull ${baseUrl}:5000/{image}:{tag}`)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Repositories</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={repositories} loading={loading} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Repository"
        description={`Are you sure you want to delete ${deleteTarget?.name}? All tags will be removed.`}
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            deleteRepo(deleteTarget.id)
            setDeleteDialogOpen(false)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => { setDeleteDialogOpen(false); setDeleteTarget(null) }}
      />

      <ConfirmDialog
        open={cleanDialogOpen}
        title="Clear Cache"
        description="This will clear all cached OCI layers. Are you sure?"
        onConfirm={() => {
          cleanCache()
          setCleanDialogOpen(false)
        }}
        onCancel={() => setCleanDialogOpen(false)}
      />
    </div>
  )
}