import { apiFetch } from '@/hooks/useAuth'

/** Types and API helpers for the backoffice notification module (super admin). */

export type NotificationChannelKey = 'smtp' | 'telegram' | 'whatsapp' | 'sms' | 'push'

export const NOTIFICATION_CHANNELS: { value: NotificationChannelKey; label: string }[] = [
  { value: 'smtp', label: 'Email (SMTP)' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
]

export const EVENT_CATEGORIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'payments', label: 'Payments' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'system', label: 'System' },
  { value: 'custom', label: 'Custom' },
]

export interface NotificationEvent {
  id: string
  key: string
  name: string
  description: string
  category: string
  is_active: boolean
  email_enabled: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  telegram_enabled: boolean
  push_enabled: boolean
  internal_enabled: boolean
  recipient_emails: string
  recipient_phones: string
  recipient_telegram_chats: string
  push_device_tokens: string
  notify_store_owner: boolean
  subject_template: string
  body_template: string
  variables: string
  created_at: string
  updated_at: string
}

export interface NotificationChannel {
  channel: NotificationChannelKey
  is_enabled: boolean
  config: Record<string, string>
  secrets_set: string[]
  updated_at?: string
}

export interface NotificationDelivery {
  id: string
  event_id?: string
  event_key: string
  channel: string
  recipient: string
  subject: string
  message: string
  status: string
  error_message: string
  created_at: string
}

export interface DeliveryResult {
  channel: string
  recipient: string
  status: string
  error?: string
}

const BASE = '/admin/notifications'

export async function fetchNotificationEvents(): Promise<NotificationEvent[]> {
  const res = await apiFetch(`${BASE}/events`)
  if (!res.ok) throw new Error('Failed to load notification events')
  return res.json()
}

export async function createNotificationEvent(payload: Partial<NotificationEvent>): Promise<NotificationEvent> {
  const res = await apiFetch(`${BASE}/events`, { method: 'POST', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create event')
  return data
}

export async function updateNotificationEvent(id: string, payload: Partial<NotificationEvent>): Promise<NotificationEvent> {
  const res = await apiFetch(`${BASE}/events/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update event')
  return data
}

export async function deleteNotificationEvent(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/events/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to delete event')
  }
}

export async function triggerNotificationEvent(
  id: string,
  data: Record<string, string>
): Promise<{ event: string; results: DeliveryResult[] }> {
  const res = await apiFetch(`${BASE}/events/${id}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to trigger event')
  return json
}

export async function fetchNotificationChannels(): Promise<NotificationChannel[]> {
  const res = await apiFetch(`${BASE}/channels`)
  if (!res.ok) throw new Error('Failed to load channel configuration')
  return res.json()
}

export async function updateNotificationChannel(
  channel: NotificationChannelKey,
  payload: { is_enabled?: boolean; config?: Record<string, string>; secrets?: Record<string, string> }
): Promise<NotificationChannel> {
  const res = await apiFetch(`${BASE}/channels/${channel}`, { method: 'PUT', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save channel')
  return data
}

export async function testNotificationChannel(channel: NotificationChannelKey, recipient: string, message?: string): Promise<string> {
  const res = await apiFetch(`${BASE}/channels/${channel}/test`, {
    method: 'POST',
    body: JSON.stringify({ recipient, message }),
    timeoutMs: 30000,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Test failed')
  return data.message || 'Test notification sent'
}

export async function broadcastNotification(payload: {
  title: string
  message: string
  channels: string[]
  emails?: string
  phones?: string
  telegram_chat_ids?: string
  device_tokens?: string
}): Promise<DeliveryResult[]> {
  const res = await apiFetch(`${BASE}/broadcast`, { method: 'POST', body: JSON.stringify(payload), timeoutMs: 30000 })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Broadcast failed')
  return data.results || []
}

export async function fetchNotificationDeliveries(params: {
  channel?: string
  status?: string
  event_key?: string
  limit?: number
  offset?: number
}): Promise<{ total: number; deliveries: NotificationDelivery[] }> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  })
  const res = await apiFetch(`${BASE}/deliveries?${qs.toString()}`)
  if (!res.ok) throw new Error('Failed to load deliveries')
  return res.json()
}

export async function clearNotificationDeliveries(days: number): Promise<number> {
  const res = await apiFetch(`${BASE}/deliveries?days=${days}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to clear deliveries')
  return data.deleted || 0
}
