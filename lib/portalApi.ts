import Cookies from 'js-cookie'
import { API_BASE } from '@/lib/utils'

const PORTAL_COOKIE = 'portal_token'

export function getPortalToken() {
  return Cookies.get(PORTAL_COOKIE) || null
}

export function setPortalToken(token: string) {
  Cookies.set(PORTAL_COOKIE, token, { expires: 7 })
}

export function clearPortalToken() {
  Cookies.remove(PORTAL_COOKIE)
}

export async function portalFetch(path: string, options: RequestInit = {}) {
  const token = getPortalToken()
  const isFormData = options.body instanceof FormData
  const hasContentType =
    options.headers && 'Content-Type' in (options.headers as Record<string, string>)
  const res = await fetch(`${API_BASE}/portal${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!isFormData && !hasContentType ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    clearPortalToken()
    const slug = new URLSearchParams(window.location.search).get('slug') || ''
    const q = slug ? `?slug=${encodeURIComponent(slug)}` : ''
    if (!window.location.pathname.startsWith('/portal/login')) {
      window.location.href = `/portal/login${q}`
    }
  }
  return res
}

export async function fetchPortalPublic(slug: string) {
  const res = await fetch(`${API_BASE}/portal/public/${encodeURIComponent(slug)}`)
  return res
}

export async function portalLogin(slug: string, phone: string, pin: string) {
  const res = await fetch(`${API_BASE}/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, phone, pin }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Login failed')
  setPortalToken(data.token)
  return data
}
