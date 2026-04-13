# Layout Design (Sidebar + Header)

## Overview

Main application layout with collapsible sidebar navigation and top header with user menu.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER ─────────────────────────────────────────────────────────── 👤  │
├────────────┬───────────────────────────────────────────────────────────┤
│            │                                                            │
│  SIDEBAR   │                    MAIN CONTENT                           │
│            │                                                            │
│  ┌──────┐  │   ┌────────────────────────────────────────────────────┐  │
│  │ 📁   │  │   │  Page Title                                        │  │
│  │ Files│  │   │                                                    │  │
│  └──────┘  │   │  ┌──────────────────────────────────────────────┐  │  │
│            │   │  │                                              │  │  │
│  ┌──────┐  │   │  │              Content Area                    │  │  │
│  │ 📦   │  │   │  │                                              │  │  │
│  │ npm  │  │   │  │                                              │  │  │
│  └──────┘  │   │  │                                              │  │  │
│            │   │  │                                              │  │  │
│  ┌──────┐  │   │  └──────────────────────────────────────────────┘  │  │
│  │ 🐹   │  │   │                                                    │  │
│  │ Go   │  │   │                                                    │  │
│  └──────┘  │   └────────────────────────────────────────────────────┘  │
│            │                                                            │
│  ┌──────┐  │                                                            │
│  │ 🐳   │  │                                                            │
│  │ Docker│  │                                                            │
│  └──────┘  │                                                            │
│            │                                                            │
│  ...       │                                                            │
│            │                                                            │
├────────────┴───────────────────────────────────────────────────────────┤
└────────────────────────────────────────────────────────────────────────┘

Collapsed sidebar (64px):
┌──┬─────────────────────────────────────────────────────────────────────┐
│📁│ HEADER ──────────────────────────────────────────────────────── 👤  │
│  ├─────────────────────────────────────────────────────────────────────┤
│📦│                     MAIN CONTENT (expanded)                         │
│  │                                                                     │
│🐹│                                                                     │
│  │                                                                     │
│🐳│                                                                     │
│  │                                                                     │
│...│                                                                     │
└──┴─────────────────────────────────────────────────────────────────────┘
```

---

## Sidebar Navigation

### Items

| Icon | Label | Path | Description |
|------|-------|------|-------------|
| `Folder` | Files | `/files` | File store |
| `Package` | npm | `/npm` | npm packages |
| `Hexagon` | Go | `/go` | Go modules |
| `Container` | Docker | `/docker` | OCI images |
| `Box` | Maven | `/maven` | Maven artifacts |
| `Circle` | PyPI | `/pypi` | Python packages |
| `Mountain` | Alpine | `/alpine` | APK packages |
| `Trash2` | GC | `/gc` | Garbage collection |
| `Users` | Users | `/users` | User management (admin) |
| `Settings` | Settings | `/settings` | System settings (admin) |

### Component

```tsx
function Sidebar({ collapsed }) {
  const navItems = [
    { icon: Folder, label: "Files", path: "/files" },
    { icon: Package, label: "npm", path: "/npm" },
    { icon: Hexagon, label: "Go", path: "/go" },
    { icon: Container, label: "Docker", path: "/docker" },
    { icon: Box, label: "Maven", path: "/maven" },
    { icon: Circle, label: "PyPI", path: "/pypi" },
    { icon: Mountain, label: "Alpine", path: "/alpine" },
    { icon: Trash2, label: "GC", path: "/gc" },
    { icon: Users, label: "Users", path: "/users", admin: true },
    { icon: Settings, label: "Settings", path: "/settings", admin: true },
  ]

  return (
    <aside className={cn(
      "fixed left-0 top-14 h-[calc(100vh-56px)] bg-background border-r",
      "transition-all duration-200 ease-out",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo area */}
      <div className="p-4 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/uranus-logo.png" alt="Uranus" className="h-8 w-8" />
            <span className="font-semibold">Uranus</span>
          </div>
        )}
        {collapsed && (
          <img src="/uranus-icon.png" alt="Uranus" className="h-8 w-8 mx-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav className="px-2 py-4 space-y-1">
        {navItems.filter(item => !item.admin || isAdmin).map((item) => (
          <NavItem key={item.path} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="absolute bottom-4 px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="w-full justify-center"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </div>
    </aside>
  )
}

function NavItem({ item, collapsed }) {
  const location = useLocation()
  const isActive = location.pathname === item.path

  return (
    <Link
      to={item.path}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md",
        "transition-colors duration-150",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}
```

### Styling

| Property | Expanded | Collapsed |
|----------|----------|-----------|
| Width | 256px (`w-64`) | 64px (`w-16`) |
| Background | `bg-background` | Same |
| Border | `border-r` | Same |
| Item padding | `px-3 py-2` | `px-3 py-2` |
| Icon size | 20px (`h-5 w-5`) | Same |
| Active bg | `bg-primary` | Same |

---

## Header

### Component

```tsx
function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Page title (optional breadcrumb) */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">
            {pageTitle}
          </h1>
        </div>

        {/* Right: Actions + User menu */}
        <div className="flex items-center gap-4">
          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.username[0]}</AvatarFallback>
                </Avatar>
                <span className="hidden md:inline">{user.username}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openPasswordDialog}>
                <Key className="mr-2 h-4 w-4" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
```

### Styling

- Height: 56px (`h-14`)
- Background: `bg-background`
- Border: `border-b`
- Position: `fixed top-0`
- Z-index: `z-50` (above content)

---

## Main Content Area

```tsx
function MainContent({ sidebarCollapsed }) {
  return (
    <main className={cn(
      "pt-14 min-h-screen bg-background",
      "transition-all duration-200",
      sidebarCollapsed ? "pl-16" : "pl-64"
    )}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page content */}
        {children}
      </div>
    </main>
  )
}
```

### Styling

- Padding-top: 56px (header height)
- Padding-left: Sidebar width (responsive)
- Max-width: `max-w-7xl` (1280px)
- Centered: `mx-auto`
- Inner padding: `p-6`

---

## Responsive

### Desktop (≥1024px)
- Sidebar expanded by default
- Can collapse to 64px
- Full navigation labels visible

### Tablet (768px-1023px)
- Sidebar collapsed by default
- Labels hidden, icons only
- Content area uses full width

### Mobile (<768px)
- Sidebar hidden (use Sheet/drawer)
- Toggle button in header
- Full-width content
- Bottom navigation optional

```tsx
// Mobile sidebar as drawer
<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
  <SheetContent side="left" className="w-64">
    <Sidebar collapsed={false} />
  </SheetContent>
</Sheet>
```

---

## Full Layout Component

```tsx
function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header mobileMenuToggle={() => setMobileMenuOpen(true)} />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} toggleCollapse={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar collapsed={false} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <MainContent sidebarCollapsed={collapsed && !mobileMenuOpen}>
        <Outlet />
      </MainContent>
    </div>
  )
}
```