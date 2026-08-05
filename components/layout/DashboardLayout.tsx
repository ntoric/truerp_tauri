'use client'

import { ReactNode, useEffect, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import ComingSoonPage from '@/components/ComingSoonPage'
import { useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { pageLabelForPath } from '@/lib/pageFeatures'

/** True when a parent layout already rendered the app chrome. */
const DashboardShellContext = createContext(false)

function isShellLessPath(pathname: string) {
  // Print/PDF views render their own full-page UI.
  return pathname.includes('/pdf')
}

export default function DashboardLayout({
  children,
  hideNavigation = false,
}: {
  children: ReactNode
  hideNavigation?: boolean
}) {
  const nested = useContext(DashboardShellContext)
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const { isPageEnabled, loading: featuresLoading } = usePageFeatures()

  useEffect(() => {
    if (!loading && !user) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
      // Full navigation is reliable in the desktop WebView; Next router can stall.
      window.location.href = `/login?next=${encodeURIComponent(next)}`
    }
  }, [loading, user])

  // Pages still wrap content in <DashboardLayout>; avoid a second sidebar/header.
  if (nested) {
    return <>{children}</>
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  const showComingSoon = !featuresLoading && !isPageEnabled(pathname)
  const content = showComingSoon ? (
    <ComingSoonPage
      title={`${pageLabelForPath(pathname)} is coming soon`}
      description="This page has been temporarily disabled. Please contact your Super Admin if you need access."
    />
  ) : (
    children
  )

  if (hideNavigation || isShellLessPath(pathname)) {
    return (
      <DashboardShellContext.Provider value={true}>
        {hideNavigation ? (
          <div className="min-h-screen bg-gray-50">
            <main className="p-8">{content}</main>
          </div>
        ) : (
          content
        )}
      </DashboardShellContext.Provider>
    )
  }

  // POS keeps a permanently expanded sidebar; elsewhere content sits beside the
  // collapsed rail and the menu overlays when hovered.
  const isPosPage = pathname === '/pos' || pathname.startsWith('/pos/')
  const contentOffset = isPosPage ? 'ml-64' : 'ml-16'

  return (
    <DashboardShellContext.Provider value={true}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className={contentOffset}>
          <Header />
          <main className="p-8">{content}</main>
        </div>
      </div>
    </DashboardShellContext.Provider>
  )
}
