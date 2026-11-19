'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { useAppearance } from '@/hooks/useAppearance'
import { cn } from '@/lib/utils'
import {
  filterNavForPageFeatures,
  filterNavForRole,
  isNavChildActive,
  navGroupHasActiveChild,
  navItems,
} from './nav-config'

// Gooseroot rail (.gr-sidebar): brand gradient, white-on-red icons, white active pill.
const ROW_BASE =
  'group relative flex h-11 items-center rounded-xl text-[14px] font-medium transition-all duration-200 ease-out outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0'

const rowState = (active: boolean) =>
  active
    ? 'bg-white text-[hsl(var(--grad-mid))] shadow-[0_10px_22px_rgba(62,0,12,0.25)]'
    : 'text-white/80 hover:bg-white/[0.14] hover:text-white'

const iconClass = (active: boolean) =>
  cn('shrink-0 transition-transform duration-200 ease-out', !active && 'group-hover:scale-110')

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { isPageEnabled } = usePageFeatures()
  const { prefs } = useAppearance()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState(false)
  const visibleNavItems = useMemo(
    () =>
      filterNavForPageFeatures(filterNavForRole(navItems, user?.role), isPageEnabled).filter(
        // Settings / Logout live in the bottom menubar.
        (item) => item.href !== '/settings'
      ),
    [user?.role, isPageEnabled]
  )

  // POS and the "Expanded" sidebar style keep the menu open; "Icons only"
  // collapses to the rail and overlays the full menu on hover.
  const isPosPage = pathname === '/pos'
  const pinnedOpen = isPosPage || prefs.sidebarStyle === 'expanded'
  const isExpanded = pinnedOpen || hovered
  const onRight = prefs.sidebarPosition === 'right'

  // Warm the route ahead of click (Next disables automatic Link prefetch in dev).
  const prefetchHref = useCallback(
    (href?: string) => {
      if (!href || href === '#' || href === pathname) return
      router.prefetch(href)
    },
    [router, pathname]
  )

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // Auto-expand parent if any child is active
  useEffect(() => {
    visibleNavItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = navGroupHasActiveChild(pathname, item.children)
        if (hasActiveChild) {
          setExpandedItems((prev) => {
            const next = new Set(prev)
            next.add(item.name)
            return next
          })
        }
      }
    })
  }, [pathname, visibleNavItems])

  return (
    <aside
      className={cn(
        // Floating card inset 0.5rem from the edges; its right edge still lines up with the
        // content offset (4.5rem collapsed / 16rem on POS) set in DashboardLayout.
        // Stop above the fixed bottom menubar so the last items (e.g. Developer Settings) stay visible.
        'fixed top-2 z-40 hidden overflow-hidden rounded-3xl bg-brand-rail text-white transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block',
        onRight ? 'right-2' : 'left-2',
        'bottom-[calc(var(--app-bottom-nav-offset,0px)+0.5rem)]',
        isExpanded && !pinnedOpen
          ? 'w-[15.5rem] shadow-[0_24px_60px_-12px_hsl(var(--theme-900)/0.55)]'
          : isExpanded
            ? 'w-[15.5rem] shadow-gr-md'
            : 'w-16 shadow-gr-md'
      )}
      onMouseEnter={() => {
        if (!pinnedOpen) setHovered(true)
      }}
      onMouseLeave={() => {
        if (!pinnedOpen) setHovered(false)
      }}
    >
      {/* Soft ring watermark, as on the kit's promo / rail surfaces */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 -z-0 h-44 w-44 rounded-full border-[28px] border-white/[0.07]"
      />
      <div className="flex h-full flex-col">
        <div
          className={cn(
            // Explicit padding instead of a fixed height so the logo gets breathing room above it.
            'flex shrink-0 items-center pb-3 pt-4',
            isExpanded ? 'px-4' : 'justify-center px-2'
          )}
        >
          <Link
            href="/dashboard"
            className={cn('flex items-center', isExpanded ? 'gap-2' : 'justify-center')}
            title="TruERP by Gooseroot"
          >
            <BrandLogo
              showWordmark={isExpanded}
              iconClassName="h-9 w-9 drop-shadow-[0_4px_10px_rgba(62,0,12,0.35)]"
              wordmarkClassName="text-base text-white [&>span]:text-white/85"
            />
          </Link>
        </div>
        <div aria-hidden="true" className="relative mx-3 h-px shrink-0 bg-white/15" />

        <nav className="sidebar-scroll relative flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {visibleNavItems.map((item) => {
            if (item.children) {
              const Icon = item.icon
              const isGroupOpen = isExpanded && expandedItems.has(item.name)
              const hasActiveChild = navGroupHasActiveChild(pathname, item.children)

              return (
                <div key={item.name}>
                  <button
                    onClick={(e) => {
                      if (isExpanded) toggleExpanded(item.name)
                      e.currentTarget.blur()
                    }}
                    title={item.name}
                    className={cn(
                      ROW_BASE,
                      'w-full',
                      isExpanded ? 'justify-between px-3' : 'justify-center',
                      rowState(hasActiveChild)
                    )}
                  >
                    <div className={cn('flex items-center', isExpanded ? 'gap-3' : '')}>
                      <Icon
                        size={22}
                        weight={hasActiveChild ? 'bold' : 'regular'}
                        color="currentColor"
                        className={iconClass(hasActiveChild)}
                      />
                      {isExpanded && <span className="whitespace-nowrap">{item.name}</span>}
                    </div>
                    {isExpanded && (
                      <CaretRight
                        size={14}
                        weight="bold"
                        className={cn(
                          'shrink-0 opacity-50 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-80',
                          expandedItems.has(item.name) && 'rotate-90 opacity-80'
                        )}
                      />
                    )}
                  </button>
                  {isGroupOpen && (
                    <div className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/20 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon
                        const isChildActive = isNavChildActive(pathname, child.href)
                        return (
                          <Link
                            key={child.name}
                            href={child.href || '#'}
                            prefetch
                            onMouseEnter={() => prefetchHref(child.href)}
                            onFocus={() => prefetchHref(child.href)}
                            onClick={(e) => e.currentTarget.blur()}
                            className={cn(
                              'group/child flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                              isChildActive
                                ? 'bg-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]'
                                : 'text-white/75 hover:bg-white/[0.12] hover:text-white'
                            )}
                          >
                            <ChildIcon
                              size={18}
                              weight={isChildActive ? 'bold' : 'regular'}
                              color="currentColor"
                              className={cn(
                                'shrink-0 transition-colors',
                                isChildActive ? 'text-white' : 'text-white/65 group-hover/child:text-white'
                              )}
                            />
                            <span className="whitespace-nowrap">{child.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const Icon = item.icon
            const isActive = pathname.startsWith(item.href || '')
            return (
              <Link
                key={item.name}
                href={item.href || '#'}
                prefetch
                title={item.name}
                onMouseEnter={() => prefetchHref(item.href)}
                onFocus={() => prefetchHref(item.href)}
                onClick={(e) => e.currentTarget.blur()}
                className={cn(
                  ROW_BASE,
                  isExpanded ? 'gap-3 px-3' : 'justify-center',
                  rowState(isActive)
                )}
              >
                <Icon
                  size={22}
                  weight={isActive ? 'bold' : 'regular'}
                  color="currentColor"
                  className={iconClass(isActive)}
                />
                {isExpanded && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
