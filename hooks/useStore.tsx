'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { isSuperAdmin } from '@/lib/roles'
import { clearActiveStoreId, getActiveStoreId, setActiveStoreId } from '@/lib/storeSelection'

export interface StoreSummary {
  id: string
  name: string
  code: string
  description?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  phone?: string
  email?: string
  is_active: boolean
  user_count?: number
  created_at?: string
  updated_at?: string
}

interface StoreContextType {
  stores: StoreSummary[]
  activeStore: StoreSummary | null
  canSwitchStores: boolean
  loading: boolean
  setActiveStore: (storeId: string) => void
  refreshStores: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [activeStore, setActiveStoreState] = useState<StoreSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const canSwitchStores = isSuperAdmin(user?.role)

  const applyActiveStore = useCallback((list: StoreSummary[], preferredId?: string | null) => {
    if (list.length === 0) {
      setActiveStoreState(null)
      clearActiveStoreId()
      return
    }
    const saved = preferredId || getActiveStoreId()
    const match = list.find((s) => s.id === saved && s.is_active) || list.find((s) => s.is_active) || list[0]
    setActiveStoreState(match)
    setActiveStoreId(match.id)
  }, [])

  const refreshStores = useCallback(async () => {
    if (!user) {
      setStores([])
      setActiveStoreState(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      if (isSuperAdmin(user.role)) {
        const res = await apiFetch('/stores')
        if (res.ok) {
          const data = (await res.json()) as StoreSummary[]
          const activeOnly = data.filter((s) => s.is_active)
          setStores(data)
          applyActiveStore(activeOnly.length > 0 ? activeOnly : data)
        } else {
          const meRes = await apiFetch('/auth/my-stores')
          if (meRes.ok) {
            const data = await meRes.json()
            const list = (data.stores || []) as StoreSummary[]
            setStores(list)
            applyActiveStore(list)
          }
        }
      } else {
        const res = await apiFetch('/auth/my-stores')
        if (res.ok) {
          const data = await res.json()
          const list = (data.stores || []) as StoreSummary[]
          setStores(list)
          applyActiveStore(list, user.store_id || null)
        }
      }
    } catch (err) {
      console.error('Failed to load stores', err)
    } finally {
      setLoading(false)
    }
  }, [user, applyActiveStore])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setStores([])
      setActiveStoreState(null)
      clearActiveStoreId()
      setLoading(false)
      return
    }
    refreshStores()
  }, [user, authLoading, refreshStores])

  const setActiveStore = useCallback(
    (storeId: string) => {
      const match = stores.find((s) => s.id === storeId)
      if (!match) return
      setActiveStoreState(match)
      setActiveStoreId(match.id)
      // Reload so store-scoped pages refetch with the new X-Store-ID header.
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    },
    [stores]
  )

  const value = useMemo(
    () => ({
      stores,
      activeStore,
      canSwitchStores,
      loading,
      setActiveStore,
      refreshStores,
    }),
    [stores, activeStore, canSwitchStores, loading, setActiveStore, refreshStores]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return ctx
}
