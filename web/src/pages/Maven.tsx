import { useEffect, useState } from 'react'
import { useMavenStore } from '@/stores/maven'
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
import { Box, Folder, HardDrive, Download, Search, MoreHorizontal, Eye, Copy } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function MavenPage() {
  const { fetchArtifacts, fetchRepositories, searchArtifacts, fetchVersions, selectArtifact, artifacts, repositories, versions, loading, selectedArtifact } = useMavenStore()

  const [search, setSearch] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    fetchArtifacts()
    fetchRepositories()
  }, [])

  const baseUrl = window.location.origin

  const handleSearch = (value: string) => {
    setSearch(value)
    if (value) {
      searchArtifacts(value)
    } else {
      fetchArtifacts()
    }
  }

  const columns = [
    {
      accessorKey: 'group_id',
      header: 'Group ID',
      cell: (info: any) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{info.getValue()}</code>,
    },
    {
      accessorKey: 'artifact_id',
      header: 'Artifact',
    },
    {
      accessorKey: 'version',
      header: 'Latest',
      cell: (info: any) => <Badge>{info.getValue()}</Badge>,
    },
    {
      accessorKey: 'is_uploaded',
      header: 'Source',
      cell: (info: any) => <Badge variant="outline">{info.getValue() ? 'Uploaded' : 'Cached'}</Badge>,
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
            <DropdownMenuItem onClick={() => { selectArtifact(row.original); fetchVersions(row.original.group_id, row.original.artifact_id); setDetailOpen(true) }}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const generateDependencyXml = (artifact: any) => {
    return `<dependency>
  <groupId>${artifact.group_id}</groupId>
  <artifactId>${artifact.artifact_id}</artifactId>
  <version>${artifact.version}</version>
</dependency>`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Maven</h1>
        <p className="text-muted-foreground">Java artifact repository</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Artifacts" value={artifacts.length} icon={<Box />} />
        <StatsCard title="Groups" value={new Set(artifacts.map((a: any) => a.group_id)).size} icon={<Folder />} />
        <StatsCard title="Repositories" value={repositories.length} icon={<HardDrive />} />
        <StatsCard title="Downloads" value={0} icon={<Download />} />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Artifacts</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by group or artifact..."
                className="w-[250px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={artifacts} loading={loading} />
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-lg">
              {selectedArtifact?.group_id} : {selectedArtifact?.artifact_id}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Available Versions</Label>
            <div className="flex flex-wrap gap-2">
              {versions.map((v: string) => (
                <Badge key={v} variant={v === selectedArtifact?.version ? "default" : "secondary"}>
                  {v}
                </Badge>
              ))}
            </div>
          </div>

          {selectedArtifact && (
            <div className="space-y-2">
              <Label>Maven Dependency</Label>
              <div className="relative">
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-sm overflow-x-auto">
                  {generateDependencyXml(selectedArtifact)}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 text-slate-400 hover:text-slate-100"
                  onClick={() => navigator.clipboard.writeText(generateDependencyXml(selectedArtifact))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Repository URL</Label>
            <code className="text-sm bg-muted px-3 py-1.5 rounded block">
              {baseUrl}/maven/
            </code>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}