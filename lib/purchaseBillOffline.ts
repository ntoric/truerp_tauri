import { offlineStorage } from '@/lib/offlineStorage'
import {
  desktopPurchaseBillQueueDelete,
  desktopPurchaseBillQueueGet,
  desktopPurchaseBillQueueListUnsynced,
  desktopPurchaseBillQueuePendingCount,
  desktopPurchaseBillQueueRequeueFailed,
  desktopPurchaseBillQueueUpdateStatus,
  desktopPurchaseBillQueueUpsert,
  hasDesktopPurchaseBillQueue,
  type DesktopPurchaseBillQueueItem,
} from '@/lib/desktopPurchaseBillQueue'

/**
 * Offline cache + sync queue for purchase bill creation. Mirrors the POS
 * offline stack: a durable Tauri SQLite queue (`purchase-bill-queue.sqlite`)
 * is the primary store in the desktop app, with an IndexedDB fallback
 * (`offlineStorage.purchaseBills`) used outside the Tauri shell (browser dev)
 * and as a JS-readable mirror.
 *
 * Two record kinds share the queue:
 *  - `kind: 'draft'`     — autosaved in-progress form (one per user), used for
 *                          the "continue previous session" restore modal.
 *  - `kind: 'submission'` — a final Save (draft or non-draft) that must be
 *                          pushed to `/purchase/bills`. Synced by
 *                          `purchaseBillSync.ts` via the existing
 *                          `useOfflineSync` loop.
 *
 * All retries reuse the original `clientBillId` (the idempotency key) so the
 * backend dedups and never creates a duplicate bill, even if a previous
 * attempt saved on the server but the response was lost.
 */

export interface QueuedPurchaseBill {
  clientBillId: string
  asDraft: boolean
  /** Exact body produced by `buildBillPayload` — POSTed as-is to `/purchase/bills`. */
  payload: Record<string, unknown>
  status: 'pending' | 'synced' | 'failed'
  vendorName?: string
  itemCount?: number
  totalAmount?: number
  errorMessage?: string
  createdAt: string
}

export interface PurchaseBillDraft {
  id: string                 // `draft:<userId>`
  kind: 'draft'
  userId: string
  clientBillId: string
  /** Snapshot of the form fields needed to rebuild the create page. */
  form: PurchaseBillDraftForm
  createdAt: string
  updatedAt: string
}

export interface PurchaseBillDraftForm {
  vendorId: string
  vendorName?: string
  billNumber: string
  billDate: string
  dueDate: string
  warehouseId: string
  notes: string
  terms: string
  paidFrom: string
  amountPaid: number
  taxExempt: boolean
  items: Array<Record<string, unknown>>
  newProductRefs?: Record<number, string>
}

function toQueued(row: DesktopPurchaseBillQueueItem): QueuedPurchaseBill {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(row.payload)
  } catch {
    /* keep empty payload; sync engine will mark failed */
  }
  return {
    clientBillId: row.clientBillId,
    asDraft: row.asDraft,
    payload,
    status: row.status === 'failed' ? 'failed' : row.status === 'synced' ? 'synced' : 'pending',
    vendorName: row.vendorName || undefined,
    itemCount: row.itemCount,
    totalAmount: row.totalAmount,
    errorMessage: row.errorMessage || undefined,
    createdAt: row.createdAt,
  }
}

function draftId(userId: string): string {
  return `draft:${userId}`
}

/** Enqueue a final submission (Save as Draft or Save Invoice) for background sync. */
export async function enqueuePurchaseBillSubmission(bill: QueuedPurchaseBill): Promise<void> {
  const payloadStr = JSON.stringify(bill.payload)
  if (hasDesktopPurchaseBillQueue()) {
    await desktopPurchaseBillQueueUpsert(
      {
        clientBillId: bill.clientBillId,
        payload: payloadStr,
        asDraft: bill.asDraft,
        vendorName: bill.vendorName ?? null,
        itemCount: bill.itemCount ?? 0,
        totalAmount: bill.totalAmount ?? 0,
      },
      bill.status,
      bill.errorMessage ?? null
    )
    // Mirror into IndexedDB so the JS sync engine reads a uniform shape.
    await offlineStorage.putPurchaseBill({
      id: bill.clientBillId,
      kind: 'submission',
      ...bill,
      payload: payloadStr,
    })
  } else {
    await offlineStorage.putPurchaseBill({
      id: bill.clientBillId,
      kind: 'submission',
      ...bill,
      payload: payloadStr,
    })
  }
}

