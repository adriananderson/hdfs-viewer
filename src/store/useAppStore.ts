import { create } from 'zustand'
import type { HdfsEntry, ParquetResult } from '../types/hdfs'

interface AppState {
  currentPath: string
  entries: HdfsEntry[]
  parquetData: ParquetResult | null
  loading: boolean
  loadingParquet: boolean
  error: string | null
  filterText: string
  activeTab: 'schema' | 'data'

  setCurrentPath: (path: string) => void
  setEntries: (entries: HdfsEntry[]) => void
  setParquetData: (data: ParquetResult | null) => void
  setLoading: (v: boolean) => void
  setLoadingParquet: (v: boolean) => void
  setError: (msg: string | null) => void
  setFilterText: (text: string) => void
  setActiveTab: (tab: 'schema' | 'data') => void

  filteredEntries: () => HdfsEntry[]
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPath: '/',
  entries: [],
  parquetData: null,
  loading: false,
  loadingParquet: false,
  error: null,
  filterText: '',
  activeTab: 'data',

  setCurrentPath: (path) => set({ currentPath: path }),
  setEntries: (entries) => set({ entries }),
  setParquetData: (data) => set({ parquetData: data }),
  setLoading: (loading) => set({ loading }),
  setLoadingParquet: (loadingParquet) => set({ loadingParquet }),
  setError: (error) => set({ error }),
  setFilterText: (filterText) => set({ filterText }),
  setActiveTab: (activeTab) => set({ activeTab }),

  filteredEntries: () => {
    const { entries, filterText } = get()
    if (!filterText) return entries
    const lower = filterText.toLowerCase()
    return entries.filter((e) => e.name.toLowerCase().includes(lower))
  }
}))
