import { apiFetch } from '@/hooks/useAuth'

/** Per-store WhatsApp invoice message (WhatsApp Cloud API) settings + API helpers. */

export interface WhatsAppInvoiceField {
  key: string
  label: string
}

export interface WhatsAppInvoiceSettings {
  enabled: boolean
  provider: string
  message_id: string
  phone_number_id: string
  language_code: string
  /** Comma-separated field keys; position N fills template variable {{N}}. */
  variable_mapping: string
  store_display_name: string
  attach_pdf: boolean
  public_base_url: string
  country_code: string
  send_for_pos: boolean
  send_for_non_pos: boolean
  /** Signed PDF link lifetime. Only super admins can change it. */
  pdf_link_ttl_minutes: number
  // read-only
  has_api_key?: boolean
  api_key_hint?: string
  available_fields?: WhatsAppInvoiceField[]
  default_mapping?: string
  env_public_base_url?: string
  can_edit_link_ttl?: boolean
  min_link_ttl_minutes?: number
  max_link_ttl_minutes?: number
}

export interface WhatsAppInvoiceSettingsPayload
  extends Omit<
    WhatsAppInvoiceSettings,
    | 'has_api_key'
    | 'api_key_hint'
    | 'available_fields'
    | 'default_mapping'
    | 'env_public_base_url'
    | 'provider'
    | 'can_edit_link_ttl'
    | 'min_link_ttl_minutes'
    | 'max_link_ttl_minutes'
  > {
  /** Empty = keep the stored key. */
  api_key?: string
  clear_api_key?: boolean
}

export interface WhatsAppInvoiceLog {
  id: string
  invoice_id: string
  invoice_number: string
  party_name: string
  phone: string
  trigger: 'auto' | 'manual' | 'test'
  status: 'sent' | 'failed' | 'skipped'
  request_id: string
  error: string
  created_at: string
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || fallback)
  return data as T
}

export async function fetchWhatsAppInvoiceSettings(): Promise<WhatsAppInvoiceSettings> {
  return readJson(await apiFetch('/settings/whatsapp-invoice'), 'Failed to load WhatsApp invoice settings')
}

export async function saveWhatsAppInvoiceSettings(
  payload: WhatsAppInvoiceSettingsPayload
): Promise<WhatsAppInvoiceSettings> {
  return readJson(
    await apiFetch('/settings/whatsapp-invoice', { method: 'PUT', body: JSON.stringify(payload) }),
    'Failed to save WhatsApp invoice settings'
  )
}

export async function sendWhatsAppInvoiceTest(phone: string, invoiceId?: string) {
  return readJson<{ message: string; log: WhatsAppInvoiceLog }>(
    await apiFetch('/settings/whatsapp-invoice/test', {
      method: 'POST',
      body: JSON.stringify({ phone, invoice_id: invoiceId || '' }),
    }),
    'Failed to send test message'
  )
}

export async function fetchWhatsAppInvoiceLogs(limit = 50, invoiceId?: string): Promise<WhatsAppInvoiceLog[]> {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (invoiceId) qs.set('invoice_id', invoiceId)
  return readJson(await apiFetch(`/settings/whatsapp-invoice/logs?${qs}`), 'Failed to load message log')
}

/** Manually (re)send an invoice on WhatsApp; phone overrides the party's number. */
export async function sendInvoiceOnWhatsApp(invoiceId: string, phone?: string) {
  return readJson<{ message: string; log: WhatsAppInvoiceLog }>(
    await apiFetch(`/invoices/${invoiceId}/whatsapp`, {
      method: 'POST',
      body: JSON.stringify({ phone: phone || '' }),
    }),
    'Failed to send WhatsApp message'
  )
}

/** Sample text matching the default WhatsApp template, for the preview. */
export const DEFAULT_TEMPLATE_PREVIEW = `Hello ,

Thank you for shopping with {{7}}!

Purchase Summary.
-----------------------
- Invoice: {{1}}
- Amount: ₹ {{2}}
- Date: {{3}}
-----------------------
- Points credited : {{4}}
- Points Balance : {{5}}
- Points Redeemed : {{6}}

Please find your invoice attached.

Thank you for choosing !`

export const SAMPLE_FIELD_VALUES: Record<string, string> = {
  invoice_number: 'INV-0042',
  total_amount: '1,250.00',
  invoice_date: '15-11-2026',
  points_earned: '12',
  points_balance: '148',
  points_redeemed: '0',
  store_name: 'Your Store',
  customer_name: 'Rahul',
  amount_paid: '1,250.00',
  balance_due: '0.00',
  loyalty_discount: '0.00',
  store_phone: '9876543210',
}
