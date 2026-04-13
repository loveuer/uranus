# Settings Page Design

## Overview

Admin-only system settings page with configuration for various repository modules and general settings.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Settings ───────────────────────────────────────────────────────────   │
│ System configuration                                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [Vertical Tabs]                                                │    │
│  │                                                                │    │
│  │  ├ General         ─────────────────────────────────────────   │    │
│  │  ├ npm                                                       │    │
│  │  ├ Go                                                        │    │
│  │  ├ OCI                                                       │    │
│  │  ├ Maven                                                     │    │
│  │  ├ PyPI                                                      │    │
│  │  └ Alpine                                                    │    │
│  │  └ Storage                                                   │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ General Settings ───────────────────────────────────────────   │    │
│  │                                                                │    │
│  │  Server URL                                                    │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ http://localhost:9817                                     │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                                                                │    │
│  │  Base Path (optional)                                          │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ [/uranus]                                                 │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                                                                │    │
│  │  Log Level                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ [Info ▼]                                                   │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                                                                │    │
│  │  JWT Expiration                                                │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ [24] hours                                                 │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                                                                │    │
│  │                                [Reset]  [Save Changes]         │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

npm Settings:
│  │  npm Settings ─────────────────────────────────────────────────    │    │
│  │                                                                  │    │
│  │  Proxy Upstream                                                  │    │
│  │  ┌──────────────────────────────────────────────────────────────┐│    │
│  │  │ [Toggle] Enabled                                             ││    │
│  │  │                                                              ││    │
│  │  │ Upstream URL                                                 ││    │
│  │  │ ┌────────────────────────────────────────────────────────────┐││    │
│  │  │ │ https://registry.npmjs.org                               │││    │
│  │  │ └────────────────────────────────────────────────────────────┐││    │
│  │  │                                                              ││    │
│  │  │ Cache TTL                                                    ││    │
│  │  │ ┌────────────────────────────────────────────────────────────┐││    │
│  │  │ │ [7] days                                                   │││    │
│  │  │ └────────────────────────────────────────────────────────────┐││    │
│  │  └──────────────────────────────────────────────────────────────┐│    │
│  │  ─────────────────────────────────────────────────────────────    │    │

Storage Settings:
│  │  Storage Settings ─────────────────────────────────────────────    │    │
│  │                                                                  │    │
│  │  Storage Path                                                    │    │
│  │  ┌──────────────────────────────────────────────────────────────┐│    │
│  │  │ [/var/lib/uranus]                                            ││    │
│  │  └──────────────────────────────────────────────────────────────┐│    │
│  │                                                                  │    │
│  │  Max Storage Size                                                │    │
│  │  ┌──────────────────────────────────────────────────────────────┐│    │
│  │  │ [500] GB                                                     ││    │
│  │  └──────────────────────────────────────────────────────────────┐│    │
│  │                                                                  │    │
│  │  Current Usage                                                   │    │
│  │  ████████████░░░░░░░░  68% (340 GB / 500 GB)                    │    │
│  │                                                                  │    │
```

---

## Component Structure

```tsx
function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general")
  const sections = [
    { id: "general", label: "General" },
    { id: "npm", label: "npm" },
    { id: "go", label: "Go" },
    { id: "oci", label: "OCI" },
    { id: "maven", label: "Maven" },
    { id: "pypi", label: "PyPI" },
    { id: "alpine", label: "Alpine" },
    { id: "storage", label: "Storage" },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">System configuration</p>
      </div>

      {/* Settings Layout */}
      <div className="flex gap-6">
        {/* Vertical Navigation */}
        <nav className="w-64 shrink-0">
          <Card>
            <CardContent className="p-2">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </nav>

        {/* Settings Content */}
        <div className="flex-1">
          {activeSection === "general" && <GeneralSettings />}
          {activeSection === "npm" && <NpmSettings />}
          {activeSection === "go" && <GoSettings />}
          {activeSection === "oci" && <OciSettings />}
          {activeSection === "maven" && <MavenSettings />}
          {activeSection === "pypi" && <PyPISettings />}
          {activeSection === "alpine" && <AlpineSettings />}
          {activeSection === "storage" && <StorageSettings />}
        </div>
      </div>
    </div>
  )
}
```

---

## Settings Panel Template

```tsx
function GeneralSettings() {
  const form = useForm({
    resolver: zodResolver(generalSchema),
    defaultValues: settings.general,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Basic server configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(saveSettings)} className="space-y-6">
            <FormField name="serverUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Server URL</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormDescription>
                  Public URL for the server (used in generated links)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="basePath" render={({ field }) => (
              <FormItem>
                <FormLabel>Base Path</FormLabel>
                <FormControl><Input {...field} placeholder="/" /></FormControl>
                <FormDescription>
                  Optional base path for reverse proxy setups
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="logLevel" render={({ field }) => (
              <FormItem>
                <FormLabel>Log Level</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger /></FormControl>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="jwtExpiration" render={({ field }) => (
              <FormItem>
                <FormLabel>JWT Expiration (hours)</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetSettings}>Reset</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

---

## Proxy Settings Pattern

Each repository module has similar proxy settings:

```tsx
function NpmSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>npm Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Proxy toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Proxy Upstream</Label>
            <p className="text-sm text-muted-foreground">
              Enable caching from upstream registry
            </p>
          </div>
          <Switch checked={proxyEnabled} onCheckedChange={setProxyEnabled} />
        </div>

        {proxyEnabled && (
          <>
            {/* Upstream URL */}
            <FormField name="upstreamUrl" ... />

            {/* Cache TTL */}
            <FormField name="cacheTtl" ... />
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Vertical navigation** | Side tabs for sections |
| **General settings** | Server URL, base path, log level, JWT |
| **Module settings** | Proxy config for each repo type |
| **Storage settings** | Path, max size, usage bar |
| **Form validation** | Zod schema validation |
| **Reset option** | Reset to defaults |
| **Save feedback** | Toast on success/error |