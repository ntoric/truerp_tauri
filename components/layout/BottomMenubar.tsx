'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, HelpCircle, Menu, Package, Plus, RefreshCw, ScanLine, Settings, Trash2, X } from 'lucide-react'
import { Headset } from '@phosphor-icons/react'
import { Kbd } from '@/components/keyboard-shortcuts/Kbd'
import { useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils'
import {
  bottomNavPrimary,
  filterNavForPageFeatures,
  filterNavForRole,
  isNavChildActive,
  navItems,
  type NavItem,
} from './nav-config'

function flattenNavLinks(
  items: NavItem[]
): { name: string; href: string; icon: NavItem['icon']; accent?: string }[] {
  const links: { name: string; href: string; icon: NavItem['icon']; accent?: string }[] = []
  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        if (child.href)
          links.push({ name: child.name, href: child.href, icon: child.icon, accent: item.accent })
      }
    } else if (item.href) {
      links.push({ name: item.name, href: item.href, icon: item.icon, accent: item.accent })
    }
  }
  return links
}

const ACCOUNT_HREFS = new Set(['/settings', '/support'])

const BAR_BTN =
  'flex w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ease-out md:w-auto md:px-3'

const barBtnState = (active: boolean) =>
  active
    ? 'bg-[linear-gradient(135deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_100%)] text-white shadow-[0_6px_16px_-6px_hsl(var(--theme-600)/0.7),inset_0_1px_0_0_rgba(255,255,255,0.22)]'
    : 'text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-900'

const PAGE_ACTION_BTN = cn(BAR_BTN, 'text-slate-600 hover:bg-slate-900/[0.06] hover:text-blue-700')

function MenubarItemTooltip({
  label,
  kbd,
  children,
}: {
  label: string
  kbd?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="group relative flex shrink-0 items-stretch">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur group-hover:block group-focus-within:block">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white/90">{label}</span>
          {kbd}
        </div>
      </div>
    </div>
  )
}

