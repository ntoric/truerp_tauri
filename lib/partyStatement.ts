import { apiFetch } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/accountingExport'

/**
 * Party balance statement ("balance reminder") sent to parties: the previous
 * and current balance for a period plus the detailed statement PDF.
 * Sent on WhatsApp or Telegram; email is a planned channel.
 */

export type StatementChannel = 'whatsapp' | 'telegram' | 'email'

export const STATEMENT_CHANNELS: { value: StatementChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
]

export type StatementPeriod =
  | 'this_week'
  | 'previous_week'
  | 'this_month'
  | 'previous_month'
  | 'last_n_days'
  | 'this_quarter'
  | 'previous_quarter'
  | 'this_fy'
  | 'previous_fy'
  | 'custom'

export const STATEMENT_PERIODS: { value: StatementPeriod; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'previous_week', label: 'Previous week' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_n_days', label: 'Last N days' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'previous_quarter', label: 'Previous quarter' },
  { value: 'this_fy', label: 'This financial year' },
  { value: 'previous_fy', label: 'Previous financial year' },
  { value: 'custom', label: 'Custom range' },
]

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const DEFAULT_PERIOD_DAYS = 30
export const MAX_PERIOD_DAYS = 366

/** Clamps a "last N days" value to 1–366 (falls back to 30). */
export function normalizePeriodDays(n: unknown): number {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v) || v < 1) return DEFAULT_PERIOD_DAYS
  return Math.min(v, MAX_PERIOD_DAYS)
}

/** Display label for a period, with N filled in for last_n_days. */
export function statementPeriodLabel(period: StatementPeriod, days = DEFAULT_PERIOD_DAYS): string {
  if (period === 'last_n_days') return `Last ${days} day${days === 1 ? '' : 's'}`
  return STATEMENT_PERIODS.find((p) => p.value === period)?.label ?? period
}

/**
 * Resolves a period preset to an inclusive [from, to] range in local dates.
 * Weeks run Monday–Sunday; FY = April–March. days is N for last_n_days.
 */
export function statementPeriodRange(
  period: StatementPeriod,
  customFrom = '',
  customTo = '',
  days = DEFAULT_PERIOD_DAYS,
  now = new Date(),
): { from_date: string; to_date: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = iso(now)
  const fyStart = m >= 3 ? y : y - 1
  const qStart = Math.floor(m / 3) * 3
  const weekStart = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7)) // Monday
  switch (period) {
    case 'this_week':
      return { from_date: iso(weekStart), to_date: today }
    case 'previous_week': {
      const prevStart = new Date(weekStart)
      prevStart.setDate(weekStart.getDate() - 7)
      const prevEnd = new Date(weekStart)
      prevEnd.setDate(weekStart.getDate() - 1)
      return { from_date: iso(prevStart), to_date: iso(prevEnd) }
    }
    case 'this_month':
      return { from_date: iso(new Date(y, m, 1)), to_date: today }
    case 'previous_month':
      return { from_date: iso(new Date(y, m - 1, 1)), to_date: iso(new Date(y, m, 0)) }
    case 'last_n_days': {
      const start = new Date(y, m, now.getDate() - (normalizePeriodDays(days) - 1))
      return { from_date: iso(start), to_date: today }
    }
    case 'this_quarter':
      return { from_date: iso(new Date(y, qStart, 1)), to_date: today }
    case 'previous_quarter':
      return { from_date: iso(new Date(y, qStart - 3, 1)), to_date: iso(new Date(y, qStart, 0)) }
    case 'this_fy':
      return { from_date: `${fyStart}-04-01`, to_date: today }
    case 'previous_fy':
      return { from_date: `${fyStart - 1}-04-01`, to_date: `${fyStart}-03-31` }
    case 'custom':
    default:
      return { from_date: customFrom, to_date: customTo }
  }
}

export function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return y && m && d ? `${d}-${m}-${y}` : isoDate
}

export interface StatementField {
  key: string
  label: string
}

