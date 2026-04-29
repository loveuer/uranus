import { create } from 'zustand'
import { userApi } from '../api'
import type { User } from '../types'

interface UsersState {
  users: User[]
  total: number
  page: number
  pageSize: number
  search: string
  selectedUser: User | null
  loading: boolean
  creating: boolean
  updating: boolean
  deleting: boolean
  error: string | null
}

interface UsersActions {
  fetchUsers: (page?: number, pageSize?: number) => Promise<void>
  getUser: (id: number) => Promise<void>
  createUser: (data: { username: string; password: string; email?: string; is_admin?: boolean }) => Promise<User | null>
  updateUser: (id: number, data: Partial<User> & { password?: string }) => Promise<boolean>
  resetPassword: (id: number, password: string) => Promise<boolean>
  deleteUser: (id: number) => Promise<boolean>
  setSearch: (search: string) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  selectUser: (user: User | null) => void
  clearError: () => void
  reset: () => void
}

type UsersStore = UsersState & UsersActions

const initialState: UsersState = {
  users: [],
  total: 0,
  page: 1,
  pageSize: 20,
  search: '',
  selectedUser: null,
  loading: false,
  creating: false,
  updating: false,
  deleting: false,
  error: null,
}

export const useUsersStore = create<UsersStore>((set, get) => ({
  ...initialState,

  fetchUsers: async (page?, pageSize?) => {
    const state = get()
    const p = page ?? state.page
    const ps = pageSize ?? state.pageSize

    set({ loading: true, error: null, page: p, pageSize: ps })
    try {
      const res = await userApi.list(p, ps)
      set({
        users: res.data.data?.items ?? [],
        total: res.data.data?.total ?? 0,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch users',
        loading: false,
      })
    }
  },

  getUser: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const res = await userApi.get(id)
      set({
        selectedUser: res.data.data,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch user',
        loading: false,
      })
    }
  },

  createUser: async (data) => {
    set({ creating: true, error: null })
    try {
      const res = await userApi.create(data)
      get().fetchUsers()
      set({ creating: false })
      return res.data.data
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to create user',
        creating: false,
      })
      return null
    }
  },

  updateUser: async (id: number, data) => {
    set({ updating: true, error: null })
    try {
      await userApi.update(id, data)
      get().fetchUsers()
      set({ updating: false })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to update user',
        updating: false,
      })
      return false
    }
  },

  resetPassword: async (id: number, password: string) => {
    set({ updating: true, error: null })
    try {
      await userApi.resetPassword(id, password)
      set({ updating: false })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to reset password',
        updating: false,
      })
      return false
    }
  },

  deleteUser: async (id: number) => {
    set({ deleting: true, error: null })
    try {
      await userApi.delete(id)
      await get().fetchUsers()
      set({ deleting: false })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to delete user',
        deleting: false,
      })
      return false
    }
  },

  setSearch: (search: string) => {
    set({ search })
    // Filter locally since API doesn't support search
    const state = get()
    if (search) {
      const filtered = state.users.filter(
        (u) => u.username.includes(search) || (u.email && u.email.includes(search))
      )
      set({ users: filtered })
    } else {
      get().fetchUsers()
    }
  },

  setPage: (page: number) => {
    set({ page })
    get().fetchUsers(page)
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 })
    get().fetchUsers(1, pageSize)
  },

  selectUser: (user: User | null) => set({ selectedUser: user }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useUsers = () => useUsersStore((state) => state.users)
export const useUsersLoading = () => useUsersStore((state) => state.loading)
export const useSelectedUser = () => useUsersStore((state) => state.selectedUser)