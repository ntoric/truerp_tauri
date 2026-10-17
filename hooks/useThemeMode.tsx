'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { getAuthToken } from '@/lib/authToken'
import {
  DEFAULT_THEME_MODE,
  THEME_MODE_STORAGE_KEY,
  isThemeMode,
  persistThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  watchSystemThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
} from '@/lib/themeMode'

interface ThemeModeContextType {
  /** Selected preference: light, dark, or system. */
  mode: ThemeMode
  /** Effective mode after resolving 'system'. */
  resolvedMode: ResolvedThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined)

async function persistModeToServer(mode: ThemeMode) {
  if (!getAuthToken()) return
  try {
    await apiFetch('/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify({ theme_mode: mode }),
    })
  } catch {
    // Local mode still applies if the server is unreachable.
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE)
  const [resolvedMode, setResolvedMode] = useState<ResolvedThemeMode>(resolveThemeMode(DEFAULT_THEME_MODE))

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    setResolvedMode(persistThemeMode(next))
    void persistModeToServer(next)
  }, [])

  // Load stored preference, then reconcile with the server copy.
  useEffect(() => {
    const stored = readStoredThemeMode()
    const initial = stored ?? DEFAULT_THEME_MODE
    setModeState(initial)
    setResolvedMode(persistThemeMode(initial))

    if (!getAuthToken()) return
    let cancelled = false
    void apiFetch('/settings/appearance')
      .then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<{ theme_mode?: string }>
      })
      .then((data) => {
        if (cancelled || !data || !isThemeMode(data.theme_mode)) return
        setModeState(data.theme_mode)
        setResolvedMode(persistThemeMode(data.theme_mode))
      })
      .catch(() => {
        // Keep the locally stored mode.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // While on 'system', follow OS scheme changes.
  useEffect(() => {
    if (mode !== 'system') return
    return watchSystemThemeMode((resolved) => {
      setResolvedMode(resolved)
      const root = document.documentElement
      root.classList.toggle('dark', resolved === 'dark')
      root.style.colorScheme = resolved
    })
  }, [mode])

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== THEME_MODE_STORAGE_KEY) return
      const next = readStoredThemeMode()
      if (!next || next === mode) return
      setModeState(next)
      setResolvedMode(resolveThemeMode(next))
      const resolved = resolveThemeMode(next)
      document.documentElement.classList.toggle('dark', resolved === 'dark')
      document.documentElement.style.colorScheme = resolved
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [mode])

  const value = useMemo<ThemeModeContextType>(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode, setMode]
  )

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider')
  }
  return context
}
