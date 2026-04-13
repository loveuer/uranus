import * as React from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const location = useLocation()

  return (
    <nav className={cn('flex items-center space-x-1 text-sm', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isActive = item.path === location.pathname

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className={cn(
                  'text-muted-foreground hover:text-foreground transition-colors',
                  isActive && 'text-foreground font-medium'
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'text-muted-foreground',
                  isLast && 'text-foreground font-medium'
                )}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// Skeleton for breadcrumb
export function BreadcrumbSkeleton({ items = 3 }: { items?: number }) {
  return (
    <nav className="flex items-center space-x-1 text-sm">
      {Array.from({ length: items }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="h-4 w-[60px] bg-muted animate-pulse rounded" />
        </React.Fragment>
      ))}
    </nav>
  )
}

// Page header component
interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-2" />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// Empty state component
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="text-muted-foreground mb-4">{icon}</div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}