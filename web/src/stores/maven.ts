import { create } from 'zustand'
import { mavenApi } from '../api'
import type { MavenArtifact, MavenRepository, MavenRepositoryConfig } from '../types'

interface MavenState {
  artifacts: MavenArtifact[]
  repositories: MavenRepository[]
  versions: string[]
  selectedArtifact: MavenArtifact | null
  page: number
  pageSize: number
  search: string
  groupId: string
  artifactId: string
  loading: boolean
  reposLoading: boolean
  versionsLoading: boolean
  error: string | null
}

interface MavenActions {
  fetchArtifacts: (page?: number, pageSize?: number, groupId?: string, artifactId?: string) => Promise<void>
  searchArtifacts: (q: string) => Promise<void>
  fetchVersions: (groupId: string, artifactId: string) => Promise<void>
  fetchRepositories: () => Promise<void>
  addRepository: (data: MavenRepositoryConfig) => Promise<boolean>
  updateRepository: (id: number, data: MavenRepositoryConfig) => Promise<boolean>
  deleteRepository: (id: number) => Promise<boolean>
  setSearch: (search: string) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  selectArtifact: (artifact: MavenArtifact | null) => void
  clearError: () => void
  reset: () => void
}

type MavenStore = MavenState & MavenActions

const initialState: MavenState = {
  artifacts: [],
  repositories: [],
  versions: [],
  selectedArtifact: null,
  page: 1,
  pageSize: 20,
  search: '',
  groupId: '',
  artifactId: '',
  loading: false,
  reposLoading: false,
  versionsLoading: false,
  error: null,
}

export const useMavenStore = create<MavenStore>((set, get) => ({
  ...initialState,

  fetchArtifacts: async (page?, pageSize?, groupId?, artifactId?) => {
    const state = get()
    const p = page ?? state.page
    const ps = pageSize ?? state.pageSize
    const gid = groupId ?? state.groupId
    const aid = artifactId ?? state.artifactId

    set({ loading: true, error: null, page: p, pageSize: ps, groupId: gid, artifactId: aid })
    try {
      const res = await mavenApi.listArtifacts(p, ps, gid, aid)
      set({
        artifacts: res.data.data ?? [],
        loading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch artifacts',
        loading: false,
      })
    }
  },

  searchArtifacts: async (q: string) => {
    set({ loading: true, error: null, search: q })
    try {
      const res = await mavenApi.searchArtifacts(q, 1, get().pageSize)
      set({
        artifacts: res.data.data ?? [],
        loading: false,
        page: 1,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to search artifacts',
        loading: false,
      })
    }
  },

  fetchVersions: async (groupId: string, artifactId: string) => {
    set({ versionsLoading: true, error: null })
    try {
      const res = await mavenApi.getVersions(groupId, artifactId)
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

  fetchRepositories: async () => {
    set({ reposLoading: true, error: null })
    try {
      const res = await mavenApi.listRepositories()
      set({
        repositories: res.data.data ?? [],
        reposLoading: false,
      })
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to fetch repositories',
        reposLoading: false,
      })
    }
  },

  addRepository: async (data: MavenRepositoryConfig) => {
    set({ loading: true, error: null })
    try {
      await mavenApi.addRepository(data)
      get().fetchRepositories()
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to add repository',
        loading: false,
      })
      return false
    }
  },

  updateRepository: async (id: number, data: MavenRepositoryConfig) => {
    set({ loading: true, error: null })
    try {
      await mavenApi.updateRepository(id, data)
      get().fetchRepositories()
      return true
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to update repository',
        loading: false,
      })
      return false
    }
  },

  deleteRepository: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await mavenApi.deleteRepository(id)
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

  setSearch: (search: string) => {
    if (search) {
      get().searchArtifacts(search)
    } else {
      get().fetchArtifacts(1)
    }
  },

  setPage: (page: number) => {
    set({ page })
    get().fetchArtifacts(page)
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 })
    get().fetchArtifacts(1, pageSize)
  },

  selectArtifact: (artifact: MavenArtifact | null) => {
    set({ selectedArtifact: artifact, versions: [] })
    if (artifact) {
      get().fetchVersions(artifact.group_id, artifact.artifact_id)
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))

// Selector hooks
export const useMavenArtifacts = () => useMavenStore((state) => state.artifacts)
export const useMavenRepositories = () => useMavenStore((state) => state.repositories)
export const useMavenVersions = () => useMavenStore((state) => state.versions)
export const useMavenLoading = () => useMavenStore((state) => state.loading)