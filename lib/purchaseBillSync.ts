import { apiFetch } from '@/hooks/useAuth'
import {
  listPendingPurchaseBills,
  markPurchaseBillFailed,
  markPurchaseBillPending,
  markPurchaseBillSynced,
  type QueuedPurchaseBill,
} from '@/lib/purchaseBillOffline'
import { setPOSAuthExpired } from '@/lib/posAuthGate'

/**
 * Background sync engine for queued purchase bill submissions. Mirrors
 * `posSync.ts`: iterates pending submissions, POSTs each to `/purchase/bills`
 * with `Idempotency-Key = clientBillId`, and marks the row synced/failed.
 *
 * Always POST (never PUT) — the backend dedups on `client_bill_id`, so a blind
 * retry is safe even if a previous attempt actually saved on the server but
 * the response was lost. Per-line `client_item_ref` (carried in the payload)
 * makes new-product creation idempotent too.
 *
 * Emits a `purchase-bills-synced` window event after each drain so the pending
 * page can refresh.
 */

export const PURCHASE_BILLS_SYNCED_EVENT = 'purchase-bills-synced'

export interface PurchaseBillSyncResult {
  synced: number
  failed: number
  pending: number
}

export async function syncPendingPurchaseBills(): Promise<PurchaseBillSyncResult> {
  const pending = await listPendingPurchaseBills()
  if (pending.length === 0) {
    return { synced: 0, failed: 0, pending: 0 }
  }

  let synced = 0
  let failed = 0

  for (const bill of pending) {
    const result = await syncOne(bill)
    if (result === 'synced') {
      synced += 1
    } else if (result === 'failed') {
      failed += 1
    } else {
      // 'stop' — network/auth error; halt this drain, retry on next tick.
      break
    }
  }

  const leftover = await listPendingPurchaseBills()
  if (synced > 0 || failed > 0) {
    try {
      window.dispatchEvent(new CustomEvent(PURCHASE_BILLS_SYNCED_EVENT))
    } catch {
      /* ignore — non-browser env */
    }
  }
  return {
    synced,
    failed: leftover.filter((b) => b.status === 'failed').length,
    pending: leftover.length,
  }
}

type SyncOutcome = 'synced' | 'failed' | 'stop'

async function syncOne(bill: QueuedPurchaseBill): Promise<SyncOutcome> {
  // Payload may be empty if the queued JSON was malformed.
  if (!bill.payload || typeof bill.payload !== 'object' || !bill.clientBillId) {
    await markPurchaseBillFailed(bill.clientBillId, 'Malformed queued purchase bill')
    return 'failed'
  }

  try {
    const res = await apiFetch('/purchase/bills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': bill.clientBillId,
      },
      body: JSON.stringify(bill.payload),
      timeoutMs: 30000,
    })

    if (res.status === 401) {
      setPOSAuthExpired(true)
      return 'stop'
    }

    if (res.ok) {
      // 201 = new bill created with the queued items. 200 = idempotent return:
      // a bill with this client_bill_id already existed (e.g. from a prior
      // online autosave), but its items were NOT updated. Follow up with a PUT
      // to replace the items with the final queued payload.
      if (res.status === 200) {
        const existing = await res.json().catch(() => null)
        const existingId = existing?.id
        if (existingId) {
          const putRes = await apiFetch(`/purchase/bills/${existingId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': bill.clientBillId,
            },
            body: JSON.stringify(bill.payload),
            timeoutMs: 30000,
          })
          if (putRes.status === 401) {
            setPOSAuthExpired(true)
            return 'stop'
          }
          if (!putRes.ok) {
            const putErr = await putRes.json().catch(() => ({}))
            const putMsg = typeof putErr.error === 'string' ? putErr.error : `HTTP ${putRes.status}`
            if (putRes.status >= 500) {
              await markPurchaseBillPending(bill.clientBillId, putMsg)
              return 'stop'
            }
            await markPurchaseBillFailed(bill.clientBillId, putMsg)
            return 'failed'
          }
        }
      }
      await markPurchaseBillSynced(bill.clientBillId)
      return 'synced'
    }

    const errData = await res.json().catch(() => ({}))
    const message = typeof errData.error === 'string' ? errData.error : `HTTP ${res.status}`
    if (res.status >= 500) {
      // Transient — leave as pending for the next drain.
      await markPurchaseBillPending(bill.clientBillId, message)
      return 'stop'
    }
    // 4xx — validation error; surface on the pending page for user action.
    await markPurchaseBillFailed(bill.clientBillId, message)
    return 'failed'
  } catch (err) {
    // Network drop / timeout — leave as pending, halt this drain.
    await markPurchaseBillPending(
      bill.clientBillId,
      err instanceof Error ? err.message : 'Network error'
    )
    return 'stop'
  }
}
