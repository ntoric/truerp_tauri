import { apiFetch } from '@/hooks/useAuth'
import {
  desktopPrintPDF,
  desktopPrintThermal,
  hasNativePrinting,
  isDesktopApp,
} from '@/lib/desktopBridge'
import {
  normalizeThermalPrintSize,
  type ThermalPrintSize,
} from '@/lib/printSizes'

export type InvoicePrintMode = 'a4' | 'thermal'

export interface PrintSettingsSnapshot {
  invoice_print_mode: InvoicePrintMode
  thermal_print_size: ThermalPrintSize
  thermal_printer_name?: string
  document_printer_name?: string
  paper_size?: string
  auto_print_on_pos?: boolean
}

export interface DocumentPrintResult {
  mode: InvoicePrintMode
  pdf_base64: string
  content_type: string
  content?: string
  width?: number
  printer_name?: string
  title: string
}

const DEFAULT_PRINT_SETTINGS: PrintSettingsSnapshot = {
  invoice_print_mode: 'a4',
  thermal_print_size: '2inch',
  paper_size: 'a4',
  auto_print_on_pos: true,
}

export async function fetchPrintSettings(): Promise<PrintSettingsSnapshot> {
  try {
    const res = await apiFetch('/settings/print')
    if (!res.ok) return DEFAULT_PRINT_SETTINGS
    const data = await res.json()
    return {
      invoice_print_mode: data.invoice_print_mode === 'thermal' ? 'thermal' : 'a4',
      thermal_print_size: normalizeThermalPrintSize(data.thermal_print_size),
      thermal_printer_name: data.thermal_printer_name || '',
      document_printer_name: data.document_printer_name || '',
      paper_size: data.paper_size || 'a4',
      auto_print_on_pos: data.auto_print_on_pos !== false,
    }
  } catch {
    return DEFAULT_PRINT_SETTINGS
  }
}

export async function fetchDocumentPrint(options: {
  documentType: 'invoice' | 'expense'
  documentId: string
  mode?: InvoicePrintMode | ''
  printSize?: ThermalPrintSize
}): Promise<DocumentPrintResult> {
  const res = await apiFetch('/printer/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_type: options.documentType,
      document_id: options.documentId,
      mode: options.mode || '',
      print_size: options.printSize || '',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to prepare print document')
  }
  return res.json()
}

function base64ToUint8Array(base64: string): Uint8Array {
  const raw = base64.includes('base64,') ? base64.split('base64,')[1] : base64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read PDF'))
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

function pdfBlobUrl(pdfBase64: string): string {
  const bytes = base64ToUint8Array(pdfBase64)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

/**
 * Print a PDF from inside the current webview.
 * Never uses window.open — in Tauri that would launch the system browser.
 */
function printPdfInApp(pdfBase64: string): void {
  const url = pdfBlobUrl(pdfBase64)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'TruERP Print')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.src = url
  document.body.appendChild(iframe)

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    URL.revokeObjectURL(url)
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (err) {
      console.warn('In-app PDF print failed:', err)
    } finally {
      setTimeout(cleanup, 60_000)
    }
  }
}

