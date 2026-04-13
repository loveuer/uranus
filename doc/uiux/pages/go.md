# Go Modules Page Design

## Overview

Go modules proxy page with cache statistics and management.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Go ─────────────────────────────────────────────────────────────────   │
│ Go modules proxy                                                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Modules  │  │ Cache    │  │ Size     │  │ Requests │                │
│  │ 234      │  │ 1,456    │  │ 2.3 GB   │  │ 12.5k/d  │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Configuration ──────────────────────────────────────────────   │    │
│  │                                                                │    │
│  │  GOPROXY Setting                                               │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ GOPROXY=http://localhost:9817/go,proxy.golang.org,direct │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │  [Copy]                                                        │    │
│  │                                                                │    │
│  │  GONOSUMDB Setting                                             │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ GONOSUMDB=github.com/your-org/*                          │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │  [Copy]                                                        │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Recent Modules ──────────────────────────────────────────────  │    │
│  │                                          [Clear Cache]         │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Module                    Version    Cached     Last Access   │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  github.com/gin-gonic/gin  v1.9.1     ✓          2 min ago    │    │
│  │  github.com/go-playground/validator  v10.15.0  ✓  5 min ago   │    │
│  │  golang.org/x/crypto       v0.18.0    ✓          10 min ago   │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```tsx
function GoPage() {
  const { modules, stats, clearCache } = useGoStore()
  const baseUrl = window.location.origin

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Go</h1>
          <p className="text-muted-foreground">Go modules proxy</p>
        </div>
        <Button variant="outline" onClick={clearCache}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Cache
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Cached Modules" value={stats.modules} icon={<Hexagon />} />
        <StatsCard title="Cache Entries" value={stats.entries} icon={<Database />} />
        <StatsCard title="Cache Size" value={formatBytes(stats.size)} icon={<HardDrive />} />
        <StatsCard title="Daily Requests" value={stats.requests} icon={<Activity />} />
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Add these settings to your Go environment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* GOPROXY */}
          <div className="space-y-2">
            <Label>GOPROXY</Label>
            <div className="flex items-center gap-2">
              <CodeBlock
                code={`GOPROXY=${baseUrl}/go,proxy.golang.org,direct`}
                className="flex-1"
              />
              <Button size="icon" variant="outline" onClick={copyGoproxy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* GONOSUMDB */}
          <div className="space-y-2">
            <Label>GONOSUMDB (for private modules)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={gonosumdb}
                onChange={(e) => setGonosumdb(e.target.value)}
                placeholder="github.com/your-org/*"
              />
              <Button size="icon" variant="outline" onClick={copyGonosumdb}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Modules */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Recent Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={modules} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Configuration Copy

Copyable configuration snippets with visual feedback.

---

## Features

| Feature | Description |
|---------|-------------|
| **Stats dashboard** | Quick metrics overview |
| **Config snippets** | Copyable GOPROXY settings |
| **Custom GONOSUMDB** | Input for private modules |
| **Clear cache** | Admin action |
| **Recent modules** | Table with access times |

---

## Simple layout focus

Go page is simpler than other repo pages - focus on configuration guidance and cache stats.