export default function BottomMenubar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { isPageEnabled } = usePageFeatures()
  const { togglePanel, panelOpen } = useKeyboardShortcuts()
  const [moreOpen, setMoreOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [piSelectedCount, setPiSelectedCount] = useState(0)
  const isPurchaseInvoiceCreate = pathname === '/purchase-invoices/create'

  useEffect(() => {
    setMounted(true)
  }, [])

  // Track selected line items count from purchase invoice create page
  useEffect(() => {
    if (!isPurchaseInvoiceCreate) {
      setPiSelectedCount(0)
      return
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail
      setPiSelectedCount(typeof detail === 'number' ? detail : 0)
    }
    window.addEventListener('pi-action:selection-changed', handler)
    return () => window.removeEventListener('pi-action:selection-changed', handler)
  }, [isPurchaseInvoiceCreate])

  // Own the html offset class whenever this bar is on screen so page content,
  // table max-heights, and sticky footers clear it on every breakpoint.
  useEffect(() => {
    if (pathname === '/pos' || pathname.startsWith('/pos/')) return

    const root = document.documentElement
    root.classList.add('has-bottom-menubar')
    return () => {
      root.classList.remove('has-bottom-menubar')
    }
  }, [pathname])

  const visibleNavItems = useMemo(
    () => filterNavForPageFeatures(filterNavForRole(navItems, user?.role), isPageEnabled),
    [user?.role, isPageEnabled]
  )

  const primaryTabs = useMemo(
    () =>
      bottomNavPrimary.filter((tab) => {
        if (tab.href === '/dashboard') return true
        return isPageEnabled(tab.href)
      }),
    [isPageEnabled]
  )

  const moreLinks = useMemo(() => {
    const primaryHrefs = new Set<string>(bottomNavPrimary.map((t) => t.href))
    return flattenNavLinks(visibleNavItems).filter(
      (link) => !primaryHrefs.has(link.href) && !ACCOUNT_HREFS.has(link.href)
    )
  }, [visibleNavItems])

  const pageActionButtons = isPurchaseInvoiceCreate ? (
    <div className="flex h-full shrink-0 items-stretch gap-0.5">
      <MenubarItemTooltip label="Add Item to Bill" kbd={<Kbd keys={['Alt', '1']} size="sm" tone="inverse" />}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pi-action:add-item'))}
          className={PAGE_ACTION_BTN}
          title="Add Item to Bill"
          aria-label="Add Item to Bill"
        >
          <Package className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </MenubarItemTooltip>
      <MenubarItemTooltip label="Add New Row" kbd={<Kbd keys={['Alt', '2']} size="sm" tone="inverse" />}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pi-action:add-row'))}
          className={PAGE_ACTION_BTN}
          title="Add New Row"
          aria-label="Add New Row"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </MenubarItemTooltip>
      <MenubarItemTooltip label="Scan Barcode" kbd={<Kbd keys={['Alt', '3']} size="sm" tone="inverse" />}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pi-action:scan-barcode'))}
          className={PAGE_ACTION_BTN}
          title="Scan Barcode"
          aria-label="Scan Barcode"
        >
          <ScanLine className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </MenubarItemTooltip>
      {piSelectedCount > 0 && (
        <MenubarItemTooltip label={`Remove ${piSelectedCount} selected item(s)`}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('pi-action:remove-selected'))}
            className={cn(BAR_BTN, 'text-red-600 hover:bg-red-500/10 hover:text-red-700')}
            title={`Remove ${piSelectedCount} selected item(s)`}
            aria-label={`Remove ${piSelectedCount} selected item(s)`}
          >
            <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
          </button>
        </MenubarItemTooltip>
      )}
    </div>
  ) : null

  const settingsEnabled = isPageEnabled('/settings')
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/')
  const supportActive = pathname === '/support' || pathname.startsWith('/support/')

  const moreIsActive =
    moreOpen ||
    settingsActive ||
    moreLinks.some((link) => isNavChildActive(pathname, link.href) || pathname.startsWith(link.href))

  // Hide on POS — terminal UI needs full viewport.
  if (pathname === '/pos' || pathname.startsWith('/pos/')) {
    return null
  }

  const openShortcuts = () => {
    setMoreOpen(false)
    togglePanel()
  }

  const handleBack = () => {
    setMoreOpen(false)
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/dashboard')
  }

  const handleRefresh = () => {
    setMoreOpen(false)
    setRefreshing(true)
    // Full reload keeps client-fetched ERP data in sync (router.refresh is RSC-only).
    window.location.reload()
  }

  const navChromeActions = (
    <div className="flex h-full shrink-0 items-stretch gap-0.5">
      <MenubarItemTooltip label="Back">
        <button
          type="button"
          onClick={handleBack}
          className={cn(BAR_BTN, barBtnState(false))}
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </MenubarItemTooltip>
      <MenubarItemTooltip label="Refresh">
        <button
          type="button"
          onClick={handleRefresh}
          className={cn(BAR_BTN, barBtnState(false))}
          title="Refresh"
          aria-label="Refresh"
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-5 w-5 md:h-4 md:w-4', refreshing && 'animate-spin')} />
        </button>
      </MenubarItemTooltip>
    </div>
  )

  const accountActions = (
    <>
      {settingsEnabled && (
        <MenubarItemTooltip label="Settings">
          <Link
            href="/settings"
            onClick={() => setMoreOpen(false)}
            className={cn(BAR_BTN, barBtnState(settingsActive))}
          >
            <Settings className="h-5 w-5 md:h-4 md:w-4" />
          </Link>
        </MenubarItemTooltip>
      )}
      <MenubarItemTooltip label="Support">
        <Link
          href="/support"
          onClick={() => setMoreOpen(false)}
          className={cn(BAR_BTN, barBtnState(supportActive))}
        >
          <Headset size={16} weight={supportActive ? 'fill' : 'duotone'} className="h-5 w-5 md:h-4 md:w-4" />
        </Link>
      </MenubarItemTooltip>
      <MenubarItemTooltip label="Shortcuts" kbd={<Kbd keys={['Alt']} size="sm" tone="inverse" />}>
        <button
          type="button"
          onClick={openShortcuts}
          className={cn(BAR_BTN, barBtnState(panelOpen))}
          aria-pressed={panelOpen}
          title="Keyboard shortcuts (Alt)"
        >
          <HelpCircle className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </MenubarItemTooltip>
    </>
  )

  if (!mounted) return null

  return createPortal(
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-[var(--app-bottom-nav-offset)] z-40 max-h-[min(70vh,28rem)] overflow-y-auto rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)]"
            role="dialog"
            aria-label="More navigation"
          >
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Menu</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b p-2">
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Account
              </p>
              <div className="grid grid-cols-3 gap-1">
                {settingsEnabled && (
                  <Link
                    href="/settings"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium',
                      settingsActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <Settings className={cn('h-4 w-4', settingsActive ? 'text-blue-600' : 'text-slate-500')} />
                    Settings
                  </Link>
                )}
                <Link
                  href="/support"
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium',
                    supportActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <Headset weight={supportActive ? 'fill' : 'duotone'} className={cn('h-4 w-4', supportActive ? 'text-blue-600' : 'text-slate-500')} />
                  Support
                </Link>
                <button
                  type="button"
                  onClick={openShortcuts}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium',
                    panelOpen ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <HelpCircle className={cn('h-4 w-4', panelOpen ? 'text-blue-600' : 'text-slate-500')} />
                  Shortcuts
                </button>
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
              {moreLinks.map((link) => {
                const Icon = link.icon
                const active = isNavChildActive(pathname, link.href) || pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium',
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <Icon size={16} weight="duotone" color={active ? 'currentColor' : '#64748b'} className="shrink-0" />
                    <span className="truncate">{link.name}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      <nav className="app-bottom-menubar pointer-events-none" aria-label="Primary">
        {/* Strip height = --app-bottom-nav-h; the dock card floats inside with a 0.5rem side/bottom inset. */}
        <div className="h-14 px-2 pb-2 md:h-[3.25rem]">
          <div className="pointer-events-auto flex h-full items-stretch justify-between gap-0.5 rounded-2xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.55)_100%)] px-1.5 py-1 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.22),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-black/[0.05] backdrop-blur-xl backdrop-saturate-[1.8] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(37,44,66,0.88)_0%,rgba(25,31,48,0.82)_100%)] dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:ring-white/[0.06]">
            {/* Mobile: Back/Refresh left — primary destinations + More right */}
            <div className="flex w-full items-stretch justify-between gap-0.5 md:hidden">
              {navChromeActions}
              {pageActionButtons}
              <div className="flex min-w-0 items-stretch justify-end gap-0.5">
                {primaryTabs.map((tab) => {
                  const Icon = tab.icon
                  const active = tab.match(pathname)
                  return (
                    <MenubarItemTooltip key={tab.href} label={tab.name}>
                      <Link
                        href={tab.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(BAR_BTN, barBtnState(active))}
                      >
                        <Icon size={20} weight={active ? 'fill' : 'duotone'} color="currentColor" />
                      </Link>
                    </MenubarItemTooltip>
                  )
                })}
                <MenubarItemTooltip label="More">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((open) => !open)}
                    className={cn(BAR_BTN, barBtnState(moreIsActive))}
                    aria-expanded={moreOpen}
                    aria-label="More"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </MenubarItemTooltip>
              </div>
            </div>

            {/* Desktop: Back/Refresh left — Settings / Shortcuts right */}
            <div className="hidden w-full items-stretch justify-between gap-0.5 md:flex">
              {navChromeActions}
              {pageActionButtons}
              <div className="flex items-stretch justify-end gap-0.5">{accountActions}</div>
            </div>
          </div>
        </div>
      </nav>
    </>,
    document.body
  )
}

/** True when bottom menubar is expected to reserve layout space. */
export function shouldReserveBottomMenubarSpace(pathname: string): boolean {
  return pathname !== '/pos' && !pathname.startsWith('/pos/')
}
