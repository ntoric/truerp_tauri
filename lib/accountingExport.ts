import { desktopSaveFile, isDesktopApp } from '@/lib/desktopBridge'
import { runWithExportProgress } from '@/lib/exportProgress'

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

export type DownloadBlobOptions = {
  /** Shown in the in-app export progress card. */
  label?: string
  /** When true, caller owns progress via runWithExportProgress. */
  skipProgress?: boolean
}

async function saveBlobToDevice(
  filename: string,
  blob: Blob,
  update?: (percent: number, message?: string) => void
): Promise<void> {
  update?.(20, 'Preparing file…')

  if (isDesktopApp()) {
    update?.(40, 'Encoding…')
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    update?.(70, 'Saving to Downloads…')
    // Never open system apps / Finder — silent save only.
    const saved = await desktopSaveFile(uint8ToBase64(bytes), filename, false)
    if (!saved) {
      throw new Error('Desktop file save is unavailable. Rebuild or update the desktop app.')
    }
    update?.(100, 'Saved to Downloads')
    return
  }

  update?.(55, 'Starting download…')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
  update?.(100, 'Download started')
}

/** Download a blob in-app — desktop writes Downloads silently; browser uses a normal download. */
export async function downloadBlob(
  filename: string,
  blob: Blob,
  options?: DownloadBlobOptions
): Promise<void> {
  const label = options?.label ?? `Exporting ${filename}`
  if (options?.skipProgress) {
    await saveBlobToDevice(filename, blob)
    return
  }
  await runWithExportProgress(label, async (update) => {
    await saveBlobToDevice(filename, blob, update)
  })
}

export async function downloadCsv(
  filename: string,
  rows: (string | number | null | undefined)[][],
  options?: DownloadBlobOptions
): Promise<void> {
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`
  const label = options?.label ?? `Exporting ${name}`
  const run = async (update: (percent: number, message?: string) => void) => {
    update(10, 'Building CSV…')
    // BOM helps Excel open UTF-8 CSV correctly
    const blob = new Blob(['\uFEFF' + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' })
    await saveBlobToDevice(name, blob, (percent, message) => {
      update(20 + Math.round(percent * 0.8), message)
    })
  }
  if (options?.skipProgress) {
    await run(() => {})
    return
  }
  await runWithExportProgress(label, run)
}

export async function downloadJson(
  filename: string,
  data: unknown,
  options?: DownloadBlobOptions
): Promise<void> {
  const name = filename.endsWith('.json') ? filename : `${filename}.json`
  const label = options?.label ?? `Exporting ${name}`
  const run = async (update: (percent: number, message?: string) => void) => {
    update(10, 'Building JSON…')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    await saveBlobToDevice(name, blob, (percent, message) => {
      update(20 + Math.round(percent * 0.8), message)
    })
  }
  if (options?.skipProgress) {
    await run(() => {})
    return
  }
  await runWithExportProgress(label, run)
}

export function accountingExportDateStamp(): string {
  return new Date().toISOString().split('T')[0]
}
