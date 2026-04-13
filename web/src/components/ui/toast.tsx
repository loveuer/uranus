import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ToastProps {
  id: string
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onDismiss: (id: string) => void
}

function Toast({ id, message, type = 'info', duration = 3000, onDismiss }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onDismiss])

  const bgColor =
    type === 'success'
      ? 'bg-green-600 text-white'
      : type === 'error'
        ? 'bg-red-600 text-white'
        : 'bg-slate-800 text-white'

  const icon =
    type === 'success' ? (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ) : type === 'error' ? (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ) : (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    )

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all',
        'animate-in slide-in-from-bottom-2 fade-in-0',
        bgColor
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

// Simple toast store
interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration: number
}

let toasts: ToastItem[] = []
let listeners: Set<() => void> = new Set()

function notify() {
  listeners.forEach((fn) => fn())
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
  const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
  toasts = [...toasts, { id, message, type, duration }]
  notify()
  return id
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

export function useToasts() {
  const [items, setItems] = React.useState<ToastItem[]>(toasts)

  React.useEffect(() => {
    const listener = () => setItems([...toasts])
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return items
}

export { Toast }
export default Toast
