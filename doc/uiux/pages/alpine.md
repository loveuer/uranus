# Alpine APK Repository Page Design

## Overview

Alpine Linux APK package repository with package search, sync management, and statistics.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Alpine ─────────────────────────────────────────────────────────────   │
│ Alpine Linux APK repository                                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Packages │  │ Branches │  │ Size     │  │ Syncs    │                │
│  │ 2,456    │  │ 3        │  │ 890 MB   │  │ 12       │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Configuration ──────────────────────────────────────────────   │    │
│  │                                                                │    │
│  │  /etc/apk/repositories                                         │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ http://localhost:9817/alpine/v3.19/main                  │ │    │
│  │  │ http://localhost:9817/alpine/v3.19/community             │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │  [Copy]                                                        │    │
│  │                                                                │    │
│  │  Branch: [v3.19 ▼]  Repository: [main ▼]  Arch: [x86_64 ▼]   │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Packages ────────────────────────────────────────────────────  │    │
│  │   [Search] 🔍   [Sync from upstream]   [Clear Cache]           │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Package          Version    Size    Origin     License    ⋮  │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  nginx            1.24.0     156 KB  main       GPL        ⋮  │    │
│  │  redis            7.2.0      89 KB   community  BSD        ⋮  │    │
│  │  postgresql       16.0       2.1 MB  main       PostgreSQL ⋮  │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Sync status indicator:
│  │  [Sync from upstream]                                           │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
│  │  Syncing v3.19/main...  ████████████░░░░  75%                    │    │
│  │  Packages: 1,234 / 2,456                                          │    │
```

---

## Component Structure

```tsx
function AlpinePage() {
  const { packages, branches, sync, clearCache } = useAlpineStore()
  const [branch, setBranch] = useState("v3.19")
  const [repo, setRepo] = useState("main")
  const [arch, setArch] = useState("x86_64")

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alpine</h1>
          <p className="text-muted-foreground">Alpine Linux APK repository</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sync}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync
          </Button>
          <Button variant="outline" onClick={clearCache}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Packages" value={stats.total} icon={<Mountain />} />
        <StatsCard title="Branches" value={stats.branches} icon={<GitBranch />} />
        <StatsCard title="Storage" value={formatBytes(stats.size)} icon={<HardDrive />} />
        <StatsCard title="Last Sync" value={stats.lastSync} icon={<Clock />} />
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Add to /etc/apk/repositories on your Alpine system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Repository URLs */}
          <div className="space-y-2">
            <Label>/etc/apk/repositories</Label>
            <CodeBlock
              code={`${baseUrl}/alpine/${branch}/${repo}\n${baseUrl}/alpine/${branch}/community`}
              copyable
            />
          </div>

          {/* Filters */}
          <div className="flex gap-4">
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

            <Select value={repo} onValueChange={setRepo}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="community">community</SelectItem>
              </SelectContent>
            </Select>

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
        </CardContent>
      </Card>

      {/* Packages Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Packages</CardTitle>
            <SearchInput value={search} onChange={setSearch} placeholder="Search packages..." />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={packages} />
        </CardContent>
      </Card>

      {/* Sync Progress Dialog */}
      <SyncProgressDialog open={syncing} progress={syncProgress} />
    </div>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Branch filter** | Select Alpine version |
| **Repo filter** | main/community |
| **Arch filter** | x86_64/aarch64 |
| **Sync button** | Sync from upstream |
| **Sync progress** | Modal with progress bar |
| **Config copy** | Copy repository URLs |
| **Clear cache** | Admin action |

---

## Sync Progress

```tsx
function SyncProgressDialog({ open, progress }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Syncing Packages</DialogTitle>
          <DialogDescription>
            Downloading packages from upstream Alpine mirrors
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progress.percent} className="h-2" />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.packages} / {progress.total} packages
            </span>
            <span className="font-mono">
              {progress.percent}%
            </span>
          </div>

          <div className="text-sm text-muted-foreground">
            Branch: {progress.branch} · Repository: {progress.repo}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```