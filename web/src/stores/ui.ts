import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean

  // Theme
  theme: 'light' | 'dark' | 'system'
  resolvedTheme: 'light' | 'dark'

  // Loading states
  globalLoading: boolean
  loadingText: string

  // Notifications/Toast
  toasts: Toast[]

  // Dialogs/Modals
  activeDialog: string | null
}

interface UIActions {
  // Sidebar
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarMobileOpen: (open: boolean) => void

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Loading
  setGlobalLoading: (loading: boolean, text?: string) => void

  // Toasts
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void

  // Dialogs
  openDialog: (dialogId: string) => void
  closeDialog: () => void
}

type UIStore = UIState & UIActions

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

const initialState: UIState = {
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  theme: 'light',
  resolvedTheme: 'light',
  globalLoading: false,
  loadingText: '',
  toasts: [],
  activeDialog: null,
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Sidebar actions
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed })
      },

      setSidebarMobileOpen: (open: boolean) => {
        set({ sidebarMobileOpen: open })
      },

      // Theme actions
      setTheme: (theme: 'light' | 'dark' | 'system') => {
        const resolvedTheme = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme

        set({ theme, resolvedTheme })

        // Apply theme to document
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(resolvedTheme)
      },

      // Loading actions
      setGlobalLoading: (loading: boolean, text = '') => {
        set({ globalLoading: loading, loadingText: text })
      },

      // Toast actions
      addToast: (toast) => {
        const id = generateId()
        const newToast = { ...toast, id }
        set((state) => ({ toasts: [...state.toasts, newToast] }))

        // Auto remove after duration
        const duration = toast.duration ?? 5000
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, duration)
        }
      },

      removeToast: (id: string) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      },

      clearToasts: () => {
        set({ toasts: [] })
      },

      // Dialog actions
      openDialog: (dialogId: string) => {
        set({ activeDialog: dialogId })
      },

      closeDialog: () => {
        set({ activeDialog: null })
      },
    }),
    {
      name: 'uranus-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          const resolvedTheme = state.theme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : state.theme
          state.resolvedTheme = resolvedTheme

          const root = document.documentElement
          root.classList.remove('light', 'dark')
          root.classList.add(resolvedTheme)
        }
      },
    }
  )
)

// Selector hooks
export const useSidebarCollapsed = () => useUIStore((state) => state.sidebarCollapsed)
export const useSidebarMobileOpen = () => useUIStore((state) => state.sidebarMobileOpen)
export const useTheme = () => useUIStore((state) => state.theme)
export const useResolvedTheme = () => useUIStore((state) => state.resolvedTheme)
export const useGlobalLoading = () => useUIStore((state) => state.globalLoading)
export const useToasts = () => useUIStore((state) => state.toasts)

// Toast helper functions
export const toast = {
  success: (title: string, description?: string) =>
    useUIStore.getState().addToast({ type: 'success', title, description }),
  error: (title: string, description?: string) =>
    useUIStore.getState().addToast({ type: 'error', title, description }),
  warning: (title: string, description?: string) =>
    useUIStore.getState().addToast({ type: 'warning', title, description }),
  info: (title: string, description?: string) =>
    useUIStore.getState().addToast({ type: 'info', title, description }),
}