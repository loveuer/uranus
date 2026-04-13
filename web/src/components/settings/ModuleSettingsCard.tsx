import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { parseBoolSetting, boolToString } from '@/lib/utils'

interface ExtraField {
  key: string
  label: string
  type: 'text' | 'number' | 'url'
  placeholder?: string
  description?: string
}

interface ModuleSettingsCardProps {
  title: string
  description: string
  enabledKey: string
  upstreamKey?: string
  addrKey?: string
  upstreamPlaceholder?: string
  addrPlaceholder?: string
  extraFields?: ExtraField[]
  localSettings: Record<string, string>
  onChange: (key: string, value: string) => void
  children?: React.ReactNode
  // Validation support
  errors?: Record<string, string>
}

export function ModuleSettingsCard({
  title,
  description,
  enabledKey,
  upstreamKey,
  addrKey,
  upstreamPlaceholder,
  addrPlaceholder,
  extraFields,
  localSettings,
  onChange,
  children,
  errors = {},
}: ModuleSettingsCardProps) {
  const enabled = parseBoolSetting(localSettings[enabledKey])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Switch */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor={`switch-${enabledKey}`}>Enable Service</Label>
            <p className="text-xs text-muted-foreground">Enable this module's proxy service</p>
          </div>
          <Switch
            id={`switch-${enabledKey}`}
            checked={enabled}
            onCheckedChange={(checked) => onChange(enabledKey, boolToString(checked))}
          />
        </div>

        {/* Settings shown when enabled */}
        {enabled && (
          <>
            {/* Upstream URL */}
            {upstreamKey && (
              <div className="space-y-2">
                <Label htmlFor={`input-${upstreamKey}`}>Upstream URL</Label>
                <Input
                  id={`input-${upstreamKey}`}
                  value={localSettings[upstreamKey] || ''}
                  onChange={(e) => onChange(upstreamKey, e.target.value)}
                  placeholder={upstreamPlaceholder}
                  error={!!errors[upstreamKey]}
                />
                {errors[upstreamKey] && (
                  <p className="text-xs text-destructive">{errors[upstreamKey]}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Upstream registry/proxy URL for fetching packages
                </p>
              </div>
            )}

            {/* Listen Address */}
            {addrKey && (
              <div className="space-y-2">
                <Label htmlFor={`input-${addrKey}`}>Listen Address</Label>
                <Input
                  id={`input-${addrKey}`}
                  value={localSettings[addrKey] || ''}
                  onChange={(e) => onChange(addrKey, e.target.value)}
                  placeholder={addrPlaceholder || ':0'}
                  error={!!errors[addrKey]}
                />
                {errors[addrKey] && (
                  <p className="text-xs text-destructive">{errors[addrKey]}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Dedicated port listen address (e.g., :4873)
                </p>
              </div>
            )}

            {/* Extra Fields */}
            {extraFields?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`input-${field.key}`}>{field.label}</Label>
                <Input
                  id={`input-${field.key}`}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={localSettings[field.key] || ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  error={!!errors[field.key]}
                />
                {errors[field.key] && (
                  <p className="text-xs text-destructive">{errors[field.key]}</p>
                )}
                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}
              </div>
            ))}

            {/* Additional content */}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  )
}
