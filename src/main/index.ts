import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import * as http from 'http'
import * as https from 'https'
import { is } from '@electron-toolkit/utils'
import { parquetMetadata, parquetRead } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HdfsConnection {
  id: string
  name: string
  host: string
  port: number
  ssl: boolean
  user: string
}

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

// ─── HTTP client with redirect following ─────────────────────────────────────

function httpGet(url: string, maxRedirects = 10): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'))
      return
    }
    const mod = url.startsWith('https:') ? https : http
    const req = mod.get(url, (res) => {
      const status = res.statusCode ?? 0
      if (status === 301 || status === 302 || status === 307 || status === 308) {
        const loc = res.headers.location
        res.resume()
        if (!loc) { reject(new Error('Redirect without Location header')); return }
        httpGet(loc, maxRedirects - 1).then(resolve).catch(reject)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        if (status !== 200) {
          reject(new Error(`HTTP ${status}: ${body.toString('utf-8').slice(0, 300)}`))
          return
        }
        resolve(body)
      })
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

// ─── WebHDFS client ──────────────────────────────────────────────────────────

function webhdfsUrl(conn: HdfsConnection, path: string, op: string): string {
  const proto = conn.ssl ? 'https' : 'http'
  const user = conn.user ? `&user.name=${encodeURIComponent(conn.user)}` : ''
  const normalPath = path.startsWith('/') ? path : '/' + path
  return `${proto}://${conn.host}:${conn.port}/webhdfs/v1${normalPath}?op=${op}${user}`
}

async function hdfsListDir(conn: HdfsConnection, path: string): Promise<HdfsEntry[]> {
  const url = webhdfsUrl(conn, path, 'LISTSTATUS')
  const raw = await httpGet(url)
  const data = JSON.parse(raw.toString('utf-8')) as {
    FileStatuses?: { FileStatus: Record<string, unknown>[] }
  }
  const statuses = data?.FileStatuses?.FileStatus ?? []
  const base = path.endsWith('/') ? path : path + '/'
  return statuses
    .map((s) => ({
      name: s.pathSuffix as string,
      path: base + (s.pathSuffix as string),
      type: s.type as 'FILE' | 'DIRECTORY',
      size: Number(s.length),
      modTime: Number(s.modificationTime),
      owner: (s.owner as string) ?? '',
      group: (s.group as string) ?? '',
      permission: (s.permission as string) ?? ''
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'DIRECTORY' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

async function hdfsReadFile(conn: HdfsConnection, path: string): Promise<Buffer> {
  return httpGet(webhdfsUrl(conn, path, 'OPEN'))
}

async function hdfsTestConnection(conn: HdfsConnection): Promise<boolean> {
  await hdfsListDir(conn, '/')
  return true
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
  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer

  const meta = parquetMetadata(ab)

  // Extract leaf columns from flat schema (index 0 is the root message schema)
  const leafCols = meta.schema.slice(1).filter((s) => !s.num_children)
  const columns: ParquetColumn[] = leafCols.map((s) => ({
    name: s.name,
    type: s.type ?? 'GROUP',
    repetition: s.repetition_type ?? 'OPTIONAL',
    logicalType:
      s.converted_type ?? (s.logical_type ? (s.logical_type as { type: string }).type : '')
  }))

  const totalRows = Number(meta.num_rows)

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
    onComplete: (data) => {
      rawRows = data as Record<string, unknown>[]
    }
  })

  const rows = rawRows.map((r) => serializeValue(r)) as Record<string, unknown>[]

  return {
    columns,
    totalRows,
    loadedRows: rows.length,
    rows,
    filePath,
    fileName: filePath.split('/').pop() ?? filePath
  }
}

// ─── Connection persistence ───────────────────────────────────────────────────

function connectionsFile(): string {
  return join(app.getPath('userData'), 'connections.json')
}

function loadConnections(): HdfsConnection[] {
  try {
    const p = connectionsFile()
    if (!existsSync(p)) return []
    return JSON.parse(readFileSync(p, 'utf-8')) as HdfsConnection[]
  } catch {
    return []
  }
}

function saveConnections(connections: HdfsConnection[]): void {
  writeFileSync(connectionsFile(), JSON.stringify(connections, null, 2), 'utf-8')
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  buildMenu()
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Local Parquet File…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu-open-local')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(is.dev ? [{ role: 'toggleDevTools' as const }] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About HDFS Viewer',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About HDFS Viewer',
              message: 'HDFS Viewer',
              detail: 'Browse HDFS and view Parquet files.\nVersion 1.0.0'
            })
          }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openLocalFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Open Parquet File',
    filters: [
      { name: 'Parquet Files', extensions: ['parquet', 'pq'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const buffer = readFileSync(filePath)
  return parseParquet(buffer, filePath)
})

ipcMain.handle('hdfs:listDir', async (_event, conn: HdfsConnection, path: string) => {
  return hdfsListDir(conn, path)
})

ipcMain.handle('hdfs:readParquet', async (_event, conn: HdfsConnection, path: string) => {
  const buffer = await hdfsReadFile(conn, path)
  return parseParquet(buffer, path)
})

ipcMain.handle('hdfs:testConnection', async (_event, conn: HdfsConnection) => {
  return hdfsTestConnection(conn)
})

ipcMain.handle('connections:load', () => loadConnections())

ipcMain.handle('connections:save', (_event, connections: HdfsConnection[]) => {
  saveConnections(connections)
})

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
