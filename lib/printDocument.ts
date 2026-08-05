import { apiFetch } from '@/hooks/useAuth'
import {
  desktopPrintThermal,
  hasNativePrinting,
  isDesktopApp,
} from '@/lib/desktopBridge'
import {
  normalizeThermalPrintSize,
  type ThermalPrintSize,
} from '@/lib/printSizes'
import { logoUrlToEscPosBase64 } from '@/lib/thermalEscPos'

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
  logo_url?: string
  logo_base64?: string
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
    const message =
      typeof err.error === 'string' && err.error.trim()
        ? err.error
        : `Failed to prepare print document (${res.status})`
    throw new Error(message)
  }
  return res.json()
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const raw = base64.includes('base64,') ? base64.split('base64,')[1] : base64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Download a PDF from base64 (A4 documents — no printer). */
export function downloadPdfBase64(pdfBase64: string, filename: string): void {
  if (!pdfBase64) {
    throw new Error('PDF was empty')
  }
  const bytes = base64ToUint8Array(pdfBase64)
  // Copy into a plain ArrayBuffer-backed view — required for BlobPart typing / WKWebView.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  triggerBlobDownload(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/** Download invoice PDF from API. */
export async function downloadInvoicePdf(
  invoiceId: string,
  options?: { invoiceNumber?: string }
): Promise<void> {
  const res = await apiFetch(`/invoices/${invoiceId}/pdf`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to download invoice PDF')
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('Invoice PDF was empty')
  }
  const name = options?.invoiceNumber
    ? `Invoice_${options.invoiceNumber}.pdf`
    : `Invoice_${invoiceId}.pdf`
  triggerBlobDownload(blob, name)
}

/** Download purchase invoice PDF from API. */
export async function downloadPurchaseBillPdf(
  billId: string,
  options?: { billNumber?: string }
): Promise<void> {
  const res = await apiFetch(`/purchase/bills/${billId}/download-pdf`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to download purchase invoice PDF')
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('Purchase invoice PDF was empty')
  }
  const name = options?.billNumber
    ? `Purchase_Invoice_${options.billNumber}.pdf`
    : `Purchase_Invoice_${billId}.pdf`
  triggerBlobDownload(blob, name)
}

function thermalReceiptHtml(content: string, widthMm: number, logoUrl?: string): string {
  const pageWidth = Math.max(40, Math.min(100, widthMm))
  const fontSize = pageWidth <= 42 ? 9 : pageWidth <= 60 ? 11 : 12
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const body = lines
    .map((raw) => {
      let center = false
      let bold = false
      let rest = raw
      while (true) {
        if (rest.startsWith('@C@')) {
          center = true
          rest = rest.slice(3)
          continue
        }
        if (rest.startsWith('@B@')) {
          bold = true
          rest = rest.slice(3)
          continue
        }
        if (rest.startsWith('@N@')) {
          center = false
          bold = false
          rest = rest.slice(3)
          continue
        }
        break
      }
      const style = [
        center ? 'text-align:center' : 'text-align:left',
        bold ? 'font-weight:700' : 'font-weight:400',
      ].join(';')
      const text = escapeHtml(rest || ' ')
      return `<div class="line" style="${style}">${text}</div>`
    })
    .join('')

  const logo =
    logoUrl && logoUrl.trim()
      ? `<div class="logo"><img src="${escapeHtml(logoUrl.trim())}" alt="" /></div>`
      : ''

  return `<!DOCTYPE html><html><head><title>Receipt</title>
<style>
  @page { size: ${pageWidth}mm auto; margin: 2mm; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${pageWidth}mm;
    font-family: "Courier New", Courier, monospace;
    font-size: ${fontSize}px;
    line-height: 1.25;
    color: #000;
  }
  .logo { text-align: center; margin: 0 0 4px; }
  .logo img { max-width: 70%; max-height: ${pageWidth <= 60 ? 36 : 48}px; object-fit: contain; }
  .line { white-space: pre-wrap; word-break: break-word; margin: 0; }
</style></head><body>${logo}${body}</body></html>`
}

/**
 * Print an HTML document from inside the current webview.
 * Never uses window.open — in Tauri that launches the system browser and breaks label printing.
 * Uses srcdoc + onload so WKWebView/Tauri can access the frame document reliably.
 */
export function printHtmlDocument(html: string, options?: { title?: string }): Promise<void> {
  if (!html?.trim()) {
    return Promise.reject(new Error('Print HTML was empty'))
  }

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', options?.title || 'TruERP Labels')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    // Non-zero size helps WebViews lay out @page label dimensions before printing.
    iframe.style.width = '1px'
    iframe.style.height = '1px'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'

    let settled = false
    let printed = false
    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err instanceof Error ? err : new Error('Unable to open print frame'))
    }

    const doPrint = () => {
      if (printed) return
      printed = true
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        if (!settled) {
          settled = true
          resolve()
        }
        setTimeout(cleanup, 120_000)
      } catch (err) {
        fail(err)
      }
    }

    iframe.onload = () => {
      // Barcodes are embedded as PNG data URIs — short delay is enough for layout.
      setTimeout(doPrint, 250)
    }

    document.body.appendChild(iframe)
    try {
      iframe.srcdoc = html
    } catch (err) {
      fail(err)
      return
    }
    // Some WebViews skip onload for srcdoc — still attempt print.
    setTimeout(doPrint, 800)
  })
}

