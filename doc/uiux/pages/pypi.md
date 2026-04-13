# PyPI Repository Page Design

## Overview

Python package repository (PyPI) with package details, version management, and statistics.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ PyPI ───────────────────────────────────────────────────────────────   │
│ Python package repository                                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Packages │  │ Cached   │  │ Size     │  │ Downloads│                │
│  │ 456      │  │ 234      │  │ 3.2 GB   │  │ 8.2k/d   │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ pip Configuration ───────────────────────────────────────────  │    │
│  │                                                                │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ pip install --index-url http://localhost:9817/simple \   │ │    │
│  │  │   --trusted-host localhost package-name                   │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │  [Copy]                                                        │    │
│  │                                                                │    │
│  │  Or add to pip.conf:                                           │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ [global]                                                  │ │    │
│  │  │ index-url = http://localhost:9817/simple                 │ │    │
│  │  │ trusted-host = localhost                                  │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │  [Copy]                                                        │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Packages ────────────────────────────────────────────────────  │    │
│  │            [Search] 🔍                    [Clear Cache]         │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Package              Latest    Cached    Size      ⋮         │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  requests             2.31.0    ✓         128 KB    ⋮         │    │
│  │  numpy                1.26.0    ✓         45 MB     ⋮         │    │
│  │  pandas               2.1.0     ✓         12 MB     ⋮         │    │
│  │  flask                3.0.0     ✓         2.1 MB    ⋮         │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Package detail dialog:
│  │  requests             2.31.0    ✓         128 KB    ⋮         │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
│  │  Versions: 2.31.0 (latest) · 2.30.0 · 2.29.0 · 2.28.0 · ...      │    │
│  │  Author: Kenneth Reitz                                           │    │
│  │  License: Apache 2.0                                             │    │
│  │                                                                  │    │
│  │  Install: pip install requests                                   │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
```

---

## Component Structure

```tsx
function PyPIPage() {
  const { packages, stats, clearCache } = usePyPIStore()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PyPI</h1>
          <p className="text-muted-foreground">Python package repository</p>
        </div>
        <Button variant="outline" onClick={clearCache}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Cache
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Packages" value={stats.total} icon={<Circle />} />
        <StatsCard title="Cached" value={stats.cached} icon={<Database />} />
        <StatsCard title="Storage" value={formatBytes(stats.size)} icon={<HardDrive />} />
        <StatsCard title="Downloads" value={stats.downloads} icon={<Download />} />
      </div>

      {/* pip Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>pip Configuration</CardTitle>
          <CardDescription>
            Configure pip to use this repository
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Install command */}
          <div className="space-y-2">
            <Label>Install from this repository</Label>
            <CodeBlock
              code={`pip install --index-url ${baseUrl}/simple --trusted-host localhost package-name`}
              copyable
            />
          </div>

          {/* pip.conf */}
          <div className="space-y-2">
            <Label>pip.conf (persistent)</Label>
            <CodeBlock
              code={`[global]
index-url = ${baseUrl}/simple
trusted-host = localhost`}
              copyable
            />
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
          <DataTable
            columns={columns}
            data={packages}
            expandable
            renderExpanded={renderPackageDetails}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **pip config** | Copyable install commands |
| **pip.conf** | Persistent configuration snippet |
| **Package search** | Filter by name |
| **Expandable rows** | View versions, author, license |
| **Install command** | Copy pip install |
| **Clear cache** | Admin action |