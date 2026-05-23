import { useAppStore } from '../store/useAppStore'
import type { HdfsEntry } from '../types/hdfs'

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isParquet(name: string): boolean {
  return name.endsWith('.parquet') || name.endsWith('.pq')
}

interface EntryRowProps {
  entry: HdfsEntry
  onClickDir: (entry: HdfsEntry) => void
  onClickFile: (entry: HdfsEntry) => void
  isActive: boolean
}

function EntryRow({ entry, onClickDir, onClickFile, isActive }: EntryRowProps): JSX.Element {
  const isDir = entry.type === 'DIRECTORY'
  const isParquetFile = !isDir && isParquet(entry.name)

  function handleClick(): void {
    if (isDir) onClickDir(entry)
    else if (isParquetFile) onClickFile(entry)
  }

  return (
    <button
      onClick={handleClick}
      disabled={!isDir && !isParquetFile}
      className={`w-full text-left px-3 py-2 border-b border-gray-700/50 transition-colors flex items-center gap-2 ${
        isActive ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''
      } ${isDir || isParquetFile ? 'hover:bg-gray-700/50 cursor-pointer' : 'opacity-50 cursor-default'}`}
    >
      <span className="text-sm shrink-0">
        {isDir ? '📁' : isParquetFile ? '📊' : '📄'}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-xs truncate ${isDir ? 'text-blue-300 font-medium' : isParquetFile ? 'text-gray-100' : 'text-gray-400'}`}>
          {entry.name}
        </div>
        {!isDir && (
          <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
            <span>{formatSize(entry.size)}</span>
            {entry.modTime > 0 && <span>{formatDate(entry.modTime)}</span>}
          </div>
        )}
      </div>
    </button>
  )
}

interface BreadcrumbProps {
  path: string
  onNavigate: (path: string) => void
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps): JSX.Element {
  const parts = path.split('/').filter(Boolean)

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 text-xs text-gray-400 border-b border-gray-700 bg-gray-800 min-h-[32px]">
      <button
        onClick={() => onNavigate('/')}
        className="hover:text-gray-200 transition-colors font-mono"
      >
        /
      </button>
      {parts.map((part, i) => {
        const navPath = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <span key={navPath} className="flex items-center gap-0.5">
            <span className="text-gray-600">/</span>
            <button
              onClick={() => !isLast && onNavigate(navPath)}
              className={`transition-colors font-mono ${isLast ? 'text-gray-200 cursor-default' : 'hover:text-gray-200'}`}
            >
              {part}
            </button>
          </span>
        )
      })}
    </div>
  )
}

interface Props {
  onOpenParquet: (path: string) => void
}

export function FileBrowser({ onOpenParquet }: Props): JSX.Element {
  const { activeConnectionId, activeConnection, currentPath, loading, entries, filteredEntries, setCurrentPath } =
    useAppStore((s) => ({
      activeConnectionId: s.activeConnectionId,
      activeConnection: s.activeConnection(),
      currentPath: s.currentPath,
      loading: s.loading,
      entries: s.entries,
      filteredEntries: s.filteredEntries(),
      setCurrentPath: s.setCurrentPath
    }))

  const { parquetData, setEntries, setLoading, setError } = useAppStore((s) => ({
    parquetData: s.parquetData,
    setEntries: s.setEntries,
    setLoading: s.setLoading,
    setError: s.setError
  }))

  async function navigate(path: string): Promise<void> {
    if (!activeConnection) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.hdfsListDir(activeConnection, path)
      setCurrentPath(path)
      setEntries(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function goUp(): void {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    navigate(parts.length === 0 ? '/' : '/' + parts.join('/'))
  }

  if (!activeConnectionId || !activeConnection) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a connection
      </div>
    )
  }

  const displayed = filteredEntries

  return (
    <div className="flex flex-col h-full min-h-0">
      <Breadcrumb path={currentPath} onNavigate={navigate} />

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-b border-gray-700 bg-gray-800">
        <button
          onClick={goUp}
          disabled={currentPath === '/'}
          className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 rounded hover:bg-gray-700 transition-colors"
          title="Go up"
        >
          ↑ Up
        </button>
        <button
          onClick={() => navigate(currentPath)}
          className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          ↻
        </button>
        <span className="ml-auto text-xs text-gray-500">
          {loading ? 'Loading…' : `${entries.length} items`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
            Loading…
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
            {entries.length === 0 ? 'Empty directory' : 'No matches'}
          </div>
        ) : (
          displayed.map((entry) => (
            <EntryRow
              key={entry.path}
              entry={entry}
              isActive={parquetData?.filePath === entry.path}
              onClickDir={(e) => navigate(e.path)}
              onClickFile={(e) => onOpenParquet(e.path)}
            />
          ))
        )}
      </div>
    </div>
  )
}
