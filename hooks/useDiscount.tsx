'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import {
  DEFAULT_SALE_DISCOUNT_SETTINGS,
  normalizeSaleDiscountSettings,
  type SaleDiscountSettings,
} from '@/lib/saleDiscount'

interface DiscountContextType {
  settings: SaleDiscountSettings
  /** False when the store admin turned discounts off — hide every discount input. */
  isDiscountEnabled: boolean
  loading: boolean
  refresh: () => Promise<void>
  setSettingsLocal: (settings: SaleDiscountSettings) => void
}

const DiscountContext = createContext<DiscountContextType | undefined>(undefined)

export function DiscountProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { isPageEnabled } = usePageFeatures()
  const [settings, setSettings] = useState<SaleDiscountSettings>({ ...DEFAULT_SALE_DISCOUNT_SETTINGS })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings({ ...DEFAULT_SALE_DISCOUNT_SETTINGS })
      setLoading(false)
      return
    }
    try {
      const res = await apiFetch('/sale-discount-settings')
      if (res.ok) {
        setSettings(normalizeSaleDiscountSettings(await res.json()))
      } else {
        setSettings({ ...DEFAULT_SALE_DISCOUNT_SETTINGS })
      }
    } catch {
      // Offline / unreachable — fail open so billing keeps working.
      setSettings({ ...DEFAULT_SALE_DISCOUNT_SETTINGS })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    setLoading(true)
    refresh()
  }, [authLoading, refresh])

  // Discounts are off when either the store's own master switch is off OR the
  // Discount page itself is hidden via Pages & Menus — both hide every
  // discount input across the app.
  const value = useMemo<DiscountContextType>(
    () => ({
      settings,
      isDiscountEnabled: settings.is_enabled !== false && isPageEnabled('/discount'),
      loading,
      refresh,
      setSettingsLocal: setSettings,
    }),
    [settings, loading, refresh, isPageEnabled]
  )

  return <DiscountContext.Provider value={value}>{children}</DiscountContext.Provider>
}

export function useDiscount() {
  const context = useContext(DiscountContext)
  if (!context) {
    throw new Error('useDiscount must be used within a DiscountProvider')
  }
  return context
}
