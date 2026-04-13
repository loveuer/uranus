import { create } from 'zustand'
import { alpineApi } from '../api'
import type { AlpinePackage, AlpineCacheStats } from '../types'

interface AlpineState {
  packages: AlpinePackage[]
  stats: AlpineCacheStats | null
  selectedPackage: AlpinePackage | null
  branch: string
  repo: string
  arch: string
  search: string
  loading: boolean
  statsLoading: boolean
  syncing: boolean
  error: string | null
}

interface AlpineActions {
  fetchPackages: (branch?: string, repo?: string, arch?: string) => Promise<void>
  searchPackages: (q: string) => Promise<void>
  fetchStats: () => Promise<void>
  fetchPackageDetail: (name: string) => Promise<void>
  sync: (branch?: string, repo?: string, arch?: string) => Promise<boolean>
  cleanCache: () => Promise<boolean>
  setBranch: (branch: string) => void
  setRepo: (repo: string) => void
  setArch: (arch: string) => void
  setSearch: (search: string) => void
  selectPackage: (name: string | null) => void
  clearError: () => void
  reset: () => void
}

type AlpineStore = AlpineState & AlpineActions

const initialState: AlpineState = {
  packages: [],
  stats: null,
  selectedPackage: null,
  branch: 'v3.19',
  repo: 'main',
  arch: 'x86_64',
  search: '',
  loading: false,
  statsLoading: false,
  syncing: false,
  error: null,
}

export const useAlpineStore = create<AlpineStore>((set, get) => ({
  ...initialState,

  fetchPackages: async (branch?, repo?, arch?) => {
    const state = get()
    const b = branch ?? state.branch
    const r = repo ?? state.repo
    const a = arch ?? state.arch

    set({ loading: true, error: null, branch: b, repo: r, arch: a })
    try {
      const res = await alpineApi.listPackages(b, r, a)
      set({
        packages: res.data.data ?? [],
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch packages',
        loading: false,
      })
    }
  },

  searchPackages: async (q: string) => {
    if (!q) {
      get().fetchPackages()
      return
    }
    const state = get()
    set({ loading: true, error: null, search: q })
    try {
      const res = await alpineApi.searchPackages(q, state.branch, state.repo, state.arch)
      set({
        packages: res.data.data ?? [],
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to search packages',
        loading: false,
      })
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true })
    try {
      const res = await alpineApi.getStats()
      set({
        stats: res.data.data,
        statsLoading: false,
      })
    } catch (err: any) {
      set({ statsLoading: false })
    }
  },

  fetchPackageDetail: async (name: string) => {
    const state = get()
    set({ loading: true, error: null })
    try {
      const res = await alpineApi.getPackageDetail(name, state.branch, state.repo, state.arch)
      set({
        selectedPackage: res.data.data,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch package details',
        loading: false,
      })
    }
  },

  sync: async (branch?, repo?, arch?) => {
    set({ syncing: true, error: null })
    try {
      await alpineApi.sync(branch, repo, arch)
      get().fetchPackages()
      get().fetchStats()
      set({ syncing: false })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to sync packages',
        syncing: false,
      })
      return false
    }
  },

  cleanCache: async () => {
    set({ loading: true, error: null })
    try {
      await alpineApi.cleanCache()
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

  setBranch: (branch: string) => {
    set({ branch })
    get().fetchPackages(branch)
  },

  setRepo: (repo: string) => {
    set({ repo })
    get().fetchPackages(undefined, repo)
  },

  setArch: (arch: string) => {
    set({ arch })
    get().fetchPackages(undefined, undefined, arch)
  },

  setSearch: (search: string) => {
    get().searchPackages(search)
  },

  selectPackage: (name: string | null) => {
    set({ selectedPackage: null })
    if (name) {
      get().fetchPackageDetail(name)
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useAlpinePackages = () => useAlpineStore((state) => state.packages)
export const useAlpineStats = () => useAlpineStore((state) => state.stats)
export const useAlpineLoading = () => useAlpineStore((state) => state.loading)
export const useAlpineBranch = () => useAlpineStore((state) => state.branch)
export const useAlpineRepo = () => useAlpineStore((state) => state.repo)
export const useAlpineArch = () => useAlpineStore((state) => state.arch)