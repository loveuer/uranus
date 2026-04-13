import * as React from 'react'
import { cn } from '@/lib/utils'
import { Sidebar, MobileSidebar } from './Sidebar'
import { Header } from './Header'
import { useSidebarCollapsed } from '@/stores/ui'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const collapsed = useSidebarCollapsed()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <MobileSidebar />
      </div>

      {/* Main Content */}
      <main
        className={cn(
          'pt-14 min-h-screen transition-all duration-200',
          'md:block',
          collapsed ? 'md:pl-16' : 'md:pl-64'
        )}
      >
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout