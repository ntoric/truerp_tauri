import { apiFetch } from '@/hooks/useAuth'

/**
 * Per-store Telegram bot: invoices and balance statements to customers, sale
 * alerts and scheduled reports to the store owner. A bot can't message anyone
 * by phone number, so each customer links once through their personal
 * t.me/<bot>?start=… link, and owners link their chat with the owner link.
 */

export interface TelegramSettings {
  enabled: boolean
  bot_username: string
  bot_name: string
  send_invoice_to_customer: boolean
  send_for_pos: boolean
  send_for_non_pos: boolean
  notify_owner_on_invoice: boolean
  owner_chat_ids: string
  poll_error: string
  // read-only
  has_bot_token: boolean
  owner_link: string
  owner_chats: string[]
  linked_customers: number
}

export interface TelegramSettingsPayload {
  enabled: boolean
  /** New BotFather token; empty keeps the current one. */
  bot_token?: string
  disconnect?: boolean
  send_invoice_to_customer: boolean
  send_for_pos: boolean
  send_for_non_pos: boolean
  notify_owner_on_invoice: boolean
  owner_chat_ids: string
}

export interface TelegramLog {
  id: string
  kind: 'invoice_customer' | 'invoice_owner' | 'daily_report' | 'party_balance_report' | 'test'
  reference: string
  party_name: string
  chat_id: string
  trigger: string
  status: 'sent' | 'failed' | 'skipped'
  error: string
  created_at: string
}

export const TELEGRAM_LOG_KIND_LABELS: Record<TelegramLog['kind'], string> = {
  invoice_customer: 'Invoice → customer',
  invoice_owner: 'Sale alert → owner',
  daily_report: 'Business report',
  party_balance_report: 'Party balance report',
  test: 'Test',
}

export interface PartyTelegramLink {
  bot_connected: boolean
  enabled: boolean
  bot_username: string
  link: string
  linked: boolean
  chat_id: string
  linked_at?: string
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || fallback)
  return data as T
}

export async function fetchTelegramSettings(): Promise<TelegramSettings> {
  return readJson(await apiFetch('/settings/telegram'), 'Failed to load Telegram settings')
}

export async function saveTelegramSettings(payload: TelegramSettingsPayload): Promise<TelegramSettings> {
  return readJson(
    await apiFetch('/settings/telegram', { method: 'PUT', body: JSON.stringify(payload) }),
    'Failed to save Telegram settings'
  )
}

/** Sends a test message to chatId, or to every linked owner chat when empty. */
export async function sendTelegramTest(chatId?: string) {
  return readJson<{ message: string }>(
    await apiFetch('/settings/telegram/test', { method: 'POST', body: JSON.stringify({ chat_id: chatId || '' }) }),
    'Failed to send test message'
  )
}

export async function fetchTelegramLogs(): Promise<TelegramLog[]> {
  return readJson(await apiFetch('/settings/telegram/logs'), 'Failed to load Telegram log')
}

export async function fetchPartyTelegramLink(partyId: string): Promise<PartyTelegramLink> {
  return readJson(await apiFetch(`/parties/${partyId}/telegram`), 'Failed to load Telegram link')
}

export async function unlinkPartyTelegram(partyId: string) {
  return readJson<{ message: string }>(
    await apiFetch(`/parties/${partyId}/telegram`, { method: 'DELETE' }),
    'Failed to unlink Telegram'
  )
}

/** Manually (re)sends an invoice to the customer's linked Telegram chat. */
export async function sendInvoiceOnTelegram(invoiceId: string, chatId?: string) {
  return readJson<{ message: string }>(
    await apiFetch(`/invoices/${invoiceId}/telegram`, { method: 'POST', body: JSON.stringify({ chat_id: chatId || '' }) }),
    'Failed to send on Telegram'
  )
}
