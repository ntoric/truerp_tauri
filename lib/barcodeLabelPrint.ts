/**
 * Silent thermal barcode-label printing via ESC/POS raster (one horizontal label per row).
 * Desktop: Winspool/CUPS raw — no Windows print dialog.
 */

import {
  desktopPrintRaw,
  hasNativePrinting,
  isDesktopApp,
} from '@/lib/desktopBridge'
import { printHtmlDocument } from '@/lib/printDocument'
import {
  normalizeThermalPrintSize,
  type BarcodeLabelSize,
} from '@/lib/printSizes'

export interface BarcodeLabelItem {
  name: string
  barcode: string
  sku?: string
  price: number
  mrp?: number
}

export interface BarcodeLabelsPayload {
  title?: string
  size: BarcodeLabelSize
  width_mm: number
  height_mm: number
  compact?: boolean
  labels: BarcodeLabelItem[]
}

const LABEL_DIMS: Record<BarcodeLabelSize, { width: number; height: number }> = {
  '1inch': { width: 25.4, height: 15 },
  '1.5inch': { width: 38.1, height: 25 },
  '2inch': { width: 50.8, height: 30 },
  '3inch': { width: 76.2, height: 50 },
}

/** ~203 dpi thermal heads → 8 dots/mm */
function dotsForMm(mm: number): number {
  return Math.max(16, Math.round(mm * 8))
}

