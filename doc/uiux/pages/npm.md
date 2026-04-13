# npm Repository Page Design

## Overview

npm package repository browser with package details, version history, and search.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ npm ────────────────────────────────────────────────────────────────   │
│ Node.js package repository                                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Packages │  │ Cached   │  │ Proxy    │  │ Today    │                │
│  │ 892      │  │ 456      │  │ Enabled  │  │ +5 req   │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Search: [________________________________] 🔍   [Clear Cache]   │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Package                    Latest     Cached    Downloads    ⋮  │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  react                      18.2.0    ✓         12,345      ⋮  │    │
│  │    ▸ versions (42)  description...                               │    │
│  │                                                                │    │
│  │  express                    4.18.2    ✓         8,721       ⋮  │    │
│  │    ▸ versions (28)  description...                               │    │
│  │                                                                │    │
│  │  lodash                     4.17.21   ✓         45,678      ⋮  │    │
│  │    ▸ versions (52)  description...                               │    │
│  │                                                                │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │  Showing 1-10 of 892                    ◀ Prev  Page 1  Next ▶ │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Expanded row:
│  │  react                      18.2.0    ✓         12,345      ⋮  │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
│  │  Versions: 18.2.0 (latest) · 18.1.0 · 17.0.2 · 16.14.0 · ...      │    │
│  │  Published: 2024-01-15 by fb-team                                   │    │
│  │  Install: npm install react                                         │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │ Description: A JavaScript library for building user interfaces│  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
```

---

## Component Structure

```tsx
function NpmPage() {
  const { packages, fetchPackages, clearCache } = useNpmStore()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">npm</h1>
          <p className="text-muted-foreground">Node.js package repository</p>
        </div>
        <Button variant="outline" onClick={clearCache}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Cache
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Packages" value={total} icon={<Package />} />
        <StatsCard title="Cached Packages" value={cached} icon={<Database />} />
        <StatsCard title="Proxy Status" value="Enabled" icon={<Cloud />} />
        <StatsCard title="Requests Today" value={requests} icon={<Activity />} />
      </div>

      {/* Package Table with expandable rows */}
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

## Expandable Row Content

```tsx
function PackageDetails({ data }) {
  return (
    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
      {/* Versions */}
      <div>
        <span className="text-sm font-medium">Versions:</span>
        <div className="flex flex-wrap gap-2 mt-1">
          {data.versions.map((v) => (
            <Badge key={v} variant={v === data.latest ? "default" : "secondary"}>
              {v}
            </Badge>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Published:</span>
          <span className="ml-2">{formatDate(data.published)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Author:</span>
          <span className="ml-2">{data.author}</span>
        </div>
      </div>

      {/* Install command */}
      <div>
        <span className="text-sm font-medium">Install:</span>
        <CodeBlock code={`npm install ${data.name}`} className="mt-1" />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {data.description}
      </p>
    </div>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Search** | Filter packages by name |
| **Expand rows** | View versions, install command, details |
| **Badge states** | latest (primary), cached (checkmark) |
| **Clear cache** | Admin action to clear proxy cache |
| **Copy install** | Copy npm install command |

---

## Responsive

### Mobile (<768px)
- Hide downloads column
- Show version count badge only
- Card-based layout optional