# Docker/OCI Page Design

## Overview

OCI/Docker image repository management with image details, tags, and layers.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Docker ─────────────────────────────────────────────────────────────   │
│ OCI container image repository                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Images   │  │ Tags     │  │ Size     │  │ Pulls    │                │
│  │ 45       │  │ 128      │  │ 12.3 GB  │  │ 1,234/d  │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Registry URL ───────────────────────────────────────────────   │    │
│  │  docker pull localhost:5000/my-image:latest                    │    │
│  │  [Copy]                                                        │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Repositories ────────────────────────────────────────────────  │    │
│  │                    [Clear Cache]  [Run GC]                      │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Repository              Tags      Size      Last Push      ⋮  │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  my-app                  12        1.2 GB    2 hours ago    ⋮  │    │
│  │    ▸ latest · v1.2.0 · v1.1.0 · ...                             │    │
│  │                                                                │    │
│  │  nginx-proxy             8         456 MB    1 day ago      ⋮  │    │
│  │    ▸ latest · alpine · stable                                   │    │
│  │                                                                │    │
│  │  redis-cache             3         128 MB    3 days ago     ⋮  │    │
│  │    ▸ 7-alpine · 6-alpine                                        │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Expanded repository:
│  │  my-app                  12        1.2 GB    2 hours ago    ⋮  │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
│  │  Tags:                                                          │    │
│  │  ┌──────────────────────────────────────────────────────────────┐│    │
│  │  │ Tag        Size      Digest              Pushed              ││    │
│  │  │ latest     120 MB    sha256:abc123...    2 hours ago    [📋] ││    │
│  │  │ v1.2.0     120 MB    sha256:def456...    1 day ago      [📋] ││    │
│  │  │ v1.1.0     118 MB    sha256:ghi789...    3 days ago     [📋] ││    │
│  │  └──────────────────────────────────────────────────────────────┐│    │
│  │                                                                  │    │
│  │  Pull: docker pull localhost:5000/my-app:latest                 │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
```

---

## Component Structure

```tsx
function DockerPage() {
  const { repositories, clearCache } = useOciStore()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Docker</h1>
          <p className="text-muted-foreground">OCI container image repository</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearCache}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Cache
          </Button>
          <Link to="/gc">
            <Button variant="outline">
              <Trash className="mr-2 h-4 w-4" />
              Run GC
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Repositories" value={total} icon={<Container />} />
        <StatsCard title="Total Tags" value={tags} icon={<Tag />} />
        <StatsCard title="Storage Used" value={formatBytes(size)} icon={<HardDrive />} />
        <StatsCard title="Daily Pulls" value={pulls} icon={<Download />} />
      </div>

      {/* Registry URL */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Pull command:</span>
            <code className="flex-1 font-mono text-sm bg-background px-3 py-1.5 rounded">
              docker pull {registryUrl}/{"{image}"}:{"{tag}"}
            </code>
            <Button size="icon" variant="ghost">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Repositories Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Repositories</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={repositories}
            expandable
            renderExpanded={renderRepositoryTags}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Expanded Repository Tags

```tsx
function RepositoryTags({ data }) {
  return (
    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
      {/* Tags table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Digest</TableHead>
            <TableHead>Pushed</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.tags.map((tag) => (
            <TableRow key={tag.name}>
              <TableCell>
                <Badge>{tag.name}</Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {formatBytes(tag.size)}
              </TableCell>
              <TableCell>
                <code className="text-xs">sha256:{tag.digest.slice(0, 12)}...</code>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(tag.pushed)}
              </TableCell>
              <TableCell>
                <Button size="icon" variant="ghost" onClick={() => copyPullCommand(data.name, tag.name)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pull command */}
      <div className="text-sm">
        <span className="font-medium">Pull:</span>
        <code className="ml-2 font-mono bg-background px-2 py-1 rounded text-xs">
          docker pull {registryUrl}/{data.name}:latest
        </code>
      </div>
    </div>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Stats** | Repository overview metrics |
| **Pull command** | Copyable registry URL |
| **Expandable rows** | View all tags per repository |
| **Tag details** | Size, digest, push time |
| **Copy pull** | Copy docker pull command |
| **Clear cache** | Admin action |
| **GC link** | Navigate to garbage collection |

---

## Key UX

- Focus on pull commands (developers need this often)
- Digest shown truncated with full on hover/copy
- Size per tag for optimization awareness