export interface PartyStatementSettings {
  default_period: StatementPeriod
  /** N for the last_n_days period. */
  default_period_days: number
  whatsapp_message_id: string
  whatsapp_language_code: string
  /** Comma-separated field keys; position N fills template variable {{N}}. */
  whatsapp_variable_mapping: string
  whatsapp_template_body?: string
  whatsapp_attach_pdf: boolean
  /** Text sent with the PDF on Telegram, with {field} placeholders. Empty = default. */
  telegram_message: string
  // read-only
  channels?: StatementChannel[]
  periods?: StatementField[]
  available_fields?: StatementField[]
  default_mapping?: string
  whatsapp_ready?: boolean
  /** The store's Telegram bot is connected and switched on. */
  telegram_ready?: boolean
  whatsapp_provider?: string
  whatsapp_invoice_language?: string
  has_public_base_url?: boolean
  /** Value the store_name variable fills (display name or business name). */
  store_name?: string
  default_telegram_message?: string
  /** Placeholders a Telegram message can use. */
  telegram_fields?: StatementField[]
}

export type PartyStatementSettingsPayload = Pick<
  PartyStatementSettings,
  | 'default_period'
  | 'default_period_days'
  | 'whatsapp_message_id'
  | 'whatsapp_language_code'
  | 'whatsapp_variable_mapping'
  | 'whatsapp_template_body'
  | 'whatsapp_attach_pdf'
  | 'telegram_message'
>

export interface PartyStatementLog {
  id: string
  party_id: string
  party_name: string
  channel: StatementChannel
  recipient: string
  from_date: string
  to_date: string
  opening_balance: number
  closing_balance: number
  trigger: 'manual' | 'bulk' | 'test'
  status: 'sent' | 'failed' | 'skipped'
  error: string
  created_at: string
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || fallback)
  return data as T
}

export async function fetchPartyStatementSettings(): Promise<PartyStatementSettings> {
  return readJson(await apiFetch('/settings/party-statement'), 'Failed to load statement settings')
}

export async function savePartyStatementSettings(
  payload: PartyStatementSettingsPayload,
): Promise<PartyStatementSettings> {
  return readJson(
    await apiFetch('/settings/party-statement', { method: 'PUT', body: JSON.stringify(payload) }),
    'Failed to save statement settings',
  )
}

/** Sends a test statement; phone is a WhatsApp number, or a chat ID for Telegram. */
export async function sendPartyStatementTest(
  phone: string,
  fromDate: string,
  toDate: string,
  channel: StatementChannel = 'whatsapp',
  partyId?: string,
) {
  return readJson<{ message: string; log: PartyStatementLog }>(
    await apiFetch('/settings/party-statement/test', {
      method: 'POST',
      body: JSON.stringify({ channel, phone, from_date: fromDate, to_date: toDate, party_id: partyId || '' }),
      timeoutMs: 60000,
    }),
    'Failed to send test statement',
  )
}

/** Sends one party's statement; recipient overrides the party's own number. */
export async function sendPartyStatement(
  partyId: string,
  channel: StatementChannel,
  fromDate: string,
  toDate: string,
  recipient?: string,
) {
  return readJson<{ message: string; log: PartyStatementLog }>(
    await apiFetch(`/parties/${partyId}/statement/send`, {
      method: 'POST',
      body: JSON.stringify({ channel, from_date: fromDate, to_date: toDate, recipient: recipient || '' }),
      timeoutMs: 60000,
    }),
    'Failed to send statement',
  )
}

export type BulkStatementSelection =
  | { ids: string[] }
  | {
      all_matching: true
      filters: { search: string; category: string; party_type: string; balance: string }
    }

/** Queues statements for many parties; they're sent in the background. */
export async function sendPartyStatementsBulk(
  selection: BulkStatementSelection,
  channel: StatementChannel,
  fromDate: string,
  toDate: string,
  includeZeroBalance: boolean,
) {
  return readJson<{ message: string; queued: number }>(
    await apiFetch('/parties/statement/send-bulk', {
      method: 'POST',
      body: JSON.stringify({
        ...selection,
        channel,
        from_date: fromDate,
        to_date: toDate,
        include_zero_balance: includeZeroBalance,
      }),
    }),
    'Failed to queue statements',
  )
}

