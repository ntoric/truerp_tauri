import { useEffect, useState, useCallback } from 'react'
import { offlineStorage } from '@/lib/offlineStorage'
import { apiFetch } from './useAuth'

interface SyncStatus {
  pending: number
  failed: number
  isOnline: boolean
}

export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pending: 0,
    failed: 0,
    isOnline: navigator.onLine
  })
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // Initialize offline storage
    offlineStorage.init()

    // Set initial online status
    setSyncStatus(prev => ({ ...prev, isOnline: navigator.onLine }))

    // Listen for online/offline events
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }))
      autoSync()
    }

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check sync status periodically
    checkSyncStatus()
    const interval = setInterval(checkSyncStatus, 30000) // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const checkSyncStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/sync/status')
      if (res.ok) {
        const data = await res.json()
        setSyncStatus(prev => ({
          ...prev,
          pending: data.pending_count,
          failed: data.failed_count
        }))
      }
    } catch (err) {
      // If offline, check local storage
      const pending = await offlineStorage.getPendingSyncs()
      setSyncStatus(prev => ({
        ...prev,
        pending: pending.length,
        failed: 0
      }))
    }
  }, [])

  const autoSync = useCallback(async () => {
    if (!syncStatus.isOnline || isSyncing) return

    const pending = await offlineStorage.getPendingSyncs()
    if (pending.length === 0) return

    setIsSyncing(true)
    try {
      const operations = pending.map(item => ({
        operation: item.operation,
        entity_type: item.entityType,
        entity_data: item.entityData
      }))

      const res = await apiFetch('/sync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      })

      if (res.ok) {
        const data = await res.json()
        const successfulIds = pending
          .filter((_, i) => data.results[i]?.success)
          .map(item => item.id)
        
        await offlineStorage.removeSyncedItems(successfulIds)
        await checkSyncStatus()
      }
    } catch (err) {
      console.error('Auto-sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [syncStatus.isOnline, isSyncing, checkSyncStatus])

  const manualSync = useCallback(async () => {
    if (!syncStatus.isOnline) {
      throw new Error('Cannot sync while offline')
    }
    await autoSync()
  }, [syncStatus.isOnline, autoSync])

  const queueOfflineOperation = useCallback(async (
    operation: string,
    entityType: string,
    entityData: any
  ) => {
    await offlineStorage.addToSyncQueue(operation, entityType, entityData)
    await checkSyncStatus()
  }, [checkSyncStatus])

  return {
    syncStatus,
    isSyncing,
    autoSync,
    manualSync,
    queueOfflineOperation,
    checkSyncStatus
  }
}
