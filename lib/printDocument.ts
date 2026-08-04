import { apiFetch } from '@/hooks/useAuth'
import {
  desktopPrintPDF,
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

function pdfBlobUrl(pdfBase64: string): string {
  const bytes = base64ToUint8Array(pdfBase64)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

/** Open/print a PDF page in the browser (proper PDF viewer, not HTML). */
function printPdfInBrowser(pdfBase64: string): void {
  const url = pdfBlobUrl(pdfBase64)
  const win = window.open(url, '_blank')
  if (!win) {
    // Popup blocked — fall back to embedded iframe print.
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
          URL.revokeObjectURL(url)
        }, 60_000)
      }
    }
    return
  }
  const revokeLater = () => {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  win.addEventListener('load', () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* user can print from PDF viewer */
    }
    revokeLater()
  })
  revokeLater()
}

/**
 * Print an invoice/expense as a proper PDF page (thermal or A4).
 * Desktop uses OS print of the PDF; browser opens the PDF viewer.
 */
export async function printDocument(options: {
  documentType: 'invoice' | 'expense'
  documentId: string
  mode?: InvoicePrintMode | ''
  printSize?: ThermalPrintSize
  preferNative?: boolean
}): Promise<DocumentPrintResult> {
  const payload = await fetchDocumentPrint(options)
  if (!payload.pdf_base64) {
    throw new Error('Print service did not return a PDF page')
  }

  const preferNative = options.preferNative !== false
  const printerName = payload.printer_name || ''

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

  if (preferNative && isDesktopApp() && (await hasNativePrinting())) {
    try {
      const ok = await desktopPrintPDF(
        payload.pdf_base64,
        printerName,
        payload.title,
        paperWidthMm,
        paperSize
      )
      if (ok) return payload
    } catch (err) {
      console.warn('Native PDF print failed, opening PDF viewer:', err)
    }
  }

  printPdfInBrowser(payload.pdf_base64)
  return payload
}

/** Open A4 invoice as a real PDF page. */
export function openInvoicePdfPage(invoiceId: string): void {
  window.open(`/invoices/${invoiceId}/pdf`, '_blank')
}
