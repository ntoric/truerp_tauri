/**
 * Silent thermal barcode-label printing via ESC/POS raster.
 * Layout: name (1–2 lines) → barcode → MRP left / sale price right.
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

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return 'Rs.0.00'
  return `Rs.${n.toFixed(2)}`
}

/** Word-wrap text into at most `maxLines` lines that fit `maxWidth` (no ellipsis). */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const raw = (text || '').trim() || 'Item'
  const words = raw.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  let wordIndex = 0

  const flush = () => {
    if (current) {
      lines.push(current)
      current = ''
    }
  }

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex]
    const trial = current ? `${current} ${word}` : word
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial
      wordIndex += 1
      continue
    }
    if (current) {
      flush()
      if (lines.length >= maxLines) break
      continue
    }
    // Single word wider than line: split by character (still no ellipsis).
    let chunk = ''
    for (const ch of word) {
      const next = chunk + ch
      if (ctx.measureText(next).width > maxWidth && chunk) {
        lines.push(chunk)
        chunk = ch
        if (lines.length >= maxLines) break
      } else {
        chunk = next
      }
    }
    current = chunk
    wordIndex += 1
    if (lines.length >= maxLines) {
      current = ''
      break
    }
  }
  if (lines.length < maxLines) flush()

  // Put any remaining words on the last line so names/codes are not cut with "…".
  if (wordIndex < words.length) {
    const rest = words.slice(wordIndex).join(' ')
    if (!lines.length) lines.push(rest)
    else lines[lines.length - 1] = `${lines[lines.length - 1]} ${rest}`.trim()
  } else if (current) {
    if (lines.length < maxLines) lines.push(current)
    else if (lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} ${current}`.trim()
  }

  return lines.length ? lines : [raw]
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
  _compact: boolean
): Promise<HTMLCanvasElement> {
  // Cap width to common head widths so drivers don't rotate/clip oddly.
  const maxDots = widthMm <= 42 ? 384 : widthMm <= 60 ? 384 : 576
  const width = Math.min(maxDots, dotsForMm(widthMm))
  const height = Math.min(dotsForMm(heightMm), Math.round(width * (heightMm / widthMm)))
  const pad = Math.max(2, Math.round(Math.min(width, height) * 0.05))
  const contentW = width - pad * 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  const nameSize = Math.max(10, Math.round(height * 0.16))
  const priceSize = Math.max(10, Math.round(height * 0.18))
  const metaSize = Math.max(8, Math.round(height * 0.13))
  const codeSize = Math.max(8, Math.round(height * 0.12))

  // 1) Product name — up to 2 wrapped lines, normal weight, no ellipsis truncation
  let y = pad
  ctx.font = `${nameSize}px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'center'
  const nameLines = wrapTextLines(ctx, item.name || 'Item', contentW, 2)
  for (const line of nameLines) {
    ctx.fillText(line, width / 2, y)
    y += nameSize + 1
  }
  y += 2

  // 2) Barcode (full width) + human-readable code (no truncation)
  const barcodeCode = (item.barcode || '0000000000').trim() || '0000000000'
  const priceRowH = priceSize + 2
  const codeH = codeSize + 2
  const barcodeMaxH = Math.max(20, height - y - pad - priceRowH - codeH - 2)
  // Prefer fitting full barcode bars in width (module width may shrink for long codes)
  let moduleW = 2
  let barcodeUrl = code128DataUrl(barcodeCode, moduleW, barcodeMaxH)
  try {
    let img = await loadImage(barcodeUrl)
    if (img.width > contentW && moduleW > 1) {
      moduleW = 1
      barcodeUrl = code128DataUrl(barcodeCode, moduleW, barcodeMaxH)
      img = await loadImage(barcodeUrl)
    }
    const scale = Math.min(contentW / img.width, barcodeMaxH / img.height)
    const bw = Math.max(1, Math.round(img.width * scale))
    const bh = Math.max(1, Math.round(img.height * scale))
    const bx = Math.floor((width - bw) / 2)
    ctx.drawImage(img, bx, y, bw, bh)
    y += bh + 1
  } catch {
    /* text fallback below */
  }

  ctx.font = `${codeSize}px "Courier New", Courier, monospace`
  ctx.textAlign = 'center'
  // Wrap barcode text if needed — never ellipsize
  const codeLines = wrapTextLines(ctx, barcodeCode, contentW, 3)
  for (const line of codeLines) {
    ctx.fillText(line, width / 2, y)
    y += codeSize + 1
  }

  // 3) MRP left · sale price right
  const bottomY = height - pad - priceSize
  ctx.font = `${metaSize}px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (item.mrp && item.mrp > 0) {
    ctx.fillText(`MRP: ${formatPrice(item.mrp)}`, pad, bottomY + priceSize)
  } else if (item.sku) {
    ctx.fillText(`SKU: ${item.sku}`, pad, bottomY + priceSize)
  }

  ctx.font = `bold ${priceSize}px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText(formatPrice(item.price), width - pad, bottomY + priceSize)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

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
  const barcodeH = Math.max(24, Math.round(h * 2.4))
  const body = (payload.labels || [])
    .map((item) => {
      const barcode = item.barcode || '0000000000'
      const name = escapeHtml(item.name || 'Item')
      const code = escapeHtml(barcode)
      const img = code128DataUrl(barcode, 2, barcodeH)
      const mrp =
        item.mrp && item.mrp > 0
          ? `<span class="product-mrp">MRP: ₹${item.mrp.toFixed(2)}</span>`
          : item.sku
            ? `<span class="product-sku">SKU: ${escapeHtml(item.sku)}</span>`
            : ''
      return `<div class="label">
  <div class="product-name">${name}</div>
  <div class="product-barcode">
    ${img ? `<img class="barcode-img" src="${img}" alt="${code}" />` : ''}
    <div class="barcode-text">${code}</div>
  </div>
  <div class="price-row">
    ${mrp}
    <span class="product-price">₹${Number(item.price || 0).toFixed(2)}</span>
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
  padding: 1mm; display: flex; flex-direction: column; align-items: stretch;
  justify-content: space-between; gap: 0.4mm; overflow: hidden;
  page-break-after: always; break-after: page; page-break-inside: avoid;
}
.label:last-child { page-break-after: auto; break-after: auto; }
.product-name {
  font-size: 11px; font-weight: 400; line-height: 1.15; text-align: center;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  overflow: hidden; word-break: break-word; overflow-wrap: anywhere;
}
.product-barcode { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.product-barcode .barcode-img { max-width: 100%; max-height: ${Math.max(8, h * 0.42)}mm; height: auto; display: block; margin: 0 auto; }
.barcode-text {
  font-family: "Courier New", monospace; font-size: 8px; text-align: center;
  width: 100%; word-break: break-all; overflow-wrap: anywhere; white-space: normal;
}
.price-row { display: flex; justify-content: space-between; align-items: baseline; gap: 1mm; width: 100%; }
.product-mrp, .product-sku { font-size: 9px; color: #333; text-align: left; word-break: break-word; }
.product-price { font-size: 12px; font-weight: 700; text-align: right; white-space: nowrap; }
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

  // Desktop: silent ESC/POS only. HTML iframe.print() opens the OS dialog and
  // mis-renders thermal labels in Tauri WebView — never use it as a soft fallback.
  if (isDesktopApp()) {
    if (!(await hasNativePrinting())) {
      throw new Error(
        'Desktop print bridge unavailable. Restart TruERP, then pick a thermal printer in Settings → Print.'
      )
    }
    const bytes = await buildBarcodeLabelsEscPos(payload)
    const ok = await desktopPrintRaw(bytesToBase64(bytes), options?.printerName || '')
    if (!ok) {
      throw new Error(
        'Label print did not reach the printer. Pick a thermal printer in Settings → Print.'
      )
    }
    return
  }

  const html = options?.htmlFallback?.trim() || buildLabelsHtmlFallback(payload)
  await printHtmlDocument(html, { title: payload.title || 'Barcode Labels' })
}

export function barcodeLabelDims(size: BarcodeLabelSize): { width: number; height: number } {
  return LABEL_DIMS[normalizeThermalPrintSize(size)]
}
