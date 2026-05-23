import { useAppStore } from '../store/useAppStore'

export function FilterBar(): JSX.Element {
  const filterText = useAppStore((s) => s.filterText)
  const setFilterText = useAppStore((s) => s.setFilterText)

  return (
    <div className="shrink-0 px-2 py-2 border-b border-gray-700 bg-gray-800">
      <input
        type="text"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Filter files…"
        className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}
