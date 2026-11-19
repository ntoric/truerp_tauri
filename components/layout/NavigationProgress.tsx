'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import BrandLoader from '@/components/BrandLoader'

/** Wait this long before showing the overlay so fast navigations don't flash. */
const SHOW_DELAY_MS = 150
/** Keep the overlay up at least this long once shown, to avoid a flicker. */
const MIN_VISIBLE_MS = 300
/** Safety net: never leave the overlay stuck if a navigation never resolves. */
const MAX_VISIBLE_MS = 10000

/**
 * Gooseroot-branded loading overlay for soft client navigations.
 * Starts on same-origin link clicks and clears once the route has changed.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const routeKey = `${pathname}?${searchParams?.toString() ?? ''}`
  const prevRoute = useRef(routeKey)
  const timers = useRef<number[]>([])
  const shownAt = useRef<number | null>(null)

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  const hide = () => {
    clearTimers()
    shownAt.current = null
    setVisible(false)
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        const nextKey = `${url.pathname}?${url.searchParams.toString()}`
        const currentKey = `${window.location.pathname}?${window.location.search.replace(/^\?/, '')}`
        if (nextKey === currentKey) return
      } catch {
        return
      }
      clearTimers()
      timers.current.push(
        window.setTimeout(() => {
          shownAt.current = Date.now()
          setVisible(true)
        }, SHOW_DELAY_MS),
        window.setTimeout(hide, MAX_VISIBLE_MS)
      )
    }

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      clearTimers()
    }
  }, [])

  useEffect(() => {
    if (prevRoute.current === routeKey) return
    prevRoute.current = routeKey
    clearTimers()
    if (shownAt.current === null) {
      // Overlay never appeared (fast navigation) — just cancel the pending show.
      setVisible(false)
      return
    }
    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current))
    timers.current.push(window.setTimeout(hide, remaining))
    return clearTimers
  }, [routeKey])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="brand-loader-overlay fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      <BrandLoader size={120} />
      <style jsx>{`
        .brand-loader-overlay {
          animation: brand-loader-fade 180ms ease-out;
        }
        @keyframes brand-loader-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
