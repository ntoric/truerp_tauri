'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const refresh = useCallback(async () => {
    const reachable = await pingHealth()
    setIsOnline(reachable)
    setLastCheckedAt(Date.now())
    return reachable
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const reachable = await pingHealth()
      if (!cancelled) {
        setIsOnline(reachable)
        setLastCheckedAt(Date.now())
      }
    }

    void run()

    const handleOnline = () => {
      void run()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setLastCheckedAt(Date.now())
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
  }, [intervalMs])

  return { isOnline, lastCheckedAt, refresh }
}
