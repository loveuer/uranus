import { useEffect, useState } from 'react'
import { usePyPIStore } from '@/stores/pypi'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CircleDot, Database, HardDrive, Download, Trash2, Search, MoreHorizontal, Copy, Eye } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function PyPIPage() {
  const { fetchPackages, fetchStats, deletePackage, cleanCache, packages, stats, loading, selectedPackage, selectPackage } = usePyPIStore()

  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)

  useEffect(() => {
    fetchPackages()
    fetchStats()
  }, [])

  const baseUrl = window.location.origin

  const columns = [
    {
      accessorKey: 'name',
      header: 'Package',
    },
    {
      accessorKey: 'summary',
      header: 'Summary',
      cell: (info: any) => <span className="text-sm text-muted-foreground truncate max-w-[200px]">{info.getValue() || '-'}</span>,
    },
    {
      accessorKey: 'is_uploaded',
      header: 'Source',
      cell: (info: any) => <Badge variant={info.getValue() ? "default" : "outline"}>{info.getValue() ? 'Uploaded' : 'Cached'}</Badge>,
    },
    {
      accessorKey: 'author',
      header: 'Author',
      cell: (info: any) => <span className="text-sm">{info.getValue() || 'Unknown'}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { selectPackage(row.original.name); setDetailOpen(true) }}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`pip install ${row.original.name}`)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Install
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setDeleteTarget(row.original); setDeleteDialogOpen(true) }} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PyPI</h1>
          <p className="text-muted-foreground">Python package repository</p>
        </div>
        <Button variant="outline" onClick={() => setCleanDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Cache
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Packages" value={packages.length} icon={<CircleDot />} />
        <StatsCard title="Cached" value={stats?.cached || 0} icon={<Database />} />
        <StatsCard title="Storage" value={formatBytes(stats?.size || 0)} icon={<HardDrive />} />
        <StatsCard title="Downloads" value={stats?.downloads || 0} icon={<Download />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>pip Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Install from this repository</Label>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-sm overflow-x-auto">
                pip install --index-url {baseUrl}/simple --trusted-host localhost package-name
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-100"
                onClick={() => navigator.clipboard.writeText(`pip install --index-url ${baseUrl}/simple --trusted-host localhost package-name`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={packages} loading={loading} />
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPackage?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-muted-foreground">{selectedPackage?.summary}</p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Author:</span>
                <span className="ml-2">{selectedPackage?.author || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">License:</span>
                <span className="ml-2">{selectedPackage?.license || 'Unknown'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Install</Label>
              <code className="bg-muted px-3 py-1.5 rounded block font-mono text-sm">
                pip install {selectedPackage?.name}
              </code>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Package"
        description={`Are you sure you want to delete ${deleteTarget?.name}?`}
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            deletePackage(deleteTarget.name)
            setDeleteDialogOpen(false)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => { setDeleteDialogOpen(false); setDeleteTarget(null) }}
      />

      <ConfirmDialog
        open={cleanDialogOpen}
        title="Clear Cache"
        description="This will clear all cached PyPI packages. Are you sure?"
        onConfirm={() => {
          cleanCache()
          setCleanDialogOpen(false)
        }}
        onCancel={() => setCleanDialogOpen(false)}
      />
    </div>
  )
}