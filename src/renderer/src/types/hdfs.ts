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