function truncate(text: string, maxChars: number): string {
  const t = (text || '').trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return 'Rs.0.00'
  return `Rs.${n.toFixed(2)}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load barcode image'))
    img.src = src
  })
}

/** Minimal Code128-B renderer → PNG data URL for canvas compositing. */
function code128DataUrl(value: string, moduleWidth = 2, heightPx = 48): string {
  const CODE128_B_START = 104
  const CODE128_STOP = 106
  // Patterns for code values 0–106 (bars/spaces widths, 6 digits each)
  const PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
  ]

  let payload = (value || '').trim() || '0000000000'
  // Code128-B printable ASCII only
  payload = payload.replace(/[^\x20-\x7F]/g, '?')
  if (!payload) payload = '0000000000'

  const codes: number[] = [CODE128_B_START]
  let checksum = CODE128_B_START
  for (let i = 0; i < payload.length; i += 1) {
    const code = payload.charCodeAt(i) - 32
    codes.push(code)
    checksum += code * (i + 1)
  }
  codes.push(checksum % 103)
  codes.push(CODE128_STOP)

  let modules = 0
  for (const c of codes) {
    const pat = PATTERNS[c] || PATTERNS[0]
    for (const ch of pat) modules += Number(ch) || 1
  }

  const mw = Math.max(1, Math.round(moduleWidth))
  const w = modules * mw
  const h = Math.max(16, heightPx)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#000'
  let x = 0
  for (const c of codes) {
    const pat = PATTERNS[c] || PATTERNS[0]
    let bar = true
    for (const ch of pat) {
      const run = (Number(ch) || 1) * mw
      if (bar) ctx.fillRect(x, 0, run, h)
      x += run
      bar = !bar
    }
  }
  return canvas.toDataURL('image/png')
}

function canvasToGsV0(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Uint8Array()
  const w = canvas.width
  const h = canvas.height
  const { data } = ctx.getImageData(0, 0, w, h)
  const bytesPerRow = Math.ceil(w / 8)
  const raster = new Uint8Array(bytesPerRow * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      if (a < 128) continue
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (lum < 180) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    h & 0xff, (h >> 8) & 0xff,
  ])
  const out = new Uint8Array(header.length + raster.length)
  out.set(header, 0)
  out.set(raster, header.length)
  return out
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(slice) as unknown as number[])
  }
  return btoa(binary)
}

async function renderLabelCanvas(
  item: BarcodeLabelItem,
  widthMm: number,
  heightMm: number,
  compact: boolean
): Promise<HTMLCanvasElement> {
  // Cap width to common head widths so drivers don't rotate/clip oddly.
  const maxDots = widthMm <= 42 ? 384 : widthMm <= 60 ? 384 : 576
  const width = Math.min(maxDots, dotsForMm(widthMm))
  const height = Math.min(dotsForMm(heightMm), Math.round(width * (heightMm / widthMm)))
  const pad = Math.max(2, Math.round(Math.min(width, height) * 0.04))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  const leftW = Math.floor(width * 0.42)
  const rightX = leftW + pad
  const rightW = width - rightX - pad
  const nameSize = Math.max(9, Math.round(height * 0.22))
  const priceSize = Math.max(10, Math.round(height * 0.26))
  const metaSize = Math.max(7, Math.round(height * 0.16))
  const maxNameChars = Math.max(6, Math.floor(leftW / (nameSize * 0.55)))

  let y = pad
  ctx.font = `bold ${nameSize}px Arial, Helvetica, sans-serif`
  ctx.fillText(truncate(item.name || 'Item', maxNameChars), pad, y, leftW - pad)
  y += nameSize + 2

  if (!compact && item.sku) {
    ctx.font = `${metaSize}px Arial, Helvetica, sans-serif`
    ctx.fillText(truncate(`SKU: ${item.sku}`, maxNameChars + 4), pad, y, leftW - pad)
    y += metaSize + 1
  }

  ctx.font = `bold ${priceSize}px Arial, Helvetica, sans-serif`
  ctx.fillText(formatPrice(item.price), pad, y, leftW - pad)
  y += priceSize + 1

  if (!compact && item.mrp && item.mrp > 0 && item.mrp !== item.price) {
    ctx.font = `${metaSize}px Arial, Helvetica, sans-serif`
    ctx.fillText(truncate(`MRP: ${formatPrice(item.mrp)}`, maxNameChars + 6), pad, y, leftW - pad)
  }

  const barcodeH = Math.max(18, Math.round(height * 0.55))
  const barcodeUrl = code128DataUrl(item.barcode || '0000000000', 2, barcodeH)
  try {
    const img = await loadImage(barcodeUrl)
    const scale = Math.min(rightW / img.width, barcodeH / img.height, 1)
    const bw = Math.max(1, Math.round(img.width * scale))
    const bh = Math.max(1, Math.round(img.height * scale))
    const bx = rightX + Math.max(0, Math.floor((rightW - bw) / 2))
    const by = Math.max(pad, Math.floor((height - bh - metaSize - 2) / 2))
    ctx.drawImage(img, bx, by, bw, bh)
    ctx.font = `${metaSize}px "Courier New", Courier, monospace`
    ctx.textAlign = 'center'
    ctx.fillText(truncate(item.barcode || '', Math.floor(rightW / (metaSize * 0.6))), rightX + rightW / 2, by + bh + 1, rightW)
    ctx.textAlign = 'left'
  } catch {
    ctx.font = `${metaSize}px "Courier New", Courier, monospace`
    ctx.fillText(truncate(item.barcode || '', 18), rightX, height / 2)
  }

  return canvas
}

/** Build ESC/POS bytes: init + one horizontal raster label per row + tiny feed (no fat receipt cut). */
export async function buildBarcodeLabelsEscPos(
  payload: BarcodeLabelsPayload
): Promise<Uint8Array> {
  const size = normalizeThermalPrintSize(payload.size)
  const dims = LABEL_DIMS[size]
  const widthMm = payload.width_mm > 0 ? payload.width_mm : dims.width
  const heightMm = payload.height_mm > 0 ? payload.height_mm : dims.height
  const compact = !!payload.compact || size === '1inch' || size === '1.5inch'
  const labels = payload.labels?.filter((l) => l && (l.name || l.barcode)) || []
  if (!labels.length) {
    throw new Error('No labels to print')
  }

  const parts: Uint8Array[] = []
  parts.push(new Uint8Array([0x1b, 0x40])) // init
  parts.push(new Uint8Array([0x1b, 0x61, 0x00])) // left align
  // Set print area width roughly to label width (GS W) when supported
  const widthDots = Math.min(widthMm <= 60 ? 384 : 576, dotsForMm(widthMm))
  parts.push(
    new Uint8Array([
      0x1d, 0x57,
      widthDots & 0xff, (widthDots >> 8) & 0xff,
    ])
  )

  for (const item of labels) {
    const canvas = await renderLabelCanvas(item, widthMm, heightMm, compact)
    const raster = canvasToGsV0(canvas)
    if (raster.length) {
      parts.push(raster)
      // Small advance to next sticker — avoid large blank feed / cut gaps
      parts.push(new Uint8Array([0x1b, 0x4a, 0x18])) // ESC J n — feed ~3mm
    }
  }

  return concatBytes(parts)
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildLabelsHtmlFallback(payload: BarcodeLabelsPayload): string {
  const size = normalizeThermalPrintSize(payload.size)
  const dims = LABEL_DIMS[size]
  const w = payload.width_mm > 0 ? payload.width_mm : dims.width
  const h = payload.height_mm > 0 ? payload.height_mm : dims.height
  const compact = !!payload.compact || size === '1inch' || size === '1.5inch'
  const barcodeH = Math.max(18, Math.round(h * 2.2))
  const body = (payload.labels || [])
    .map((item) => {
      const barcode = item.barcode || '0000000000'
      const name = escapeHtml(item.name || 'Item')
      const code = escapeHtml(barcode)
      const img = code128DataUrl(barcode, 2, barcodeH)
      const mrp =
        !compact && item.mrp && item.mrp > 0 && item.mrp !== item.price
          ? `<div class="product-mrp">MRP: ₹${item.mrp.toFixed(2)}</div>`
          : ''
      return `<div class="label">
  <div class="label-left">
    <div class="product-name">${name}</div>
    <div class="product-price">₹${Number(item.price || 0).toFixed(2)}</div>
    ${mrp}
  </div>
  <div class="product-barcode">
    ${img ? `<img class="barcode-img" src="${img}" alt="${code}" />` : ''}
    <div class="barcode-text">${code}</div>
  </div>
</div>`
    })
    .join('\n')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(payload.title || 'Labels')}</title>
<style>
@page { size: ${w}mm ${h}mm; margin: 0; }
html, body { width: ${w}mm; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
.label {
  width: ${w}mm; height: ${h}mm; max-width: ${w}mm; max-height: ${h}mm;
  padding: 1mm; display: flex; flex-direction: row; align-items: center;
  justify-content: space-between; gap: 1mm; overflow: hidden;
  page-break-after: always; break-after: page; page-break-inside: avoid;
}
.label:last-child { page-break-after: auto; break-after: auto; }
.label-left { flex: 1; min-width: 0; max-width: 48%; overflow: hidden; }
.product-name { font-size: 11px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product-price { font-size: 12px; font-weight: bold; }
.product-mrp { font-size: 8px; color: #555; }
.product-barcode { flex: 0 1 52%; max-width: 52%; text-align: center; overflow: hidden; }
.product-barcode .barcode-img { max-width: 100%; max-height: ${Math.max(8, h * 0.55)}mm; height: auto; display: block; margin: 0 auto; }
.barcode-text { font-family: "Courier New", monospace; font-size: 8px; }
@media print {
  html, body { width: ${w}mm !important; margin: 0 !important; }
  .label { width: ${w}mm !important; height: ${h}mm !important; }
}
</style></head><body>${body}</body></html>`
}

/**
 * Print barcode labels: desktop silent ESC/POS when available; otherwise in-app HTML iframe.
 * Never opens the system browser; avoids Windows print-options when native printing works.
 */
export async function printBarcodeLabels(
  payload: BarcodeLabelsPayload,
  options?: { printerName?: string; htmlFallback?: string }
): Promise<void> {
  if (!payload?.labels?.length) {
    throw new Error('No labels to print')
  }

  const preferNative = isDesktopApp() && (await hasNativePrinting())
  if (preferNative) {
    try {
      const bytes = await buildBarcodeLabelsEscPos(payload)
      const ok = await desktopPrintRaw(bytesToBase64(bytes), options?.printerName || '')
      if (ok) return
    } catch (err) {
      console.warn('Silent barcode label print failed, falling back to HTML print:', err)
    }
  }

  const html = options?.htmlFallback?.trim() || buildLabelsHtmlFallback(payload)
  printHtmlDocument(html, { title: payload.title || 'Barcode Labels' })
}

export function barcodeLabelDims(size: BarcodeLabelSize): { width: number; height: number } {
  return LABEL_DIMS[normalizeThermalPrintSize(size)]
}
