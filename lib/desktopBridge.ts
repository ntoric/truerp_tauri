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
  PrintThermal?: (
    content: string,
    printerName: string,
    paperWidthMm?: number | null,
    jobTitle?: string,
    logoEscposBase64?: string | null
  ) => Promise<void>
  AppVersion?: () => Promise<string>
  CheckForUpdates?: () => Promise<DesktopUpdateCheckResult>
  DownloadAndInstallUpdate?: () => Promise<void>
}

type TauriCore = {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
}

function getTauriCore(): TauriCore | null {
  if (typeof window === 'undefined') return null
  const tauri = (window as unknown as { __TAURI__?: { core?: TauriCore } }).__TAURI__
  return tauri?.core ?? null
}

function getDesktopApp(): DesktopAppBridge | null {
  if (typeof window === 'undefined') return null
  const go = (window as unknown as { go?: { main?: { App?: DesktopAppBridge } } }).go
  if (go?.main?.App) return go.main.App

  // Tauri desktop shell (frontend/src-tauri) — same print surface via invoke().
  const core = getTauriCore()
  if (!core?.invoke) return null
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
    PrintThermal: (content, printerName, paperWidthMm, jobTitle, logoEscposBase64) =>
      invoke('print_thermal', {
        content,
        printerName: printerName || '',
        paperWidthMm: paperWidthMm ?? null,
        jobTitle: jobTitle || 'TruERP Receipt',
        logoEscposBase64: logoEscposBase64 || null,
      }) as Promise<void>,
    AppVersion: () => invoke('app_version') as Promise<string>,
    CheckForUpdates: () => invoke('check_for_updates') as Promise<DesktopUpdateCheckResult>,
    DownloadAndInstallUpdate: () => invoke('download_and_install_update') as Promise<void>,
  }
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
  await app.PrintPDF(pdfBase64, printerName, jobTitle, paperWidthMm, paperSize)
  return true
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
  await app.PrintThermal(content, printerName, paperWidthMm, jobTitle, logoEscposBase64)
  return true
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
