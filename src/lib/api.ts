import type { HdfsEntry, ParquetResult } from '../types/hdfs'

async function post<T>(path: string, body: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(path, {
    method: 'POST',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body)
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  hdfsListDir: (path: string): Promise<HdfsEntry[]> =>
    post('/api/hdfs/list', { path }),

  hdfsReadParquet: (path: string): Promise<ParquetResult> =>
    post('/api/hdfs/parquet', { path }),

  uploadLocalFile: (file: File): Promise<ParquetResult> => {
    const form = new FormData()
    form.append('file', file)
    return post<ParquetResult>('/api/parquet/upload', form)
  }
}
