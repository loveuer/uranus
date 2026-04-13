import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from './input'
import { cn } from '../../lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, onChange, debounceMs])

  React.useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  )
}