import { useState } from 'react'
import type { HdfsConnection } from '../types/hdfs'

interface Props {
  initial?: HdfsConnection
  onSave: (conn: HdfsConnection) => void
  onCancel: () => void
}

function randomId(): string {
  return Math.random().toString(36).slice(2)
}

export function ConnectionDialog({ initial, onSave, onCancel }: Props): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState(String(initial?.port ?? 9870))
  const [ssl, setSsl] = useState(initial?.ssl ?? false)
  const [user, setUser] = useState(initial?.user ?? '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [testError, setTestError] = useState('')

  const conn: HdfsConnection = {
    id: initial?.id ?? randomId(),
    name: name.trim() || host,
    host: host.trim(),
    port: parseInt(port, 10) || 9870,
    ssl,
    user: user.trim()
  }

  async function handleTest(): Promise<void> {
    setTesting(true)
    setTestResult(null)
    setTestError('')
    try {
      await window.electronAPI.hdfsTestConnection(conn)
      setTestResult('ok')
    } catch (err) {
      setTestResult('fail')
      setTestError(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  const canSave = host.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg w-[480px] shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">
            {initial ? 'Edit Connection' : 'New HDFS Connection'}
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Field label="Display Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Cluster"
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </Field>

          <div className="flex gap-2">
            <Field label="Host" className="flex-1">
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="namenode.example.com"
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Port" className="w-28">
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </Field>
          </div>

          <Field label="Username (optional)">
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="hdfs"
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ssl}
              onChange={(e) => setSsl(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-sm text-gray-300">Use HTTPS (SSL)</span>
          </label>

          {testResult === 'ok' && (
            <div className="text-xs text-green-400 bg-green-900/30 rounded px-3 py-2">
              Connection successful
            </div>
          )}
          {testResult === 'fail' && (
            <div className="text-xs text-red-400 bg-red-900/30 rounded px-3 py-2 break-all">
              {testError || 'Connection failed'}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={handleTest}
            disabled={!canSave || testing}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => canSave && onSave(conn)}
              disabled={!canSave}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  className = ''
}: {
  label: string
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
