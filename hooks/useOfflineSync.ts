'use client'

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncPendingPOSSales } from '@/lib/posSync'
import { subscribePOSAuthExpired } from '@/lib/posAuthGate'
import { subscribeDesktopPosQueueSync } from '@/lib/desktopBridge'
import { useNetworkStatus } from './useNetworkStatus'
import { apiFetch } from './useAuth'
import { getAuthToken } from '@/lib/authToken'

interface SyncStatus {
  pending: number
  failed: number
  isOnline: boolean
  authExpired: boolean
}

interface OfflineSyncValue {
  syncStatus: SyncStatus
  isSyncing: boolean
  autoSync: () => Promise<void>
  manualSync: () => Promise<void>
  queueOfflineOperation: (operation: string, entityType: string, entityData: unknown) => Promise<void>
  checkSyncStatus: () => Promise<number>
}

const OfflineSyncContext = createContext<OfflineSyncValue | null>(null)

function useOfflineSyncState(): OfflineSyncValue {
  const { isOnline } = useNetworkStatus()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pending: 0,
    failed: 0,
    isOnline: true,
    authExpired: false,
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)
  const onlineRef = useRef(isOnline)
  onlineRef.current = isOnline

  const refreshLocalCounts = useCallback(async () => {
    const unsynced = await offlineStorage.getUnsynced()
    setSyncStatus((prev) => ({
      ...prev,
      pending: unsynced.length,
      failed: unsynced.filter((item) => item.status === 'failed').length,
    }))
    return unsynced.length
  }, [])

  const autoSync = useCallback(async () => {
    if (!onlineRef.current || syncingRef.current) return
    if (!getAuthToken()) {
      await refreshLocalCounts()
      return
    }
    syncingRef.current = true
    setIsSyncing(true)
    try {
      const result = await syncPendingPOSSales()
      setSyncStatus((prev) => ({
        ...prev,
        pending: result.pending,
        failed: result.failed,
        isOnline: true,
      }))
      if (result.synced > 0) {
        try {
          const res = await apiFetch('/products', { timeoutMs: 8000 })
          if (res.ok) {
            const data = await res.json()
            await offlineStorage.cacheProducts(Array.isArray(data) ? data : [])
          }
        } catch {
          /* keep local catalog */
        }
      }
    } catch (err) {
      console.error('Auto-sync failed:', err)
      await refreshLocalCounts()
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }
  }, [refreshLocalCounts])

  useEffect(() => {
    void offlineStorage.init().then(() => refreshLocalCounts())
    return subscribePOSAuthExpired((expired) => {
      setSyncStatus((prev) => ({ ...prev, authExpired: expired }))
    })
  }, [refreshLocalCounts])

  useEffect(() => {
    setSyncStatus((prev) => ({ ...prev, isOnline }))
    if (isOnline) {
      void autoSync()
    }
  }, [isOnline, autoSync])

  useEffect(() => {
    const interval = setInterval(() => {
      void (async () => {
        const pending = await refreshLocalCounts()
        if (onlineRef.current && pending > 0) {
          void autoSync()
        }
      })()
    }, 15000)
    return () => clearInterval(interval)
  }, [autoSync, refreshLocalCounts])

  useEffect(() => {
    let active = true
    let unsub = () => {}
    void subscribeDesktopPosQueueSync(() => {
      void autoSync()
    }).then((fn) => {
      if (!active) {
        fn()
        return
      }
      unsub = fn
    })
    return () => {
      active = false
      unsub()
    }
  }, [autoSync])

  const manualSync = useCallback(async () => {
    if (!onlineRef.current) {
      throw new Error('Cannot sync while offline')
    }
    await offlineStorage.requeueFailedSyncs()
    await autoSync()
  }, [autoSync])

  const queueOfflineOperation = useCallback(
    async (operation: string, entityType: string, entityData: unknown) => {
      await offlineStorage.addToSyncQueue(operation, entityType, entityData)
      await refreshLocalCounts()
    },
    [refreshLocalCounts]
  )

  return {
    syncStatus,
    isSyncing,
    autoSync,
    manualSync,
    queueOfflineOperation,
    checkSyncStatus: refreshLocalCounts,
  }
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const value = useOfflineSyncState()
  return createElement(OfflineSyncContext.Provider, { value }, children)
}

export function useOfflineSync(): OfflineSyncValue {
  const ctx = useContext(OfflineSyncContext)
  if (!ctx) {
    throw new Error('useOfflineSync must be used within OfflineSyncProvider')
  }
  return ctx
}
