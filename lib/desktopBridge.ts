export interface DesktopPrinterInfo {
  name: string
  is_default: boolean
}

export interface DesktopUpdateCheckResult {
  available: boolean
  currentVersion: string
  version?: string | null
  notes?: string | null
  date?: string | null
}

export type DesktopUpdateProgressStatus = 'downloading' | 'installing'

export interface DesktopUpdateProgress {
  status: DesktopUpdateProgressStatus
  downloaded: number
  contentLength?: number | null
  percent?: number | null
}

const UPDATE_PROGRESS_EVENT = 'desktop-update-progress'

type TauriEventApi = {
  listen?: (
    event: string,
    handler: (event: { payload: DesktopUpdateProgress }) => void
  ) => Promise<() => void>
}

type DesktopAppBridge = {
  HasNativePrinting?: () => Promise<boolean>
  ListPrinters?: () => Promise<DesktopPrinterInfo[]>
  PrintPDF?: (
    pdfBase64: string,
    printerName: string,
    jobTitle: string,
    paperWidthMm?: number | null,
    paperSize?: string | null
  ) => Promise<void>
  SavePDF?: (pdfBase64: string, filename: string) => Promise<string>
  PrintThermal?: (
    content: string,
    printerName: string,
    paperWidthMm?: number | null,
    jobTitle?: string,
    logoEscposBase64?: string | null
  ) => Promise<void>
  /** Silent raw ESC/POS (or other) bytes as base64 — used for barcode labels. */
  PrintRaw?: (dataBase64: string, printerName: string) => Promise<void>
  AppVersion?: () => Promise<string>
  CheckForUpdates?: () => Promise<DesktopUpdateCheckResult>
  DownloadAndInstallUpdate?: () => Promise<void>
}

type TauriCore = {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
}

function getTauri(): { core?: TauriCore; event?: TauriEventApi } | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { __TAURI__?: { core?: TauriCore; event?: TauriEventApi } }).__TAURI__ ?? null
}

function getTauriCore(): TauriCore | null {
  return getTauri()?.core ?? null
}

function invokeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Desktop print bridge error'
  }
}

/** Prefer direct Tauri IPC; fall back to injected window.go.main.App (Wails-shaped). */
function getDesktopApp(): DesktopAppBridge | null {
  if (typeof window === 'undefined') return null

  const core = getTauriCore()
  if (core?.invoke) {
    const invoke = core.invoke.bind(core)
    return {
      HasNativePrinting: () => invoke('has_native_printing') as Promise<boolean>,
      ListPrinters: () => invoke('list_printers') as Promise<DesktopPrinterInfo[]>,
      PrintPDF: (pdfBase64, printerName, jobTitle, paperWidthMm, paperSize) =>
        invoke('print_pdf', {
          pdfBase64,
          printerName,
          jobTitle,
          paperWidthMm: paperWidthMm ?? null,
          paperSize: paperSize ?? null,
        }) as Promise<void>,
      SavePDF: (pdfBase64, filename) =>
        invoke('save_pdf', {
          pdfBase64,
          filename: filename || 'document.pdf',
        }) as Promise<string>,
      PrintThermal: (content, printerName, paperWidthMm, jobTitle, logoEscposBase64) =>
        invoke('print_thermal', {
          content,
          printerName: printerName || '',
          paperWidthMm: paperWidthMm ?? null,
          jobTitle: jobTitle || 'TruERP Receipt',
          logoEscposBase64: logoEscposBase64 || null,
        }) as Promise<void>,
      PrintRaw: (dataBase64, printerName) =>
        invoke('print_raw_base64', {
          dataBase64: dataBase64 || '',
          printerName: printerName || '',
        }) as Promise<void>,
      AppVersion: () => invoke('app_version') as Promise<string>,
      CheckForUpdates: () => invoke('check_for_updates') as Promise<DesktopUpdateCheckResult>,
      DownloadAndInstallUpdate: () => invoke('download_and_install_update') as Promise<void>,
    }
  }

  const go = (window as unknown as { go?: { main?: { App?: DesktopAppBridge } } }).go
  if (go?.main?.App) return go.main.App
  return null
}

export function isDesktopApp(): boolean {
  return !!getDesktopApp()
}

