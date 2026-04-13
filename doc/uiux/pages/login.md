# Login Page Design

## Overview

Authentication page for Uranus artifact repository. Clean, minimal design with focus on the login form.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                                                                    │
│                    ┌──────────────────────┐                        │
│                    │     ╭─────────────╮  │                        │
│                    │     │   LOGO      │  │                        │
│                    │     ╰─────────────╯  │                        │
│                    │                      │                        │
│                    │   Uranus Repository  │                        │
│                    │                      │                        │
│                    │   ┌──────────────┐   │                        │
│                    │   │ Username     │   │                        │
│                    │   └──────────────┘   │                        │
│                    │                      │                        │
│                    │   ┌──────────────┐   │                        │
│                    │   │ Password  👁 │   │                        │
│                    │   └──────────────┘   │                        │
│                    │                      │                        │
│                    │   ┌──────────────┐   │                        │
│                    │   │   Log In     │   │                        │
│                    │   └──────────────┘   │                        │
│                    │                      │                        │
│                    │   Forgot password?   │                        │
│                    │                      │                        │
│                    └──────────────────────┘                        │
│                                                                    │
│                                                                    │
│                                                                    │
│                    Version v2.0.0 · Secure Connection              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```tsx
function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src="/uranus-logo.png" alt="Uranus" className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Uranus Repository</CardTitle>
          <CardDescription>
            Universal artifact management
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {/* Error message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit button */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log In
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button variant="link" size="sm">
            Forgot password?
          </Button>
        </CardFooter>
      </Card>

      {/* Footer */}
      <div className="fixed bottom-4 text-center text-xs text-muted-foreground">
        Version v2.0.0 · <Lock className="inline h-3 w-3 mr-1" /> Secure Connection
      </div>
    </div>
  )
}
```

---

## Styling

### Card
- Centered on screen
- Max width: 400px (`max-w-md`)
- Background: `bg-card`
- Border: `border`
- Shadow: `shadow-sm`

### Logo
- Size: 48×48px (`h-12 w-12`)
- Centered alignment

### Form Fields
- Full width
- Input height: 40px (`h-10`)
- Label visible, not placeholder-only
- Focus ring: emerald ring

### Button
- Full width (`w-full`)
- Height: 40px (`h-10`)
- Primary color (`bg-primary`)
- Loading state with spinner

---

## States

### Default
- Clean form ready for input
- All fields empty

### Loading
- Button disabled with spinner
- Fields disabled
- No error shown

### Error
- Alert above button
- Red border on failed field
- Focus moves to error field

### Success
- Redirect to dashboard
- Brief success indicator optional

---

## Responsive

### Mobile (<768px)
- Card width: 95% with padding
- Maintain centered layout
- Touch-friendly input heights (44pt)

### Desktop (≥768px)
- Fixed max-width 400px
- Centered with equal margins

---

## Accessibility

- All inputs have visible labels
- `aria-live="polite"` for error announcements
- Focus moves to first invalid field on error
- Password toggle announces state change
- Keyboard: Tab through fields, Enter to submit
- High contrast text (4.5:1 minimum)