import { apiFetch } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/accountingExport'

export type PartyBalanceType = 'all' | 'customer' | 'vendor'

export interface PartyBalanceLine {
  party_id: string
  party_name: string
  party_type: string
  phone: string
  opening_balance: number
  debit: number
  credit: number
  closing_balance: number
  /** closing − opening */
  difference: number
}

export interface PartyBalanceReport {
  business_name: string
  date: string
  party_type: PartyBalanceType
  opening_receivable: number
  opening_payable: number
  closing_receivable: number
  closing_payable: number
  total_debit: number
  total_credit: number
  net_opening: number
  net_closing: number
  net_difference: number
  lines: PartyBalanceLine[]
}

export type PartyBalanceParams = { date: string; partyType: PartyBalanceType; search?: string }

function buildQuery(params: PartyBalanceParams) {
  const qs = new URLSearchParams({ date: params.date, party_type: params.partyType })
  if (params.search?.trim()) qs.set('search', params.search.trim())
  return qs.toString()
}

async function errorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}))
  return (err as { error?: string }).error || fallback
}

export async function fetchPartyBalanceReport(params: PartyBalanceParams): Promise<PartyBalanceReport> {
  const res = await apiFetch(`/dashboard/party-balance-report?${buildQuery(params)}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load party balance report'))
  return res.json()
}

export async function downloadPartyBalanceReport(params: PartyBalanceParams, kind: 'excel' | 'pdf') {
  const res = await apiFetch(`/dashboard/party-balance-report/${kind}?${buildQuery(params)}`)
  if (!res.ok) {
    throw new Error(await errorMessage(res, `Failed to export ${kind === 'excel' ? 'Excel' : 'PDF'}`))
  }
  const blob = await res.blob()
  if (!blob.size) throw new Error('Export was empty')
  const ext = kind === 'excel' ? 'xlsx' : 'pdf'
  await downloadBlob(`party_balance_report_${params.date}.${ext}`, blob, {
    label: `Exporting party balance report ${ext.toUpperCase()}`,
  })
}

// --- Scheduled email delivery ---

export type PartyBalanceReportDay = 'today' | 'previous_day'

export interface PartyBalanceEmailSettings {
  id: string
  user_id: string
  is_enabled: boolean
  recipient_emails: string
  report_day: PartyBalanceReportDay
  party_type: PartyBalanceType
  send_time: string
  subject: string
  last_sent_at?: string | null
  last_sent_status?: string
  last_sent_error?: string
  last_scheduled_at?: string | null
}

export const PARTY_BALANCE_REPORT_DAY_OPTIONS: { value: PartyBalanceReportDay; label: string }[] = [
  { value: 'today', label: 'Current day (as of send time)' },
  { value: 'previous_day', label: 'Previous day (full day)' },
]

const EMAIL_SETTINGS_PATH = '/dashboard/party-balance-report/email-settings'

export async function getPartyBalanceEmailSettings(): Promise<PartyBalanceEmailSettings> {
  const res = await apiFetch(EMAIL_SETTINGS_PATH)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load report email settings'))
  return res.json()
}

export async function updatePartyBalanceEmailSettings(
  payload: Partial<PartyBalanceEmailSettings>
): Promise<PartyBalanceEmailSettings> {
  const res = await apiFetch(EMAIL_SETTINGS_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to save report email settings'))
  return res.json()
}

export async function sendPartyBalanceEmailNow(): Promise<{
  sent_count: number
  total: number
  settings: PartyBalanceEmailSettings
  warning: boolean
  warning_msg?: string
}> {
  const res = await apiFetch(`${EMAIL_SETTINGS_PATH}/send-now`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to send report email'))
  return res.json()
}