/** True only when the Tauri shell exposes updater commands. */
export function hasDesktopUpdater(): boolean {
  const app = getDesktopApp()
  return !!(app?.CheckForUpdates && app?.DownloadAndInstallUpdate)
}

export async function hasNativePrinting(): Promise<boolean> {
  const app = getDesktopApp()
  if (!app?.HasNativePrinting) return false
  try {
    return await app.HasNativePrinting()
  } catch {
    return false
  }
}

export async function listDesktopPrinters(): Promise<DesktopPrinterInfo[]> {
  const app = getDesktopApp()
  if (!app?.ListPrinters) return []
  try {
    return (await app.ListPrinters()) || []
  } catch {
    return []
  }
}

export async function desktopPrintPDF(
  pdfBase64: string,
  printerName = '',
  jobTitle = 'TruERP Document',
  paperWidthMm?: number | null,
  paperSize?: string | null
): Promise<boolean> {
  const app = getDesktopApp()
  if (!app?.PrintPDF) return false
  try {
    await app.PrintPDF(pdfBase64, printerName, jobTitle, paperWidthMm, paperSize)
    return true
  } catch (err) {
    throw new Error(invokeErrorMessage(err))
  }
}

/** Save PDF via native Downloads folder (desktop WKWebView cannot use `<a download>`). */
export async function desktopSavePDF(
  pdfBase64: string,
  filename: string
): Promise<boolean> {
  const app = getDesktopApp()
  if (!app?.SavePDF) return false
  try {
    await app.SavePDF(pdfBase64, filename)
    return true
  } catch (err) {
    throw new Error(invokeErrorMessage(err))
  }
}

/** Silent ESC/POS thermal print via desktop Winspool/CUPS (no print dialog). */
export async function desktopPrintThermal(
  content: string,
  printerName = '',
  paperWidthMm?: number | null,
  jobTitle = 'TruERP Receipt',
  logoEscposBase64?: string | null
): Promise<boolean> {
  const app = getDesktopApp()
  if (!app?.PrintThermal) return false
  try {
    await app.PrintThermal(content, printerName, paperWidthMm, jobTitle, logoEscposBase64)
    return true
  } catch (err) {
    throw new Error(invokeErrorMessage(err))
  }
}

/** Silent raw bytes (base64) to the thermal printer — no print dialog. */
export async function desktopPrintRaw(
  dataBase64: string,
  printerName = ''
): Promise<boolean> {
  const app = getDesktopApp()
  if (!app?.PrintRaw) return false
  if (!dataBase64?.trim()) return false
  try {
    await app.PrintRaw(dataBase64, printerName)
    return true
  } catch (err) {
    throw new Error(invokeErrorMessage(err))
  }
}

export async function getDesktopAppVersion(): Promise<string | null> {
  const app = getDesktopApp()
  if (!app?.AppVersion) return null
  try {
    return await app.AppVersion()
  } catch {
    return null
  }
}

export async function checkDesktopForUpdates(): Promise<DesktopUpdateCheckResult | null> {
  const app = getDesktopApp()
  if (!app?.CheckForUpdates) return null
  return app.CheckForUpdates()
}

export async function downloadAndInstallDesktopUpdate(): Promise<boolean> {
  const app = getDesktopApp()
  if (!app?.DownloadAndInstallUpdate) return false
  await app.DownloadAndInstallUpdate()
  return true
}

/** Subscribe to native updater download/install progress. Returns an unsubscribe fn. */
export async function subscribeDesktopUpdateProgress(
  onProgress: (progress: DesktopUpdateProgress) => void
): Promise<() => void> {
  const listen = getTauri()?.event?.listen
  if (!listen) return () => {}
  try {
    return await listen(UPDATE_PROGRESS_EVENT, (event) => {
      const payload = event?.payload
      if (!payload || typeof payload !== 'object') return
      onProgress({
        status: payload.status === 'installing' ? 'installing' : 'downloading',
        downloaded: Number(payload.downloaded) || 0,
        contentLength: payload.contentLength ?? null,
        percent:
          payload.percent == null || Number.isNaN(Number(payload.percent))
            ? null
            : Number(payload.percent),
      })
    })
  } catch {
    return () => {}
  }
}
