import { create } from 'zustand'
import { gcApi } from '../api'
import type { GcStatus, GcCandidate, GcResult, GcUnreferencedBlobs } from '../types'

interface GcState {
  candidates: GcCandidate[]
  history: GcStatus[]
  unreferenced: GcUnreferencedBlobs | null
  autoStatus: { running: boolean } | null
  lastResult: GcResult | null
  loading: boolean
  running: boolean
  error: string | null
}

interface GcActions {
  fetchCandidates: () => Promise<void>
  fetchHistory: (limit?: number) => Promise<void>
  fetchUnreferenced: () => Promise<void>
  fetchAutoStatus: () => Promise<void>
  runGc: () => Promise<boolean>
  dryRun: () => Promise<GcResult | null>
  restore: (id: number) => Promise<boolean>
  clearError: () => void
  reset: () => void
}

type GcStore = GcState & GcActions

const initialState: GcState = {
  candidates: [],
  history: [],
  unreferenced: null,
  autoStatus: null,
  lastResult: null,
  loading: false,
  running: false,
  error: null,
}

export const useGcStore = create<GcStore>((set, get) => ({
  ...initialState,

  fetchCandidates: async () => {
    set({ loading: true, error: null })
    try {
      const res = await gcApi.getCandidates()
      set({
        candidates: res.data.data ?? [],
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch candidates',
        loading: false,
      })
    }
  },

  fetchHistory: async (limit = 10) => {
    set({ loading: true, error: null })
    try {
      const res = await gcApi.getStatus(limit)
      set({
        history: res.data.data ?? [],
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch history',
        loading: false,
      })
    }
  },

  fetchUnreferenced: async () => {
    set({ loading: true, error: null })
    try {
      const res = await gcApi.getUnreferenced()
      set({
        unreferenced: res.data.data,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch unreferenced blobs',
        loading: false,
      })
    }
  },

  fetchAutoStatus: async () => {
    try {
      const res = await gcApi.getAutoStatus()
      set({ autoStatus: res.data.data })
    } catch (err: any) {
      // Ignore auto status errors
    }
  },

  runGc: async () => {
    set({ running: true, error: null })
    try {
      await gcApi.run()
      get().fetchCandidates()
      get().fetchHistory()
      set({ running: false })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to run GC',
        running: false,
      })
      return false
    }
  },

  dryRun: async () => {
    set({ loading: true, error: null })
    try {
      const res = await gcApi.dryRun()
      set({
        lastResult: res.data.data,
        loading: false,
      })
      return res.data.data
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to run dry run',
        loading: false,
      })
      return null
    }
  },

  restore: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await gcApi.restore(id)
      get().fetchCandidates()
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to restore blob',
        loading: false,
      })
      return false
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useGcCandidates = () => useGcStore((state) => state.candidates)
export const useGcHistory = () => useGcStore((state) => state.history)
export const useGcUnreferenced = () => useGcStore((state) => state.unreferenced)
export const useGcAutoStatus = () => useGcStore((state) => state.autoStatus)
export const useGcRunning = () => useGcStore((state) => state.running)
export const useGcLoading = () => useGcStore((state) => state.loading)