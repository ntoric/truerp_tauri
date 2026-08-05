import { desktopSaveFile, isDesktopApp } from '@/lib/desktopBridge'

export function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function rowsToCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    for (let j = 0; j < slice.length; j += 1) {
      binary += String.fromCharCode(slice[j])
    }
  }
  return btoa(binary)
}

/** Download a blob — uses native Downloads on desktop (WKWebView `<a download>` is a no-op). */
export async function downloadBlob(filename: string, blob: Blob): Promise<void> {
  if (isDesktopApp()) {
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const saved = await desktopSaveFile(uint8ToBase64(bytes), filename)
    if (saved) return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Browsers often start the download asynchronously; early revoke cancels it silently.
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
}

export async function downloadCsv(
  filename: string,
  rows: (string | number | null | undefined)[][]
): Promise<void> {
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`
  // BOM helps Excel open UTF-8 CSV correctly
  const blob = new Blob(['\uFEFF' + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  await downloadBlob(name, blob)
}

export async function downloadJson(filename: string, data: unknown): Promise<void> {
  const name = filename.endsWith('.json') ? filename : `${filename}.json`
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  await downloadBlob(name, blob)
}

export function accountingExportDateStamp(): string {
  return new Date().toISOString().split('T')[0]
}
