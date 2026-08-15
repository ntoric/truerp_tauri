'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { API_BASE } from '@/lib/utils'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/authToken'
import { clearActiveStoreId, getActiveStoreId, setActiveStoreId } from '@/lib/storeSelection'
import { offlineStorage } from '@/lib/offlineStorage'
import { setPOSAuthExpired } from '@/lib/posAuthGate'

interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  store_id?: string | null
  must_change_password?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string, totpCode?: string) => Promise<{ requiresPasswordChange: boolean }>
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>
  logout: () => void
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function clearAuthAndRedirect() {
  clearAuthToken()
  clearActiveStoreId()
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (path === '/login' || path === '/register' || path === '/forgot-password' || path.startsWith('/reset-password') || path === '/change-password-required') return
  if (path.startsWith('/portal')) return
  window.location.href = `/login?next=${encodeURIComponent(path)}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = getAuthToken()
    if (storedToken) {
      setToken(storedToken)
      fetchProfile(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchProfile = async (authToken: string) => {
    try {
      const storeId = getActiveStoreId()
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...(storeId ? { 'X-Store-ID': storeId } : {}),
        },
      })
      if (res.ok) {
        const data = await res.json()
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          store_id: data.store_id || data.active_store?.id || null,
          must_change_password: data.must_change_password,
        })
        if (data.must_change_password && typeof window !== 'undefined' && window.location.pathname !== '/change-password-required') {
          window.location.href = '/change-password-required'
          return
        }
        if (data.active_store?.id) {
          setActiveStoreId(data.active_store.id)
        } else if (data.stores?.length && !getActiveStoreId()) {
          setActiveStoreId(data.stores[0].id)
        }
      } else {
        clearAuthToken()
        setToken(null)
        if (res.status === 401) clearAuthAndRedirect()
      }
    } catch (err) {
      console.error('Fetch profile error:', err)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string, totpCode?: string) => {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totp_code: totpCode || '' }),
      })
    } catch {
      throw new Error('Unable to reach the server. Please try again.')
    }
    let data: {
      error?: string
      requires_2fa?: boolean
      requires_password_change?: boolean
      token?: string
      user?: User
      store?: { id: string }
      stores?: { id: string }[]
    } = {}
    try {
      data = await res.json()
    } catch {
      throw new Error(res.ok ? 'Invalid server response' : 'Login failed')
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Login failed') as Error & { requires2fa?: boolean }
      if (data.requires_2fa) err.requires2fa = true
      throw err
    }
    if (!data.token || !data.user) throw new Error('Invalid server response')

    setAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)

    if (data.user.store_id) {
      setActiveStoreId(data.user.store_id)
    } else if (data.store?.id) {
      setActiveStoreId(data.store.id)
    } else if (data.stores?.length) {
      setActiveStoreId(data.stores[0].id)
    }

    return { requiresPasswordChange: Boolean(data.requires_password_change || data.user?.must_change_password) }
  }

  const refreshProfile = async () => {
    const authToken = getAuthToken()
    if (!authToken) return
    await fetchProfile(authToken)
  }

  const register = async (name: string, email: string, password: string, phone?: string) => {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      })
    } catch {
      throw new Error('Unable to reach the server. Please try again.')
    }
    let data: { error?: string; token?: string; user?: User; store?: { id: string } } = {}
    try {
      data = await res.json()
    } catch {
      throw new Error(res.ok ? 'Invalid server response' : 'Registration failed')
    }
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    if (!data.token || !data.user) throw new Error('Invalid server response')

    setAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)
    if (data.user.store_id) {
      setActiveStoreId(data.user.store_id)
    } else if (data.store?.id) {
      setActiveStoreId(data.store.id)
    }
  }

  const logout = () => {
    clearAuthToken()
    clearActiveStoreId()
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

function abortAfter(timeoutMs: number, existing?: AbortSignal | null): AbortSignal {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => {
    clearTimeout(timer)
    if (!controller.signal.aborted) controller.abort()
  }
  existing?.addEventListener('abort', onAbort, { once: true })
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return controller.signal
}

export async function apiFetch(path: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const token = getAuthToken()
  const storeId = getActiveStoreId()
  const isFormData = options.body instanceof FormData
  const hasContentType = options.headers && 'Content-Type' in (options.headers as Record<string, string>)
  const { timeoutMs = 8000, signal, ...rest } = options
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    signal: abortAfter(timeoutMs, signal),
    headers: {
      ...(rest.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeId ? { 'X-Store-ID': storeId } : {}),
      ...(!isFormData && !hasContentType ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (res.status === 401) {
    const onPos = typeof window !== 'undefined' && window.location.pathname === '/pos'
    if (onPos && (await offlineStorage.hasPendingPOSSales())) {
      setPOSAuthExpired(true)
    } else {
      clearAuthAndRedirect()
    }
  }
  if (res.status === 403) {
    try {
      const data = await res.clone().json()
      if (data.requires_password_change && typeof window !== 'undefined' && window.location.pathname !== '/change-password-required') {
        window.location.href = '/change-password-required'
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  // Header names are case-insensitive; sync if middleware corrected a stale store.
  const activeStoreHeader =
    res.headers.get('X-Active-Store-ID') || res.headers.get('x-active-store-id')
  if (activeStoreHeader && activeStoreHeader !== getActiveStoreId()) {
    setActiveStoreId(activeStoreHeader)
  }
  return res
}
