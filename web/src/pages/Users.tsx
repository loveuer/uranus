import { useEffect, useState } from 'react'
import { useUsersStore } from '@/stores/users'
import { useIsAdmin, useUser } from '@/stores/auth'
import { toast } from '@/stores/ui'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Users, Shield, CheckCircle, UserPlus, MoreHorizontal, Edit, Key, Trash2, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function UsersPage() {
  const { fetchUsers, createUser, updateUser, resetPassword, deleteUser, selectUser, users, loading, selectedUser, creating, updating, deleting } = useUsersStore()
  const isAdmin = useIsAdmin()
  const currentUser = useUser()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_admin: false,
  })

  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const columns = [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{row.original.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.original.username}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (info: any) => <span className="text-muted-foreground">{info.getValue() || '-'}</span>,
    },
    {
      accessorKey: 'is_admin',
      header: 'Role',
      cell: (info: any) => (
        <Badge variant={info.getValue() ? "default" : "secondary"}>
          {info.getValue() ? 'Admin' : 'User'}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => (
        <Badge variant={info.getValue() === 1 ? "default" : "outline"}>
          {info.getValue() === 1 ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: (info: any) => <span className="text-sm text-muted-foreground">{formatDate(info.getValue())}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }: any) => {
        const isSelf = row.original.id === currentUser?.id
        const isTargetAdmin = row.original.is_admin
        const canDelete = !isSelf && !isTargetAdmin
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { selectUser(row.original); setFormData({ username: row.original.username, email: row.original.email || '', password: '', is_admin: row.original.is_admin || false }); setEditDialogOpen(true) }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { selectUser(row.original); setNewPassword(''); setResetPasswordDialogOpen(true) }}>
                <Key className="mr-2 h-4 w-4" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { selectUser(row.original); setDeleteDialogOpen(true) }}
                disabled={!canDelete}
                className="text-destructive"
                title={isSelf ? 'Cannot delete yourself' : isTargetAdmin ? 'Revoke admin role first' : undefined}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const handleCreate = async () => {
    const result = await createUser(formData)
    if (result) {
      setCreateDialogOpen(false)
      setFormData({ username: '', email: '', password: '', is_admin: false })
    }
  }

  const handleUpdate = async () => {
    if (selectedUser) {
      const success = await updateUser(selectedUser.id, formData)
      if (success) {
        setEditDialogOpen(false)
      }
    }
  }

  const handleResetPassword = async () => {
    if (selectedUser && newPassword) {
      const success = await resetPassword(selectedUser.id, newPassword)
      if (success) {
        setResetPasswordDialogOpen(false)
        setNewPassword('')
      }
    }
  }

  const handleDelete = async () => {
    if (selectedUser) {
      const success = await deleteUser(selectedUser.id)
      if (success) {
        setDeleteDialogOpen(false)
      } else {
        const errMsg = useUsersStore.getState().error || 'Failed to delete user'
        toast.error(errMsg)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">User account management</p>
        </div>
        <Button onClick={() => { setFormData({ username: '', email: '', password: '', is_admin: false }); setCreateDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Users" value={users.length} icon={<Users />} />
        <StatsCard title="Admins" value={users.filter((u: any) => u.is_admin).length} icon={<Shield />} />
        <StatsCard title="Active" value={users.filter((u: any) => u.status === 1).length} icon={<CheckCircle />} />
        <StatsCard title="Created Today" value={0} icon={<UserPlus />} />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={users} loading={loading} />
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Admin Role</Label>
              <Switch checked={formData.is_admin} onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave empty to keep current)</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Admin Role</Label>
              <Switch checked={formData.is_admin} onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updating}>{updating ? 'Updating...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {selectedUser?.username}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={updating}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete User"
        description={`Are you sure you want to delete ${selectedUser?.username}? This action cannot be undone.`}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  )
}