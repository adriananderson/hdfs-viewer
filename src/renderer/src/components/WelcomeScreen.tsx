interface Props {
  onOpenLocal: () => void
  onAddConnection: () => void
}

export function WelcomeScreen({ onOpenLocal, onAddConnection }: Props): JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="text-5xl mb-4">🗄️</div>
      <h1 className="text-2xl font-bold text-gray-100 mb-2">HDFS Viewer</h1>
      <p className="text-sm text-gray-400 mb-8 max-w-md leading-relaxed">
        Browse HDFS clusters and inspect Parquet files. Connect to a WebHDFS endpoint or open a
        local Parquet file directly.
      </p>

      <div className="flex gap-4 mb-10">
        <button
          onClick={onAddConnection}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Connect to HDFS
          <div className="text-xs text-blue-200 font-normal mt-0.5">WebHDFS endpoint</div>
        </button>
        <button
          onClick={onOpenLocal}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm border border-gray-600"
        >
          Open Local File
          <div className="text-xs text-gray-400 font-normal mt-0.5">.parquet or .pq</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-lg text-left">
        <Feature
          icon="📂"
          title="HDFS Browser"
          desc="Navigate HDFS directories via WebHDFS REST API"
        />
        <Feature
          icon="📊"
          title="Parquet Viewer"
          desc="Inspect schema, column types, and row data"
        />
        <Feature
          icon="💻"
          title="Local Files"
          desc="Open and inspect Parquet files from your filesystem"
        />
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xl">{icon}</span>
      <div className="text-sm font-semibold text-gray-200">{title}</div>
      <div className="text-xs text-gray-400 leading-snug">{desc}</div>
    </div>
  )
}
