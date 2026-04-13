import { create } from 'zustand'
import { goApi } from '../api'
import type { GoCacheStats } from '../types'

interface GoState {
  stats: GoCacheStats | null
  loading: boolean
  cleaning: boolean
  error: string | null
}

interface GoActions {
  fetchStats: () => Promise<void>
  cleanCache: () => Promise<boolean>
  clearError: () => void
  reset: () => void
}

type GoStore = GoState & GoActions

const initialState: GoState = {
  stats: null,
  loading: false,
  cleaning: false,
  error: null,
}

export const useGoStore = create<GoStore>((set, get) => ({
  ...initialState,

  fetchStats: async () => {
    set({ loading: true, error: null })
    try {
      const res = await goApi.getStats()
      set({
        stats: res.data.data,
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch stats',
        loading: false,
      })
    }
  },

  cleanCache: async () => {
    set({ cleaning: true, error: null })
    try {
      await goApi.cleanCache()
      get().fetchStats()
      set({ cleaning: false })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to clean cache',
        cleaning: false,
      })
      return false
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useGoStats = () => useGoStore((state) => state.stats)
export const useGoLoading = () => useGoStore((state) => state.loading)