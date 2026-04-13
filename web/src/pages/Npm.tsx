import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, DataTableSkeleton } from '@/components/ui/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CodeBlock } from '@/components/ui/code-block'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronRight,
  ChevronDown,
  Package,
  Cloud,
  HardDrive,
  Copy,
  RefreshCw,
  Check,
} from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { npmApi } from '@/api'
import type { NpmPackage, NpmVersion } from '@/types'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Version sub-row component
function VersionRows({ name }: { name: string }) {
  const [versions, setVersions] = useState<NpmVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    npmApi.listVersions(name)
      .then(res => setVersions(res.data.data ?? []))
      .catch(() => setError('Failed to load versions'))
      .finally(() => setLoading(false))
  }, [name])

  if (loading) {
    return (
      <div className="p-4">
        <Skeleton className="h-4 w-[200px]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive text-sm">{error}</div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">No versions</div>
    )
  }

  return (
    <div className="p-4 pl-8 space-y-2">
      {versions.map(v => (
        <div key={v.version} className="flex items-center gap-4 py-2 border-b last:border-b-0">
          <span className="font-mono text-sm">{v.version}</span>
          <Badge
            variant={v.cached ? 'success' : 'secondary'}
            className="text-xs"
          >
            {v.cached ? (
              <><HardDrive className="h-3 w-3 mr-1" /> Cached</>
            ) : (
              <><Cloud className="h-3 w-3 mr-1" /> Proxy</>
            )}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {formatBytes(v.size)}
          </span>
          <span className="text-xs text-muted-foreground">
            {v.uploader || 'upstream'}
          </span>
        </div>
      ))}
    </div>
  )
}

// Package row with expandable versions
function PackageRow({ pkg, registryURL }: { pkg: NpmPackage; registryURL: string }) {
  const [expanded, setExpanded] = useState(false)

  const installCmd = `npm install ${pkg.name} --registry ${registryURL}`
  const [copied, setCopied] = useState(false)

  const copyInstallCmd = () => {
    navigator.clipboard.writeText(installCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const latest = pkg.dist_tags?.latest ?? ''

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div className="flex-1">
            <span className="font-mono font-medium">{pkg.name}</span>
            {pkg.description && (
              <span className="text-sm text-muted-foreground ml-2">
                {pkg.description.slice(0, 50)}...
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {latest && (
              <Badge variant="default" className="text-xs">
                latest: {latest}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {pkg.version_count} versions
          </Badge>
          <Badge variant={pkg.cached_count > 0 ? 'success' : 'secondary'} className="text-xs">
            {pkg.cached_count} cached
          </Badge>
          <div className="flex items-center gap-1 bg-muted rounded px-2 py-1">
            <span className="font-mono text-xs truncate max-w-[200px]">{installCmd}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); copyInstallCmd() }}>
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <VersionRows name={pkg.name} />
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function NpmPage() {
  const [packages, setPackages] = useState<NpmPackage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(false)

  const registryURL = `${window.location.origin}/npm`

  const load = useCallback(async (p: number, ps: number, s: string) => {
    setLoading(true)
    try {
      const res = await npmApi.listPackages(p, ps, s)
      setPackages(res.data.data ?? [])
      setTotal((res.data as unknown as { total: number }).total ?? 0)
    } catch {
      // Handle error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, pageSize, search)
  }, [load, page, pageSize, search])

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  return (
    <div>
      <PageHeader
        title="npm Registry"
        description="Manage npm packages and cache"
        breadcrumb={[
          { label: 'Dashboard', path: '/' },
          { label: 'npm' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Package className="h-3 w-3 mr-1" />
              {total} packages
            </Badge>
          </div>
        }
      />

      {/* Registry URL */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Registry URL:</span>
              <span className="font-mono text-sm">{registryURL}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(`npm set registry ${registryURL}`)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="Search packages..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Package list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <DataTableSkeleton columns={5} rows={5} />
          ) : packages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search
                ? `No packages matching "${search}"`
                : 'No packages yet. Use npm publish to add packages, or pull to proxy.'}
            </div>
          ) : (
            <div className="divide-y">
              {packages.map(pkg => (
                <PackageRow key={pkg.name} pkg={pkg} registryURL={registryURL} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}