import { apiFetch } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/accountingExport'

/** Subscription plans (super admin) and the store-facing My Plan API. */

export type BillingCycle = 'monthly' | 'annual'
export type SubscriptionStatus = 'active' | 'cancelled'
export type CyclePaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'cheque' | 'other'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  billing_cycle: BillingCycle
  price: number
  currency: string
  features: string
  feature_list: string[]
  highlight: boolean
  is_active: boolean
  sort_order: number
  active_subscriptions: number
  created_at: string
  updated_at: string
}

export interface SubscriptionPlanPayload {
  name: string
  description: string
  billing_cycle: BillingCycle
  price: number
  currency: string
  features: string[]
  highlight: boolean
  is_active: boolean
  sort_order: number
}

export interface SubscriptionCycle {
  id: string
  subscription_id: string
  cycle_number: number
  period_start: string
  period_end: string
  amount: number
  amount_paid: number
  payment_status: CyclePaymentStatus
  paid_at?: string | null
  source: 'initial' | 'auto_renewal' | 'prepaid' | 'reactivation'
  /** Free cycle; waived_amount is the regular price not charged. */
  complimentary: boolean
  waived_amount: number
  invoice_number: string
  invoice_date: string
  created_at: string
}

export interface SubscriptionPayment {
  id: string
  subscription_id: string
  cycle_id: string
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string
  notes: string
  receipt_number: string
  created_at: string
}

export interface StoreSubscription {
  id: string
  store_id: string
  plan_id?: string | null
  plan_name: string
  plan_description: string
  billing_cycle: BillingCycle
  price: number
  currency: string
  feature_list: string[]
  status: SubscriptionStatus
  auto_renew: boolean
  is_complimentary: boolean
  /** Last free cycle number; 0 = no end date. */
  complimentary_until_cycle: number
  complimentary_reason: string
  anchor_date: string
  current_cycle: number
  current_period_start: string
  current_period_end: string
  cancelled_at?: string | null
  cancellation_reason: string
  notes: string
  created_at: string
  updated_at: string
  store_name: string
  store_code: string
  today: string
  remaining_days: number
  total_days: number
  current_payment_status: CyclePaymentStatus | ''
  amount_due: number
  next_cycle_paid: boolean
  total_paid: number
  current_complimentary: boolean
  /** Free cycles left including the current one; -1 = no end date. */
  complimentary_cycles_left: number
  total_waived: number
  cycles?: SubscriptionCycle[]
  payments?: SubscriptionPayment[]
}

export interface SubscriptionOverview {
  active_subscriptions: number
  stores: number
  stores_without_plan: number
  mrr: number
  renewing_in_7_days: number
  auto_renew_off: number
  complimentary: number
  /** Monthly value of plans currently given free. */
  complimentary_value: number
  outstanding: number
  collected_this_month: number
}

export interface PaymentPayload {
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string
  notes: string
}

export interface CreateSubscriptionPayload {
  store_id: string
  plan_id: string
  start_date: string
  auto_renew: boolean
  price?: number
  notes: string
  replace_existing?: boolean
  initial_payment?: PaymentPayload
  is_complimentary?: boolean
  /** Number of free cycles; 0 = no end date. */
  complimentary_cycles?: number
  complimentary_reason?: string
}

export interface UpdateSubscriptionPayload {
  auto_renew?: boolean
  notes?: string
  is_complimentary?: boolean
  /** Free cycles counted from the current one; 0 = no end date. */
  complimentary_cycles?: number
  complimentary_reason?: string
}

