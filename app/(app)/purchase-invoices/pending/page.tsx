'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import {
  deleteQueuedPurchaseBill,
  listPendingPurchaseBills,
  type QueuedPurchaseBill,
} from '@/lib/purchaseBillOffline'
import { PURCHASE_BILLS_SYNCED_EVENT } from '@/lib/purchaseBillSync'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Loader2, RefreshCw, Trash2, Pencil, CloudOff, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

function billNumberFromPayload(bill: QueuedPurchaseBill): string {
  const pn = (bill.payload as { bill_number?: string } | null)?.bill_number
  return pn || bill.clientBillId.slice(0, 8)
}

function formatDate(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts.length > 10 ? Number(ts) * 1000 : ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

export default function PendingPurchaseBillsPage() {
  const router = useRouter()
  const { syncStatus, isSyncing, manualSync } = useOfflineSync()
  const [bills, setBills] = useState<QueuedPurchaseBill[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const rows = await listPendingPurchaseBills()
      rows.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      setBills(rows)
    } catch (err) {
      console.error('Failed to load pending bills:', err)
      setBills([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onSynced = () => void refresh()
    window.addEventListener(PURCHASE_BILLS_SYNCED_EVENT, onSynced)
    const interval = window.setInterval(() => void refresh(), 5000)
    return () => {
      window.removeEventListener(PURCHASE_BILLS_SYNCED_EVENT, onSynced)
      window.clearInterval(interval)
    }
  }, [refresh])

  const handleRetry = async () => {
    try {
      await manualSync()
      await refresh()
      notifySuccess('Sync started — pending bills will upload in the background')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  const handleOpen = (bill: QueuedPurchaseBill) => {
    router.push(`/purchase-invoices/create?queueId=${encodeURIComponent(bill.clientBillId)}`)
  }

  const handleDelete = async (bill: QueuedPurchaseBill) => {
    if (!confirm(`Delete the pending offline bill "${billNumberFromPayload(bill)}"? This cannot be undone.`)) {
      return
    }
    setBusyId(bill.clientBillId)
    try {
      await deleteQueuedPurchaseBill(bill.clientBillId)
      await refresh()
      notifySuccess('Pending bill deleted')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const pendingCount = bills.length
  const failedCount = bills.filter((b) => b.status === 'failed').length

  return (
    <DashboardLayout>
      <PageHeader
        title="Pending offline bills"
        description={`${pendingCount} pending${failedCount > 0 ? ` · ${failedCount} failed` : ''}${syncStatus.isOnline ? '' : ' · offline'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/purchase-invoices')}>
              Back to list
            </Button>
            <Button onClick={handleRetry} disabled={!syncStatus.isOnline || isSyncing || pendingCount === 0}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync all
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        {!syncStatus.isOnline && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <CloudOff className="h-4 w-4" />
            You are offline. Bills will sync automatically when the connection returns.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading pending bills…
          </div>
        ) : pendingCount === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
              <p className="text-lg font-medium text-slate-900">All caught up</p>
              <p className="mt-1 text-sm text-slate-500">No offline bills waiting to sync.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => {
              const isFailed = bill.status === 'failed'
              const isBusy = busyId === bill.clientBillId
              return (
                <Card key={bill.clientBillId}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900">
                          {billNumberFromPayload(bill)}
                        </span>
                        <StatusBadge status={bill.status} />
                        {bill.asDraft && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">draft</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {bill.vendorName || 'Unknown vendor'}
                        {' · '}
                        {bill.itemCount ?? 0} item{(bill.itemCount ?? 0) === 1 ? '' : 's'}
                        {' · '}
                        {formatCurrency(bill.totalAmount ?? 0)}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatDate(bill.createdAt)}
                      </div>
                      {isFailed && bill.errorMessage && (
                        <div className="mt-2 flex items-start gap-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span className="break-words">{bill.errorMessage}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpen(bill)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(bill)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" /> Pending
    </span>
  )
}
