# Uranus v2.0.0 Design System

## Overview

Uranus is an enterprise artifact repository management system supporting npm, Go Modules, Docker/OCI, Maven, PyPI, Alpine APK, and File Store. This design system defines the visual identity, component specifications, and interaction patterns for a modern minimalist UI.

---

## Design Philosophy

### Core Principles

1. **Clarity over decoration** - Every element serves a purpose
2. **Information density** - Maximize data visibility without sacrificing readability
3. **Professional trust** - Enterprise-grade visual confidence
4. **Accessibility first** - WCAG AA minimum, AAA where possible

### Style: Modern Minimalist (Swiss-Inspired)

- Clean, simple, spacious, functional
- High contrast, geometric, sans-serif
- Grid-based structure, essential elements only
- No decorative shadows or gradients (except functional)
- Fast loading, minimal complexity

---

## Quick Reference

| Aspect | Value |
|--------|-------|
| Primary Color | `#059669` (Emerald 600) |
| Background | `#F8FAFC` (Slate 50) |
| Text Primary | `#0F172A` (Slate 900) |
| Font Family | Inter |
| Border Radius | `8px` (medium) |
| Base Spacing | `8px` |
| Animation Duration | `150-300ms` |

---

## Directory Structure

```
doc/uiux/
├── MASTER.md              # This document
├── color-system.md        # Color palette and tokens
├── typography.md          # Font system and scale
├── components.md          # shadcn/ui component specs
├── interaction-patterns.md # UX patterns and animations
└── pages/
    ├── login.md           # Login page design
    ├── layout.md          # Main layout (sidebar, header)
    ├── files.md           # File store page
    ├── npm.md             # npm repository page
    ├── go.md              # Go modules page
    ├── docker.md          # OCI/Docker page
    ├── maven.md           # Maven artifacts page
    ├── pypi.md            # PyPI packages page
    ├── alpine.md          # Alpine APK page
    ├── gc.md              # Garbage collection page
    ├── users.md           # User management page
    └── settings.md        # System settings page
```

---

## Anti-Patterns (Avoid)

- Playful design elements
- Hidden credentials/unclear trust indicators
- AI purple/pink gradients
- Emojis as structural icons
- Decorative-only animations
- Wide tables breaking mobile layout
- Buttons clickable during loading operations

---

## Pre-Delivery Checklist

- [ ] No emojis as icons (use SVG: Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum in both themes
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive tested: 375px, 768px, 1024px, 1440px
- [ ] All touch targets ≥44×44pt
- [ ] Loading states for operations >300ms

---

## Implementation Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Styling | TailwindCSS 3.4 |
| Components | shadcn/ui (customized) |
| State | Zustand 4.5 |
| Tables | TanStack Table 8 |
| Icons | Lucide React |
| Charts | Recharts / custom SVG |
| Forms | react-hook-form + zod |
| Build | Vite 7 |

---

## Related Documents

- [Color System](color-system.md)
- [Typography](typography.md)
- [Components](components.md)
- [Interaction Patterns](interaction-patterns.md)
- [Page Designs](pages/)