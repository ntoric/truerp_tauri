'use client'

import { ReactNode, Suspense, useEffect, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomMenubar, { shouldReserveBottomMenubarSpace } from './BottomMenubar'
import NavigationProgress from './NavigationProgress'
import ComingSoonPage from '@/components/ComingSoonPage'
import AnnouncementToaster from '@/components/AnnouncementToaster'
import { useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { KeyboardShortcutsProvider } from '@/hooks/useKeyboardShortcuts'
import { pageLabelForPath } from '@/lib/pageFeatures'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { RefreshCw, WifiOff } from 'lucide-react'

/** True when a parent layout already rendered the app chrome. */
const DashboardShellContext = createContext(false)

function isShellLessPath(pathname: string) {
  // Print/PDF views render their own full-page UI.
  return pathname.includes('/pdf')
}

function AuthBootSkeleton() {
  return (
    <div className="flex min-h-screen bg-[#f6f7fb]">
      {/* Floating dock placeholder */}
      <div className="hidden shrink-0 p-2 pr-0 md:block">
        <div className="flex h-full w-14 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,hsl(var(--theme-900)/0.95),hsl(var(--theme-950)/0.98))] px-2 py-4 shadow-xl shadow-black/20">
          <Skeleton dark className="h-8 w-8 rounded-lg" />
          <div className="mt-2 flex flex-col items-center gap-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} dark delayMs={i * 70} className="h-9 w-9 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Floating header placeholder */}
        <div className="px-2 pt-2 sm:px-3">
          <div className="flex h-12 items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 px-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] backdrop-blur-md">
            <Skeleton className="h-7 w-36 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton delayMs={80} className="h-7 w-20 rounded-full" />
              <Skeleton delayMs={160} className="h-8 w-8 rounded-full" />
              <Skeleton delayMs={240} className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
        <div className="space-y-4 p-3 sm:p-4 lg:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} delayMs={i * 80} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
  hideNavigation = false,
}: {
  children: ReactNode
  hideNavigation?: boolean
}) {
  const nested = useContext(DashboardShellContext)
  const { user, loading, token, refreshProfile } = useAuth()
  const pathname = usePathname()
  const { isPageEnabled, loading: featuresLoading } = usePageFeatures()

  useEffect(() => {
    if (!loading && !user && !token) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/dashboard'
      // Full navigation is reliable in the desktop WebView; Next router can stall.
      window.location.href = `/login?next=${encodeURIComponent(next)}`
      return
    }
    if (!loading && user?.must_change_password) {
      window.location.href = '/change-password-required'
    }
  }, [loading, user, token])

  // POS keeps a permanently expanded sidebar; elsewhere content sits beside the
  // collapsed rail and the menu overlays when hovered. On small screens the
  // sidebar is hidden and BottomMenubar reserves space instead.
  const isPosPage = pathname === '/pos' || pathname.startsWith('/pos/')
  const contentOffset = isPosPage ? 'md:ml-64' : 'md:ml-[4.5rem]'
  const showShell =
    !nested && !!user && !loading && !hideNavigation && !isShellLessPath(pathname)
  const reserveBottomNav = showShell && shouldReserveBottomMenubarSpace(pathname)

  // Pages still wrap content in <DashboardLayout>; avoid a second sidebar/header.
  if (nested) {
    return <>{children}</>
  }

  if (loading || !user) {
    if (!loading && !user && token) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7fb] p-6">
          <WifiOff className="h-12 w-12 text-gray-400" />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-700">Unable to reach server</h2>
            <p className="mt-1 text-sm text-gray-500">
              Your session is still active. Please check your connection and try again.
            </p>
          </div>
          <button
            onClick={() => refreshProfile()}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )
    }
    return <AuthBootSkeleton />
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
          <div className="min-h-screen bg-[#f6f7fb]">
            <main className="app-main p-4 sm:p-5">{content}</main>
          </div>
        ) : (
          content
        )}
      </DashboardShellContext.Provider>
    )
  }

  return (
    <DashboardShellContext.Provider value={true}>
      <KeyboardShortcutsProvider>
        <div className="min-h-screen bg-[#f6f7fb]">
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <Sidebar />
          <div
            className={cn(
              contentOffset,
              // Explicit clearance matching .app-bottom-menubar heights — don't
              // rely only on --app-bottom-nav-offset (can be 0 before the class lands).
              reserveBottomNav &&
                'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))]'
            )}
          >
            <Header />
            <main className="app-main p-3 sm:p-4 lg:p-5">{content}</main>
          </div>
          <BottomMenubar />
          <AnnouncementToaster />
        </div>
      </KeyboardShortcutsProvider>
    </DashboardShellContext.Provider>
  )
}
