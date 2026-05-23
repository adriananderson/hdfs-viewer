import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface HdfsConnection {
  id: string
  name: string
  host: string
  port: number
  ssl: boolean
  user: string
}

export interface HdfsEntry {
  name: string
  path: string
  type: 'FILE' | 'DIRECTORY'
  size: number
  modTime: number
  owner: string
  group: string
  permission: string
}

export interface ParquetColumn {
  name: string
  type: string
  repetition: string
  logicalType: string
}

export interface ParquetResult {
  columns: ParquetColumn[]
  totalRows: number
  loadedRows: number
  rows: Record<string, unknown>[]
  filePath: string
  fileName: string
}

const api = {
  openLocalFile: (): Promise<ParquetResult | null> =>
    ipcRenderer.invoke('dialog:openLocalFile'),

  hdfsListDir: (conn: HdfsConnection, path: string): Promise<HdfsEntry[]> =>
    ipcRenderer.invoke('hdfs:listDir', conn, path),

  hdfsReadParquet: (conn: HdfsConnection, path: string): Promise<ParquetResult> =>
    ipcRenderer.invoke('hdfs:readParquet', conn, path),

  hdfsTestConnection: (conn: HdfsConnection): Promise<boolean> =>
    ipcRenderer.invoke('hdfs:testConnection', conn),

  connectionsLoad: (): Promise<HdfsConnection[]> =>
    ipcRenderer.invoke('connections:load'),

  connectionsSave: (connections: HdfsConnection[]): Promise<void> =>
    ipcRenderer.invoke('connections:save', connections),

  onMenuOpenLocal: (callback: () => void) => {
    const handler = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on('menu-open-local', handler)
    return () => { ipcRenderer.removeListener('menu-open-local', handler) }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
