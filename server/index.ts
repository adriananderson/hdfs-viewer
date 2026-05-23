import express from 'express'
import multer from 'multer'
import { join } from 'path'
import { spawn } from 'child_process'
import { parquetMetadata, parquetRead } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HdfsEntry {
  name: string
  path: string
  type: 'FILE' | 'DIRECTORY'
  size: number
  modTime: number
  owner: string
  group: string
  permission: string
}

interface ParquetColumn {
  name: string
  type: string
  repetition: string
  logicalType: string
}

interface ParquetResult {
  columns: ParquetColumn[]
  totalRows: number
  loadedRows: number
  rows: Record<string, unknown>[]
  filePath: string
  fileName: string
}

// ─── HDFS CLI client ──────────────────────────────────────────────────────────

function hdfsExec(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('hdfs', args)
    const out: Buffer[] = []
    const err: Buffer[] = []
    proc.stdout.on('data', (c: Buffer) => out.push(c))
    proc.stderr.on('data', (c: Buffer) => err.push(c))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(err).toString('utf-8').trim() || `hdfs exited ${code}`))
      } else {
        resolve(Buffer.concat(out))
      }
    })
  })
}

function parseLsOutput(stdout: string): HdfsEntry[] {
  const lines = stdout
    .trim()
    .split('\n')
    .filter((l) => l && !l.startsWith('Found'))

  return lines
    .map((line) => {
      const parts = line.split(/\s+/)
      // permissions  replication  owner  group  size  date  time  path
      const [permissions, , owner, group, sizeStr, date, time, fullPath] = parts
      if (!fullPath) return null
      const name = fullPath.split('/').pop() ?? fullPath
      const isDir = permissions.startsWith('d')
      const modTime = date && time ? new Date(`${date}T${time}`).getTime() : 0
      return {
        name,
        path: fullPath,
        type: (isDir ? 'DIRECTORY' : 'FILE') as 'DIRECTORY' | 'FILE',
        size: parseInt(sizeStr, 10) || 0,
        modTime: isNaN(modTime) ? 0 : modTime,
        owner: owner ?? '',
        group: group ?? '',
        permission: permissions ?? ''
      }
    })
    .filter((e): e is HdfsEntry => e !== null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'DIRECTORY' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

async function hdfsListDir(path: string): Promise<HdfsEntry[]> {
  const stdout = await hdfsExec(['dfs', '-ls', path])
  return parseLsOutput(stdout.toString('utf-8'))
}

async function hdfsReadFile(path: string): Promise<Buffer> {
  return hdfsExec(['dfs', '-cat', path])
}

// ─── Parquet reader ───────────────────────────────────────────────────────────

function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Date) return v.toISOString()
  if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
    const preview = Array.from(v.slice(0, 32)).map((b) => b.toString(16).padStart(2, '0')).join('')
    const suffix = v.byteLength > 32 ? '…' : ''
    return `${preview}${suffix} [${v.byteLength}B]`
  }
  if (Array.isArray(v)) return v.map(serializeValue)
  if (typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, serializeValue(val)])
    )
  }
  return v
}

async function parseParquet(buffer: Buffer, filePath: string, rowLimit = 2000): Promise<ParquetResult> {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  const meta = parquetMetadata(ab)

  const leafCols = meta.schema.slice(1).filter((s) => !s.num_children)
  const columns: ParquetColumn[] = leafCols.map((s) => ({
    name: s.name,
    type: s.type ?? 'GROUP',
    repetition: s.repetition_type ?? 'OPTIONAL',
    logicalType: s.converted_type ?? (s.logical_type ? (s.logical_type as { type: string }).type : '')
  }))

  const asyncBuffer = {
    byteLength: ab.byteLength,
    slice: (start: number, end?: number) => Promise.resolve(ab.slice(start, end))
  }

  let rawRows: Record<string, unknown>[] = []
  await parquetRead({
    file: asyncBuffer,
    metadata: meta,
    rowEnd: rowLimit,
    rowFormat: 'object',
    compressors,
    onComplete: (data) => { rawRows = data as Record<string, unknown>[] }
  })

  const rows = rawRows.map((r) => serializeValue(r)) as Record<string, unknown>[]
  return {
    columns,
    totalRows: Number(meta.num_rows),
    loadedRows: rows.length,
    rows,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath
  }
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } })

app.use(express.json({ limit: '10mb' }))

app.post('/api/hdfs/list', async (req, res) => {
  try {
    const { path } = req.body as { path: string }
    const entries = await hdfsListDir(path || '/')
    res.json(entries)
  } catch (err) {
    res.status(400).json({ error: String(err) })
  }
})

app.post('/api/hdfs/parquet', async (req, res) => {
  try {
    const { path } = req.body as { path: string }
    const buffer = await hdfsReadFile(path)
    const result = await parseParquet(buffer, path)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: String(err) })
  }
})

app.post('/api/parquet/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
    const result = await parseParquet(req.file.buffer, req.file.originalname)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: String(err) })
  }
})

if (process.env.NODE_ENV === 'production') {
  const clientDist = join(process.cwd(), 'dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')))
}

const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HDFS Viewer running on http://0.0.0.0:${PORT}`)
})
