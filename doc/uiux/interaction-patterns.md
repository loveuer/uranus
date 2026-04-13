# Interaction Patterns

## Overview

UX patterns and interaction guidelines for Uranus, following modern minimalist principles with accessibility-first approach.

---

## Animation Guidelines

### Timing

| Interaction Type | Duration | Easing |
|------------------|----------|--------|
| Micro-interactions | 150-200ms | `ease-out` |
| State transitions | 200-300ms | `ease-out` |
| Modal open/close | 200ms | `ease-out` |
| Hover effects | 150ms | `ease-out` |
| Exit animations | ~60% of enter | `ease-in` |

### Properties to Animate

**Allowed:**
- `opacity` (fade in/out)
- `transform: scale` (subtle 0.95-1.05)
- `transform: translate` (slide)
- `color`, `background-color` (hover states)

**Forbidden:**
- `width`, `height` (causes layout thrashing)
- `top`, `left`, `right`, `bottom` (use translate instead)
- Layout properties (causes reflow)

### Tailwind Animation Classes

```css
/* Custom animations */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in-from-top {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slide-in-from-right {
  from { transform: translateX(10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}

.animate-slide-in-top {
  animation: slide-in-from-top 200ms ease-out;
}

.animate-slide-in-right {
  animation: slide-in-from-right 200ms ease-out;
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Loading States

### Skeleton Loading

Use for initial page loads >300ms:

```tsx
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-[150px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-[100px]" />
        <Skeleton className="h-3 w-[80px] mt-2" />
      </CardContent>
    </Card>
  )
}
```

### Spinner Loading

Use for inline operations (button clicks, small updates):

```tsx
function LoadingSpinner() {
  return (
    <Loader2 className="h-4 w-4 animate-spin" />
  )
}

// In button
<Button disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Submit
</Button>
```

### Progress Indicators

Use for file uploads, long operations:

```tsx
<Progress value={uploadProgress} className="h-2" />
<span className="text-xs text-muted-foreground">
  {uploadProgress}% uploaded
</span>
```

---

## Error Handling

### Inline Form Errors

```tsx
// Error below field
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" className={errors.email ? "border-destructive" : ""} />
  {errors.email && (
    <p className="text-sm text-destructive">{errors.email.message}</p>
  )}
</div>
```

### Toast Notifications

```tsx
// Success toast
toast({
  title: "Package uploaded",
  description: "npm-package-1.2.3 has been uploaded successfully.",
})

