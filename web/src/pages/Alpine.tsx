import { useEffect, useState } from 'react'
import { useAlpineStore } from '@/stores/alpine'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Mountain, GitBranch, HardDrive, Clock, RefreshCw, Trash2, Search, Copy } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

export default function AlpinePage() {
  const { fetchPackages, fetchStats, sync, cleanCache, searchPackages, setBranch, setRepo, setArch, packages, stats, loading, branch, repo, arch, syncing } = useAlpineStore()

  const [searchInput, setSearchInput] = useState('')
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)

  useEffect(() => {
    fetchPackages()
    fetchStats()
  }, [])

  const baseUrl = window.location.origin

  const handleSearch = (value: string) => {
    setSearchInput(value)
    searchPackages(value)
  }

  const columns = [
    {
      accessorKey: 'Name',
      header: 'Package',
    },
    {
      accessorKey: 'Version',
      header: 'Version',
      cell: (info: any) => <Badge variant="outline">{info.getValue()}</Badge>,
    },
    {
      accessorKey: 'Size',
      header: 'Size',
      cell: (info: any) => <span className="font-mono text-sm">{formatBytes(info.getValue())}</span>,
    },
    {
      accessorKey: 'Origin',
      header: 'Origin',
      cell: (info: any) => <Badge variant="secondary">{info.getValue() || repo}</Badge>,
    },
    {
      accessorKey: 'License',
      header: 'License',
      cell: (info: any) => <span className="text-sm text-muted-foreground">{info.getValue() || 'Unknown'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alpine</h1>
          <p className="text-muted-foreground">Alpine Linux APK repository</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSyncDialogOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync
          </Button>
          <Button variant="outline" onClick={() => setCleanDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Cache
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Packages" value={packages.length} icon={<Mountain />} />
        <StatsCard title="Branches" value={3} icon={<GitBranch />} />
        <StatsCard title="Storage" value={formatBytes(stats?.CacheSize || 0)} icon={<HardDrive />} />
        <StatsCard title="Cached" value={stats?.CachedPackages || 0} icon={<Clock />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Add to /etc/apk/repositories on your Alpine system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>/etc/apk/repositories</Label>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-sm overflow-x-auto">
                {`${baseUrl}/alpine/${branch}/${repo}\n${baseUrl}/alpine/${branch}/community`}
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-100"
                onClick={() => navigator.clipboard.writeText(`${baseUrl}/alpine/${branch}/${repo}\n${baseUrl}/alpine/${branch}/community`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v3.19">v3.19</SelectItem>
                  <SelectItem value="v3.18">v3.18</SelectItem>
                  <SelectItem value="v3.17">v3.17</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Repository</Label>
              <Select value={repo} onValueChange={setRepo}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">main</SelectItem>
                  <SelectItem value="community">community</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Architecture</Label>
              <Select value={arch} onValueChange={setArch}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="x86_64">x86_64</SelectItem>
                  <SelectItem value="aarch64">aarch64</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Packages</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search packages..."
                className="w-[200px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={packages} loading={loading || syncing} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={syncDialogOpen}
        title="Sync from Upstream"
        description="This will download packages from upstream Alpine mirrors. This may take a while."
        onConfirm={() => {
          sync(branch, repo, arch)
          setSyncDialogOpen(false)
        }}
        onCancel={() => setSyncDialogOpen(false)}
      />

      <ConfirmDialog
        open={cleanDialogOpen}
        title="Clear Cache"
        description="This will clear all cached Alpine packages. Are you sure?"
        onConfirm={() => {
          cleanCache()
          setCleanDialogOpen(false)
        }}
        onCancel={() => setCleanDialogOpen(false)}
      />
    </div>
  )
}