export async function fetchPartyStatementLogs(
  opts: { partyId?: string; limit?: number } = {},
): Promise<{ logs: PartyStatementLog[]; bulk_running: boolean }> {
  const qs = new URLSearchParams({ limit: String(opts.limit ?? 50) })
  if (opts.partyId) qs.set('party_id', opts.partyId)
  return readJson(await apiFetch(`/parties/statement/logs?${qs}`), 'Failed to load statement log')
}

export async function downloadPartyStatementPdf(
  partyId: string,
  fromDate: string,
  toDate: string,
  partyName: string,
): Promise<void> {
  const qs = new URLSearchParams({ from_date: fromDate, to_date: toDate })
  const res = await apiFetch(`/parties/${partyId}/statement/pdf?${qs}`, { timeoutMs: 30000 })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to download statement')
  }
  const blob = await res.blob()
  if (!blob.size) throw new Error('PDF was empty')
  const safe = partyName.trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '') || 'Party'
  await downloadBlob(`Statement_${safe}_${fromDate}_to_${toDate}.pdf`, blob, {
    label: 'Downloading statement PDF',
  })
}

/** The reminder template from the approved WhatsApp design, for previews. */
export const DEFAULT_STATEMENT_TEMPLATE = `Hi {{1}},
Here is a reminder from {{2}}.

Your balance due for the period {{3}} to {{4}} is as follow:

• *Previous Balance* : ₹{{5}}
• *Current Balance* : ₹{{6}}

Please find detailed statement attached.

Thank You.`

export const SAMPLE_STATEMENT_VALUES: Record<string, string> = {
  customer_name: 'Rahul',
  store_name: 'Your Store',
  from_date: '01-10-2026',
  to_date: '31-10-2026',
  opening_balance: '2,500.00',
  closing_balance: '4,000.00',
  total_sales: '3,000.00',
  total_received: '1,500.00',
  store_phone: '9876543210',
  statement_pdf_url: 'https://api.example.com/api/v1/public/party-statement-pdf/…pdf',
  statement_pdf_file: '…pdf',
}

export const TELEGRAM_CAPTION_LIMIT = 1024

/**
 * Splits a Telegram statement message into preview segments, mirroring the
 * backend: {field} placeholders are filled and **text** is bold.
 */
export function telegramMessageSegments(
  template: string,
  values: Record<string, string>,
  knownFields: string[],
): { text: string; bold: boolean; field?: string }[] {
  const out: { text: string; bold: boolean; field?: string }[] = []
  const markers = template.split('**').length - 1
  const pairedUpTo = markers - (markers % 2) // an unpaired last marker stays literal
  let bold = false
  let seen = 0
  const re = /\*\*|\{([a-z_]+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  const push = (text: string, field?: string) => text && out.push({ text, bold, field })
  while ((m = re.exec(template))) {
    push(template.slice(last, m.index))
    if (m[0] === '**') {
      seen++
      if (seen <= pairedUpTo) bold = !bold
      else push('**')
    } else if (knownFields.includes(m[1])) {
      push(values[m[1]] ?? m[1], m[1])
    } else {
      push(m[0])
    }
    last = re.lastIndex
  }
  push(template.slice(last))
  return out
}

/** Formats a balance the way the backend fills the message (Cr suffix for advances). */
export function statementBalanceText(v: number): string {
  const abs = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v < -0.005 ? `${abs} Cr` : abs
}

// ---- Schedules ----

export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly'

export const SCHEDULE_FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
]

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface PartyStatementSchedule {
  id: string
  name: string
  is_enabled: boolean
  channel: StatementChannel
  frequency: ScheduleFrequency
  run_date: string
  weekday: number
  /** 1–28, or 0 for the last day of the month. */
  day_of_month: number
  send_time: string
  period: StatementPeriod
  /** N for last_n_days. */
  period_days: number
  from_date: string
  to_date: string
  party_ids: string
  party_count: number
  party_type: string
  category: string
  balance: string
  search: string
  include_zero_balance: boolean
  next_run_at?: string
  last_run_at?: string
  last_run_status?: 'success' | 'partial' | 'failed' | ''
  last_run_summary?: string
  /** Set on create when the schedule was saved paused because setup is incomplete. */
  warning?: string
}

export interface PartyStatementScheduleInput {
  name: string
  is_enabled?: boolean
  channel: StatementChannel
  frequency: ScheduleFrequency
  run_date: string
  weekday: number
  day_of_month: number
  send_time: string
  period: StatementPeriod
  period_days?: number
  from_date: string
  to_date: string
  party_ids?: string[]
  filters?: { search: string; category: string; party_type: string; balance: string }
  include_zero_balance: boolean
}

export async function fetchPartyStatementSchedules(): Promise<PartyStatementSchedule[]> {
  return readJson(await apiFetch('/parties/statement/schedules'), 'Failed to load schedules')
}

export async function savePartyStatementSchedule(
  input: PartyStatementScheduleInput,
  id?: string,
): Promise<PartyStatementSchedule> {
  return readJson(
    await apiFetch(id ? `/parties/statement/schedules/${id}` : '/parties/statement/schedules', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(input),
    }),
    'Failed to save schedule',
  )
}