// Error toast
toast({
  variant: "destructive",
  title: "Upload failed",
  description: "Please check your network connection and try again.",
})
```

### Error Summary

For multiple form errors:

```tsx
{Object.keys(errors).length > 0 && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Validation Errors</AlertTitle>
    <AlertDescription>
      Please fix the following fields:
      <ul className="mt-2 list-inside list-disc">
        {Object.entries(errors).map(([field, error]) => (
          <li key={field}>{field}: {error.message}</li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
)}
```

---

## Touch & Interaction

### Touch Targets

- Minimum: **44×44pt** (iOS) / **48×48dp** (Android)
- Expand hit area with padding if icon is smaller:

```tsx
// Icon button with expanded touch area
<Button size="icon" className="h-10 w-10">
  <Trash2 className="h-4 w-4" />
</Button>

// Touch area expansion
<Button variant="ghost" className="p-2">
  <span className="relative">
    <Edit className="h-4 w-4" />
    {/* Expanded touch area */}
    <span className="absolute inset-0 -m-2" />
  </span>
</Button>
```

### Press Feedback

```tsx
// Scale on press
const pressVariants = cva("transition-transform", {
  variants: {
    pressed: {
      true: "scale-[0.97]",
      false: "scale-100",
    },
  },
})
```

### Hover vs Tap

- Never rely on hover alone for important actions
- Hover is supplementary feedback on web
- Mobile: all actions require tap/click

---

## Navigation Patterns

### Sidebar Navigation

```tsx
// Collapsible sidebar
<aside className={cn(
  "fixed left-0 top-0 h-full bg-background border-r transition-all duration-200",
  collapsed ? "w-16" : "w-64"
)}>
  {/* Logo */}
  <div className="p-4">
    {collapsed ? <LogoIcon /> : <LogoFull />}
  </div>

  {/* Nav items */}
  <nav className="space-y-1 p-2">
    {navItems.map((item) => (
      <NavItem key={item.path} item={item} collapsed={collapsed} />
    ))}
  </nav>

  {/* Collapse toggle */}
  <Button variant="ghost" size="icon" onClick={toggleCollapse} className="m-2">
    {collapsed ? <ChevronRight /> : <ChevronLeft />}
  </Button>
</aside>
```

### Active State

```tsx
function NavItem({ item, collapsed }) {
  const isActive = location.pathname === item.path

  return (
    <Link
      to={item.path}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      <item.icon className="h-5 w-5" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}
```

### Back Navigation

- Preserve scroll position when navigating back
- Use browser history (React Router handles this)
- Don't reset navigation stack unexpectedly

---

## Forms & Inputs

### Labels

```tsx
// Visible label (not placeholder-only)
<div className="space-y-2">
  <Label htmlFor="name">Package Name</Label>
  <Input id="name" placeholder="Enter package name" />
</div>
```

### Required Fields

```tsx
// Asterisk for required
<Label htmlFor="name">
  Package Name <span className="text-destructive">*</span>
</Label>
```

### Helper Text

```tsx
<div className="space-y-2">
  <Label htmlFor="url">Repository URL</Label>
  <Input id="url" placeholder="https://registry.npmjs.org" />
  <p className="text-xs text-muted-foreground">
    Enter the upstream repository URL for proxy caching.
  </p>
</div>
```

### Disabled States

```tsx
// Disabled input
<Input disabled value="readonly-value" className="opacity-50 cursor-not-allowed" />

// Disabled button
<Button disabled className="opacity-50 cursor-not-allowed">
  Cannot Delete
</Button>
```

### Password Toggle

```tsx
function PasswordInput() {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}
```

---

## Tables & Data

### Sorting

```tsx
// Sortable header
<TableHead
  onClick={() => table.getColumn("name")?.toggleSorting()}
  className="cursor-pointer hover:bg-muted/50"
>
  <div className="flex items-center gap-2">
    Name
    {table.getColumn("name")?.getIsSorted() === "asc" && <ArrowUp className="h-4 w-4" />}
    {table.getColumn("name")?.getIsSorted() === "desc" && <ArrowDown className="h-4 w-4" />}
  </div>
</TableHead>
```

### Pagination

```tsx
<div className="flex items-center justify-between">
  <span className="text-sm text-muted-foreground">
    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
  </span>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
      Previous
    </Button>
    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
      Next
    </Button>
  </div>
</div>
```

### Row Actions

```tsx
// Actions dropdown
<TableCell>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => viewDetails(row)}>
        <Eye className="mr-2 h-4 w-4" />
        View Details
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => download(row)}>
        <Download className="mr-2 h-4 w-4" />
        Download
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => deleteRow(row)} className="text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</TableCell>
```

### Mobile Table Handling

```tsx
// Responsive: hide columns on mobile
<TableCell className="hidden md:table-cell">
  {row.description}
</TableCell>

// Or: switch to card layout on mobile
<div className="hidden md:block">
  <DataTable ... />
</div>
<div className="md:hidden">
  <MobileCardList ... />
</div>
```

---

## Dialogs & Modals

### Dialog Structure

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Edit Package</DialogTitle>
      <DialogDescription>
        Update package metadata and settings.
      </DialogDescription>
    </DialogHeader>

    {/* Form content */}
    <div className="space-y-4">
      ...
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave}>Save Changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Escape Routes

- Always provide close/dismiss affordance
- Allow `Escape` key to close
- Mobile: swipe-down to dismiss (use Sheet)

### Confirmation Dialogs

Use for destructive actions:

```tsx
<ConfirmDialog
  open={confirmOpen}
  title="Delete Package"
  description="Are you sure you want to delete this package? This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  variant="destructive"
  onConfirm={handleDelete}
  onCancel={() => setConfirmOpen(false)}
/>
```

---

## Accessibility

### Focus Management

```tsx
// Focus first error on form submit
useEffect(() => {
  if (Object.keys(errors).length > 0) {
    const firstErrorField = Object.keys(errors)[0]
    document.getElementById(firstErrorField)?.focus()
  }
}, [errors])
```

### Keyboard Navigation

- Tab order matches visual order
- All interactive elements keyboard-accessible
- Use native controls (Button, Input) over custom

### Screen Reader Labels

```tsx
// Icon-only button needs aria-label
<Button size="icon" aria-label="Delete package">
  <Trash2 className="h-4 w-4" />
</Button>

// Loading state announcement
<span aria-live="polite" aria-busy={loading}>
  {loading ? "Loading..." : "Loaded"}
</span>
```

---

## Anti-Patterns

### Don't

- Block UI during animations
- Use hover-only for critical actions
- Snap state changes (always animate transitions)
- Hide navigation on deep pages
- Allow multiple button clicks during async
- Layout shift during loading (reserve space)
- Auto-play media without controls

### Do

- Provide loading feedback >300ms
- Use skeleton/shimmer for content loading
- Preserve scroll/state on navigation back
- Confirm destructive actions
- Disable buttons during async operations
- Use `prefers-reduced-motion` media query
- Keep core navigation accessible