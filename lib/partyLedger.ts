import { apiFetch } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/accountingExport'
import { printHtmlDocument } from '@/lib/printDocument'
import { formatCurrency, formatDate } from '@/lib/utils'

export interface PartyLedgerParty {
  id: string
  name: string
  phone: string
  email: string
  gstin: string
  party_type: string
  opening_balance: number
  balance: number
}

export interface PartyLedgerEntry {
  type: string
  voucher: string
  ref_id?: string
  ref_number: string
  date: string
  payment_mode: string
  debit: number
  credit: number
  balance: number
  due_date?: string
  due_status?: 'paid' | 'partial' | 'unpaid' | ''
  overdue_days?: number
}

export interface PartyLedger {
  party: PartyLedgerParty
  from_date: string
  to_date: string
  label: string
  opening_balance: number
  closing_balance: number
  total_debit: number
  total_credit: number
  total_sales: number
  total_purchases: number
  total_received: number
  total_paid: number
  overdue_amount: number
  entries: PartyLedgerEntry[]
}

export type PartyLedgerPeriod =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'previous_month'
  | 'this_year'
  | 'custom'

export const PARTY_LEDGER_PERIODS: { value: PartyLedgerPeriod; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Map a period preset to an inclusive [from_date, to_date] range (local dates). */
export function partyLedgerRange(
  period: PartyLedgerPeriod,
  customFrom = '',
  customTo = ''
): { from_date: string; to_date: string } {
  const now = new Date()
  const today = localISO(now)
  switch (period) {
    case 'today':
      return { from_date: today, to_date: today }
    case 'this_week': {
      const weekday = now.getDay() === 0 ? 7 : now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (weekday - 1))
      return { from_date: localISO(monday), to_date: today }
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from_date: localISO(first), to_date: today }
    }
    case 'previous_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from_date: localISO(first), to_date: localISO(last) }
    }
    case 'this_year':
      return { from_date: `${now.getFullYear()}-01-01`, to_date: today }
    case 'custom':
      return { from_date: customFrom, to_date: customTo }
    case 'all':
    default:
      return { from_date: '', to_date: '' }
  }
}

function buildQuery(fromDate: string, toDate: string): string {
  const qs = new URLSearchParams()
  if (fromDate) qs.set('from_date', fromDate)
  if (toDate) qs.set('to_date', toDate)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function fetchPartyLedger(
  partyId: string,
  fromDate: string,
  toDate: string
): Promise<PartyLedger> {
  const res = await apiFetch(`/parties/${partyId}/ledger${buildQuery(fromDate, toDate)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load party ledger')
  }
  return res.json()
}

export async function downloadPartyLedgerExcel(
  partyId: string,
  fromDate: string,
  toDate: string,
  partyName: string
): Promise<void> {
  const res = await apiFetch(`/parties/${partyId}/ledger/excel${buildQuery(fromDate, toDate)}`, {
    timeoutMs: 30000,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to export Excel')
  }
  const blob = await res.blob()
  if (!blob.size) throw new Error('Export was empty')
  const safe = partyName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '')
  await downloadBlob(`party_statement_${safe || 'ledger'}.xlsx`, blob, {
    label: 'Exporting party statement',
  })
}

/** Fetch the printable HTML statement and print it in-app (no system browser). */
export async function printPartyLedger(
  partyId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  const res = await apiFetch(`/parties/${partyId}/ledger/pdf${buildQuery(fromDate, toDate)}`, {
    timeoutMs: 30000,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to prepare statement')
  }
  const html = await res.text()
  if (!html.trim()) throw new Error('Statement was empty')
  await printHtmlDocument(html, { title: 'Party Statement' })
}

export function partyLedgerModeLabel(mode: string): string {
  if (!mode || mode === '-') return '—'
  return mode
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function buildPartyLedgerShareText(ledger: PartyLedger): string {
  const isVendor = ledger.party.party_type === 'vendor'
  const docLabel = isVendor ? 'Purchases' : 'Sales'
  const moneyLabel = isVendor ? 'Paid' : 'Received'
  const direction = ledger.closing_balance < 0 ? 'payable' : 'receivable'
  const lines = [
    `Party Statement — ${ledger.party.name}`,
    `Period: ${ledger.label}`,
    '',
    `Opening balance: ${formatCurrency(ledger.opening_balance)}`,
    `${docLabel}: ${formatCurrency(isVendor ? ledger.total_purchases : ledger.total_sales)}`,
    `${moneyLabel}: ${formatCurrency(isVendor ? ledger.total_paid : ledger.total_received)}`,
    `Closing balance: ${formatCurrency(Math.abs(ledger.closing_balance))} (${direction})`,
    `Overdue: ${formatCurrency(ledger.overdue_amount)}`,
    '',
    'Date · Voucher · Ref · Credit · Debit · Balance',
    '-----------------------------------------------',
  ]
  for (const e of ledger.entries) {
    const date = e.date ? formatDate(e.date + 'T00:00:00') : '—'
    const credit = e.credit > 0 ? formatCurrency(e.credit) : '—'
    const debit = e.debit > 0 ? formatCurrency(e.debit) : '—'
    lines.push(`${date} · ${e.voucher} · ${e.ref_number} · ${credit} · ${debit} · ${formatCurrency(e.balance)}`)
  }
  lines.push('', 'Generated from TruERP')
  return lines.join('\n')
}
