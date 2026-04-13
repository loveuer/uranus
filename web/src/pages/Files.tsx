import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, DataTableSkeleton } from '@/components/ui/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ColumnDef } from '@tanstack/react-table'
import {
  Folder,
  Upload,
  Download,
  Trash2,
  MoreHorizontal,
  Copy,
  Link,
  Loader2,
} from 'lucide-react'
import type { FileEntry } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { formatBytes, formatDate } from '@/lib/utils'

export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const token = useAuthStore((state) => state.token)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/file-store')
      const json = await res.json()
      setFiles(json.data ?? [])
    } catch {
      // Handle error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadProgress(0)

    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (ev) => {
      if (ev.total) setUploadProgress(Math.round((ev.loaded * 100) / ev.total))
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        loadFiles()
      } else {
        alert(`Upload failed: ${xhr.status} ${xhr.statusText}`)
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      alert('Upload failed: network error')
    }

    xhr.open('PUT', `/file-store/${encodeURIComponent(file.name)}`)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(file)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/file-store/${deleteTarget.path}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setDeleteTarget(null)
      setDeleteDialogOpen(false)
      loadFiles()
    } catch {
      // Handle error
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyLink = (path: string) => {
    const url = `${window.location.origin}/file-store/${path}`
    const success = () => {
      setCopiedLink(path)
      setTimeout(() => setCopiedLink(null), 2000)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(success)
    } else {
      // Fallback: select + execCommand (deprecated but works in more contexts)
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.select()
      try { document.execCommand('copy'); success() } catch { /* ignore */ }
      document.body.removeChild(el)
    }
  }

  const handleCopySHA256 = (hash: string) => {
    const success = () => {
      setCopiedHash(hash)
      setTimeout(() => setCopiedHash(null), 2000)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(hash).then(success)
    } else {
      const el = document.createElement('textarea')
      el.value = hash
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.select()
      try { document.execCommand('copy'); success() } catch { /* ignore */ }
      document.body.removeChild(el)
    }
  }

  const columns: ColumnDef<FileEntry>[] = [
    {
      accessorKey: 'path',
      header: 'Path',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.path}</span>
      ),
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">
          {formatBytes(row.original.size)}
        </span>
      ),
    },
    {
      accessorKey: 'mime_type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono text-xs">
          {row.original.mime_type || 'unknown'}
        </Badge>
      ),
    },
    {
      accessorKey: 'uploader',
      header: 'Uploader',
    },
    {
      accessorKey: 'sha256',
      header: 'SHA256',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.sha256?.slice(0, 12)}...
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => window.open(`/file-store/${row.original.path}`, '_blank')}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyLink(row.original.path)}
              className={copiedLink === row.original.path ? 'text-success' : ''}
            >
              <Link className="mr-2 h-4 w-4" />
              {copiedLink === row.original.path ? 'Copied!' : 'Copy Link'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopySHA256(row.original.sha256 ?? '')}
              className={copiedHash === row.original.sha256 ? 'text-success' : ''}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copiedHash === row.original.sha256 ? 'Copied!' : 'Copy SHA256'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDeleteTarget(row.original)
                setDeleteDialogOpen(true)
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="File Store"
        description="Manage file uploads and downloads"
        breadcrumb={[
          { label: 'Dashboard', path: '/' },
          { label: 'Files' },
        ]}
        actions={
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Upload
              <input type="file" hidden onChange={handleUpload} disabled={uploading} />
            </label>
          </Button>
        }
      />

      {/* Upload progress */}
      {uploading && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <Progress value={uploadProgress} className="h-2" />
              </div>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="flex gap-2 mb-4">
        <Badge variant="secondary">
          <Folder className="h-3 w-3 mr-1" />
          {files.length} files
        </Badge>
      </div>

      {/* Data table */}
      {loading ? (
        <DataTableSkeleton columns={6} rows={5} />
      ) : (
        <DataTable
          columns={columns}
          data={files}
          searchable
          searchPlaceholder="Search files..."
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete File"
        description={`Delete "${deleteTarget?.path}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteDialogOpen(false)
        }}
      />
    </div>
  )
}