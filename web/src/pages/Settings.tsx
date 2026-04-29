import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore, useSettings, useSettingsLoading, useSettingsSaving } from '@/stores/settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast, toast, useToasts, dismissToast } from '@/components/ui/toast'
import {
  Settings,
  Package,
  Hexagon,
  Container,
  Box,
  CircleDot,
  Folder,
  Database,
} from 'lucide-react'
import { ModuleSettingsCard } from '@/components/settings'

export default function SettingsPage() {
  const { fetchSettings, updateSettings } = useSettingsStore()
  const settings = useSettings()
  const loading = useSettingsLoading()
  const saving = useSettingsSaving()
  const toasts = useToasts()

  const [activeTab, setActiveTab] = useState('general')
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const errorInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    setLocalSettings(settings)
    setErrors({})
  }, [settings])

  const handleChange = useCallback((key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    // Clear error when user edits
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // A3: Form validation
  const validate = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {}

    // Validate upstream fields
    const upstreamKeys = [
      'npm.upstream', 'go.upstream', 'oci.upstream',
      'maven.upstream', 'pypi.upstream',
    ]
    for (const key of upstreamKeys) {
      const val = localSettings[key]
      if (val && val.trim() && !val.match(/^https?:\/\//i)) {
        errs[key] = 'Must be a valid URL starting with http:// or https://'
      }
    }

    // Validate addr fields
    const addrKeys = ['npm.addr', 'go.addr', 'oci.addr', 'maven.addr', 'pypi.addr', 'file.addr']
    for (const key of addrKeys) {
      const val = localSettings[key]
      if (val && val.trim() && !val.match(/:\d+$/)) {
        errs[key] = 'Must match format :port or host:port (e.g., :8080)'
      }
    }

    // Validate number fields
    const numberKeys = ['max_storage_gb']
    for (const key of numberKeys) {
      const val = localSettings[key]
      if (val && val.trim()) {
        const n = parseInt(val, 10)
        if (isNaN(n) || n <= 0 || String(n) !== val.trim()) {
          errs[key] = 'Must be a positive integer'
        }
      }
    }

    return errs
  }, [localSettings])

  const handleSave = useCallback(async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Focus first error field
      const firstErrorKey = Object.keys(errs)[0]
      const ref = errorInputRefs.current[firstErrorKey]
      if (ref) {
        ref.focus()
      }
      return
    }

    const success = await updateSettings(localSettings)
    if (success) {
      toast('Settings saved successfully', 'success')
    } else {
      toast('Failed to save settings', 'error')
    }
  }, [localSettings, updateSettings, validate])

  // A7: Dirty state tracking
  const dirtyKeys = Object.keys(localSettings).filter(
    (key) => localSettings[key] !== settings[key]
  )
  const hasDirty = dirtyKeys.length > 0

  const handleReset = useCallback(() => {
    setLocalSettings(settings)
    setErrors({})
  }, [settings])

  // Tab configuration
  const tabs = [
    { value: 'general', icon: Settings, label: 'General' },
    { value: 'npm', icon: Package, label: 'npm' },
    { value: 'go', icon: Hexagon, label: 'Go' },
    { value: 'oci', icon: Container, label: 'OCI' },
    { value: 'maven', icon: Box, label: 'Maven' },
    { value: 'pypi', icon: CircleDot, label: 'PyPI' },
    { value: 'file', icon: Folder, label: 'File' },
    { value: 'storage', icon: Database, label: 'Storage' },
  ]

  // Helper to register input refs for error focusing
  const registerInput = useCallback((key: string) => (el: HTMLInputElement | null) => {
    errorInputRefs.current[key] = el
  }, [])

  // A4: Storage stats - TODO: Storage stats API pending, using hardcoded placeholder
  const storageUsedGB = 0
  const storageMaxGB = parseInt(localSettings.max_storage_gb || '500', 10) || 500
  const storagePercent = storageMaxGB > 0 ? 0 : 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">System configuration</p>
      </div>

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* Settings Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex gap-6">
        <TabsList className="flex flex-col w-[200px] h-auto bg-card items-stretch justify-start">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="justify-start w-full">
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 space-y-6 pb-24">
          {/* A8: Loading Skeleton */}
          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
          ) : (
            <>
              {/* General Tab */}
              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Basic server configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="input-server_url">Server URL</Label>
                      <Input
                        id="input-server_url"
                        ref={registerInput('server_url')}
                        value={localSettings.server_url || ''}
                        onChange={(e) => handleChange('server_url', e.target.value)}
                        placeholder="http://localhost:9817"
                        error={!!errors['server_url']}
                      />
                      {errors['server_url'] && (
                        <p className="text-xs text-destructive">{errors['server_url']}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Public URL for the server (used in generated links)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="input-base_path">Base Path</Label>
                      <Input
                        id="input-base_path"
                        value={localSettings.base_path || ''}
                        onChange={(e) => handleChange('base_path', e.target.value)}
                        placeholder="/"
                      />
                      <p className="text-xs text-muted-foreground">Optional base path for reverse proxy setups</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="select-log_level">Log Level</Label>
                      <Select value={localSettings.log_level || 'info'} onValueChange={(v) => handleChange('log_level', v)}>
                        <SelectTrigger id="select-log_level">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debug">Debug</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warn">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="switch-allow_registration">Allow Registration</Label>
                        <p className="text-xs text-muted-foreground">Allow new users to register</p>
                      </div>
                      <Switch
                        id="switch-allow_registration"
                        checked={localSettings.allow_registration === 'true'}
                        onCheckedChange={(checked) => handleChange('allow_registration', checked ? 'true' : 'false')}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* npm Tab */}
              <TabsContent value="npm">
                <ModuleSettingsCard
                  title="npm Registry Settings"
                  description="npm package proxy configuration"
                  enabledKey="npm.enabled"
                  upstreamKey="npm.upstream"
                  addrKey="npm.addr"
                  upstreamPlaceholder="https://registry.npmmirror.com"
                  addrPlaceholder=":4873"
                  localSettings={localSettings}
                  onChange={handleChange}
                  errors={errors}
                />
              </TabsContent>

              {/* Go Tab */}
              <TabsContent value="go">
                <ModuleSettingsCard
                  title="Go Modules Settings"
                  description="Go module proxy configuration"
                  enabledKey="go.enabled"
                  upstreamKey="go.upstream"
                  addrKey="go.addr"
                  upstreamPlaceholder="https://goproxy.cn,direct"
                  addrPlaceholder=":3000"
                  extraFields={[
                    {
                      key: 'go.private',
                      label: 'Private Modules Pattern',
                      type: 'text',
                      placeholder: 'git.example.com/*',
                      description: 'Private module patterns (comma-separated)',
                    },
                  ]}
                  localSettings={localSettings}
                  onChange={handleChange}
                  errors={errors}
                />
              </TabsContent>

              {/* OCI Tab */}
              <TabsContent value="oci">
                <ModuleSettingsCard
                  title="OCI/Docker Registry Settings"
                  description="Docker/OCI image proxy configuration"
                  enabledKey="oci.enabled"
                  upstreamKey="oci.upstream"
                  addrKey="oci.addr"
                  upstreamPlaceholder="https://registry-1.docker.io"
                  addrPlaceholder=":5000"
                  extraFields={[
                    {
                      key: 'oci.http_proxy',
                      label: 'HTTP Proxy',
                      type: 'url',
                      placeholder: 'http://proxy.example.com:8080',
                      description: 'HTTP proxy for OCI requests',
                    },
                    {
                      key: 'oci.https_proxy',
                      label: 'HTTPS Proxy',
                      type: 'url',
                      placeholder: 'http://proxy.example.com:8080',
                      description: 'HTTPS proxy for OCI requests',
                    },
                  ]}
                  localSettings={localSettings}
                  onChange={handleChange}
                  errors={errors}
                />
              </TabsContent>

              {/* Maven Tab */}
              <TabsContent value="maven">
                <ModuleSettingsCard
                  title="Maven Repository Settings"
                  description="Maven artifact proxy configuration"
                  enabledKey="maven.enabled"
                  upstreamKey="maven.upstream"
                  addrKey="maven.addr"
                  upstreamPlaceholder="https://repo.maven.apache.org/maven2"
                  addrPlaceholder=":8081"
                  localSettings={localSettings}
                  onChange={handleChange}
                  errors={errors}
                />
              </TabsContent>

              {/* PyPI Tab */}
              <TabsContent value="pypi">
                <ModuleSettingsCard
                  title="PyPI Settings"
                  description="Python package proxy configuration"
                  enabledKey="pypi.enabled"
                  upstreamKey="pypi.upstream"
                  addrKey="pypi.addr"
                  upstreamPlaceholder="https://pypi.org"
                  addrPlaceholder=":8080"
                  localSettings={localSettings}
                  onChange={handleChange}
                  errors={errors}
                />
              </TabsContent>

              {/* File Tab */}
              <TabsContent value="file">
                <ModuleSettingsCard
                  title="File Storage Settings"
                  description="File storage service configuration"
                  enabledKey="file.enabled"
                  addrKey="file.addr"
                  addrPlaceholder=":9000"
                  localSettings={localSettings}
                  onChange={handleChange}
                  errors={errors}
                />
              </TabsContent>

              {/* Storage Tab */}
              <TabsContent value="storage">
                <Card>
                  <CardHeader>
                    <CardTitle>Storage Configuration</CardTitle>
                    <CardDescription>File storage settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="input-storage_path">Storage Path</Label>
                      <Input
                        id="input-storage_path"
                        ref={registerInput('storage_path')}
                        value={localSettings.storage_path || './x-data'}
                        onChange={(e) => handleChange('storage_path', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="input-max_storage_gb">Max Storage Size (GB)</Label>
                      <Input
                        id="input-max_storage_gb"
                        ref={registerInput('max_storage_gb')}
                        type="number"
                        value={localSettings.max_storage_gb || '500'}
                        onChange={(e) => handleChange('max_storage_gb', e.target.value)}
                        error={!!errors['max_storage_gb']}
                      />
                      {errors['max_storage_gb'] && (
                        <p className="text-xs text-destructive">{errors['max_storage_gb']}</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <Label>Current Usage</Label>
                      {/* TODO: Replace with real storage stats once API is available */}
                      <div className="flex items-center gap-4">
                        <Progress value={storagePercent} className="flex-1 h-2" />
                        <span className="text-sm font-mono text-muted-foreground">
                          Storage stats API pending
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      {/* A1: Unified sticky bottom save bar */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-screen-xl px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {hasDirty && (
                <span className="text-amber-600 font-medium">
                  {dirtyKeys.length} unsaved change{dirtyKeys.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasDirty}
              >
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : hasDirty
                  ? `Save Changes (${dirtyKeys.length})`
                  : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
