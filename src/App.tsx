import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from './store/useAppStore'
import { api } from './lib/api'
import { FileBrowser } from './components/FileBrowser'
import { FilterBar } from './components/FilterBar'
import { ParquetViewer } from './components/ParquetViewer'

export function App(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigateRef = useRef<((path: string, push?: boolean) => Promise<void>) | null>(null)
  const { error, setError, setEntries, setCurrentPath, setLoading, setParquetData, setLoadingParquet } =
    useAppStore((s) => ({
      error: s.error,
      setError: s.setError,
      setEntries: s.setEntries,
      setCurrentPath: s.setCurrentPath,
      setLoading: s.setLoading,
      setParquetData: s.setParquetData,
      setLoadingParquet: s.setLoadingParquet
    }))

  const handleOpenParquet = useCallback(
    async (path: string, pushHistory = true) => {
      setError(null)
      setLoadingParquet(true)
      try {
        const result = await api.hdfsReadParquet(path)
        setParquetData(result)
        if (pushHistory) history.pushState(null, '', path)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoadingParquet(false)
      }
    },
    [setError, setLoadingParquet, setParquetData]
  )

  const loadPath = useCallback(async (path: string) => {
    const isParquetPath = path.endsWith('.parquet') || path.endsWith('.pq')
    const dirPath = isParquetPath ? (path.substring(0, path.lastIndexOf('/')) || '/') : path
    setLoading(true)
    try {
      const entries = await api.hdfsListDir(dirPath)
      setEntries(entries)
      setCurrentPath(dirPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
    if (isParquetPath) handleOpenParquet(path, false)
  }, [setEntries, setCurrentPath, setLoading, setError, handleOpenParquet])

  // Load from URL on startup
  useEffect(() => {
    loadPath(window.location.pathname || '/')
  }, [])

  // Back/forward navigation
  useEffect(() => {
    function onPopState() {
      const path = window.location.pathname || '/'
      const isParquetPath = path.endsWith('.parquet') || path.endsWith('.pq')
      const dirPath = isParquetPath ? (path.substring(0, path.lastIndexOf('/')) || '/') : path
      navigateRef.current?.(dirPath, false)
      if (isParquetPath) handleOpenParquet(path, false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [handleOpenParquet])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    setLoadingParquet(true)
    try {
      const result = await api.uploadLocalFile(file)
      setParquetData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingParquet(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".parquet,.pq"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-base">🗄️</span>
          <span className="text-sm font-semibold text-gray-100">HDFS Viewer</span>
          <span className="text-xs text-gray-500">turing</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors border border-gray-600"
        >
          Upload Local File
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 bg-red-900 border-b border-red-700 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-red-200">⚠ {error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 text-sm ml-4">✕</button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        <div className="w-80 flex flex-col border-r border-gray-700 min-h-0 shrink-0 bg-gray-850">
          <FilterBar />
          <FileBrowser onOpenParquet={handleOpenParquet} navigateRef={navigateRef} />
        </div>
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <ParquetViewer />
        </div>
      </div>
    </div>
  )
}
