# Maven Repository Page Design

## Overview

Maven artifact repository with search, version history, and repository management.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Maven ──────────────────────────────────────────────────────────────   │
│ Java artifact repository                                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Artifacts │  │ Groups   │  │ Size     │  │ Downloads│                │
│  │ 1,234     │  │ 56       │  │ 8.5 GB   │  │ 5.6k/d   │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [Search by Group/Artifact] 🔍        [+ Add Repository]         │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Group           Artifact      Latest    Repository      ⋮     │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  com.fasterxml   jackson-core   2.15.0   central        ⋮     │    │
│  │  org.springframework spring-core  6.1.0  internal       ⋮     │    │
│  │  org.slf4j       slf4j-api      2.0.9    central        ⋮     │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Artifact detail dialog:
┌────────────────────────────────────────────────────────────────────────┐
│ Artifact Details ────────────────────────────────────────────────────  │
│                                                        [×]            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  com.fasterxml.jackson.core : jackson-core                            │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Versions ───────────────────────────────────────────────────── │    │
│  │                                                                │    │
│  │  2.15.0 (latest) · 2.14.2 · 2.14.1 · 2.13.5 · 2.12.7 · ...    │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Maven Dependency                                                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ <dependency>                                                   │    │
│  │   <groupId>com.fasterxml.jackson.core</groupId>               │    │
│  │   <artifactId>jackson-core</artifactId>                       │    │
│  │   <version>2.15.0</version>                                    │    │
│  │ </dependency>                                                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│  [Copy XML]                                                            │
│                                                                        │
│  Repository URL                                                        │
│  http://localhost:9817/maven/internal                                  │
│                                                                        │
│                                                        [Close]         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```tsx
function MavenPage() {
  const { artifacts, repositories, search } = useMavenStore()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maven</h1>
          <p className="text-muted-foreground">Java artifact repository</p>
        </div>
        <Button onClick={() => setAddRepoOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Artifacts" value={total} icon={<Box />} />
        <StatsCard title="Groups" value={groups} icon={<Folder />} />
        <StatsCard title="Storage" value={formatBytes(size)} icon={<HardDrive />} />
        <StatsCard title="Downloads" value={downloads} icon={<Download />} />
      </div>

      {/* Artifacts Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Artifacts</CardTitle>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by group or artifact..."
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={artifacts}
            onRowClick={openArtifactDetail}
          />
        </CardContent>
      </Card>

      {/* Artifact Detail Dialog */}
      <ArtifactDetailDialog
        open={detailOpen}
        artifact={selectedArtifact}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
```

---

## Artifact Detail Dialog

```tsx
function ArtifactDetailDialog({ open, artifact, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">
            {artifact.groupId} : {artifact.artifactId}
          </DialogTitle>
        </DialogHeader>

        {/* Versions */}
        <div className="space-y-2">
          <Label>Available Versions</Label>
          <div className="flex flex-wrap gap-2">
            {artifact.versions.map((v) => (
              <Badge
                key={v}
                variant={v === artifact.latest ? "default" : "secondary"}
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>

        {/* Maven Dependency XML */}
        <div className="space-y-2">
          <Label>Maven Dependency</Label>
          <CodeBlock
            code={generateMavenDependency(artifact)}
            language="xml"
            copyable
          />
        </div>

        {/* Repository URL */}
        <div className="space-y-2">
          <Label>Repository URL</Label>
          <code className="text-sm bg-muted px-3 py-1.5 rounded block">
            {baseUrl}/maven/{artifact.repository}
          </code>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Search** | Filter by groupId or artifactId |
| **Artifact detail** | Dialog with versions, dependency XML |
| **Copy XML** | Copy Maven dependency snippet |
| **Add repository** | Admin can add new repos |
| **Repository badge** | Show source (central, internal) |