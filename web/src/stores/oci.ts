import { create } from 'zustand'
import { ociApi } from '../api'
import type { OciRepository, OciTagInfo, OciCacheStats } from '../types'

interface OciState {
  repositories: OciRepository[]
  tags: OciTagInfo[]
  stats: OciCacheStats | null
  selectedRepo: string | null
  page: number
  pageSize: number
  search: string
  loading: boolean
  tagsLoading: boolean
  statsLoading: boolean
  error: string | null
}

interface OciActions {
  fetchRepositories: (page?: number, pageSize?: number, search?: string) => Promise<void>
  fetchTags: (name: string) => Promise<void>
  fetchStats: () => Promise<void>
  deleteRepo: (id: number) => Promise<boolean>
  cleanCache: () => Promise<boolean>
  setSearch: (search: string) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  selectRepo: (name: string | null) => void
  clearError: () => void
  reset: () => void
}

type OciStore = OciState & OciActions

const initialState: OciState = {
  repositories: [],
  tags: [],
  stats: null,
  selectedRepo: null,
  page: 1,
  pageSize: 20,
  search: '',
  loading: false,
  tagsLoading: false,
  statsLoading: false,
  error: null,
}

export const useOciStore = create<OciStore>((set, get) => ({
  ...initialState,

  fetchRepositories: async (page?, pageSize?, search?) => {
    const state = get()
    const p = page ?? state.page
    const ps = pageSize ?? state.pageSize
    const s = search ?? state.search

    set({ loading: true, error: null, page: p, pageSize: ps, search: s })
    try {
      const res = await ociApi.listRepos(p, ps, s)
      set({
        repositories: res.data.data ?? [],
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch repositories',
        loading: false,
      })
    }
  },

  fetchTags: async (name: string) => {
    set({ tagsLoading: true, error: null })
    try {
      const res = await ociApi.listTags(name)
      set({
        tags: res.data.data ?? [],
        tagsLoading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch tags',
        tagsLoading: false,
      })
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true })
    try {
      const res = await ociApi.getStats()
      set({
        stats: res.data.data,
        statsLoading: false,
      })
    } catch (err: any) {
      set({
        statsLoading: false,
      })
    }
  },

  deleteRepo: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await ociApi.deleteRepo(id)
      get().fetchRepositories()
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to delete repository',
        loading: false,
      })
      return false
    }
  },

  cleanCache: async () => {
    set({ loading: true, error: null })
    try {
      await ociApi.cleanCache()
      get().fetchStats()
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to clean cache',
        loading: false,
      })
      return false
    }
  },

  setSearch: (search: string) => {
    set({ search })
    get().fetchRepositories(1, undefined, search)
  },

  setPage: (page: number) => {
    set({ page })
    get().fetchRepositories(page)
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 })
    get().fetchRepositories(1, pageSize)
  },

  selectRepo: (name: string | null) => {
    set({ selectedRepo: name, tags: [] })
    if (name) {
      get().fetchTags(name)
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useOciRepositories = () => useOciStore((state) => state.repositories)
export const useOciTags = () => useOciStore((state) => state.tags)
export const useOciStats = () => useOciStore((state) => state.stats)
export const useOciLoading = () => useOciStore((state) => state.loading)