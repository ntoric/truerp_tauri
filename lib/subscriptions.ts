import { apiFetch } from '@/hooks/useAuth'

/** Types and API helpers for store subscriptions and the plan catalog. */

export type SubscriptionFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom'

export const SUBSCRIPTION_FREQUENCIES: { value: SubscriptionFrequency; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
  { value: 'half_yearly', label: 'Half-yearly', months: 6 },
  { value: 'yearly', label: 'Yearly', months: 12 },
  { value: 'custom', label: 'Custom', months: 0 },
]

export function frequencyLabel(frequency: string, periodMonths?: number): string {
  if (frequency === 'custom') return `Custom${periodMonths ? ` (${periodMonths} mo)` : ''}`
  return SUBSCRIPTION_FREQUENCIES.find((f) => f.value === frequency)?.label || frequency
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export interface SubscriptionPackage {
  id: string
  name: string
  description: string
  /** Absent when the package hides its price from non-admin users. */
  price?: number | null
  features: string[]
  show_price: boolean
  show_features: boolean
  is_complimentary: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SubscriptionPackagePayload {
  name: string
  description: string
  price: number
  features: string[]
  show_price: boolean
  show_features: boolean
  is_complimentary: boolean
  is_active: boolean
  sort_order: number
}

export type SubscriptionEffectiveStatus = 'active' | 'scheduled' | 'expired' | 'cancelled'

export interface StoreSubscription {
  id: string
  store_id: string
  package_id?: string | null
  package_name: string
  price: number
  status: string
  effective_status: SubscriptionEffectiveStatus
  start_date: string
  end_date: string
  frequency: string
  period_months: number
  auto_renew: boolean
  notes: string
  days_remaining: number
  store?: { id: string; name: string; code: string }
  package?: SubscriptionPackage
  created_at: string
  updated_at: string
}

export interface SubscriptionHistoryEvent {
  id: string
  store_id: string
  subscription_id?: string | null
  event_type: string
  from_package: string
  to_package: string
  start_date?: string | null
  end_date?: string | null
  price: number
  notes: string
  actor_name: string
  store?: { id: string; name: string; code: string }
  created_at: string
}

export interface StoreSubscriptionPayload {
  store_id: string
  package_id?: string
  start_date: string
  end_date?: string
  frequency: SubscriptionFrequency
  period_months?: number
  price?: number
  auto_renew?: boolean
  status?: string
  notes?: string
}

export const SUBSCRIPTION_EVENT_LABELS: Record<string, string> = {
  created: 'Subscribed',
  renewed: 'Renewed',
  upgraded: 'Upgraded',
  downgraded: 'Downgraded',
  changed: 'Plan changed',
  updated: 'Updated',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
  reactivated: 'Reactivated',
  cancel_requested: 'Cancellation requested',
  upgrade_requested: 'Upgrade requested',
  downgrade_requested: 'Downgrade requested',
  change_requested: 'Plan change requested',
  request_rejected: 'Request rejected',
}

export function subscriptionEventLabel(eventType: string): string {
  return SUBSCRIPTION_EVENT_LABELS[eventType] || eventType
}

// --------------------------- Shared / store view ---------------------------

export async function listSubscriptionPackages(): Promise<SubscriptionPackage[]> {
  const res = await apiFetch('/subscription-packages')
  if (!res.ok) throw new Error('Failed to load subscription packages')
  return res.json()
}

export async function getCurrentSubscription(): Promise<{
  subscription: StoreSubscription | null
  store?: { id: string; name: string; code: string }
}> {
  const res = await apiFetch('/subscriptions/current')
  if (!res.ok) throw new Error('Failed to load subscription')
  return res.json()
}

export async function getSubscriptionHistory(): Promise<SubscriptionHistoryEvent[]> {
  const res = await apiFetch('/subscriptions/history')
  if (!res.ok) throw new Error('Failed to load subscription history')
  return res.json()
}

// ------------------------------ Super admin ------------------------------

export async function adminCreateSubscriptionPackage(
  payload: SubscriptionPackagePayload
): Promise<SubscriptionPackage> {
  const res = await apiFetch('/subscription-packages', { method: 'POST', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create package')
  return data
}

export async function adminUpdateSubscriptionPackage(
  id: string,
  payload: SubscriptionPackagePayload
): Promise<SubscriptionPackage> {
  const res = await apiFetch(`/subscription-packages/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update package')
  return data
}

export async function adminDeleteSubscriptionPackage(id: string): Promise<void> {
  const res = await apiFetch(`/subscription-packages/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to delete package')
  }
}

export async function adminListSubscriptions(storeId?: string): Promise<StoreSubscription[]> {
  const res = await apiFetch(`/subscriptions${storeId ? `?store_id=${storeId}` : ''}`)
  if (!res.ok) throw new Error('Failed to load subscriptions')
  return res.json()
}

export async function adminListSubscriptionHistory(storeId?: string): Promise<SubscriptionHistoryEvent[]> {
  const res = await apiFetch(`/subscriptions/history/all${storeId ? `?store_id=${storeId}` : ''}`)
  if (!res.ok) throw new Error('Failed to load subscription history')
  return res.json()
}

export async function adminCreateSubscription(payload: StoreSubscriptionPayload): Promise<StoreSubscription> {
  const res = await apiFetch('/subscriptions', { method: 'POST', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create subscription')
  return data
}

export async function adminUpdateSubscription(
  id: string,
  payload: StoreSubscriptionPayload
): Promise<StoreSubscription> {
  const res = await apiFetch(`/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update subscription')
  return data
}

export async function adminRenewSubscription(id: string, notes?: string): Promise<StoreSubscription> {
  const res = await apiFetch(`/subscriptions/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to renew subscription')
  return data
}

export async function adminCancelSubscription(id: string, notes?: string): Promise<StoreSubscription> {
  const res = await apiFetch(`/subscriptions/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to cancel subscription')
  return data
}

// --------------------------- Change requests ---------------------------

export type SubscriptionRequestType = 'cancel' | 'upgrade' | 'downgrade' | 'change'
export type SubscriptionRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface SubscriptionRequest {
  id: string
  store_id: string
  subscription_id?: string | null
  request_type: SubscriptionRequestType
  target_package_id?: string | null
  target_package_name: string
  current_package_name: string
  reason: string
  status: SubscriptionRequestStatus
  requested_by_name: string
  resolved_by_name?: string
  resolved_at?: string | null
  resolution_notes?: string
  store?: { id: string; name: string; code: string }
  target_package?: SubscriptionPackage
  created_at: string
  updated_at: string
}

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  cancel: 'Cancellation',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  change: 'Plan change',
}

export function subscriptionRequestTypeLabel(t: string): string {
  return REQUEST_TYPE_LABELS[t] || t
}

export async function listMySubscriptionRequests(): Promise<SubscriptionRequest[]> {
  const res = await apiFetch('/subscription-requests')
  if (!res.ok) throw new Error('Failed to load requests')
  return res.json()
}

export async function createSubscriptionRequest(payload: {
  request_type: SubscriptionRequestType
  target_package_id?: string
  reason?: string
}): Promise<SubscriptionRequest> {
  const res = await apiFetch('/subscription-requests', { method: 'POST', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to submit request')
  return data
}

export async function withdrawSubscriptionRequest(id: string): Promise<SubscriptionRequest> {
  const res = await apiFetch(`/subscription-requests/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to withdraw request')
  return data
}

export async function adminListSubscriptionRequests(
  status?: string,
  storeId?: string
): Promise<SubscriptionRequest[]> {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  if (storeId && storeId !== 'all') params.set('store_id', storeId)
  const res = await apiFetch(`/subscription-requests/all${params.size ? `?${params}` : ''}`)
  if (!res.ok) throw new Error('Failed to load requests')
  return res.json()
}

export async function adminApproveSubscriptionRequest(
  id: string,
  notes?: string
): Promise<SubscriptionRequest> {
  const res = await apiFetch(`/subscription-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to approve request')
  return data
}

export async function adminRejectSubscriptionRequest(
  id: string,
  notes?: string
): Promise<SubscriptionRequest> {
  const res = await apiFetch(`/subscription-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || '' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to reject request')
  return data
}
