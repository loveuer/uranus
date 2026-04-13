# User Management Page Design

## Overview

Admin-only user management page with create, edit, delete, and password reset functionality.

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ Users ──────────────────────────────────────────────────────────────   │
│ User account management                                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Total    │  │ Admins   │  │ Active   │  │ Today    │                │
│  │ 12       │  │ 2        │  │ 10       │  │ +1       │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Users ──────────────────────────────────────────────────────   │    │
│  │                 [Search] 🔍           [+ Create User]          │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                │    │
│  │  Username   Email          Role     Status    Created      ⋮  │    │
│  │  ───────────────────────────────────────────────────────────── │    │
│  │  admin      admin@corp     Admin    Active    2024-01-01  ⋮  │    │
│  │  developer  dev@corp       User     Active    2024-01-10  ⋮  │    │
│  │  ops        ops@corp       User     Active    2024-01-12  ⋮  │    │
│  │  guest      guest@corp     User     Disabled  2024-01-15  ⋮  │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

User actions dropdown:
│  │  guest      guest@corp     User     Disabled  2024-01-15  ⋮  │    │
│  │  ─────────────────────────────────────────────────────────────    │    │
│  │  ├ Edit                                                        │    │
│  │  ├ Reset Password                                              │    │
│  │  ├ Enable/Disable                                              │    │
│  │  ├ Set Admin Role                                              │    │
│  │  └ Delete (destructive)                                       │    │
│  │  ─────────────────────────────────────────────────────────────    │    │

Create/Edit User Dialog:
┌────────────────────────────────────────────────────────────────────────┐
│ Create User ────────────────────────────────────────────────────────   │
│                                                        [×]            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Username                                                              │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [__________________]                                            │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Email                                                                 │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [__________________]                                            │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Password                                                              │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [__________________] 👁                                         │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Role                                                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [User ▼]                                                        │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│                                [Cancel]  [Create User]                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```tsx
function UsersPage() {
  const { users, createUser, updateUser, deleteUser, resetPassword } = useUsersStore()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">User account management</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Users" value={total} icon={<Users />} />
        <StatsCard title="Admins" value={admins} icon={<Shield />} />
        <StatsCard title="Active" value={active} icon={<CheckCircle />} />
        <StatsCard title="Created Today" value={today} icon={<UserPlus />} />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Users</CardTitle>
            <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={users} />
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Edit User Dialog */}
      <EditUserDialog open={editOpen} user={selectedUser} onClose={() => setEditOpen(false)} />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog open={resetOpen} user={selectedUser} onClose={() => setResetOpen(false)} />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete User"
        description={`Are you sure you want to delete ${selectedUser?.username}? This action cannot be undone.`}
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}
```

---

## Table Columns

```tsx
const columns: ColumnDef<User>[] = [
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{row.original.username[0]}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{row.original.username}</span>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "is_admin",
    header: "Role",
    cell: ({ row }) => (
      <Badge variant={row.original.is_admin ? "default" : "secondary"}>
        {row.original.is_admin ? "Admin" : "User"}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.disabled ? "outline" : "default"}>
        {row.original.disabled ? "Disabled" : "Active"}
      </Badge>
    ),
  },
  {
    accessorKey: "created",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.created),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => openEdit(row.original)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openReset(row.original)}>
            <Key className="mr-2 h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleStatus(row.original)}>
            {row.original.disabled ? (
              <><CheckCircle className="mr-2 h-4 w-4" /> Enable</>
            ) : (
              <><XCircle className="mr-2 h-4 w-4" /> Disable</>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleAdmin(row.original)}>
            <Shield className="mr-2 h-4 w-4" />
            {row.original.is_admin ? "Remove Admin" : "Set Admin"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openDelete(row.original)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
```

---

## Create User Dialog

```tsx
function CreateUserDialog({ open, onClose }) {
  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", email: "", password: "", is_admin: false },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(createUser)} className="space-y-4">
            <FormField name="username" render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl><PasswordInput {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="is_admin" render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel>Admin Role</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit">Create User</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Create user** | Dialog with form validation |
| **Edit user** | Modify username, email, role |
| **Reset password** | Admin password reset |
| **Enable/disable** | Toggle user status |
| **Role management** | Set/remove admin role |
| **Delete** | Destructive action with confirmation |
| **Search** | Filter users by username/email |
| **Avatar** | User avatar with initials fallback |