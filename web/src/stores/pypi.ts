import { create } from 'zustand'
import { pypiApi } from '../api'
import type { PyPIPackage } from '../types'

interface PyPIState {
  packages: PyPIPackage[]
  total: number
  stats: { packages: number; cached: number; size: number; downloads: number } | null
  selectedPackage: PyPIPackage | null
  page: number
  pageSize: number
  loading: boolean
  statsLoading: boolean
  deleting: boolean
  error: string | null
}

interface PyPIActions {
  fetchPackages: (page?: number, pageSize?: number) => Promise<void>
  fetchStats: () => Promise<void>
  fetchPackageDetail: (name: string) => Promise<void>
  deletePackage: (name: string) => Promise<boolean>
  deleteVersion: (name: string, version: string) => Promise<boolean>
  cleanCache: () => Promise<boolean>
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  selectPackage: (name: string | null) => void
  clearError: () => void
  reset: () => void
}

type PyPIStore = PyPIState & PyPIActions

const initialState: PyPIState = {
  packages: [],
  total: 0,
  stats: null,
  selectedPackage: null,
  page: 1,
  pageSize: 20,
  loading: false,
  statsLoading: false,
  deleting: false,
  error: null,
}

export const usePyPIStore = create<PyPIStore>((set, get) => ({
  ...initialState,

  fetchPackages: async (page?, pageSize?) => {
    const state = get()
    const p = page ?? state.page
    const ps = pageSize ?? state.pageSize

    set({ loading: true, error: null, page: p, pageSize: ps })
    try {
      const res = await pypiApi.listPackages(p, ps)
      set({
        packages: res.data.data?.packages ?? [],
        total: res.data.data?.total ?? 0,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch packages',
        loading: false,
      })
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true })
    try {
      const res = await pypiApi.getStats()
      set({
        stats: res.data.data,
        statsLoading: false,
      })
    } catch (err: any) {
      set({ statsLoading: false })
    }
  },

  fetchPackageDetail: async (name: string) => {
    set({ loading: true, error: null })
    try {
      const res = await pypiApi.getPackageDetail(name)
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

  deletePackage: async (name: string) => {
    set({ deleting: true, error: null })
    try {
      await pypiApi.deletePackage(name)
      get().fetchPackages()
      get().fetchStats()
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to delete package',
        deleting: false,
      })
      return false
    }
  },

  deleteVersion: async (name: string, version: string) => {
    set({ deleting: true, error: null })
    try {
      await pypiApi.deleteVersion(name, version)
      get().fetchPackageDetail(name)
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to delete version',
        deleting: false,
      })
      return false
    }
  },

  cleanCache: async () => {
    set({ loading: true, error: null })
    try {
      await pypiApi.cleanCache()
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

  setPage: (page: number) => {
    set({ page })
    get().fetchPackages(page)
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 })
    get().fetchPackages(1, pageSize)
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
export const usePyPIPackages = () => usePyPIStore((state) => state.packages)
export const usePyPIStats = () => usePyPIStore((state) => state.stats)
export const usePyPILoading = () => usePyPIStore((state) => state.loading)
export const usePyPISelectedPackage = () => usePyPIStore((state) => state.selectedPackage)