import { apiFetch } from '@/hooks/useAuth'

/**
 * Marketing → Campaigns: store-specific offers / promotions sent over the
 * store's existing WhatsApp, Telegram, email and SMS connections.
 * Backend: /api/v1/marketing (controllers/marketing_campaigns.go).
 */

export type MarketingChannel = 'whatsapp' | 'telegram' | 'email' | 'sms'

export const MARKETING_CHANNELS: { value: MarketingChannel; label: string; color: string; hint: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', color: 'text-green-600', hint: 'Approved template, sent to customer mobile numbers' },
  { value: 'telegram', label: 'Telegram', color: 'text-sky-600', hint: 'Free text, sent to customers who linked the store bot' },
  { value: 'email', label: 'Email', color: 'text-violet-600', hint: 'Subject + HTML body, sent to customer email addresses' },
  { value: 'sms', label: 'SMS', color: 'text-amber-600', hint: 'Short text, sent to customer mobile numbers' },
]

export const channelLabel = (c: string) => MARKETING_CHANNELS.find((x) => x.value === c)?.label ?? c

export type CampaignType =
  | 'promotion'
  | 'offer'
  | 'festival'
  | 'new_arrival'
  | 'loyalty'
  | 'reengagement'
  | 'announcement'

export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: 'offer', label: 'Discount / coupon offer' },
  { value: 'festival', label: 'Festival sale' },
  { value: 'promotion', label: 'General promotion' },
  { value: 'new_arrival', label: 'New arrivals' },
  { value: 'loyalty', label: 'Loyalty points reminder' },
  { value: 'reengagement', label: 'We miss you (win-back)' },
  { value: 'announcement', label: 'Store announcement' },
]

export const campaignTypeLabel = (t: string) => CAMPAIGN_TYPES.find((x) => x.value === t)?.label ?? t

export type AudienceType = 'all_customers' | 'all_vendors' | 'all_parties' | 'category' | 'loyalty_members' | 'specific'

export const AUDIENCE_TYPES: { value: AudienceType; label: string }[] = [
  { value: 'all_customers', label: 'All customers' },
  { value: 'loyalty_members', label: 'Loyalty members (with points / cashback)' },
  { value: 'category', label: 'Party category' },
  { value: 'specific', label: 'Selected parties' },
  { value: 'all_vendors', label: 'All vendors' },
  { value: 'all_parties', label: 'All parties' },
]

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed'

export interface MarketingCampaign {
  id: string
  name: string
  type: CampaignType
  channels: string // comma separated
  offer_title: string
  offer_code: string
  discount: string
  valid_until: string
  link: string
  image_url: string
  message: string
  sms_message: string
  email_subject: string
  email_body: string
  wa_template_name: string
  wa_language: string
  wa_variables: string // JSON array
  audience_type: AudienceType
  audience_category: string
  audience_party_ids: string // JSON array
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  last_error: string
  total_recipients: number
  sent_count: number
  failed_count: number
  skipped_count: number
  created_at: string
}

/** Editable form state (also the request body for create / update / test / preview). */
export interface CampaignForm {
  name: string
  type: CampaignType
  channels: MarketingChannel[]
  offer_title: string
  offer_code: string
  discount: string
  valid_until: string
  link: string
  image_url: string
  message: string
  sms_message: string
  email_subject: string
  email_body: string
  wa_template_name: string
  wa_language: string
  wa_variables: string[]
  audience_type: AudienceType
  audience_category: string
  audience_party_ids: string[]
}

export const emptyCampaignForm = (): CampaignForm => ({
  name: '',
  type: 'offer',
  channels: [],
  offer_title: '',
  offer_code: '',
  discount: '',
  valid_until: '',
  link: '',
  image_url: '',
  message: '',
  sms_message: '',
  email_subject: '',
  email_body: '',
  wa_template_name: '',
  wa_language: 'en',
  wa_variables: [],
  audience_type: 'all_customers',
  audience_category: '',
  audience_party_ids: [],
})

