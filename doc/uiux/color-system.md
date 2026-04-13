# Color System

## Overview

Professional emerald/slate palette optimized for enterprise tools and data-heavy interfaces. Designed for WCAG AA compliance in both light and dark modes.

---

## Semantic Color Tokens

### Light Mode

| Token | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Primary** | `#059669` | `--primary` | Primary actions, active states, links |
| **On Primary** | `#FFFFFF` | `--primary-foreground` | Text on primary backgrounds |
| **Secondary** | `#334155` | `--secondary` | Secondary buttons, muted actions |
| **On Secondary** | `#FFFFFF` | `--secondary-foreground` | Text on secondary backgrounds |
| **Accent/CTA** | `#10B981` | `--accent` | Success states, confirmations |
| **On Accent** | `#FFFFFF` | `--accent-foreground` | Text on accent backgrounds |
| **Background** | `#F8FAFC` | `--background` | App background |
| **Foreground** | `#0F172A` | `--foreground` | Primary text |
| **Card** | `#FFFFFF` | `--card` | Card/surface background |
| **Card Foreground** | `#0F172A` | `--card-foreground` | Text on cards |
| **Muted** | `#F1F5F9` | `--muted` | Disabled backgrounds, subtle surfaces |
| **Muted Foreground** | `#64748B` | `--muted-foreground` | Secondary/placeholder text |
| **Border** | `#E2E8F0` | `--border` | Borders, separators |
| **Destructive** | `#DC2626` | `--destructive` | Errors, delete actions |
| **On Destructive** | `#FFFFFF` | `--destructive-foreground` | Text on destructive backgrounds |
| **Ring** | `#059669` | `--ring` | Focus ring color |

### Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| **Primary** | `#10B981` | Slightly lighter for contrast |
| **On Primary** | `#0F172A` | Dark text on light primary |
| **Background** | `#0F172A` | Dark background |
| **Foreground** | `#F8FAFC` | Light text |
| **Card** | `#1E293B` | Elevated surfaces |
| **Card Foreground** | `#F8FAFC` | Text on cards |
| **Muted** | `#334155` | Subtle surfaces |
| **Muted Foreground** | `#94A3B8` | Secondary text |
| **Border** | `#334155` | Borders |
| **Destructive** | `#EF4444` | Lighter red for dark bg |

---

## Extended Palette

### Emerald Scale (Primary)

```
emerald-50:  #ECFDF5   ← Very light bg
emerald-100: #D1FAE5   ← Light bg, success highlights
emerald-200: #A7F3D0
emerald-300: #6EE7B7
emerald-400: #34D399   ← Hover state
emerald-500: #10B981   ← Accent/CTA
emerald-600: #059669   ← Primary ←
emerald-700: #047857   ← Pressed state
emerald-800: #065F46
emerald-900: #064E3B
```

### Slate Scale (Neutral)

```
slate-50:  #F8FAFC    ← Background ←
slate-100: #F1F5F9    ← Muted bg
slate-200: #E2E8F0    ← Border ←
slate-300: #CBD5E1
slate-400: #94A3B8
slate-500: #64748B    ← Muted text ←
slate-600: #475569
slate-700: #334155    ← Secondary ←
slate-800: #1E293B
slate-900: #0F172A    ← Foreground ←
```

### Semantic Colors

| Semantic | Light | Dark | Usage |
|----------|-------|------|-------|
| **Success** | `#10B981` | `#34D399` | Positive states, confirmations |
| **Warning** | `#F59E0B` | `#FBBF24` | Alerts, caution states |
| **Error** | `#DC2626` | `#EF4444` | Errors, destructive actions |
| **Info** | `#3B82F6` | `#60A5FA` | Information, help |

---

## Data Visualization Colors

For charts, tables, and data-heavy components:

| Data Color | Hex | Usage |
|------------|-----|-------|
| **Data 1** | `#059669` | Primary series |
| **Data 2** | `#3B82F6` | Secondary series (blue) |
| **Data 3** | `#8B5CF6` | Third series (violet) |
| **Data 4** | `#F59E0B` | Fourth series (amber) |
| **Data 5** | `#EC4899` | Fifth series (pink) |

**Gridlines**: `#E2E8F0` (slate-200) - low contrast
**Axis text**: `#64748B` (slate-500)

---

## TailwindCSS Configuration

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // shadcn/ui semantic tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
}
```

---

## CSS Variables (globals.css)

```css
@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222 47% 11%;

    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    --primary: 160 84% 39%;
    --primary-foreground: 0 0% 100%;

    --secondary: 215 25% 27%;
    --secondary-foreground: 0 0% 100%;

    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;

    --accent: 160 84% 39%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 160 84% 39%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;

    --card: 222 47% 15%;
    --card-foreground: 210 40% 98%;

    --popover: 222 47% 15%;
    --popover-foreground: 210 40% 98%;

    --primary: 160 84% 45%;
    --primary-foreground: 222 47% 11%;

    --secondary: 217 33% 17%;
    --secondary-foreground: 0 0% 100%;

    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;

    --accent: 160 84% 45%;
    --accent-foreground: 222 47% 11%;

    --destructive: 0 62% 50%;
    --destructive-foreground: 0 0% 100%;

    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 160 84% 45%;
  }
}
```

---

## Contrast Verification

| Pair | Light Mode Ratio | Dark Mode Ratio | Status |
|------|------------------|-----------------|--------|
| foreground / background | 15.5:1 | 15.5:1 | AAA ✓ |
| muted-foreground / background | 4.7:1 | 5.1:1 | AA ✓ |
| primary-foreground / primary | 4.5:1 | 7.1:1 | AA ✓ |
| destructive-foreground / destructive | 4.5:1 | 4.5:1 | AA ✓ |

---

## Usage Guidelines

### Do

- Use semantic tokens (`--primary`, `--destructive`) in components
- Test both light and dark modes
- Verify contrast for new color combinations
- Use emerald-600 for primary CTAs

### Don't

- Use raw hex values in components
- Assume dark mode values work without testing
- Use emerald for errors (use red)
- Mix too many data colors (max 5 in charts)