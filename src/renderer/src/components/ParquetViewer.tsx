import { useAppStore } from '../store/useAppStore'
import type { ParquetColumn } from '../types/hdfs'

const TYPE_COLORS: Record<string, string> = {
  INT32: 'text-blue-400',
  INT64: 'text-blue-400',
  INT96: 'text-blue-400',
  FLOAT: 'text-purple-400',
  DOUBLE: 'text-purple-400',
  BOOLEAN: 'text-yellow-400',
  BYTE_ARRAY: 'text-green-400',
  FIXED_LEN_BYTE_ARRAY: 'text-green-400'
}

function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? 'text-gray-400'
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function SchemaView({ columns }: { columns: ParquetColumn[] }): JSX.Element {
  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 pr-4 text-gray-400 font-medium w-8">#</th>
            <th className="text-left py-2 pr-4 text-gray-400 font-medium">Column</th>
            <th className="text-left py-2 pr-4 text-gray-400 font-medium">Type</th>
            <th className="text-left py-2 pr-4 text-gray-400 font-medium">Repetition</th>
            <th className="text-left py-2 text-gray-400 font-medium">Logical Type</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col, i) => (
            <tr key={col.name} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-2 pr-4 text-gray-600 font-mono">{i + 1}</td>
              <td className="py-2 pr-4 font-mono text-gray-100">{col.name}</td>
              <td className={`py-2 pr-4 font-mono ${typeColor(col.type)}`}>{col.type}</td>
              <td className="py-2 pr-4 text-gray-400">{col.repetition}</td>
              <td className="py-2 text-gray-500">{col.logicalType || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataView({
  columns,
  rows
}: {
  columns: ParquetColumn[]
  rows: Record<string, unknown>[]
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No rows
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-800 border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-500 font-mono font-normal w-12 shrink-0 border-r border-gray-700">
              #
            </th>
            {columns.map((col) => (
              <th
                key={col.name}
                className="text-left py-2 px-3 text-gray-300 font-medium whitespace-nowrap border-r border-gray-700 last:border-r-0"
              >
                <div className="font-mono">{col.name}</div>
                <div className={`text-xs font-normal ${typeColor(col.type)}`}>{col.type}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-gray-800 hover:bg-gray-800/60 ${ri % 2 === 0 ? '' : 'bg-gray-850'}`}
            >
              <td className="py-1.5 px-3 text-gray-600 font-mono border-r border-gray-800 tabular-nums">
                {ri + 1}
              </td>
              {columns.map((col) => {
                const raw = row[col.name]
                const display = formatValue(raw)
                const isNull = raw === null || raw === undefined
                return (
                  <td
                    key={col.name}
                    className={`py-1.5 px-3 border-r border-gray-800 last:border-r-0 max-w-xs ${
                      isNull ? 'text-gray-600 italic' : 'text-gray-200'
                    }`}
                    title={display}
                  >
                    <span className="font-mono truncate block">
                      {isNull ? 'null' : display}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ParquetViewer(): JSX.Element {
  const { parquetData, loadingParquet, activeTab, setActiveTab } = useAppStore((s) => ({
    parquetData: s.parquetData,
    loadingParquet: s.loadingParquet,
    activeTab: s.activeTab,
    setActiveTab: s.setActiveTab
  }))

  if (loadingParquet) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Reading file…
      </div>
    )
  }

  if (!parquetData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-600 text-sm gap-2">
        <span className="text-3xl">📊</span>
        <span>Select a .parquet file to inspect</span>
      </div>
    )
  }

  const { columns, totalRows, loadedRows, rows, fileName } = parquetData

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-100 font-mono">{fileName}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {columns.length} column{columns.length !== 1 ? 's' : ''} ·{' '}
            {totalRows.toLocaleString()} row{totalRows !== 1 ? 's' : ''}
            {loadedRows < totalRows && (
              <span className="text-yellow-500 ml-1">
                (showing first {loadedRows.toLocaleString()})
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
          {(['data', 'schema'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'schema' ? (
        <SchemaView columns={columns} />
      ) : (
        <DataView columns={columns} rows={rows} />
      )}
    </div>
  )
}
