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

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(filename.endsWith('.csv') ? filename : `${filename}.csv`, blob)
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(filename.endsWith('.json') ? filename : `${filename}.json`, blob)
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function accountingExportDateStamp(): string {
  return new Date().toISOString().split('T')[0]
}
