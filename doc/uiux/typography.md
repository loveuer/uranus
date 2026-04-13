# Typography System

## Overview

Single-family typography system using Inter for maximum simplicity, professional appearance, and excellent readability across all devices.

---

## Font Family

### Primary: Inter

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

**Tailwind Configuration:**
```typescript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Consolas', 'monospace'],
}
```

### Why Inter?

- Designed for screens, excellent legibility
- Variable font support for performance
- Wide weight range (300-700) for hierarchy
- Works in both Latin and Cyrillic
- Zero cost, open source
- Used by GitHub, Vercel, Linear

---

## Type Scale

### Desktop (>1024px)

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `text-4xl` | 36px | 700 | 1.1 | -0.02em | Page titles, Hero |
| `text-3xl` | 30px | 700 | 1.2 | -0.01em | Section headers |
| `text-2xl` | 24px | 600 | 1.25 | 0 | Card headers, Dialog titles |
| `text-xl` | 20px | 600 | 1.4 | 0 | Subsection headers |
| `text-lg` | 18px | 500 | 1.5 | 0 | Emphasized body |
| `text-base` | 16px | 400 | 1.5 | 0 | Body text, Labels |
| `text-sm` | 14px | 500 | 1.5 | 0 | Secondary labels, Tags |
| `text-xs` | 12px | 500 | 1.6 | 0.02em | Captions, Metadata |

### Mobile (<768px)

| Token | Size | Usage |
|-------|------|-------|
| `text-3xl` | 28px | Page titles (reduced) |
| `text-2xl` | 22px | Section headers |
| `text-xl` | 18px | Card headers |
| `text-lg` | 16px | Emphasized body |
| `text-base` | 16px | Body (unchanged) |

---

## Semantic Typography Classes

### shadcn/ui Compatible

```typescript
// Component-level typography
const textVariants = cva("", {
  variants: {
    variant: {
      h1: "scroll-m-20 text-4xl font-bold tracking-tight",
      h2: "scroll-m-20 text-3xl font-bold tracking-tight",
      h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
      h4: "scroll-m-20 text-xl font-semibold tracking-tight",
      p: "leading-7 [&:not(:first-child)]:mt-6",
      lead: "text-xl text-muted-foreground",
      large: "text-lg font-semibold",
      small: "text-sm font-medium leading-none",
      muted: "text-sm text-muted-foreground",
    },
  },
})
```

---

## Component Typography

### Page Header
```tsx
<h1 className="text-3xl font-bold tracking-tight">
  {title}
</h1>
<p className="text-muted-foreground mt-1">
  {description}
</p>
```

### Card Title
```tsx
<h3 className="text-lg font-semibold">
  Package Name
</h3>
```

### Table Headers
```tsx
<th className="text-sm font-medium text-muted-foreground">
  Column Name
</th>
```

### Table Cells
```tsx
<td className="text-sm">
  {value}
</td>
```

### Button Text
```tsx
// Primary button
<span className="text-sm font-medium">Submit</span>

// Small button
<span className="text-xs font-medium">Cancel</span>
```

### Badge/Chip
```tsx
<span className="text-xs font-medium">
  v1.2.3
</span>
```

### Code/Monospace
```tsx
<code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
  npm install
</code>
```

---

## Special Cases

### Package Versions
```tsx
// Use monospace for versions
<span className="font-mono text-sm">
  1.2.3-beta.1
</span>
```

### File Sizes
```tsx
// Use monospace for alignment
<span className="font-mono text-sm tabular-nums">
  12.5 MB
</span>
```

### Timestamps
```tsx
// Use monospace for consistency
<span className="font-mono text-xs text-muted-foreground">
  2024-01-15 10:30
</span>
```

---

## Line Length Guidelines

| Context | Max Characters | Implementation |
|---------|---------------|----------------|
| Body text | 65-75 | `max-w-prose` (65ch) |
| Card descriptions | 40-50 | `max-w-md` |
| Table columns | Auto-fit | `min-w-[100px]` |
| Code blocks | No limit | `overflow-x-auto` |

---

## Accessibility

### Dynamic Type Support

```css
/* Allow system text scaling */
html {
  font-size: 100%; /* Don't override */
}
```

### Minimum Sizes

- Body text: **16px** minimum (avoids iOS auto-zoom on inputs)
- Secondary text: **14px** minimum
- Captions: **12px** minimum (with high contrast)

### Contrast Requirements

| Element | Minimum Ratio |
|---------|---------------|
| Body text | 4.5:1 |
| Large text (>18px) | 3:1 |
| Secondary text | 3:1 |
| Placeholder text | 3:1 |

---

## Responsive Typography

```tsx
// Fluid typography example
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Dashboard
</h1>

// Or using clamp
<h1 className="text-[clamp(1.5rem,2vw+1rem,2.25rem)] font-bold">
  Responsive Title
</h1>
```

---

## Anti-Patterns

### Don't

- Use `text-xs` for body text
- Mix fonts from different families at same hierarchy level
- Use letter-spacing on body text (keep default)
- Hard-code px values (use Tailwind classes)
- Use `font-light` (300) for body text (legibility issues)

### Do

- Use weight for hierarchy: Bold headings, Regular body
- Use `tabular-nums` for data columns (numbers align)
- Use monospace for code, versions, file sizes
- Use semantic tokens (`text-muted-foreground`)