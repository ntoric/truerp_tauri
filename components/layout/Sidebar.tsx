'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
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
        // Stop above the fixed bottom menubar so the last items (e.g. Developer Settings) stay visible.
        'fixed left-0 top-0 z-40 hidden overflow-hidden border-r bg-white transition-[width] duration-200 ease-out md:block',
        'bottom-[var(--app-bottom-nav-offset,0px)]',
        isExpanded ? 'w-64 shadow-lg' : 'w-[4.5rem]'
      )}
      onMouseEnter={() => {
        if (!isPosPage) setHovered(true)
      }}
      onMouseLeave={() => {
        if (!isPosPage) setHovered(false)
      }}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex h-[var(--app-header-h)] items-center border-b',
            isExpanded ? 'px-4' : 'justify-center px-2'
          )}
        >
          <Link
            href="/dashboard"
            className={cn('flex items-center', isExpanded ? 'gap-2' : 'justify-center')}
            title="TruERP"
          >
            <img
              src="/logo.png"
              alt="TruERP"
              className="h-7 w-7 object-contain"
              width={28}
              height={28}
            />
            {isExpanded && (
              <span className="whitespace-nowrap text-base font-bold text-gray-900">TruERP</span>
            )}
          </Link>
        </div>

        <nav
          className={cn(
            'sidebar-scroll flex-1 space-y-1 overflow-y-auto py-3',
            isExpanded ? 'px-2.5' : 'px-2'
          )}
        >
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
                      'flex w-full items-center rounded-md py-2.5 text-[15px] font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                      isExpanded ? 'justify-between px-2.5' : 'justify-center px-2',
                      hasActiveChild
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn('flex items-center', isExpanded ? 'gap-3' : '')}>
                      <Icon className={cn('h-6 w-6 shrink-0', hasActiveChild ? 'text-blue-600' : 'text-gray-500')} />
                      {isExpanded && <span className="whitespace-nowrap">{item.name}</span>}
                    </div>
                    {isExpanded &&
                      (expandedItems.has(item.name) ? (
                        <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
                      ))}
                  </button>
                  {isGroupOpen && (
                    <div className="ml-8 mt-1 space-y-1">
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
                              'flex items-center gap-3 rounded-md px-2.5 py-2 text-[15px] font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                              isChildActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            <ChildIcon className={cn('h-5 w-5', isChildActive ? 'text-blue-600' : 'text-gray-400')} />
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
                  'flex items-center rounded-md py-2.5 text-[15px] font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
                  isExpanded ? 'gap-3 px-2.5' : 'justify-center px-2',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <Icon className={cn('h-6 w-6 shrink-0', isActive ? 'text-blue-600' : 'text-gray-500')} />
                {isExpanded && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