export class ApiError extends Error {
  status: number
  data: Record<string, unknown>
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, init?: RequestInit, fallback = 'Request failed'): Promise<T> {
  const res = await apiFetch(path, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error || fallback, res.status, data)
  return data as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

// ---- Super admin ----

export const getSubscriptionOverview = () =>
  request<SubscriptionOverview>('/admin/subscriptions/overview', undefined, 'Failed to load overview')

export const listPlans = () =>
  request<SubscriptionPlan[]>('/admin/subscriptions/plans', undefined, 'Failed to load plans')

export const createPlan = (p: SubscriptionPlanPayload) =>
  request<SubscriptionPlan>('/admin/subscriptions/plans', json('POST', p), 'Failed to create plan')

export const updatePlan = (id: string, p: SubscriptionPlanPayload) =>
  request<SubscriptionPlan>(`/admin/subscriptions/plans/${id}`, json('PUT', p), 'Failed to update plan')

export const deletePlan = (id: string) =>
  request<{ message: string }>(`/admin/subscriptions/plans/${id}`, json('DELETE'), 'Failed to delete plan')

export const listSubscriptions = (params: { store_id?: string; status?: string } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
  return request<StoreSubscription[]>(`/admin/subscriptions${qs ? `?${qs}` : ''}`, undefined, 'Failed to load subscriptions')
}

export const getSubscription = (id: string) =>
  request<StoreSubscription>(`/admin/subscriptions/${id}`, undefined, 'Failed to load subscription')

export const createSubscription = (p: CreateSubscriptionPayload) =>
  request<StoreSubscription>('/admin/subscriptions', json('POST', p), 'Failed to create subscription')

export const updateSubscription = (id: string, p: UpdateSubscriptionPayload) =>
  request<StoreSubscription>(`/admin/subscriptions/${id}`, json('PATCH', p), 'Failed to update subscription')

export const cancelSubscription = (id: string, reason: string) =>
  request<StoreSubscription>(`/admin/subscriptions/${id}/cancel`, json('POST', { reason }), 'Failed to cancel subscription')

export const recordPayment = (
  id: string,
  p: PaymentPayload & { apply_to: 'cycle' | 'next' | 'reactivate'; cycle_id?: string }
) =>
  request<{ payment?: SubscriptionPayment; subscription: StoreSubscription }>(
    `/admin/subscriptions/${id}/payments`,
    json('POST', p),
    'Failed to record payment'
  )

export const deletePayment = (id: string, paymentId: string) =>
  request<StoreSubscription>(`/admin/subscriptions/${id}/payments/${paymentId}`, json('DELETE'), 'Failed to delete payment')

// ---- Store ----

export const getMyPlan = () =>
  request<{ subscription: StoreSubscription | null }>('/my-plan', undefined, 'Failed to load your plan')

export const getMyPlanHistory = () =>
  request<StoreSubscription[]>('/my-plan/history', undefined, 'Failed to load subscription history')

// ---- Formatting ----

export function formatMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** Format a YYYY-MM-DD calendar date without a timezone shift. */
export function formatPlanDate(ymd?: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Today as YYYY-MM-DD in the browser's local time. */
export function todayYmd(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const cycleLabel = (c: BillingCycle) => (c === 'annual' ? 'Annual' : 'Monthly')
export const cyclePer = (c: BillingCycle) => (c === 'annual' ? '/year' : '/month')
export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m

export const PAYMENT_BADGE: Record<CyclePaymentStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700' },
  partial: { label: 'Partially paid', className: 'bg-amber-100 text-amber-700' },
  unpaid: { label: 'Payment due', className: 'bg-rose-100 text-rose-700' },
}

export const COMPLIMENTARY_BADGE = { label: 'Complimentary', className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300/60' }

/** Status badge for a cycle: complimentary cycles read as such, not "Paid". */
export function cycleBadge(c: Pick<SubscriptionCycle, 'complimentary' | 'payment_status'>) {
  return c.complimentary ? COMPLIMENTARY_BADGE : PAYMENT_BADGE[c.payment_status]
}

/** Whether cycle n of a subscription will be free under its current terms. */
export function isComplimentaryCycle(sub: StoreSubscription, n: number): boolean {
  return sub.is_complimentary && (sub.complimentary_until_cycle <= 0 || n <= sub.complimentary_until_cycle)
}

/** "Complimentary · no end date" / "Complimentary · 2 cycles left". */
export function complimentaryLabel(sub: StoreSubscription): string {
  if (sub.complimentary_cycles_left < 0) return 'No end date'
  const n = sub.complimentary_cycles_left
  return `${n} cycle${n === 1 ? '' : 's'} left`
}

export const SOURCE_LABEL: Record<SubscriptionCycle['source'], string> = {
  initial: 'First cycle',
  auto_renewal: 'Auto-renewed',
  prepaid: 'Paid in advance',
  reactivation: 'Reactivated',
}

// ---- Invoices & receipts ----

export interface BillingSettings {
  issuer_name: string
  address: string
  city: string
  state: string
  state_code: string
  pincode: string
  gstin: string
  pan: string
  email: string
  phone: string
  website: string
  logo_data: string
  accent_color: string
  highlight_color: string
  invoice_prefix: string
  receipt_prefix: string
  number_padding: number
  tax_rate: number
  tax_label: string
  sac_code: string
  invoice_title: string
  show_amount_in_words: boolean
  show_payment_history: boolean
  show_bank_details: boolean
  bank_name: string
  account_name: string
  account_number: string
  ifsc: string
  upi_id: string
  invoice_notes: string
  invoice_terms: string
  receipt_title: string
  show_receipt_balance: boolean
  receipt_notes: string
  show_signature: boolean
  signatory_name: string
  footer_text: string
}

export interface BillingSettingsResponse {
  settings: BillingSettings
  next_numbers: { invoice: string; receipt: string }
}

export const getBillingSettings = () =>
  request<BillingSettingsResponse>('/admin/subscriptions/billing-settings', undefined, 'Failed to load invoice settings')

export const saveBillingSettings = (s: BillingSettings) =>
  request<BillingSettingsResponse>('/admin/subscriptions/billing-settings', json('PUT', s), 'Failed to save invoice settings')

async function pdfBlob(path: string, init?: RequestInit, fallback = 'Failed to load PDF'): Promise<Blob> {
  const res = await apiFetch(path, { ...init, timeoutMs: 30000 })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || fallback)
  }
  const blob = await res.blob()
  if (!blob.size) throw new Error('PDF was empty')
  return blob
}

/** Sample invoice or receipt rendered from unsaved settings. */
export const previewBillingDocument = (s: BillingSettings, doc: 'invoice' | 'receipt') =>
  pdfBlob(`/admin/subscriptions/billing-settings/preview?doc=${doc}`, json('POST', s), 'Failed to render preview')

type DocScope = { admin: true; subscriptionId: string } | { admin: false }

export async function downloadInvoice(scope: DocScope, cycle: Pick<SubscriptionCycle, 'id' | 'invoice_number'>) {
  const path = scope.admin
    ? `/admin/subscriptions/${scope.subscriptionId}/cycles/${cycle.id}/invoice`
    : `/my-plan/invoices/${cycle.id}`
  const blob = await pdfBlob(path, undefined, 'Failed to download invoice')
  await downloadBlob(`${cycle.invoice_number || 'invoice'}.pdf`, blob, { label: 'Downloading invoice' })
}

export async function downloadReceipt(scope: DocScope, payment: Pick<SubscriptionPayment, 'id' | 'receipt_number'>) {
  const path = scope.admin
    ? `/admin/subscriptions/${scope.subscriptionId}/payments/${payment.id}/receipt`
    : `/my-plan/receipts/${payment.id}`
  const blob = await pdfBlob(path, undefined, 'Failed to download receipt')
  await downloadBlob(`${payment.receipt_number || 'receipt'}.pdf`, blob, { label: 'Downloading receipt' })
}
