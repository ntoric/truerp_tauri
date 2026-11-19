'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/** Leaf cut-out where the two Lens rings overlap (from gooseroot-ui). */
const LENS_LEAF =
  'M225.0 -181.37254478007415 A289 289 0 0 1 225.0 181.37254478007415 A289 289 0 0 1 225.0 -181.37254478007415 Z'

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
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')

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

  const gradId = `lens-g-${uid}`
  const maskId = `lens-m-${uid}`

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="brand-loader-overlay fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      {/* Gooseroot Lens loader, tinted with the user's accent theme ramp. */}
      <svg className="gr-lens" viewBox="-309 -309 1068 618" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="-309" y1="0" x2="759" y2="0">
            <stop offset="0" style={{ stopColor: 'hsl(var(--theme-500))' }} />
            <stop offset="1" style={{ stopColor: 'hsl(var(--theme-700))' }} />
          </linearGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-500" y="-500" width="1500" height="1000">
            <rect x="-500" y="-500" width="1500" height="1000" fill="#fff" />
            <path className="leaf" d={LENS_LEAF} fill="#000" stroke="#000" strokeWidth={44} strokeLinejoin="round" />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`} stroke={`url(#${gradId})`}>
          <g className="ga">
            <path className="ra" pathLength={100} d="M0 -208.5 A208.5 208.5 0 1 1 0 208.5 A208.5 208.5 0 1 1 0 -208.5" />
          </g>
          <g className="gb">
            <path className="rb" pathLength={100} d="M450 208.5 A208.5 208.5 0 1 1 450 -208.5 A208.5 208.5 0 1 1 450 208.5" />
          </g>
        </g>
      </svg>
      <style jsx>{`
        .brand-loader-overlay {
          animation: brand-loader-fade 180ms ease-out;
        }
        @keyframes brand-loader-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .gr-lens {
          width: 120px;
          height: calc(120px * 0.58);
          overflow: visible;
        }
        .gr-lens .ra,
        .gr-lens .rb {
          fill: none;
          stroke-width: 161;
          stroke-dasharray: 100;
          animation: gr-lens-draw 2.6s cubic-bezier(0.6, 0, 0.3, 1) infinite;
        }
        .gr-lens .ga {
          animation: gr-lens-a 2.6s cubic-bezier(0.7, 0, 0.25, 1) infinite;
        }
        .gr-lens .gb {
          animation: gr-lens-b 2.6s cubic-bezier(0.7, 0, 0.25, 1) infinite;
        }
        .gr-lens .leaf {
          transform-box: view-box;
          transform-origin: 225px 0;
          animation: gr-lens-leaf 2.6s cubic-bezier(0.3, 1.4, 0.5, 1) infinite;
        }
        @keyframes gr-lens-draw {
          0% { stroke-dashoffset: 100; }
          30%, 82% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 100; }
        }
        @keyframes gr-lens-a {
          0%, 22% { transform: translateX(-130px); }
          46%, 82% { transform: none; }
          100% { transform: translateX(-130px); }
        }
        @keyframes gr-lens-b {
          0%, 22% { transform: translateX(130px); }
          46%, 82% { transform: none; }
          100% { transform: translateX(130px); }
        }
        @keyframes gr-lens-leaf {
          0%, 44% { transform: scale(0); }
          56%, 76% { transform: scale(1); }
          84%, 100% { transform: scale(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gr-lens .ra,
          .gr-lens .rb,
          .gr-lens .ga,
          .gr-lens .gb,
          .gr-lens .leaf {
            animation: none;
          }
          .gr-lens .ra,
          .gr-lens .rb {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  )
}
