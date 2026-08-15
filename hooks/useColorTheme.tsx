'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { getAuthToken } from '@/lib/authToken'
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME_ID,
  DEFAULT_CUSTOM_HEX,
  isColorThemeId,
  normalizeHex,
  persistColorTheme,
  readStoredColorTheme,
  type ColorThemeId,
} from '@/lib/colorThemes'

interface ColorThemeContextType {
  themeId: ColorThemeId
  customHex: string
  setTheme: (id: ColorThemeId, customHex?: string) => void
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined)

async function persistAppearanceToServer(id: ColorThemeId, customHex: string) {
  if (!getAuthToken()) return
  try {
    await apiFetch('/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify({ color_theme: id, custom_hex: customHex }),
    })
  } catch {
    // Local theme still applies if the server is unreachable.
  }
}

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ColorThemeId>(DEFAULT_COLOR_THEME_ID)
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_HEX)

  const setTheme = useCallback((id: ColorThemeId, nextHex?: string) => {
    const hex = normalizeHex(nextHex ?? customHex)
    setThemeId(id)
    if (id === 'custom') setCustomHex(hex)
    persistColorTheme(id, hex)
    void persistAppearanceToServer(id, hex)
  }, [customHex])

  useEffect(() => {
    const stored = readStoredColorTheme()
    if (stored) {
      setThemeId(stored.id)
      setCustomHex(stored.customHex)
      persistColorTheme(stored.id, stored.customHex)
    }

    if (!getAuthToken()) return
    let cancelled = false
    void apiFetch('/settings/appearance')
      .then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<{ color_theme?: string; custom_hex?: string }>
      })
      .then((data) => {
        if (cancelled || !data) return
        if (!isColorThemeId(data.color_theme)) {
          if (stored) void persistAppearanceToServer(stored.id, stored.customHex)
          return
        }
        const hex = normalizeHex(data.custom_hex || DEFAULT_CUSTOM_HEX)
        setThemeId(data.color_theme)
        setCustomHex(hex)
        persistColorTheme(data.color_theme, hex)
      })
      .catch(() => {
        // Keep the locally stored theme.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<ColorThemeContextType>(
    () => ({ themeId, customHex, setTheme }),
    [themeId, customHex, setTheme]
  )

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext)
  if (!context) {
    throw new Error('useColorTheme must be used within a ColorThemeProvider')
  }
  return context
}

export { COLOR_THEMES }
