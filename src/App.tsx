import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from './store/useAppStore'
import { api } from './lib/api'
import { FileBrowser } from './components/FileBrowser'
import { FilterBar } from './components/FilterBar'
import { ParquetViewer } from './components/ParquetViewer'

export function App(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Load root on startup
  useEffect(() => {
    setLoading(true)
    api
      .hdfsListDir('/')
      .then((entries) => { setEntries(entries); setCurrentPath('/') })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  const handleOpenParquet = useCallback(
    async (path: string) => {
      setError(null)
      setLoadingParquet(true)
      try {
        const result = await api.hdfsReadParquet(path)
        setParquetData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoadingParquet(false)
      }
    },
    [setError, setLoadingParquet, setParquetData]
  )

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
          <FileBrowser onOpenParquet={handleOpenParquet} />
        </div>
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <ParquetViewer />
        </div>
      </div>
    </div>
  )
}
