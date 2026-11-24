import { apiFetch } from '@/hooks/useAuth'
import { API_BASE } from '@/lib/utils'

/** Types and API helpers for Super Admin → API Management. */

const BASE = '/admin/integrations'

/** Origin of the backend (API_BASE without /api/v1), for docs links. */
export function backendOrigin(): string {
  const origin = API_BASE.replace(/\/api\/v1\/?$/, '')
  if (origin.startsWith('http')) return origin
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export const publicApiDocsUrl = () => `${backendOrigin()}/api/public/docs`
export const publicApiExplorerUrl = () => `${backendOrigin()}/api/public/docs/explorer`
export const publicApiSpecUrl = () => `${backendOrigin()}/api/public/v1/openapi.yaml`
export const publicApiBaseUrl = () => `${backendOrigin()}/api/public/v1`

export interface ScopeInfo {
  scope: string
  resource: string
  access: 'read' | 'write' | 'manage'
  description: string
}

export interface EventTypeInfo {
  type: string
  description: string
  scope: string
}

export interface IntegrationCatalog {
  scopes: ScopeInfo[]
  event_types: EventTypeInfo[]
  grant_types: string[]
  base_path: string
  docs_path: string
  spec_path: string
}

export interface IntegrationOverview {
  active_api_keys: number
  active_oauth_clients: number
  active_webhooks: number
  failing_webhooks: number
  pending_deliveries: number
  requests_24h: number
  client_errors_24h: number
  server_errors_24h: number
  top_stores_24h: { store_id: string; store_name: string; requests: number }[]
}

export interface ApiKey {
  id: string
  store_id: string
  store_name: string
  name: string
  prefix: string
  scopes: string
  scope_list: string[]
  created_by_name: string
  last_used_at?: string | null
  last_used_ip?: string
  expires_at?: string | null
  revoked_at?: string | null
  status: 'active' | 'revoked' | 'expired'
  created_at: string
}

export interface StorePolicy {
  store_id: string
  store_name: string
  store_code: string
  store_active: boolean
  api_enabled: boolean
  allowed_scopes: string
  scope_list: string[]
  rate_limit_per_minute: number
  webhooks_enabled: boolean
  allowed_ips: string
  is_default: boolean
  active_api_keys: number
  webhooks: number
  oauth_clients: number
  updated_at?: string
}

export interface OAuthClient {
  id: string
  client_id: string
  client_name: string
  description: string
  redirect_uris: string
  redirect_uri_list: string[]
  grant_types: string
  grant_type_list: string[]
  scopes: string
  scope_list: string[]
  is_public: boolean
  is_active: boolean
  store_id?: string | null
  store_name: string
  active_tokens: number
  created_at: string
}

export interface AdminWebhook {
  id: string
  store_id: string
  store_name: string
  url: string
  description: string
  events: string[]
  is_active: boolean
  disabled_reason: string
  failure_count: number
  last_delivery_at?: string | null
  created_via: string
  pending_deliveries: number
  created_at: string
}

export interface WebhookDelivery {
  id: string
  event_id: string
  event_type: string
  status: 'pending' | 'succeeded' | 'failed'
  attempts: number
  next_attempt_at?: string | null
  response_status: number
  last_error: string
  delivered_at?: string | null
  created_at: string
}

export interface RequestLog {
  id: string
  store_id?: string | null
  store_name: string
  credential_type: string
  credential_id: string
  credential_name: string
  method: string
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  request_id: string
  error_code: string
  created_at: string
}

export interface StoreOption {
  id: string
  name: string
  code: string
  is_active: boolean
}

async function request<T>(path: string, init: RequestInit = {}, fallback = 'Request failed'): Promise<T> {
  const res = await apiFetch(path, { timeoutMs: 15000, ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || fallback)
  return data as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const fetchCatalog = () => request<IntegrationCatalog>(`${BASE}/catalog`)
export const fetchOverview = () => request<IntegrationOverview>(`${BASE}/overview`)
export const fetchStores = () => request<StoreOption[]>('/stores', {}, 'Failed to load stores')

// API keys
export const listApiKeys = (storeId?: string) =>
  request<ApiKey[]>(`${BASE}/api-keys${storeId ? `?store_id=${storeId}` : ''}`, {}, 'Failed to load API keys')
export const createApiKey = (body: { store_id: string; name: string; scopes: string[]; expires_at?: string | null }) =>
  request<{ api_key: ApiKey; secret: string }>(`${BASE}/api-keys`, json('POST', body), 'Failed to create API key')
export const updateApiKey = (id: string, body: { name?: string; scopes?: string[]; expires_at?: string | null; clear_expiry?: boolean }) =>
  request<ApiKey>(`${BASE}/api-keys/${id}`, json('PATCH', body), 'Failed to update API key')
export const revokeApiKey = (id: string) =>
  request<{ message: string }>(`${BASE}/api-keys/${id}/revoke`, json('POST'), 'Failed to revoke API key')
export const deleteApiKey = (id: string) =>
  request<{ message: string }>(`${BASE}/api-keys/${id}`, json('DELETE'), 'Failed to delete API key')

// Policies (permissions)
export const listPolicies = () => request<StorePolicy[]>(`${BASE}/policies`, {}, 'Failed to load permissions')
export const updatePolicy = (
  storeId: string,
  body: Partial<{ api_enabled: boolean; allowed_scopes: string[]; rate_limit_per_minute: number; webhooks_enabled: boolean; allowed_ips: string }>,
) => request<StorePolicy>(`${BASE}/policies/${storeId}`, json('PUT', body), 'Failed to save permissions')

// OAuth clients
export interface OAuthClientPayload {
  client_name?: string
  description?: string
  redirect_uris?: string
  grant_types?: string[]
  scopes?: string[]
  is_public?: boolean
  is_active?: boolean
  store_id?: string
}
export const listOAuthClients = () => request<OAuthClient[]>(`${BASE}/oauth-clients`, {}, 'Failed to load applications')
export const createOAuthClient = (body: OAuthClientPayload) =>
  request<{ client: OAuthClient; client_secret?: string }>(`${BASE}/oauth-clients`, json('POST', body), 'Failed to create application')
export const updateOAuthClient = (id: string, body: OAuthClientPayload) =>
  request<{ client: OAuthClient; client_secret?: string }>(`${BASE}/oauth-clients/${id}`, json('PATCH', body), 'Failed to update application')
export const rotateOAuthSecret = (id: string) =>
  request<{ client_secret: string }>(`${BASE}/oauth-clients/${id}/rotate-secret`, json('POST'), 'Failed to rotate secret')
export const revokeOAuthTokens = (id: string) =>
  request<{ revoked: number }>(`${BASE}/oauth-clients/${id}/revoke-tokens`, json('POST'), 'Failed to revoke tokens')
export const deleteOAuthClient = (id: string) =>
  request<{ message: string }>(`${BASE}/oauth-clients/${id}`, json('DELETE'), 'Failed to delete application')

// Webhooks
export const listWebhooks = (storeId?: string) =>
  request<AdminWebhook[]>(`${BASE}/webhooks${storeId ? `?store_id=${storeId}` : ''}`, {}, 'Failed to load webhooks')
export const createWebhook = (body: { store_id: string; url: string; description: string; events: string[] }) =>
  request<{ webhook: AdminWebhook; secret: string }>(`${BASE}/webhooks`, json('POST', body), 'Failed to create webhook')
export const updateWebhook = (id: string, body: { url?: string; description?: string; events?: string[]; is_active?: boolean }) =>
  request<AdminWebhook>(`${BASE}/webhooks/${id}`, json('PATCH', body), 'Failed to update webhook')
export const deleteWebhook = (id: string) =>
  request<{ message: string }>(`${BASE}/webhooks/${id}`, json('DELETE'), 'Failed to delete webhook')
export const testWebhook = (id: string) =>
  request<{ succeeded: boolean; response_status: number; error?: string }>(`${BASE}/webhooks/${id}/test`, json('POST'), 'Failed to send test')
export const listWebhookDeliveries = (id: string) =>
  request<WebhookDelivery[]>(`${BASE}/webhooks/${id}/deliveries`, {}, 'Failed to load deliveries')
export const retryWebhookDelivery = (id: string, deliveryId: string) =>
  request<{ message: string }>(`${BASE}/webhooks/${id}/deliveries/${deliveryId}/retry`, json('POST'), 'Failed to retry')

// Request logs
export const listRequestLogs = (params: { store_id?: string; status?: string; offset?: number; limit?: number }) => {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v))
  })
  return request<{ logs: RequestLog[]; total: number; limit: number; offset: number }>(`${BASE}/logs?${q}`, {}, 'Failed to load logs')
}

/** Group scopes by resource for the permission matrix. */
export function groupScopes(scopes: ScopeInfo[]): { resource: string; read?: ScopeInfo; write?: ScopeInfo }[] {
  const map = new Map<string, { resource: string; read?: ScopeInfo; write?: ScopeInfo }>()
  for (const s of scopes) {
    const row = map.get(s.resource) ?? { resource: s.resource }
    if (s.access === 'read') row.read = s
    else row.write = s
    map.set(s.resource, row)
  }
  return Array.from(map.values())
}

export const RESOURCE_LABELS: Record<string, string> = {
  parties: 'Parties',
  products: 'Products',
  stock: 'Stock',
  invoices: 'Sales invoices',
  payments: 'Payments in',
  purchases: 'Purchase bills',
  events: 'Event feed',
  webhooks: 'Webhooks',
}

export const GRANT_TYPE_LABELS: Record<string, string> = {
  authorization_code: 'Authorization code (users sign in and approve)',
  refresh_token: 'Refresh token',
  client_credentials: 'Client credentials (server-to-server, store-bound)',
  password: 'Password (trusted first-party apps only)',
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