/** Browser fallback: print thermal text via a hidden preformatted iframe (no PDF blank space). */
function printThermalTextInApp(content: string, widthMm = 58): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'TruERP Thermal Print')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    throw new Error('Unable to open print frame')
  }
  const pageWidth = Math.max(40, Math.min(100, widthMm))
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><title>Receipt</title>
<style>
  @page { size: ${pageWidth}mm auto; margin: 2mm; }
  html, body { margin: 0; padding: 0; }
  body { width: ${pageWidth}mm; }
  pre {
    margin: 0;
    padding: 0;
    font-family: "Courier New", Courier, monospace;
    font-size: ${pageWidth <= 42 ? 9 : pageWidth <= 60 ? 11 : 12}px;
    line-height: 1.25;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style></head><body><pre>${escapeHtml(content)}</pre></body></html>`)
  doc.close()
  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(cleanup, 60_000)
    }
  }, 50)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Send PDF to OS printer (desktop) or in-app print dialog (browser/fallback). */
export async function printPdfBase64(
  pdfBase64: string,
  options?: {
    title?: string
    printerName?: string
    paperWidthMm?: number | null
    paperSize?: string | null
    preferNative?: boolean
  }
): Promise<void> {
  if (!pdfBase64) {
    throw new Error('Print service did not return a PDF page')
  }

  const preferNative = options?.preferNative !== false
  if (preferNative && isDesktopApp() && (await hasNativePrinting())) {
    try {
      const ok = await desktopPrintPDF(
        pdfBase64,
        options?.printerName || '',
        options?.title || 'TruERP Document',
        options?.paperWidthMm,
        options?.paperSize
      )
      if (ok) return
    } catch (err) {
      console.warn('Native PDF print failed, using in-app print dialog:', err)
    }
  }

  printPdfInApp(pdfBase64)
}

/**
 * Print thermal receipt: desktop uses silent ESC/POS; browser uses compact text print.
 */
export async function printThermalContent(options: {
  content: string
  printerName?: string
  paperWidthMm?: number
  title?: string
  preferNative?: boolean
}): Promise<void> {
  const content = options.content?.trim()
  if (!content) {
    throw new Error('Thermal receipt content was empty')
  }
  const widthMm = options.paperWidthMm && options.paperWidthMm > 0 ? options.paperWidthMm : 58
  const preferNative = options.preferNative !== false

  if (preferNative && isDesktopApp() && (await hasNativePrinting())) {
    try {
      const ok = await desktopPrintThermal(
        content,
        options.printerName || '',
        widthMm,
        options.title || 'TruERP Receipt'
      )
      if (ok) return
    } catch (err) {
      console.warn('Native thermal print failed, using in-app text print:', err)
    }
  }

  printThermalTextInApp(content, widthMm)
}

/**
 * Print an invoice/expense (thermal ESC/POS on desktop, or A4 PDF).
 */
export async function printDocument(options: {
  documentType: 'invoice' | 'expense'
  documentId: string
  mode?: InvoicePrintMode | ''
  printSize?: ThermalPrintSize
  preferNative?: boolean
}): Promise<DocumentPrintResult> {
  const payload = await fetchDocumentPrint(options)

  if (payload.mode === 'thermal') {
    const content = payload.content?.trim()
    if (content) {
      await printThermalContent({
        content,
        printerName: payload.printer_name || '',
        paperWidthMm: typeof payload.width === 'number' ? payload.width : 58,
        title: payload.title,
        preferNative: options.preferNative,
      })
      return payload
    }
    if (!payload.pdf_base64) {
      throw new Error('Print service did not return thermal content')
    }
  }

  if (!payload.pdf_base64) {
    throw new Error('Print service did not return a PDF page')
  }

  let paperSize: string | undefined
  let paperWidthMm: number | undefined
  if (payload.mode === 'thermal') {
    if (typeof payload.width === 'number' && payload.width > 0) {
      paperWidthMm = payload.width
    }
  } else {
    try {
      const settings = await fetchPrintSettings()
      paperSize = settings.paper_size || 'a4'
    } catch {
      paperSize = 'a4'
    }
  }

  await printPdfBase64(payload.pdf_base64, {
    title: payload.title,
    printerName: payload.printer_name || '',
    paperWidthMm,
    paperSize,
    preferNative: options.preferNative,
  })
  return payload
}

/** Print a purchase invoice PDF via desktop native print (or in-app dialog). */
export async function printPurchaseBill(
  billId: string,
  options?: { billNumber?: string; preferNative?: boolean }
): Promise<void> {
  const [settings, res] = await Promise.all([
    fetchPrintSettings(),
    apiFetch(`/purchase/bills/${billId}/download-pdf`),
  ])
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to prepare purchase invoice PDF')
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('Purchase invoice PDF was empty')
  }
  const pdfBase64 = await blobToBase64(blob)
  const title = options?.billNumber
    ? `Purchase Invoice ${options.billNumber}`
    : 'Purchase Invoice'
  await printPdfBase64(pdfBase64, {
    title,
    printerName: settings.document_printer_name || '',
    paperSize: settings.paper_size || 'a4',
    preferNative: options?.preferNative,
  })
}

/** Open A4 invoice PDF in the current app window (no new browser tab). */
export function openInvoicePdfPage(invoiceId: string): void {
  // In Tauri, window.open(_blank) launches the system browser with the app URL.
  window.location.assign(`/invoices/${invoiceId}/pdf`)
}
