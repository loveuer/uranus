import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CodeBlock } from '@/components/ui/code-block'
import { StatsCard, StatsCardSkeleton } from '@/components/ui/stats-card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Hexagon,
  Trash2,
  RefreshCw,
  Copy,
  HardDrive,
  FolderOpen,
  Server,
  Check,
} from 'lucide-react'
import { goApi } from '@/api'
import type { GoCacheStats } from '@/types'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/stores/ui'

export default function GoPage() {
  const [stats, setStats] = useState<GoCacheStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await goApi.getStats()
      setStats(res.data.data)
    } catch {
      toast.error('Failed to load cache stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleCleanCache = async () => {
    setCleaning(true)
    try {
      await goApi.cleanCache()
      await loadStats()
      setCleanDialogOpen(false)
      toast.success('Cache cleaned successfully')
    } catch {
      toast.error('Failed to clean cache')
    } finally {
      setCleaning(false)
    }
  }

  const getProxyUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/go`
  }

  const copyProxyUrl = () => {
    navigator.clipboard.writeText(`export GOPROXY=${getProxyUrl()}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Go Module Proxy"
        description="Go module proxy cache statistics"
        breadcrumb={[
          { label: 'Dashboard', path: '/' },
          { label: 'Go' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanDialogOpen(true)}
              disabled={!stats || stats.file_count === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clean Cache
            </Button>
          </div>
        }
      />

      {/* Proxy URL Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Proxy URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 bg-muted rounded-md mb-3">
            <span className="font-mono text-sm">{getProxyUrl()}</span>
            <Button variant="ghost" size="icon" onClick={copyProxyUrl}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Set this URL as your <code className="bg-muted px-1.5 py-0.5 rounded text-xs">GOPROXY</code> environment variable
          </p>
          <CodeBlock
            code={`export GOPROXY=${getProxyUrl()}`}
            language="bash"
          />
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatsCard
              title="Cache Size"
              value={formatBytes(stats.size_bytes)}
              icon={<HardDrive className="h-4 w-4" />}
            />
            <StatsCard
              title="Files Cached"
              value={stats.file_count}
              icon={<FolderOpen className="h-4 w-4" />}
            />
            <StatsCard
              title="Cache Directory"
              value={stats.cache_dir.split('/').pop() || stats.cache_dir}
              description={stats.cache_dir}
              icon={<Server className="h-4 w-4" />}
            />
            <StatsCard
              title="Upstream"
              value={stats.upstream || 'proxy.cn'}
              description="Default upstream proxy"
              icon={<Hexagon className="h-4 w-4" />}
            />
          </>
        ) : (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        )}
      </div>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">1. Configure Go to use this proxy</p>
            <CodeBlock code={`go env -w GOPROXY=${getProxyUrl()}`} language="bash" />
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">2. Or set environment variable temporarily</p>
            <CodeBlock code={`export GOPROXY=${getProxyUrl()}`} language="bash" />
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">3. For private modules, also set GOPRIVATE</p>
            <CodeBlock code="go env -w GOPRIVATE=github.com/mycompany/*" language="bash" />
          </div>
        </CardContent>
      </Card>

      {/* Clean cache confirmation */}
      <ConfirmDialog
        open={cleanDialogOpen}
        title="Clean Cache"
        description="Are you sure you want to clean all cached Go modules? This action cannot be undone."
        confirmText="Clean"
        cancelText="Cancel"
        variant="destructive"
        loading={cleaning}
        onConfirm={handleCleanCache}
        onCancel={() => setCleanDialogOpen(false)}
      />
    </div>
  )
}