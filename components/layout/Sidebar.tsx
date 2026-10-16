'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { cn } from '@/lib/utils'
import {
  filterNavForPageFeatures,
  filterNavForRole,
  isNavChildActive,
  navGroupHasActiveChild,
  navItems,
} from './nav-config'

const ROW_BASE =
  'group relative flex h-11 items-center rounded-xl text-[14px] font-medium transition-all duration-200 ease-out outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0'

const rowState = (active: boolean) =>
  active
    ? 'bg-[linear-gradient(135deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_100%)] text-white shadow-[0_8px_20px_-6px_hsl(var(--theme-600)/0.65),inset_0_1px_0_0_rgba(255,255,255,0.22)]'
    : 'text-white/65 hover:bg-white/[0.07] hover:text-white'

const iconClass = (active: boolean) =>
  cn(
    'shrink-0 transition-transform duration-200 ease-out',
    active ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]' : 'group-hover:scale-110'
  )

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { isPageEnabled } = usePageFeatures()
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

  // POS terminal keeps the always-expanded sidebar; other pages collapse until hover.
  const isPosPage = pathname === '/pos'
  const isExpanded = isPosPage || hovered

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
        'fixed left-2 top-2 z-40 hidden overflow-hidden rounded-2xl border border-white/10 bg-[hsl(var(--theme-950)/0.88)] backdrop-blur-2xl backdrop-saturate-150 transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block',
        'bottom-[calc(var(--app-bottom-nav-offset,0px)+0.5rem)]',
        isExpanded
          ? 'w-[15.5rem] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)]'
          : 'w-16 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)]'
      )}
      onMouseEnter={() => {
        if (!isPosPage) setHovered(true)
      }}
      onMouseLeave={() => {
        if (!isPosPage) setHovered(false)
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(90%_100%_at_50%_0%,hsl(var(--theme-500)/0.22),transparent_75%)]"
      />
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex h-[calc(var(--app-header-h)-0.5rem)] shrink-0 items-center',
            isExpanded ? 'px-4' : 'justify-center px-2'
          )}
        >
          <Link
            href="/dashboard"
            className={cn('flex items-center', isExpanded ? 'gap-2' : 'justify-center')}
            title="TruERP"
          >
            <BrandLogo showWordmark={isExpanded} iconClassName="h-8 w-8" wordmarkClassName="text-base text-white" />
          </Link>
        </div>
        <div aria-hidden="true" className="mx-3 h-px shrink-0 bg-white/10" />

        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-2 py-3">
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
                        weight={hasActiveChild ? 'fill' : 'duotone'}
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
                    <div className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/10 pl-3">
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
                                ? 'bg-white/10 text-white'
                                : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                            )}
                          >
                            <ChildIcon
                              size={18}
                              weight={isChildActive ? 'fill' : 'duotone'}
                              color="currentColor"
                              className={cn(
                                'shrink-0 transition-colors',
                                isChildActive ? 'text-[hsl(var(--theme-300))]' : 'text-white/50 group-hover/child:text-white'
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
                  weight={isActive ? 'fill' : 'duotone'}
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