function parseJSONArray<T>(raw: string | null | undefined): T[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function campaignChannels(c: Pick<MarketingCampaign, 'channels'>): MarketingChannel[] {
  return (c.channels || '').split(',').map((s) => s.trim()).filter(Boolean) as MarketingChannel[]
}

export function campaignToForm(c: MarketingCampaign): CampaignForm {
  return {
    name: c.name,
    type: c.type,
    channels: campaignChannels(c),
    offer_title: c.offer_title || '',
    offer_code: c.offer_code || '',
    discount: c.discount || '',
    valid_until: c.valid_until || '',
    link: c.link || '',
    image_url: c.image_url || '',
    message: c.message || '',
    sms_message: c.sms_message || '',
    email_subject: c.email_subject || '',
    email_body: c.email_body || '',
    wa_template_name: c.wa_template_name || '',
    wa_language: c.wa_language || 'en',
    wa_variables: parseJSONArray<string>(c.wa_variables),
    audience_type: c.audience_type || 'all_customers',
    audience_category: c.audience_category || '',
    audience_party_ids: parseJSONArray<string>(c.audience_party_ids),
  }
}

export interface ChannelStatus {
  key: MarketingChannel
  label: string
  ready: boolean
  provider?: string
  reason?: string
  setup_url: string
}

export interface Placeholder {
  key: string
  label: string
}

export interface ChannelsResponse {
  channels: ChannelStatus[]
  placeholders: Placeholder[]
  store_name?: string
}

export interface AudiencePreview {
  total: number
  reachable: Partial<Record<MarketingChannel, number>>
  sample: { id: string; name: string }[]
}

export interface MarketingStats {
  total_campaigns: number
  scheduled_campaigns: number
  completed_campaigns: number
  messages: { sent: number; failed: number; skipped: number }
  by_channel: Record<string, { sent?: number; failed?: number; skipped?: number }>
}

export interface CampaignDelivery {
  id: string
  party_name: string
  channel: MarketingChannel
  recipient: string
  status: 'sent' | 'failed' | 'skipped'
  error: string
  created_at: string
}

export interface DeliveriesResponse {
  items: CampaignDelivery[]
  total: number
  page: number
  per_page: number
  summary: Record<string, Record<string, number>>
}

/** Error thrown by the API helpers; `errors` lists every readiness problem. */
export class MarketingApiError extends Error {
  errors: string[]
  constructor(message: string, errors: string[] = []) {
    super(message)
    this.errors = errors
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/marketing${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new MarketingApiError(body?.error || `Request failed (${res.status})`, body?.errors || [])
  return body as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const marketingApi = {
  channels: () => call<ChannelsResponse>('/channels'),
  stats: () => call<MarketingStats>('/stats'),
  list: () => call<MarketingCampaign[]>('/campaigns'),
  get: (id: string) => call<MarketingCampaign>(`/campaigns/${id}`),
  create: (form: CampaignForm, scheduledAt?: string | null) =>
    call<MarketingCampaign>('/campaigns', json('POST', { ...form, scheduled_at: scheduledAt || null })),
  update: (id: string, form: CampaignForm, scheduledAt?: string | null) =>
    call<MarketingCampaign>(`/campaigns/${id}`, json('PUT', { ...form, scheduled_at: scheduledAt || null })),
  remove: (id: string) => call<{ message: string }>(`/campaigns/${id}`, { method: 'DELETE' }),
  send: (id: string) => call<MarketingCampaign>(`/campaigns/${id}/send`, json('POST')),
  cancelSchedule: (id: string) => call<MarketingCampaign>(`/campaigns/${id}/cancel-schedule`, json('POST')),
  duplicate: (id: string) => call<MarketingCampaign>(`/campaigns/${id}/duplicate`, json('POST')),
  deliveries: (id: string, q: { page?: number; status?: string; channel?: string; search?: string } = {}) => {
    const p = new URLSearchParams()
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
    return call<DeliveriesResponse>(`/campaigns/${id}/deliveries?${p.toString()}`)
  },
  preview: (form: CampaignForm) => call<AudiencePreview>('/audience/preview', json('POST', form)),
  test: (form: CampaignForm, channel: MarketingChannel, to: string) =>
    call<{ message: string }>('/test', json('POST', { ...form, channel, to })),
}

/** Fills {{placeholders}} with sample values for the live preview. */
export const SAMPLE_VALUES: Record<string, string> = {
  customer_name: 'Asha Rao',
  first_name: 'Asha',
  store_name: 'Your Store',
  store_phone: '98765 43210',
  offer_title: 'Festive Collection',
  offer_code: 'FEST20',
  discount: '20% off',
  valid_until: '31 Dec 2026',
  link: 'https://yourstore.in',
  loyalty_points: '120',
  loyalty_cash: '50.00',
}

export function renderPreview(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) => (key in values ? values[key] || `[${key}]` : m))
}

function formatYMD(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Preview values: the form's offer fields over the samples. */
export function previewValues(form: CampaignForm, storeName?: string): Record<string, string> {
  return {
    ...SAMPLE_VALUES,
    ...(storeName ? { store_name: storeName } : {}),
    ...(form.offer_title ? { offer_title: form.offer_title } : {}),
    ...(form.offer_code ? { offer_code: form.offer_code } : {}),
    ...(form.discount ? { discount: form.discount } : {}),
    ...(form.valid_until ? { valid_until: formatYMD(form.valid_until) } : {}),
    ...(form.link ? { link: form.link } : {}),
  }
}

// ---------------------------------------------------------------------------
// Ready-made text for Telegram / SMS / email, per campaign type
// ---------------------------------------------------------------------------

export const MESSAGE_PRESETS: Record<CampaignType, { message: string; sms: string; subject: string }> = {
  offer: {
    message:
      'Hi {{first_name}}! 🎁\n\nEnjoy {{discount}} at {{store_name}} with code {{offer_code}}.\nShow this message at billing. Valid till {{valid_until}}.\n\nSee you soon!',
    sms: '{{store_name}}: Get {{discount}} with code {{offer_code}}. Valid till {{valid_until}}.',
    subject: '{{first_name}}, here is {{discount}} just for you',
  },
  festival: {
    message:
      'Hi {{first_name}}, warm festive wishes from {{store_name}}! 🎉\n\nCelebrate with {{discount}} on your purchase. Use code {{offer_code}} at billing.\nOffer valid till {{valid_until}}.',
    sms: 'Festive wishes from {{store_name}}! {{discount}} with code {{offer_code}} till {{valid_until}}.',
    subject: 'Festive offer: {{discount}} at {{store_name}} 🎉',
  },
  promotion: {
    message:
      'Hi {{first_name}}, there is something special waiting for you at {{store_name}}.\n\n{{offer_title}} — {{discount}}.\nVisit us or call {{store_phone}}.',
    sms: '{{store_name}}: {{offer_title}} - {{discount}}. Call {{store_phone}}.',
    subject: '{{offer_title}} at {{store_name}}',
  },
  new_arrival: {
    message:
      'Hi {{first_name}}, fresh stock just landed at {{store_name}}! ✨\n\n{{offer_title}} is now available. Be the first to pick your favourites.\n\n{{link}}',
    sms: 'New at {{store_name}}: {{offer_title}}. Visit us today!',
    subject: 'New arrivals: {{offer_title}}',
  },
  loyalty: {
    message:
      'Hi {{first_name}}, you have {{loyalty_points}} loyalty points at {{store_name}}. 🌟\n\nRedeem them on your next purchase — just share your registered mobile number at billing.',
    sms: '{{store_name}}: You have {{loyalty_points}} loyalty points. Redeem on your next visit!',
    subject: 'You have {{loyalty_points}} points waiting at {{store_name}}',
  },
  reengagement: {
    message:
      'Hi {{first_name}}, we miss you at {{store_name}}! 💛\n\nCome back and get {{discount}} with code {{offer_code}}. Valid till {{valid_until}}.',
    sms: 'We miss you! {{discount}} at {{store_name}} with code {{offer_code}}.',
    subject: 'We miss you, {{first_name}} — {{discount}} inside',
  },
  announcement: {
    message: 'Hello {{first_name}},\n\n{{store_name}} has an update for you: {{offer_title}}\n\nThank you for shopping with us!',
    sms: '{{store_name}}: {{offer_title}}',
    subject: 'An update from {{store_name}}',
  },
}

// ---------------------------------------------------------------------------
// WhatsApp template library (copy into Meta WhatsApp Manager / Twilio / Fast2SMS)
// ---------------------------------------------------------------------------

export interface WATemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
  text: string
  value?: string
}

export interface WATemplateSample {
  id: string
  title: string
  description: string
  campaignType: CampaignType
  category: 'MARKETING'
  language: string
  languageLabel: string
  name: string
  header: { type: 'none' } | { type: 'text'; text: string } | { type: 'image' }
  body: string
  footer: string
  buttons: WATemplateButton[]
  /** Variable {{i+1}} → campaign placeholder (auto-filled when sending) and the sample value Meta asks for. */
  variables: { placeholder: string; sample: string }[]
}

const STOP_BUTTON: WATemplateButton = { type: 'QUICK_REPLY', text: 'Stop promotions' }
const STOP_FOOTER = 'Reply STOP to unsubscribe'

export const WHATSAPP_TEMPLATE_SAMPLES: WATemplateSample[] = [
  {
    id: 'festival_offer',
    title: 'Festival offer',
    description: 'Festive greeting with a discount code and expiry date. Image header for your sale banner.',
    campaignType: 'festival',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'festival_offer',
    header: { type: 'image' },
    body:
      'Hi {{1}}, {{2}} wishes you and your family a joyful festive season! 🎉\n\nCelebrate with *{{3}}* on your next purchase. Use code *{{4}}* at billing.\n\nOffer valid till {{5}}. See you soon!',
    footer: STOP_FOOTER,
    buttons: [STOP_BUTTON],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{discount}}', sample: '20% off' },
      { placeholder: '{{offer_code}}', sample: 'DIWALI20' },
      { placeholder: '{{valid_until}}', sample: '15 Nov 2026' },
    ],
  },
  {
    id: 'festival_offer_hi',
    title: 'Festival offer (Hindi)',
    description: 'The festival offer in Hindi. Create it as a separate template with language Hindi (hi).',
    campaignType: 'festival',
    category: 'MARKETING',
    language: 'hi',
    languageLabel: 'Hindi',
    name: 'festival_offer_hi',
    header: { type: 'image' },
    body:
      'नमस्ते {{1}}, {{2}} की ओर से आपको और आपके परिवार को त्योहार की हार्दिक शुभकामनाएं! 🎉\n\nअपनी अगली खरीदारी पर *{{3}}* पाएं। बिलिंग के समय कोड *{{4}}* बताएं।\n\nऑफर {{5}} तक मान्य है। जल्द मिलते हैं!',
    footer: 'प्रचार बंद करने के लिए STOP लिखें',
    buttons: [{ type: 'QUICK_REPLY', text: 'प्रचार बंद करें' }],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'आशा' },
      { placeholder: '{{store_name}}', sample: 'शर्मा स्टोर्स' },
      { placeholder: '{{discount}}', sample: '20% छूट' },
      { placeholder: '{{offer_code}}', sample: 'DIWALI20' },
      { placeholder: '{{valid_until}}', sample: '15 Nov 2026' },
    ],
  },
  {
    id: 'discount_coupon',
    title: 'Discount coupon',
    description: 'Exclusive coupon code to redeem at the counter before a date.',
    campaignType: 'offer',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'discount_coupon',
    header: { type: 'text', text: 'A special offer for you 🎁' },
    body:
      'Hello {{1}},\n\nHere is an exclusive coupon from {{2}}. Use code *{{3}}* to get {{4}} on your purchase.\n\nShow this message at the counter before {{5}} to redeem it.',
    footer: STOP_FOOTER,
    buttons: [STOP_BUTTON],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{offer_code}}', sample: 'SAVE100' },
      { placeholder: '{{discount}}', sample: '₹100 off' },
      { placeholder: '{{valid_until}}', sample: '31 Dec 2026' },
    ],
  },
  {
    id: 'weekend_sale',
    title: 'Weekend sale',
    description: 'Short, urgent weekend-only sale message.',
    campaignType: 'promotion',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'weekend_sale',
    header: { type: 'text', text: 'Weekend sale is live 🛒' },
    body:
      'Hi {{1}}, this weekend only at {{2}}: get {{3}} on selected items!\n\nThe offer ends on {{4}}, so visit us before stocks run out.',
    footer: STOP_FOOTER,
    buttons: [STOP_BUTTON],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{discount}}', sample: 'up to 40% off' },
      { placeholder: '{{valid_until}}', sample: '30 Nov 2026' },
    ],
  },
  {
    id: 'clearance_sale',
    title: 'Clearance sale',
    description: 'End-of-season clearance with an image banner and a website button.',
    campaignType: 'promotion',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'clearance_sale',
    header: { type: 'image' },
    body:
      'Big clearance sale at {{1}}! 🛍️\n\nHi {{2}}, enjoy {{3}} on selected items until {{4}}. Limited stock, first come first served.',
    footer: STOP_FOOTER,
    buttons: [
      { type: 'URL', text: 'Shop now', value: 'https://yourstore.in' },
      STOP_BUTTON,
    ],
    variables: [
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{discount}}', sample: 'flat 50% off' },
      { placeholder: '{{valid_until}}', sample: '10 Jan 2027' },
    ],
  },
  {
    id: 'new_arrivals',
    title: 'New arrivals',
    description: 'Announce new stock with an image of the collection and a call button.',
    campaignType: 'new_arrival',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'new_arrivals',
    header: { type: 'image' },
    body:
      'Hi {{1}}, fresh stock just landed at {{2}}! ✨\n\n{{3}} is now available in store. Drop by and be the first to pick your favourites.\n\nQuestions? Call us at {{4}} anytime.',
    footer: STOP_FOOTER,
    buttons: [
      { type: 'PHONE_NUMBER', text: 'Call store', value: '+919876543210' },
      STOP_BUTTON,
    ],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{offer_title}}', sample: 'Our winter collection' },
      { placeholder: '{{store_phone}}', sample: '98765 43210' },
    ],
  },
  {
    id: 'loyalty_points_reminder',
    title: 'Loyalty points reminder',
    description: 'Remind customers of their loyalty points balance. Pair with the "Loyalty members" audience.',
    campaignType: 'loyalty',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'loyalty_points_reminder',
    header: { type: 'text', text: 'Your reward points 🌟' },
    body:
      'Hi {{1}}, you have *{{2}} loyalty points* waiting for you at {{3}}.\n\nRedeem them on your next purchase and save more. Just share your registered mobile number at billing.',
    footer: STOP_FOOTER,
    buttons: [STOP_BUTTON],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{loyalty_points}}', sample: '240' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
    ],
  },
  {
    id: 'we_miss_you',
    title: 'We miss you (win-back)',
    description: 'Bring back customers who have not visited in a while with a comeback code.',
    campaignType: 'reengagement',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'we_miss_you',
    header: { type: 'none' },
    body:
      'Hi {{1}}, we miss you at {{2}}! 💛\n\nCome back this week and get {{3}} on your purchase with code *{{4}}*.\n\nWe look forward to seeing you again.',
    footer: STOP_FOOTER,
    buttons: [STOP_BUTTON],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{discount}}', sample: '15% off' },
      { placeholder: '{{offer_code}}', sample: 'COMEBACK15' },
    ],
  },
  {
    id: 'store_announcement',
    title: 'Store announcement',
    description: 'New branch, holiday timings, or other news. Put the announcement in the offer title field.',
    campaignType: 'announcement',
    category: 'MARKETING',
    language: 'en',
    languageLabel: 'English',
    name: 'store_announcement',
    header: { type: 'text', text: 'News from the store 📢' },
    body: 'Hello {{1}},\n\n{{2}} has an update for you: {{3}}\n\nThank you for shopping with us!',
    footer: STOP_FOOTER,
    buttons: [STOP_BUTTON],
    variables: [
      { placeholder: '{{customer_name}}', sample: 'Asha' },
      { placeholder: '{{store_name}}', sample: 'Sharma Stores' },
      { placeholder: '{{offer_title}}', sample: 'our new branch opens on MG Road this Sunday' },
    ],
  },
]

/** Everything Meta's template form asks for, as plain text. */
export function templateAsText(t: WATemplateSample): string {
  const lines = [
    `Template name: ${t.name}`,
    `Category: ${t.category}`,
    `Language: ${t.languageLabel} (${t.language})`,
    '',
    `Header: ${t.header.type === 'none' ? 'None' : t.header.type === 'image' ? 'Image (upload a sample banner)' : `Text — ${t.header.text}`}`,
    '',
    'Body:',
    t.body,
    '',
    `Footer: ${t.footer || 'None'}`,
  ]
  if (t.buttons.length) {
    lines.push('', 'Buttons:')
    t.buttons.forEach((b) =>
      lines.push(`- ${b.type === 'QUICK_REPLY' ? 'Quick reply' : b.type === 'URL' ? 'Visit website' : 'Call phone number'}: ${b.text}${b.value ? ` (${b.value})` : ''}`)
    )
  }
  lines.push('', 'Sample values:')
  t.variables.forEach((v, i) => lines.push(`{{${i + 1}}} = ${v.sample}`))
  return lines.join('\n')
}

/** Copies text, with a textarea fallback for webviews without the async clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
