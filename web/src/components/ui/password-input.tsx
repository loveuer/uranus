import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { cn } from '../../lib/utils'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function PasswordInput({
  className,
  error,
  ...props
}: PasswordInputProps) {
  const [show, setShow] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        className={cn('pr-10', error && 'border-destructive', className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setShow(!show)}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <span className="sr-only">
          {show ? 'Hide password' : 'Show password'}
        </span>
      </Button>
    </div>
  )
}