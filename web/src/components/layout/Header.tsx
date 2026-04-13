import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  Key,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUser, useAuthStore } from '@/stores/auth'
import { useUIStore, useResolvedTheme } from '@/stores/ui'
import { authApi } from '@/api'

export function Header() {
  const navigate = useNavigate()
  const user = useUser()
  const logout = useAuthStore((state) => state.logout)
  const setMobileOpen = useUIStore((state) => state.setSidebarMobileOpen)
  const resolvedTheme = useResolvedTheme()
  const setTheme = useUIStore((state) => state.setTheme)

  // Password change dialog state
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [pwdData, setPwdData] = React.useState({ old: '', new_: '', confirm: '' })
  const [pwdError, setPwdError] = React.useState('')
  const [pwdSuccess, setPwdSuccess] = React.useState(false)
  const [pwdLoading, setPwdLoading] = React.useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleChangePwd = async () => {
    setPwdError('')
    if (!pwdData.old || !pwdData.new_) {
      setPwdError('All fields are required')
      return
    }
    if (pwdData.new_.length < 6) {
      setPwdError('New password must be at least 6 characters')
      return
    }
    if (pwdData.new_ !== pwdData.confirm) {
      setPwdError('Passwords do not match')
      return
    }

    setPwdLoading(true)
    try {
      await authApi.changePassword(pwdData.old, pwdData.new_)
      setPwdSuccess(true)
      setTimeout(() => {
        setPwdOpen(false)
        setPwdSuccess(false)
        setPwdData({ old: '', new_: '', confirm: '' })
      }, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwdError(msg || 'Failed to change password')
    } finally {
      setPwdLoading(false)
    }
  }

  const closePwdDialog = () => {
    setPwdOpen(false)
    setPwdError('')
    setPwdSuccess(false)
    setPwdData({ old: '', new_: '', confirm: '' })
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left: Logo + Mobile menu toggle */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/uranus-icon.png" alt="Uranus" className="h-8 w-8" />
              <span className="font-semibold text-foreground hidden md:inline">Uranus</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Right: Actions + User menu */}
          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {user?.username?.[0]?.toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm font-medium">
                    {user?.username}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.is_admin ? 'Administrator' : 'User'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPwdOpen(true)}>
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Change password dialog */}
      <Dialog open={pwdOpen} onOpenChange={(open) => !open && closePwdDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pwdError && (
              <Alert variant="destructive">
                <AlertDescription>{pwdError}</AlertDescription>
              </Alert>
            )}
            {pwdSuccess && (
              <Alert className="border-success/50 text-success bg-success/10">
                <AlertDescription>Password changed successfully!</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={pwdData.old}
                onChange={(e) => setPwdData({ ...pwdData, old: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={pwdData.new_}
                onChange={(e) => setPwdData({ ...pwdData, new_: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={pwdData.confirm}
                onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePwdDialog} disabled={pwdLoading}>
              Cancel
            </Button>
            <Button onClick={handleChangePwd} disabled={pwdLoading || pwdSuccess}>
              {pwdLoading && (
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}