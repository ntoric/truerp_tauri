import { apiFetch } from '@/hooks/useAuth'

// --- Telegram marketing campaigns ---

export interface TelegramRecipient {
  id: string
  campaign_id: string
  party_id: string | null
  chat_target: string
  status: string
  error_message: string
  sent_at: string | null
}

export interface TelegramCampaign {
  id: string
  campaign_name: string
  message: string
  media_url: string
  target_audience: string
  scheduled_date: string | null
  sent_date: string | null
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  notes: string
  created_at: string
  recipients?: TelegramRecipient[]
}

export interface TelegramCampaignStats {
  total_campaigns: number
  sent_campaigns: number
  scheduled_campaigns: number
  total_sent: number
  total_failed: number
}

export const TELEGRAM_AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all_customers', label: 'All customers (with Telegram chat ID)' },
  { value: 'all_vendors', label: 'All vendors (with Telegram chat ID)' },
  { value: 'specific_customers', label: 'Specific customers' },
  { value: 'specific_vendors', label: 'Specific vendors' },
  { value: 'custom_chats', label: 'Custom chat IDs / @channels' },
]

export async function getTelegramCampaigns(): Promise<TelegramCampaign[]> {
  const res = await apiFetch('/telegram-marketing')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to fetch Telegram campaigns')
  }
  return res.json()
}

export async function getTelegramCampaign(id: string): Promise<TelegramCampaign> {
  const res = await apiFetch(`/telegram-marketing/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to fetch Telegram campaign')
  }
  return res.json()
}

export async function getTelegramStats(): Promise<TelegramCampaignStats> {
  const res = await apiFetch('/telegram-marketing/stats')
  if (!res.ok) {
    return { total_campaigns: 0, sent_campaigns: 0, scheduled_campaigns: 0, total_sent: 0, total_failed: 0 }
  }
  return res.json()
}

export interface TelegramCampaignInput {
  campaign_name: string
  message: string
  media_url?: string
  target_audience: string
  scheduled_date?: string | null
  party_ids?: string[]
  chat_targets?: string[]
  notes?: string
}

export async function createTelegramCampaign(input: TelegramCampaignInput): Promise<TelegramCampaign> {
  const res = await apiFetch('/telegram-marketing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to create Telegram campaign')
  }
  return res.json()
}

export async function updateTelegramCampaign(
  id: string,
  input: Partial<TelegramCampaignInput>
): Promise<TelegramCampaign> {
  const res = await apiFetch(`/telegram-marketing/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to update Telegram campaign')
  }
  return res.json()
}

export async function deleteTelegramCampaign(id: string): Promise<void> {
  const res = await apiFetch(`/telegram-marketing/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to delete Telegram campaign')
  }
}

export async function sendTelegramCampaign(id: string): Promise<TelegramCampaign> {
  const res = await apiFetch(`/telegram-marketing/${id}/send`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to send Telegram campaign')
  }
  return res.json()
}

export async function scheduleTelegramCampaign(
  id: string,
  scheduledDate: string
): Promise<TelegramCampaign> {
  const res = await apiFetch(`/telegram-marketing/${id}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduled_date: scheduledDate }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to schedule Telegram campaign')
  }
  return res.json()
}

// --- Daily report Telegram automation ---

export type ReportTelegramPeriod = 'today' | 'daily' | 'weekly' | 'monthly'

export interface DailyReportTelegramSettings {
  id: string
  user_id: string
  is_enabled: boolean
  target_chats: string
  period: ReportTelegramPeriod
  send_time: string
  caption: string
  last_sent_at?: string | null
  last_sent_status?: string
  last_sent_error?: string
  last_scheduled_at?: string | null
}

export const REPORT_TELEGRAM_PERIOD_OPTIONS: { value: ReportTelegramPeriod; label: string }[] = [
  { value: 'today', label: 'Today (current day)' },
  { value: 'daily', label: 'Daily (previous day)' },
  { value: 'weekly', label: 'Weekly (last week)' },
  { value: 'monthly', label: 'Monthly (last month)' },
]

export async function getDailyReportTelegramSettings(): Promise<DailyReportTelegramSettings> {
  const res = await apiFetch('/dashboard/report-telegram-settings')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load report Telegram settings')
  }
  return res.json()
}

export async function updateDailyReportTelegramSettings(
  payload: Partial<DailyReportTelegramSettings>
): Promise<DailyReportTelegramSettings> {
  const res = await apiFetch('/dashboard/report-telegram-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to save report Telegram settings')
  }
  return res.json()
}

export async function sendDailyReportTelegramNow(
  date?: string
): Promise<{ sent_count: number; total: number; settings: DailyReportTelegramSettings; warning: boolean; warning_msg?: string }> {
  const qs = date ? `?date=${date}` : ''
  const res = await apiFetch(`/dashboard/report-telegram-settings/send-now${qs}`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to send report via Telegram')
  }
  return res.json()
}

// --- Telegram share deep link (manual share, no bot needed) ---

/**
 * Builds a t.me share URL that opens Telegram with the given text pre-filled.
 * The user picks a chat to send to inside Telegram. Works in browsers and the
 * Telegram desktop/mobile apps.
 */
export function buildTelegramShareURL(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent('https://truerp.app')}&text=${encodeURIComponent(text)}`
}
