import { create } from 'zustand'
import { settingApi } from '../api'

interface SettingsState {
  settings: Record<string, string>
  loading: boolean
  saving: boolean
  error: string | null
}

interface SettingsActions {
  fetchSettings: () => Promise<void>
  updateSettings: (data: Record<string, string>) => Promise<boolean>
  setSetting: (key: string, value: string) => void
  clearError: () => void
  reset: () => void
}

type SettingsStore = SettingsState & SettingsActions

const initialState: SettingsState = {
  settings: {},
  loading: false,
  saving: false,
  error: null,
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initialState,

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      const res = await settingApi.getAll()
      set({
        settings: res.data.data ?? {},
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch settings',
        loading: false,
      })
    }
  },

  updateSettings: async (data: Record<string, string>) => {
    set({ saving: true, error: null })
    try {
      await settingApi.update(data)
      set({
        settings: { ...get().settings, ...data },
        saving: false,
      })
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to update settings',
        saving: false,
      })
      return false
    }
  },

  setSetting: (key: string, value: string) => {
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }))
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useSettings = () => useSettingsStore((state) => state.settings)
export const useSettingsLoading = () => useSettingsStore((state) => state.loading)
export const useSettingsSaving = () => useSettingsStore((state) => state.saving)

// Helper to get specific setting
export const useSetting = (key: string) => useSettingsStore((state) => state.settings[key])