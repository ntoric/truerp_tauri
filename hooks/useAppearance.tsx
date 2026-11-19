'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearanceToDocument,
  persistAppearance,
  readStoredAppearance,
  type AppearancePrefs,
} from '@/lib/appearancePrefs'

interface AppearanceContextType {
  prefs: AppearancePrefs
  /** Shallow-merge a change; saved immediately. */
  update: (patch: Partial<AppearancePrefs>) => void
  reset: () => void
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [prefs, setPrefs] = useState<AppearancePrefs>(DEFAULT_APPEARANCE)

  // Load this account's prefs once the user is known (and on account switch).
  useEffect(() => {
    const stored = readStoredAppearance(userId) ?? DEFAULT_APPEARANCE
    setPrefs(stored)
    persistAppearance(stored, userId)
  }, [userId])

  // Cross-tab sync of the device copy.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_STORAGE_KEY) return
      const next = readStoredAppearance()
      if (!next) return
      setPrefs(next)
      applyAppearanceToDocument(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback(
    (patch: Partial<AppearancePrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch }
        persistAppearance(next, userId)
        return next
      })
    },
    [userId]
  )

  const reset = useCallback(() => {
    setPrefs(DEFAULT_APPEARANCE)
    persistAppearance(DEFAULT_APPEARANCE, userId)
  }, [userId])

  const value = useMemo(() => ({ prefs, update, reset }), [prefs, update, reset])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider')
  }
  return context
}

/**
 * Initial open state for a page's collapsible stat cards, following the
 * "Expand page stats" preference. Pages still own the toggle afterwards.
 */
export function useStatsDefaultOpen(): [boolean, (open: boolean | ((prev: boolean) => boolean)) => void] {
  const { prefs } = useAppearance()
  const [open, setOpen] = useState(prefs.expandStats)
  // Prefs hydrate from storage after mount; follow them until the user toggles.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched) setOpen(prefs.expandStats)
  }, [prefs.expandStats, touched])
  const set = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setTouched(true)
    setOpen(value)
  }, [])
  return [open, set]
}
