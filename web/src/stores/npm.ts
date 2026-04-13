import { create } from 'zustand'
import { npmApi } from '../api'
import type { NpmPackage, NpmVersion } from '../types'

interface NpmState {
  packages: NpmPackage[]
  total: number
  page: number
  pageSize: number
  search: string
  versions: NpmVersion[]
  selectedPackage: string | null
  loading: boolean
  versionsLoading: boolean
  error: string | null
}

interface NpmActions {
  fetchPackages: (page?: number, pageSize?: number, search?: string) => Promise<void>
  fetchVersions: (name: string) => Promise<void>
  setSearch: (search: string) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  selectPackage: (name: string | null) => void
  clearError: () => void
  reset: () => void
}

type NpmStore = NpmState & NpmActions

const initialState: NpmState = {
  packages: [],
  total: 0,
  page: 1,
  pageSize: 20,
  search: '',
  versions: [],
  selectedPackage: null,
  loading: false,
  versionsLoading: false,
  error: null,
}

export const useNpmStore = create<NpmStore>((set, get) => ({
  ...initialState,

  fetchPackages: async (page?, pageSize?, search?) => {
    const state = get()
    const p = page ?? state.page
    const ps = pageSize ?? state.pageSize
    const s = search ?? state.search

    set({ loading: true, error: null, page: p, pageSize: ps, search: s })
    try {
      const res = await npmApi.listPackages(p, ps, s)
      set({
        packages: res.data.data ?? [],
        total: res.data.data?.length ?? 0,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch packages',
        loading: false,
      })
    }
  },

  fetchVersions: async (name: string) => {
    set({ versionsLoading: true, error: null })
    try {
      const res = await npmApi.listVersions(name)
      set({
        versions: res.data.data ?? [],
        versionsLoading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch versions',
        versionsLoading: false,
      })
    }
  },

  setSearch: (search: string) => {
    set({ search })
    get().fetchPackages(1, undefined, search)
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
    set({ selectedPackage: name, versions: [] })
    if (name) {
      get().fetchVersions(name)
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useNpmPackages = () => useNpmStore((state) => state.packages)
export const useNpmLoading = () => useNpmStore((state) => state.loading)
export const useNpmVersions = () => useNpmStore((state) => state.versions)
export const useNpmSelectedPackage = () => useNpmStore((state) => state.selectedPackage)