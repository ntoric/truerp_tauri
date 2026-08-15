import { useCallback, useEffect, useRef, useState } from 'react'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncPendingPOSSales } from '@/lib/posSync'
import { subscribePOSAuthExpired } from '@/lib/posAuthGate'
import { useNetworkStatus } from './useNetworkStatus'
import { apiFetch } from './useAuth'

interface SyncStatus {
  pending: number
  failed: number
  isOnline: boolean
  authExpired: boolean
}

export function useOfflineSync() {
  const { isOnline } = useNetworkStatus()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pending: 0,
    failed: 0,
    isOnline: true,
    authExpired: false,
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)

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
    if (!isOnline || syncingRef.current) return
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
  }, [isOnline, refreshLocalCounts])

  useEffect(() => {
    void offlineStorage.init()
    void refreshLocalCounts()
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
      void refreshLocalCounts()
    }, 15000)
    return () => clearInterval(interval)
  }, [refreshLocalCounts])

  const manualSync = useCallback(async () => {
    if (!isOnline) {
      throw new Error('Cannot sync while offline')
    }
    await offlineStorage.requeueFailedSyncs()
    await autoSync()
  }, [isOnline, autoSync])

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
