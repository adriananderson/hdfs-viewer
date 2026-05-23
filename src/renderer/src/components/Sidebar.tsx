import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ConnectionDialog } from './ConnectionDialog'
import type { HdfsConnection } from '../types/hdfs'

interface Props {
  onOpenLocal: () => void
}

function ConnectionTab({
  conn,
  isActive,
  onClick,
  onEdit,
  onRemove
}: {
  conn: HdfsConnection
  isActive: boolean
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onRemove: (e: React.MouseEvent) => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-gray-700 hover:bg-gray-700 transition-colors group ${
        isActive ? 'bg-gray-700 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
            <span className="text-xs font-medium text-gray-100 truncate">{conn.name || conn.host}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 pl-3">
            {conn.ssl ? 'https' : 'http'}://{conn.host}:{conn.port}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5">
          <button
            onClick={onEdit}
            className="text-gray-500 hover:text-gray-300 text-xs px-1"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-red-400 text-xs px-1"
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>
    </button>
  )
}

export function Sidebar({ onOpenLocal }: Props): JSX.Element {
  const { connections, activeConnectionId, setActiveConnection, addConnection, updateConnection, removeConnection } =
    useAppStore()
  const [showDialog, setShowDialog] = useState(false)
  const [editingConn, setEditingConn] = useState<HdfsConnection | undefined>(undefined)

  function handleSave(conn: HdfsConnection): void {
    if (editingConn) {
      updateConnection(conn)
    } else {
      addConnection(conn)
    }
    window.electronAPI.connectionsSave([...connections.filter((c) => c.id !== conn.id), conn])
    setShowDialog(false)
    setEditingConn(undefined)
  }

  function handleRemove(id: string): void {
    removeConnection(id)
    const remaining = connections.filter((c) => c.id !== id)
    window.electronAPI.connectionsSave(remaining)
  }

  return (
    <>
      <div className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 h-full">
        <div className="px-3 py-3 border-b border-gray-700">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Connections
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => { setEditingConn(undefined); setShowDialog(true) }}
              className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
            >
              + HDFS
            </button>
            <button
              onClick={onOpenLocal}
              className="flex-1 px-2 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium rounded transition-colors"
              title="Open local Parquet file"
            >
              Local File
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {connections.length === 0 ? (
            <div className="px-3 py-6 text-center text-gray-500 text-xs leading-relaxed">
              No connections.
              <br />
              Add an HDFS cluster or open a local file.
            </div>
          ) : (
            connections.map((conn) => (
              <ConnectionTab
                key={conn.id}
                conn={conn}
                isActive={conn.id === activeConnectionId}
                onClick={() => setActiveConnection(conn.id)}
                onEdit={(e) => {
                  e.stopPropagation()
                  setEditingConn(conn)
                  setShowDialog(true)
                }}
                onRemove={(e) => {
                  e.stopPropagation()
                  handleRemove(conn.id)
                }}
              />
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t border-gray-700">
          <div className="text-xs text-gray-500">HDFS Viewer</div>
        </div>
      </div>

      {showDialog && (
        <ConnectionDialog
          initial={editingConn}
          onSave={handleSave}
          onCancel={() => { setShowDialog(false); setEditingConn(undefined) }}
        />
      )}
    </>
  )
}
