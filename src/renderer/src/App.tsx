import { useEffect, useCallback } from 'react'
import { useAppStore } from './store/useAppStore'
import { Sidebar } from './components/Sidebar'
import { FileBrowser } from './components/FileBrowser'
import { FilterBar } from './components/FilterBar'
import { ParquetViewer } from './components/ParquetViewer'
import { WelcomeScreen } from './components/WelcomeScreen'

export function App(): JSX.Element {
  const {
    connections,
    activeConnectionId,
    activeConnection,
    error,
    setError,
    setConnections,
    setEntries,
    setCurrentPath,
    setParquetData,
    setLoadingParquet
  } = useAppStore((s) => ({
    connections: s.connections,
    activeConnectionId: s.activeConnectionId,
    activeConnection: s.activeConnection(),
    error: s.error,
    setError: s.setError,
    setConnections: s.setConnections,
    setEntries: s.setEntries,
    setCurrentPath: s.setCurrentPath,
    setParquetData: s.setParquetData,
    setLoadingParquet: s.setLoadingParquet
  }))

  // Load saved connections on startup
  useEffect(() => {
    window.electronAPI.connectionsLoad().then(setConnections).catch(() => {})
  }, [setConnections])

  // When a connection becomes active, navigate to root
  const { setLoading } = useAppStore((s) => ({ setLoading: s.setLoading }))
  useEffect(() => {
    if (!activeConnectionId || !activeConnection) return
    setLoading(true)
    setError(null)
    setEntries([])
    setCurrentPath('/')
    window.electronAPI
      .hdfsListDir(activeConnection, '/')
      .then((entries) => {
        setEntries(entries)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [activeConnectionId]) // intentionally only on id change

  const handleOpenLocal = useCallback(async () => {
    setError(null)
    setLoadingParquet(true)
    try {
      const result = await window.electronAPI.openLocalFile()
      if (result) setParquetData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingParquet(false)
    }
  }, [setError, setLoadingParquet, setParquetData])

  const handleOpenParquet = useCallback(
    async (path: string) => {
      if (!activeConnection) return
      setError(null)
      setLoadingParquet(true)
      try {
        const result = await window.electronAPI.hdfsReadParquet(activeConnection, path)
        setParquetData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoadingParquet(false)
      }
    },
    [activeConnection, setError, setLoadingParquet, setParquetData]
  )

  // Wire up menu events
  useEffect(() => {
    return window.electronAPI.onMenuOpenLocal(handleOpenLocal)
  }, [handleOpenLocal])

  const hasConnection = activeConnectionId !== null

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="shrink-0 bg-red-900 border-b border-red-700 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-red-200">⚠ {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 text-sm ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar – connections */}
        <Sidebar onOpenLocal={handleOpenLocal} />

        {/* Main content */}
        {connections.length === 0 && !hasConnection ? (
          <WelcomeScreen onOpenLocal={handleOpenLocal} onAddConnection={() => {}} />
        ) : (
          <div className="flex-1 flex min-h-0 min-w-0">
            {/* File browser panel */}
            {hasConnection && (
              <div className="w-72 flex flex-col border-r border-gray-700 min-h-0 shrink-0 bg-gray-850">
                <FilterBar />
                <FileBrowser onOpenParquet={handleOpenParquet} />
              </div>
            )}

            {/* Parquet viewer panel */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <ParquetViewer />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
