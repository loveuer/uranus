import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../lib/utils'

interface CodeBlockProps {
  code: string
  language?: string
  copyable?: boolean
  className?: string
}

export function CodeBlock({
  code,
  language,
  copyable = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'relative bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto',
        className
      )}
    >
      {copyable && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-100 h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
      {/* Language label removed per user request */}
      <pre className="text-xs whitespace-pre-wrap">{code}</pre>
    </div>
  )
}