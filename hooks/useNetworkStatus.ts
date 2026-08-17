'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/lib/utils'

function healthURL(): string {
  return `${API_BASE.replace(/\/api\/v1\/?$/, '')}/health`
}

async function pingHealth(timeoutMs = 2000): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false
  }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(healthURL(), { method: 'GET', signal: controller.signal, cache: 'no-store' })
    return res.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

export function useNetworkStatus(intervalMs = 10000) {
  const [isOnline, setIsOnline] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)
  const onlineRef = useRef(true)

  const applyReachable = useCallback((reachable: boolean) => {
    if (onlineRef.current === reachable) return reachable
    onlineRef.current = reachable
    setIsOnline(reachable)
    setLastCheckedAt(Date.now())
    return reachable
  }, [])

  const refresh = useCallback(async () => {
    return applyReachable(await pingHealth())
  }, [applyReachable])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const reachable = await pingHealth()
      if (!cancelled) applyReachable(reachable)
    }

    void run()

    const handleOnline = () => {
      void run()
    }
    const handleOffline = () => {
      if (!cancelled) applyReachable(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const interval = window.setInterval(run, intervalMs)

    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.clearInterval(interval)
    }
  }, [applyReachable, intervalMs])

  return { isOnline, lastCheckedAt, refresh }
}
