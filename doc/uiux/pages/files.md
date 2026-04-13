# Files Page Design

## Overview

File store management page with upload, download, and delete capabilities.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Files ──────────────────────────────────────────────────────────────   │
│ Universal file storage repository                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Total    │  │ Size     │  │ Today    │  │ Storage  │                │
│  │ 1,234    │  │ 45.2 GB  │  │ +12      │  │ 68%      │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Upload ──────────────────────────────────────────────────────  │    │
│  │                                                                │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │     Drag and drop files here, or click to browse         │ │    │
│  │  │                                                          │ │    │
│  │  │              📁  Supports any file type                  │ │    │
│  │  │                                                          │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                                                                │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ package.tar.gz ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 87%  12.3MB  │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Search: [________________] 🔍        [_____] per page  Sort ▼  │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Name              Size       Modified        Path           ⋮  │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  📄 package.tar.gz 12.3 MB    2024-01-15     /downloads/      ⋮  │    │
│  │  📄 config.yaml    2.1 KB     2024-01-14     /config/         ⋮  │    │
│  │  📄 backup.sql     856 MB     2024-01-13     /backups/        ⋮  │    │
│  │  📄 readme.md      1.2 KB     2024-01-12     /docs/           ⋮  │    │
│  │                                                                │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │  Showing 1-10 of 1,234                    ◀ Prev  Page 1  Next ▶ │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```tsx
function FilesPage() {
  const { files, total, fetchFiles, uploadFile, deleteFile } = useFilesStore()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Files</h1>
        <p className="text-muted-foreground">Universal file storage repository</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Files" value={total} icon={<Folder />} />
        <StatsCard title="Total Size" value="45.2 GB" icon={<HardDrive />} />
        <StatsCard title="Uploaded Today" value={12} icon={<Upload />} trend={{ value: 8, positive: true }} />
        <StatsCard title="Storage Used" value="68%" icon={<Database />} description="450 GB limit" />
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadDropzone
            onUpload={handleUpload}
            uploading={uploading}
            progress={uploadProgress}
          />
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Files</CardTitle>
            <div className="flex items-center gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder="Search files..." />
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={files}
            pagination={{ pageSize, total, page }}
            onPaginationChange={setPage}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Table Columns

```tsx
const columns: ColumnDef<File>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <FileIcon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => (
      <span className="font-mono text-sm tabular-nums">
        {formatBytes(row.original.size)}
      </span>
    ),
  },
  {
    accessorKey: "modified",
    header: "Modified",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.modified)}
      </span>
    ),
  },
  {
    accessorKey: "path",
    header: "Path",
    cell: ({ row }) => (
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
        {row.original.path}
      </code>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => download(row.original)}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyUrl(row.original)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteTarget(row.original)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
```

---

## Upload Component

```tsx
function FileUploadDropzone({ onUpload, uploading, progress }) {
  const [files, setFiles] = useState<File[]>([])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center",
        "transition-colors duration-150",
        files.length > 0 ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      )}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />

      <p className="text-lg font-medium mb-2">
        Drag and drop files here, or click to browse
      </p>

      <p className="text-sm text-muted-foreground mb-4">
        Supports any file type
      </p>

      <Input
        type="file"
        className="hidden"
        ref={inputRef}
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />

      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        Browse Files
      </Button>

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {progress}% uploaded
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## States

| State | UI |
|-------|-----|
| **Empty** | Empty state message + upload area |
| **Loading** | Skeleton table rows |
| **Loaded** | Table with data |
| **Uploading** | Progress bar, disabled buttons |
| **Error** | Alert with retry action |
| **Deleting** | Confirm dialog, loading state |

---

## Responsive

### Desktop (≥1024px)
- 4 stats cards in row
- Full table with all columns
- Wide upload area

### Tablet (768px-1023px)
- 2 stats cards in row
- Table hides path column
- Upload area narrower

### Mobile (<768px)
- 1 stats card per row
- Card list instead of table
- Full-width upload area