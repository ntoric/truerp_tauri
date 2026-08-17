import { thermalWidthMM, type ThermalPrintSize } from '@/lib/printSizes'
import { formatQty } from '@/lib/numbers'
import { formatPaymentSplitsLabel, type PaymentSplit } from '@/lib/paymentSplits'

export interface POSReceiptBusiness {
  name?: string
  gstin?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  phone?: string
  logo_data_url?: string
}

export interface POSReceiptItem {
  description: string
  quantity: number
  unit?: string
  unit_price: number
  tax_rate?: number
  total: number
}

export interface POSReceiptSale {
  invoice_number: string
  date: string
  party_name?: string
  party_phone?: string
  payment_mode?: string
  payment_splits?: PaymentSplit[]
  amount_paid?: number
  invoice_discount?: number
  tax_total?: number
  round_off?: number
  total: number
  items: POSReceiptItem[]
}

function thermalCols(printSize: ThermalPrintSize): number {
  switch (printSize) {
    case '1inch':
      return 16
    case '1.5inch':
      return 24
    case '3inch':
      return 48
    default:
      return 32
  }
}

function padSep(cols: number, ch: string): string {
  return ch.repeat(Math.max(8, cols))
}

function truncate(text: string, max: number): string {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1))}…`
}

function money(value: number): string {
  return (Number(value) || 0).toFixed(2)
}

function labelValue(label: string, value: string, cols: number): string {
  const left = `${label}:`
  const right = value
  const space = cols - left.length - right.length
  if (space >= 1) return `${left}${' '.repeat(space)}${right}`
  return truncate(`${left} ${right}`, cols)
}

function wrapText(text: string, cols: number): string[] {
  const raw = String(text || '').trim()
  if (!raw) return []
  const words = raw.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= cols) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word.length > cols ? truncate(word, cols) : word
    }
  }
  if (current) lines.push(current)
  return lines
}

function stackedItemLine(qty: string, rate: string, total: string, cols: number): string {
  const left = `${qty} x ${rate}`
  const space = cols - left.length - total.length
  if (space >= 1) return `${left}${' '.repeat(space)}${total}`
  return truncate(`${left} ${total}`, cols)
}

export function buildPOSReceiptContent(
  business: POSReceiptBusiness,
  sale: POSReceiptSale,
  printSize: ThermalPrintSize = '2inch'
): string {
  const cols = thermalCols(printSize)
  const strong = padSep(cols, '=')
  const weak = padSep(cols, '-')
  const lines: string[] = []

  const name = business.name?.trim() || 'TruERP'
  lines.push(truncate(name, cols))
  const addressParts = [business.address, business.city, business.state, business.pincode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
  for (const line of wrapText(addressParts.join(', '), cols)) {
    lines.push(line)
  }
  if (business.gstin?.trim()) lines.push(truncate(`GSTIN: ${business.gstin.trim()}`, cols))
  if (business.phone?.trim()) lines.push(truncate(`Ph: ${business.phone.trim()}`, cols))

  lines.push(strong)
  lines.push('TAX INVOICE')
  lines.push(labelValue('Invoice', sale.invoice_number, cols))
  const date = sale.date ? new Date(sale.date) : new Date()
  const dateLabel = Number.isNaN(date.getTime())
    ? sale.date
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  lines.push(labelValue('Date', dateLabel, cols))
  lines.push(weak)

  lines.push(truncate(`Bill To: ${sale.party_name || 'Walk-in Customer'}`, cols))
  if (sale.party_phone?.trim()) {
    lines.push(truncate(`Ph: ${sale.party_phone.trim()}`, cols))
  }
  lines.push(weak)

  for (const item of sale.items) {
    lines.push(truncate(item.description, cols))
    const qty = `${formatQty(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`
    lines.push(stackedItemLine(qty.trim(), money(item.unit_price), money(item.total), cols))
  }

  lines.push(weak)
  const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  lines.push(labelValue('Sub Total', money(subTotal), cols))
  if ((sale.invoice_discount || 0) > 0) {
    lines.push(labelValue('Discount', money(sale.invoice_discount || 0), cols))
  }
  if ((sale.tax_total || 0) > 0) {
    lines.push(labelValue('GST', money(sale.tax_total || 0), cols))
  }
  if (sale.round_off) {
    lines.push(labelValue('Round Off', money(sale.round_off), cols))
  }
  lines.push(labelValue('TOTAL', money(sale.total), cols))
  const paymentLabel = formatPaymentSplitsLabel(sale.payment_splits, sale.payment_mode)
  if (paymentLabel) {
    lines.push(labelValue('Payment', paymentLabel, cols))
  }
  if (typeof sale.amount_paid === 'number') {
    lines.push(labelValue('Paid', money(sale.amount_paid), cols))
  }
  lines.push(strong)
  lines.push('Thank you for your business!')
  return `${lines.join('\n')}\n`
}

export function receiptPaperWidthMm(printSize: ThermalPrintSize = '2inch'): number {
  return thermalWidthMM(printSize)
}