/** List all submissions still pending or failed (for the pending page + sync engine). */
export async function listPendingPurchaseBills(): Promise<QueuedPurchaseBill[]> {
  // Ensure IndexedDB is initialized (the purchaseBills store is created on
  // upgrade) so the fallback path works even if useOfflineSync hasn't run yet.
  try {
    await offlineStorage.init()
  } catch {
    /* ignore — getPendingPurchaseBills will re-init on demand */
  }
  if (hasDesktopPurchaseBillQueue()) {
    const rows = await desktopPurchaseBillQueueListUnsynced()
    return rows.map(toQueued)
  }
  const rows = await offlineStorage.getPendingPurchaseBills()
  return rows.map((row) => {
    let payload: Record<string, unknown> = {}
    try {
      payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    } catch {
      /* ignore */
    }
    return {
      clientBillId: row.clientBillId,
      asDraft: row.asDraft,
      payload,
      status: row.status === 'failed' ? 'failed' : 'pending',
      vendorName: row.vendorName,
      itemCount: row.itemCount,
      totalAmount: row.totalAmount,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    } as QueuedPurchaseBill
  })
}

export async function getQueuedPurchaseBill(clientBillId: string): Promise<QueuedPurchaseBill | null> {
  if (!clientBillId) return null
  if (hasDesktopPurchaseBillQueue()) {
    const row = await desktopPurchaseBillQueueGet(clientBillId)
    return row ? toQueued(row) : null
  }
  const row = await offlineStorage.getPurchaseBill(clientBillId)
  if (!row) return null
  let payload: Record<string, unknown> = {}
  try {
    payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
  } catch {
    /* ignore */
  }
  return {
    clientBillId: row.clientBillId,
    asDraft: row.asDraft,
    payload,
    status: row.status === 'failed' ? 'failed' : row.status === 'synced' ? 'synced' : 'pending',
    vendorName: row.vendorName,
    itemCount: row.itemCount,
    totalAmount: row.totalAmount,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  } as QueuedPurchaseBill
}

export async function markPurchaseBillSynced(clientBillId: string): Promise<void> {
  if (!clientBillId) return
  if (hasDesktopPurchaseBillQueue()) {
    await desktopPurchaseBillQueueUpdateStatus(clientBillId, 'synced', null)
  }
  const row = await offlineStorage.getPurchaseBill(clientBillId)
  if (row) {
    row.status = 'synced'
    row.errorMessage = undefined
    await offlineStorage.putPurchaseBill(row)
  }
}

export async function markPurchaseBillFailed(clientBillId: string, errorMessage: string): Promise<void> {
  if (!clientBillId) return
  if (hasDesktopPurchaseBillQueue()) {
    await desktopPurchaseBillQueueUpdateStatus(clientBillId, 'failed', errorMessage)
  }
  const row = await offlineStorage.getPurchaseBill(clientBillId)
  if (row) {
    row.status = 'failed'
    row.errorMessage = errorMessage
    await offlineStorage.putPurchaseBill(row)
  }
}

export async function markPurchaseBillPending(clientBillId: string, errorMessage?: string): Promise<void> {
  if (!clientBillId) return
  if (hasDesktopPurchaseBillQueue()) {
    await desktopPurchaseBillQueueUpdateStatus(clientBillId, 'pending', errorMessage ?? null)
  }
  const row = await offlineStorage.getPurchaseBill(clientBillId)
  if (row) {
    row.status = 'pending'
    if (errorMessage) row.errorMessage = errorMessage
    await offlineStorage.putPurchaseBill(row)
  }
}

export async function deleteQueuedPurchaseBill(clientBillId: string): Promise<void> {
  if (!clientBillId) return
  if (hasDesktopPurchaseBillQueue()) {
    await desktopPurchaseBillQueueDelete(clientBillId)
  }
  await offlineStorage.deletePurchaseBill(clientBillId)
}

export async function requeueFailedPurchaseBills(): Promise<void> {
  if (hasDesktopPurchaseBillQueue()) {
    await desktopPurchaseBillQueueRequeueFailed()
  }
  const rows = await offlineStorage.getAllPurchaseBills()
  for (const row of rows) {
    if (row.status === 'failed') {
      row.status = 'pending'
      await offlineStorage.putPurchaseBill(row)
    }
  }
}

export async function pendingPurchaseBillCount(): Promise<number> {
  if (hasDesktopPurchaseBillQueue()) {
    return desktopPurchaseBillQueuePendingCount()
  }
  const rows = await offlineStorage.getPendingPurchaseBills()
  return rows.length
}

// ---- In-progress draft (form restore on reopen) ----

export async function savePurchaseBillDraft(userId: string, draft: Omit<PurchaseBillDraft, 'id' | 'kind' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<void> {
  if (!userId) return
  const now = new Date().toISOString()
  const existing = await offlineStorage.getPurchaseBill(draftId(userId))
  const record: PurchaseBillDraft = {
    id: draftId(userId),
    kind: 'draft',
    userId,
    clientBillId: draft.clientBillId,
    form: draft.form,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  await offlineStorage.putPurchaseBill(record)
}

export async function getPurchaseBillDraft(userId: string): Promise<PurchaseBillDraft | null> {
  if (!userId) return null
  const row = await offlineStorage.getPurchaseBill(draftId(userId))
  if (!row || row.kind !== 'draft') return null
  return row as PurchaseBillDraft
}

export async function clearPurchaseBillDraft(userId: string, _clientBillId?: string): Promise<void> {
  if (!userId) return
  await offlineStorage.deletePurchaseBill(draftId(userId))
}
