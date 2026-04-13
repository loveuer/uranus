# Garbage Collection Page Design

## Overview

OCI storage garbage collection management with candidates, restore, and auto-GC configuration.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ GC ──────────────────────────────────────────────────────────────────   │
│ Garbage Collection for OCI layers                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Storage │  │ Candidates│  │ Garbage │  │ Auto GC  │                │
│  │ 12.3 GB │  │ 45 layers │  │ 890 MB  │  │ Enabled  │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [Tabs: Candidates | Unreferenced | History | Settings]         │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Candidates ──────────────────────────────────────────────────   │    │
│  │                  [Dry Run]  [Run GC]  [Restore All]             │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Layer                    Size    Created     Image        ⋮  │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  sha256:abc123...         12 MB   2 days ago  nginx        ⋮  │    │
│  │    ▸ Used by: no tags (orphaned)                                │    │
│  │                                                                │    │
│  │  sha256:def456...         8 MB    5 days ago  my-app       ⋮  │    │
│  │    ▸ Used by: my-app:v1.0.0 (deleted tag)                      │    │
│  │                                                                │    │
│  │  sha256:ghi789...         45 MB   7 days ago  -            ⋮  │    │
│  │    ▸ Never referenced                                          │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

GC Settings tab:
│  │  Settings ─────────────────────────────────────────────────────    │    │
│  │                                                                  │    │
│  │  Automatic GC                                                    │    │
│  │  ┌──────────────────────────────────────────────────────────────┐│    │
│  │  │ [Toggle] Enabled                                             ││    │
│  │  │                                                              ││    │
│  │  │ Schedule: [Daily ▼] at [02:00 ▼]                            ││    │
│  │  │ Threshold: [7 ▼] days unreferenced                           ││    │
│  │  │ Dry run first: [Toggle]                                      ││    │
│  │  └──────────────────────────────────────────────────────────────┐│    │
│  │                                                                  │    │
│  │  [Save Settings]                                                 │    │
│  │  ─────────────────────────────────────────────────────────────    │    │

GC Running:
│  │  GC in progress...                                               │    │
│  │  ████████████░░░░░░░░  60%                                       │    │
│  │  Layers: 27 / 45 processed                                       │    │
│  │  Freed: 534 MB / ~890 MB                                         │    │
```

---

## Component Structure

```tsx
function GCPage() {
  const [activeTab, setActiveTab] = useState("candidates")

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GC</h1>
        <p className="text-muted-foreground">Garbage Collection for OCI layers</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Storage Used" value={formatBytes(stats.storage)} icon={<HardDrive />} />
        <StatsCard title="Candidates" value={stats.candidates} icon={<Trash />} />
        <StatsCard title="Potential Free" value={formatBytes(stats.garbage)} icon={<Sparkles />} />
        <StatsCard
          title="Auto GC"
          value={settings.autoEnabled ? "Enabled" : "Disabled"}
          icon={<Clock />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="unreferenced">Unreferenced</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Candidates Tab */}
        <TabsContent value="candidates">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>GC Candidates</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={dryRun}>
                    Dry Run
                  </Button>
                  <Button onClick={runGC}>
                    Run GC
                  </Button>
                  <Button variant="outline" onClick={restoreAll}>
                    Restore All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={candidateColumns}
                data={candidates}
                expandable
                renderExpanded={renderLayerDetails}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Automatic GC</CardTitle>
              <CardDescription>
                Configure automatic garbage collection schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto GC</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically clean unreferenced layers
                  </p>
                </div>
                <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={schedule} onValueChange={setSchedule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="02:00">02:00</SelectItem>
                      <SelectItem value="04:00">04:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Threshold */}
              <div className="space-y-2">
                <Label>Unreferenced Threshold</Label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Layers unreferenced for more than this many days will be candidates
                </p>
              </div>

              {/* Dry run */}
              <div className="flex items-center justify-between">
                <Label>Dry Run First</Label>
                <Switch checked={dryRunFirst} onCheckedChange={setDryRunFirst} />
              </div>

              <Button onClick={saveSettings}>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Stats** | Storage, candidates, potential free |
| **Tabs** | Candidates, Unreferenced, History, Settings |
| **Dry run** | Preview what would be deleted |
| **Run GC** | Execute garbage collection |
| **Restore** | Restore accidentally deleted layers |
| **Auto GC config** | Schedule, threshold, dry-run-first |
| **Progress indicator** | Show GC progress during execution |

---

## GC Progress Modal

```tsx
function GCProgressDialog({ open, progress }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Garbage Collection Running</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progress.percent} className="h-3" />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Layers processed:</span>
              <span className="ml-2 font-mono">{progress.layers} / {progress.total}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Freed:</span>
              <span className="ml-2 font-mono">{formatBytes(progress.freed)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```