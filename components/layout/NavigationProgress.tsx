'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Thin top progress bar for soft client navigations.
 * Sidebar/header stay mounted; only the content area feels like it is loading.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const routeKey = `${pathname}?${searchParams?.toString() ?? ''}`
  const prevRoute = useRef(routeKey)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
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
      setVisible(true)
      setWidth(18)
      timers.current.push(
        window.setTimeout(() => setWidth(55), 80),
        window.setTimeout(() => setWidth(78), 280)
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
    setVisible(true)
    setWidth(92)
    timers.current.push(
      window.setTimeout(() => setWidth(100), 60),
      window.setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, 220)
    )
    return clearTimers
  }, [routeKey])

  if (!visible && width === 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-0.5 overflow-hidden"
    >
      <div
        className="h-full bg-blue-600 transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${width}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  )
}
