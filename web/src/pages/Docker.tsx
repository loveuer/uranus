import { useEffect, useState } from 'react'
import { useOciStore } from '@/stores/oci'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Container,
  HardDrive,
  Tag,
  Download,
  Trash2,
  Copy,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import { ociApi } from '@/api'
import type { OciTagInfo, OciRepository } from '@/types'
import { toast } from '@/stores/ui'

// Tag sub-row component — self-fetches tags on mount
function TagRows({ repoName, onTagDeleted }: { repoName: string; onTagDeleted?: () => void }) {
  const [tags, setTags] = useState<OciTagInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<OciTagInfo | null>(null)
  const [copiedTag, setCopiedTag] = useState<string | null>(null)

  const baseUrl = window.location.origin

  const loadTags = () => {
    setLoading(true)
    ociApi.listTags(repoName)
      .then(res => setTags(res.data.data ?? []))
      .catch(() => setError('Failed to load tags'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTags() }, [repoName])

  const handleCopyPull = (tag: string) => {
    const cmd = `docker pull ${baseUrl}:5000/${repoName}:${tag}`
    navigator.clipboard.writeText(cmd)
    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 2000)
  }

  const handleDeleteTag = async () => {
    if (!deleteTarget) return
    try {
      await ociApi.deleteTag(repoName, deleteTarget.tag)
      toast.success(`Tag "${deleteTarget.tag}" deleted`)
      setDeleteTarget(null)
      loadTags()
      onTagDeleted?.()
    } catch {
      toast.error('Failed to delete tag')
    }
  }

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

  if (tags.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">No tags</div>
    )
  }

  return (
    <>
      <div className="p-4 pl-8 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-4 py-2 text-xs text-muted-foreground font-medium border-b">
          <span className="w-[120px]">Tag</span>
          <span className="flex-1">Digest</span>
          <span className="w-[100px]">Type</span>
          <span className="w-[70px] text-right">Size</span>
          <span className="w-[130px] text-right">Created</span>
          <span className="w-[72px]" /> {/* actions column */}
        </div>
        {tags.map(t => (
          <div key={t.tag} className="flex items-center gap-4 py-2 border-b last:border-b-0 group">
            <span className="w-[120px] font-mono text-sm">{t.tag}</span>
            <span className="flex-1 font-mono text-xs text-muted-foreground truncate" title={t.manifest_digest}>
              {t.manifest_digest.length > 20 ? t.manifest_digest.slice(0, 20) + '...' : t.manifest_digest}
            </span>
            <span className="w-[100px]">
              <Badge variant="secondary" className="text-xs">
                {t.media_type.split('.').pop() || t.media_type}
              </Badge>
            </span>
            <span className="w-[70px] text-right font-mono text-xs text-muted-foreground">
              {formatBytes(t.size)}
            </span>
            <span className="w-[130px] text-right text-xs text-muted-foreground">
              {formatDate(t.created_at)}
            </span>
            <span className="w-[72px] flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={`Copy pull command for ${t.tag}`}
                onClick={() => handleCopyPull(t.tag)}
              >
                {copiedTag === t.tag ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                title={`Delete tag ${t.tag}`}
                onClick={() => setDeleteTarget(t)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tag"
        description={`Are you sure you want to delete tag "${deleteTarget?.tag}" from ${repoName}?`}
        variant="destructive"
        onConfirm={handleDeleteTag}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

// Repository row with expandable tags
function RepoRow({ repo, onDeleteRepo, onTagDeleted }: { repo: OciRepository; onDeleteRepo: (repo: OciRepository) => void; onTagDeleted?: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div className="flex-1 min-w-0">
            <span className="font-mono font-medium">{repo.name}</span>
            {repo.is_pushed && (
              <Badge variant="default" className="ml-2 text-xs">pushed</Badge>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {repo.tag_count} tags
          </Badge>
          <span className="font-mono text-sm text-muted-foreground w-[80px] text-right shrink-0">
            {formatBytes(repo.total_size)}
          </span>
          <span className="text-sm text-muted-foreground w-[140px] text-right shrink-0">
            {formatDate(repo.updated_at)}
          </span>
          <div className="w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              title="Delete repository"
              onClick={() => onDeleteRepo(repo)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <TagRows repoName={repo.name} onTagDeleted={onTagDeleted} />
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function DockerPage() {
  const { fetchRepositories, fetchStats, cleanCache, deleteRepo, repositories, stats, loading } = useOciStore()

  const [deleteRepoDialogOpen, setDeleteRepoDialogOpen] = useState(false)
  const [deleteRepoTarget, setDeleteRepoTarget] = useState<OciRepository | null>(null)
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)

  useEffect(() => {
    fetchRepositories()
    fetchStats()
  }, [])

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
              docker pull {window.location.origin}:5000/{'{image}'}:{'{tag}'}
            </code>
            <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(`docker pull ${window.location.origin}:5000/{image}:{tag}`)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Repositories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : repositories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No repositories yet. Push an image to get started.
            </div>
          ) : (
            <div className="divide-y">
              {repositories.map((repo: OciRepository) => (
                <RepoRow
                  key={repo.id}
                  repo={repo}
                  onDeleteRepo={(r) => { setDeleteRepoTarget(r); setDeleteRepoDialogOpen(true) }}
                  onTagDeleted={() => { fetchRepositories(); fetchStats() }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteRepoDialogOpen}
        title="Delete Repository"
        description={`Are you sure you want to delete ${deleteRepoTarget?.name}? All tags will be removed.`}
        variant="destructive"
        onConfirm={() => {
          if (deleteRepoTarget) {
            deleteRepo(deleteRepoTarget.id)
            setDeleteRepoDialogOpen(false)
            setDeleteRepoTarget(null)
          }
        }}
        onCancel={() => { setDeleteRepoDialogOpen(false); setDeleteRepoTarget(null) }}
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
