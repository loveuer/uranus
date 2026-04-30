import { Link, useLocation } from 'react-router-dom'
import {
  Folder,
  Package,
  Hexagon,
  Container,
  Box,
  CircleDot,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSidebarCollapsed, useUIStore } from '@/stores/ui'
import { useIsAdmin } from '@/stores/auth'

const navItems = [
  { icon: Folder, label: 'Files', path: '/files' },
  { icon: Package, label: 'npm', path: '/npm' },
  { icon: Hexagon, label: 'Go', path: '/go' },
  { icon: Container, label: 'Docker', path: '/docker' },
  { icon: Box, label: 'Maven', path: '/maven' },
  { icon: CircleDot, label: 'PyPI', path: '/pypi' },
  { icon: Users, label: 'Users', path: '/users', admin: true },
  { icon: Settings, label: 'Settings', path: '/settings', admin: true },
]

interface NavItemProps {
  item: (typeof navItems)[number]
  collapsed: boolean
}

function NavItem({ item, collapsed }: NavItemProps) {
  const location = useLocation()
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')

  return (
    <Link
      to={item.path}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md',
        'transition-colors duration-150 cursor-pointer',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
    </Link>
  )
}

export function Sidebar() {
  const collapsed = useSidebarCollapsed()
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const isAdmin = useIsAdmin()

  const filteredItems = navItems.filter((item) => !item.admin || isAdmin)

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 h-[calc(100vh-56px)] bg-background border-r',
        'transition-all duration-200 ease-out z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Navigation */}
      <nav className="px-2 py-4 space-y-1">
        {filteredItems.map((item) => (
          <NavItem key={item.path} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="absolute bottom-4 left-0 right-0 px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}

// Mobile sidebar (sheet/drawer version)
export function MobileSidebar() {
  const mobileOpen = useUIStore((state) => state.sidebarMobileOpen)
  const setMobileOpen = useUIStore((state) => state.setSidebarMobileOpen)
  const isAdmin = useIsAdmin()

  const filteredItems = navItems.filter((item) => !item.admin || isAdmin)

  return (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-background border-r z-50',
          'transform transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/uranus-icon.png" alt="Uranus" className="h-8 w-8" />
            <span className="font-semibold text-foreground">Uranus</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="px-2 py-4 space-y-1">
          {filteredItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md',
                'transition-colors duration-150 cursor-pointer',
                'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}