/** Browser/desktop fallback: print thermal receipt via a hidden iframe (no PDF blank space). */
function printThermalTextInApp(
  content: string,
  widthMm = 58,
  logoUrl?: string
): Promise<void> {
  return printHtmlDocument(thermalReceiptHtml(content, widthMm, logoUrl), {
    title: 'TruERP Thermal Print',
  }).catch(async (err) => {
    // Last resort for stubborn WebViews: write via document API after append.
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'TruERP Thermal Print')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '1px'
    iframe.style.height = '1px'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
      iframe.remove()
      throw err instanceof Error ? err : new Error('Unable to open print frame')
    }
    doc.open()
    doc.write(thermalReceiptHtml(content, widthMm, logoUrl))
    doc.close()

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }
      const doPrint = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          resolve()
          setTimeout(cleanup, 60_000)
        } catch (printErr) {
          cleanup()
          reject(printErr)
        }
      }
      setTimeout(doPrint, logoUrl?.trim() ? 350 : 50)
    })
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
  logoUrl?: string
  logoBase64?: string
}): Promise<void> {
  const content = options.content?.trim()
  if (!content) {
    throw new Error('Thermal receipt content was empty')
  }
  const widthMm = options.paperWidthMm && options.paperWidthMm > 0 ? options.paperWidthMm : 58
  const preferNative = options.preferNative !== false
  const logoSrc = options.logoBase64?.trim() || options.logoUrl?.trim() || ''

  let logoEscpos: string | null = null
  if (logoSrc) {
    logoEscpos = await logoUrlToEscPosBase64(logoSrc, widthMm)
  }

  // Desktop: silent ESC/POS only. HTML iframe.print() opens the OS dialog and
  // does not drive thermal printers reliably in Tauri WebView.
  if (preferNative && isDesktopApp()) {
    if (!(await hasNativePrinting())) {
      throw new Error(
        'Desktop print bridge unavailable. Restart TruERP, then pick a thermal printer in Settings → Print.'
      )
    }
    const ok = await desktopPrintThermal(
      content,
      options.printerName || '',
      widthMm,
      options.title || 'TruERP Receipt',
      logoEscpos
    )
    if (!ok) {
      throw new Error(
        'Thermal print did not reach the printer. Pick a thermal printer in Settings → Print.'
      )
    }
    return
  }

  await printThermalTextInApp(content, widthMm, logoSrc || undefined)
}

/**
 * Print an invoice/expense: thermal ESC/POS when mode is thermal;
 * otherwise download A4 PDF (no printer).
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
        logoUrl: payload.logo_url,
        logoBase64: payload.logo_base64,
      })
      return payload
    }
    throw new Error('Print service did not return thermal content')
  }

  if (!payload.pdf_base64) {
    throw new Error('Print service did not return a PDF page')
  }

  const filename = payload.title?.trim()
    ? `${payload.title.replace(/[^\w\-]+/g, '_')}.pdf`
    : `${options.documentType}_${options.documentId}.pdf`
  downloadPdfBase64(payload.pdf_base64, filename)
  return payload
}

/** @deprecated Use downloadPurchaseBillPdf — A4 documents are downloaded, not printed. */
export async function printPurchaseBill(
  billId: string,
  options?: { billNumber?: string; preferNative?: boolean }
): Promise<void> {
  await downloadPurchaseBillPdf(billId, { billNumber: options?.billNumber })
}

/** Open A4 invoice PDF in the current app window (view/download only). */
export function openInvoicePdfPage(invoiceId: string): void {
  // In Tauri, window.open(_blank) launches the system browser with the app URL.
  window.location.assign(`/invoices/${invoiceId}/pdf`)
}