export async function setPartyStatementScheduleEnabled(id: string, enabled: boolean): Promise<PartyStatementSchedule> {
  return readJson(
    await apiFetch(`/parties/statement/schedules/${id}/enabled`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
    'Failed to update schedule',
  )
}

export async function runPartyStatementScheduleNow(id: string) {
  return readJson<{ message: string }>(
    await apiFetch(`/parties/statement/schedules/${id}/run`, { method: 'POST' }),
    'Failed to run schedule',
  )
}

export async function deletePartyStatementSchedule(id: string) {
  return readJson<{ message: string }>(
    await apiFetch(`/parties/statement/schedules/${id}`, { method: 'DELETE' }),
    'Failed to delete schedule',
  )
}

/** Human summary like "Every month on the 1st at 10:00". */
export function describeSchedule(s: Pick<PartyStatementSchedule, 'frequency' | 'run_date' | 'weekday' | 'day_of_month' | 'send_time'>): string {
  const at = `at ${s.send_time}`
  switch (s.frequency) {
    case 'once':
      return `Once on ${displayDate(s.run_date)} ${at}`
    case 'daily':
      return `Every day ${at}`
    case 'weekly':
      return `Every ${WEEKDAYS[s.weekday] ?? ''} ${at}`
    case 'monthly':
      return `Every month on the ${s.day_of_month === 0 ? 'last day' : ordinal(s.day_of_month)} ${at}`
  }
  return ''
}

function ordinal(n: number): string {
  const v = n % 100
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'
  return `${n}${suffix}`
}

// ---------------------------------------------------------------------------
// Excluded parties: left out of bulk sends and schedules.
// ---------------------------------------------------------------------------

export interface StatementExclusion {
  party_id: string
  name: string
  phone: string
  party_type: string
  excluded_at: string
}

export async function fetchStatementExclusions(): Promise<StatementExclusion[]> {
  return readJson(await apiFetch('/parties/statement/exclusions'), 'Failed to load excluded parties')
}

/** Excludes parties by ID, or every party matching the list filters. */
export async function excludeFromStatements(selection: { party_ids: string[] } | BulkStatementSelection) {
  const body = 'ids' in selection ? { party_ids: selection.ids } : selection
  return readJson<{ excluded: number }>(
    await apiFetch('/parties/statement/exclusions', { method: 'POST', body: JSON.stringify(body) }),
    'Failed to exclude parties',
  )
}

export async function includeInStatements(partyId: string) {
  return readJson<{ party_id: string }>(
    await apiFetch(`/parties/statement/exclusions/${partyId}`, { method: 'DELETE' }),
    'Failed to update excluded parties',
  )
}
