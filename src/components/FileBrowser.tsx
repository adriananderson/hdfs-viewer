import { useAppStore } from '../store/useAppStore'
import { api } from '../lib/api'
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

function EntryRow({
  entry,
  isActive,
  onClickDir,
  onClickFile
}: {
  entry: HdfsEntry
  isActive: boolean
  onClickDir: (e: HdfsEntry) => void
  onClickFile: (e: HdfsEntry) => void
}): JSX.Element {
  const isDir = entry.type === 'DIRECTORY'
  const isParquetFile = !isDir && isParquet(entry.name)

  return (
    <button
      onClick={() => isDir ? onClickDir(entry) : isParquetFile ? onClickFile(entry) : undefined}
      disabled={!isDir && !isParquetFile}
      className={`w-full text-left px-3 py-2 border-b border-gray-700/50 transition-colors flex items-center gap-2 ${
        isActive ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''
      } ${isDir || isParquetFile ? 'hover:bg-gray-700/50 cursor-pointer' : 'opacity-40 cursor-default'}`}
    >
      <span className="text-sm shrink-0">{isDir ? '📁' : isParquetFile ? '📊' : '📄'}</span>
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

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }): JSX.Element {
  const parts = path.split('/').filter(Boolean)
  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 text-xs text-gray-400 border-b border-gray-700 bg-gray-800 min-h-[32px]">
      <button onClick={() => onNavigate('/')} className="hover:text-gray-200 font-mono">/</button>
      {parts.map((part, i) => {
        const navPath = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <span key={navPath} className="flex items-center gap-0.5">
            <span className="text-gray-600">/</span>
            <button
              onClick={() => !isLast && onNavigate(navPath)}
              className={`font-mono transition-colors ${isLast ? 'text-gray-200 cursor-default' : 'hover:text-gray-200'}`}
            >
              {part}
            </button>
          </span>
        )
      })}
    </div>
  )
}

export function FileBrowser({ onOpenParquet }: { onOpenParquet: (path: string) => void }): JSX.Element {
  const currentPath = useAppStore((s) => s.currentPath)
  const loading = useAppStore((s) => s.loading)
  const entries = useAppStore((s) => s.entries)
  const filteredEntries = useAppStore((s) => s.filteredEntries())
  const parquetData = useAppStore((s) => s.parquetData)
  const setCurrentPath = useAppStore((s) => s.setCurrentPath)
  const setEntries = useAppStore((s) => s.setEntries)
  const setLoading = useAppStore((s) => s.setLoading)
  const setError = useAppStore((s) => s.setError)

  async function navigate(path: string): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await api.hdfsListDir(path)
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <Breadcrumb path={currentPath} onNavigate={navigate} />

      <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-b border-gray-700 bg-gray-800">
        <button
          onClick={goUp}
          disabled={currentPath === '/'}
          className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 rounded hover:bg-gray-700 transition-colors"
        >
          ↑ Up
        </button>
        <button
          onClick={() => navigate(currentPath)}
          className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 rounded hover:bg-gray-700 transition-colors"
        >
          ↻
        </button>
        <span className="ml-auto text-xs text-gray-500">
          {loading ? 'Loading…' : `${entries.length} items`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">Loading…</div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
            {entries.length === 0 ? 'Empty directory' : 'No matches'}
          </div>
        ) : (
          filteredEntries.map((entry) => (
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
