import { create } from 'zustand'
import type { HdfsConnection, HdfsEntry, ParquetResult } from '../types/hdfs'

interface AppState {
  connections: HdfsConnection[]
  activeConnectionId: string | null
  currentPath: string
  entries: HdfsEntry[]
  parquetData: ParquetResult | null
  loading: boolean
  loadingParquet: boolean
  error: string | null
  filterText: string
  activeTab: 'schema' | 'data'

  setConnections: (c: HdfsConnection[]) => void
  addConnection: (c: HdfsConnection) => void
  updateConnection: (c: HdfsConnection) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  setCurrentPath: (path: string) => void
  setEntries: (entries: HdfsEntry[]) => void
  setParquetData: (data: ParquetResult | null) => void
  setLoading: (v: boolean) => void
  setLoadingParquet: (v: boolean) => void
  setError: (msg: string | null) => void
  setFilterText: (text: string) => void
  setActiveTab: (tab: 'schema' | 'data') => void

  activeConnection: () => HdfsConnection | null
  filteredEntries: () => HdfsEntry[]
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  currentPath: '/',
  entries: [],
  parquetData: null,
  loading: false,
  loadingParquet: false,
  error: null,
  filterText: '',
  activeTab: 'data',

  setConnections: (connections) => set({ connections }),
  addConnection: (c) => set((s) => ({ connections: [...s.connections, c] })),
  updateConnection: (c) =>
    set((s) => ({ connections: s.connections.map((x) => (x.id === c.id ? c : x)) })),
  removeConnection: (id) =>
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      activeConnectionId: s.activeConnectionId === id ? null : s.activeConnectionId
    })),
  setActiveConnection: (id) => set({ activeConnectionId: id, currentPath: '/', entries: [], parquetData: null }),
  setCurrentPath: (path) => set({ currentPath: path }),
  setEntries: (entries) => set({ entries }),
  setParquetData: (data) => set({ parquetData: data }),
  setLoading: (loading) => set({ loading }),
  setLoadingParquet: (loadingParquet) => set({ loadingParquet }),
  setError: (error) => set({ error }),
  setFilterText: (filterText) => set({ filterText }),
  setActiveTab: (activeTab) => set({ activeTab }),

  activeConnection: () => {
    const { connections, activeConnectionId } = get()
    return connections.find((c) => c.id === activeConnectionId) ?? null
  },

  filteredEntries: () => {
    const { entries, filterText } = get()
    if (!filterText) return entries
    const lower = filterText.toLowerCase()
    return entries.filter((e) => e.name.toLowerCase().includes(lower))
  }
}))
