import { desktopInvoke, hasDesktopIpc } from '@/lib/desktopBridge'

/**
 * Durable, on-disk queue of purchase bill submissions that have not yet
 * reached the cloud API. Mirrors `desktopPosQueue.ts`: a thin Tauri IPC
 * wrapper over the Rust `purchase_bill_queue` module (`purchase-bill-queue.sqlite`
 * in the app data dir). The frontend sync engine reads `listUnsynced`, POSTs
 * each row to `/purchase/bills` with `Idempotency-Key = clientBillId`, and calls
 * `updateStatus` to mark the row synced/failed. Because the backend dedups on
 * `client_bill_id`, blind retries are safe even if a previous attempt saved on
 * the server but the response was lost.
 *
 * When not running inside the Tauri shell (e.g. browser dev), all functions
 * are no-ops / return empty results and the IndexedDB fallback in
 * `purchaseBillOffline.ts` is used instead.
 */

export interface DesktopPurchaseBillQueueItem {
  clientBillId: string
  payload: string
  asDraft: boolean
  status: 'pending' | 'failed' | 'synced' | string
  errorMessage?: string | null
  vendorName?: string | null
  itemCount: number
  totalAmount: number
  createdAt: string
}

type QueueBill = {
  clientBillId?: string
  status?: string
  errorMessage?: string | null
}

export function hasDesktopPurchaseBillQueue(): boolean {
  return hasDesktopIpc()
}

export async function desktopPurchaseBillQueueUpsert(
  bill: QueueBill & {
    payload: string
    asDraft?: boolean
    vendorName?: string | null
    itemCount?: number
    totalAmount?: number
  },
  status?: string,
  errorMessage?: string | null
): Promise<void> {
  if (!hasDesktopIpc()) return
  const clientBillId = bill.clientBillId
  if (!clientBillId) return
  try {
    await desktopInvoke('purchase_bill_queue_upsert', {
      clientBillId,
      payload: bill.payload,
      asDraft: bill.asDraft ?? false,
      status: status || bill.status || 'pending',
      errorMessage: errorMessage ?? bill.errorMessage ?? null,
      vendorName: bill.vendorName ?? null,
      itemCount: bill.itemCount ?? 0,
      totalAmount: bill.totalAmount ?? 0,
    })
  } catch (err) {
    console.warn('Desktop purchase bill queue upsert failed:', err)
  }
}

export async function desktopPurchaseBillQueueListUnsynced(): Promise<DesktopPurchaseBillQueueItem[]> {
  if (!hasDesktopIpc()) return []
  try {
    const rows = await desktopInvoke<DesktopPurchaseBillQueueItem[]>('purchase_bill_queue_list_unsynced')
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    console.warn('Desktop purchase bill queue list failed:', err)
    return []
  }
}

export async function desktopPurchaseBillQueueUpdateStatus(
  clientBillId: string,
  status: 'pending' | 'failed' | 'synced',
  errorMessage?: string | null
): Promise<void> {
  if (!hasDesktopIpc() || !clientBillId) return
  try {
    await desktopInvoke('purchase_bill_queue_update_status', {
      clientBillId,
      status,
      errorMessage: errorMessage ?? null,
    })
  } catch (err) {
    console.warn('Desktop purchase bill queue status update failed:', err)
  }
}

export async function desktopPurchaseBillQueueRequeueFailed(): Promise<void> {
  if (!hasDesktopIpc()) return
  try {
    await desktopInvoke('purchase_bill_queue_requeue_failed')
  } catch (err) {
    console.warn('Desktop purchase bill queue requeue failed:', err)
  }
}

export async function desktopPurchaseBillQueueDelete(clientBillId: string): Promise<void> {
  if (!hasDesktopIpc() || !clientBillId) return
  try {
    await desktopInvoke('purchase_bill_queue_delete', { clientBillId })
  } catch (err) {
    console.warn('Desktop purchase bill queue delete failed:', err)
  }
}

export async function desktopPurchaseBillQueueGet(
  clientBillId: string
): Promise<DesktopPurchaseBillQueueItem | null> {
  if (!hasDesktopIpc() || !clientBillId) return null
  try {
    const row = await desktopInvoke<DesktopPurchaseBillQueueItem | null>('purchase_bill_queue_get', {
      clientBillId,
    })
    return row ?? null
  } catch (err) {
    console.warn('Desktop purchase bill queue get failed:', err)
    return null
  }
}

export async function desktopPurchaseBillQueuePendingCount(): Promise<number> {
  if (!hasDesktopIpc()) return 0
  try {
    const count = await desktopInvoke<number>('purchase_bill_queue_pending_count')
    return Number(count) || 0
  } catch (err) {
    console.warn('Desktop purchase bill queue count failed:', err)
    return 0
  }
}

export function parseDesktopPurchaseBillPayload(payload: string): QueueBill | null {
  try {
    const data = JSON.parse(payload) as QueueBill
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}
