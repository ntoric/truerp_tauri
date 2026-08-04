'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import {
  defaultPageFeatures,
  isPageEnabled as checkPageEnabled,
  mergePageFeatures,
  type PageFeaturesMap,
} from '@/lib/pageFeatures'

interface PageFeaturesContextType {
  pages: PageFeaturesMap
  loading: boolean
  refresh: () => Promise<void>
  setPagesLocal: (pages: PageFeaturesMap) => void
  isPageEnabled: (pathname: string) => boolean
}

const PageFeaturesContext = createContext<PageFeaturesContextType | undefined>(undefined)

export function PageFeaturesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [pages, setPages] = useState<PageFeaturesMap>(() => defaultPageFeatures())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setPages(defaultPageFeatures())
      setLoading(false)
      return
    }
    try {
      const res = await apiFetch('/page-features')
      if (res.ok) {
        const data = await res.json()
        setPages(mergePageFeatures(data.pages))
      } else {
        setPages(defaultPageFeatures())
      }
    } catch {
      setPages(defaultPageFeatures())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    setLoading(true)
    refresh()
  }, [authLoading, refresh])

  const value = useMemo<PageFeaturesContextType>(
    () => ({
      pages,
      loading,
      refresh,
      setPagesLocal: setPages,
      isPageEnabled: (pathname: string) => checkPageEnabled(pathname, pages),
    }),
    [pages, loading, refresh]
  )

  return <PageFeaturesContext.Provider value={value}>{children}</PageFeaturesContext.Provider>
}

export function usePageFeatures() {
  const context = useContext(PageFeaturesContext)
  if (!context) {
    throw new Error('usePageFeatures must be used within a PageFeaturesProvider')
  }
  return context
}
