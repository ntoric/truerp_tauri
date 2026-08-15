import { apiFetch } from '@/hooks/useAuth'
import { offlineStorage, type POSSaleRecord } from '@/lib/offlineStorage'
import { setPOSAuthExpired } from '@/lib/posAuthGate'

function parseQueueSale(item: { entityData?: string; id?: string }): POSSaleRecord | null {
  try {
    const data = typeof item.entityData === 'string' ? JSON.parse(item.entityData) : item.entityData
    if (!data || typeof data !== 'object') return null
    return data as POSSaleRecord
  } catch {
    return null
  }
}

async function ensureServerSession(sale: POSSaleRecord): Promise<string | undefined> {
  const localId = sale.pos_session_id
  if (!localId) return undefined
  if (!sale.session_local_only) return localId

  try {
    const res = await apiFetch('/pos/sessions', {
      method: 'POST',
      body: JSON.stringify({
        id: localId,
        opening_cash: sale.session_opening_cash || 0,
      }),
      timeoutMs: 8000,
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.id && data.id !== localId) {
        await offlineStorage.remapPOSSessionId(localId, data.id)
        return data.id
      }
      await offlineStorage.remapPOSSessionId(localId, data.id || localId)
      return data.id || localId
    }
    if (res.status === 400) {
      const activeRes = await apiFetch('/pos/sessions/active', { timeoutMs: 8000 })
      if (activeRes.ok) {
        const data = await activeRes.json()
        if (data?.id) {
          await offlineStorage.remapPOSSessionId(localId, data.id)
          return data.id
        }
      }
    }
    if (res.status === 401) {
      setPOSAuthExpired(true)
    }
  } catch {
    /* stay with local id; CreateInvoice can attach to an open session */
  }
  return localId
}

export async function syncPendingPOSSales(): Promise<{ synced: number; failed: number; pending: number }> {
  const pendingItems = await offlineStorage.getPendingSyncs()
  const sales = pendingItems.filter((item) => item.entityType === 'pos_sale' || item.entityType === 'invoice')
  if (sales.length === 0) {
    const unsynced = await offlineStorage.getUnsynced()
    return { synced: 0, failed: unsynced.filter((item) => item.status === 'failed').length, pending: unsynced.length }
  }

  let synced = 0
  let failed = 0

  for (const item of sales) {
    const sale = parseQueueSale(item)
    if (!sale) {
      await offlineStorage.updateSyncStatus(item.id, 'failed', 'Malformed queued sale')
      failed += 1
      continue
    }

    const sessionId = await ensureServerSession(sale)
    const payload = {
      client_sale_id: sale.client_sale_id || sale.id || item.id,
      invoice_number: sale.invoice_number,
      party_id: sale.party_id,
      party: sale.party
        ? {
            id: sale.party.id,
            name: sale.party.name,
            phone: sale.party.phone || '',
            gstin: sale.party.gstin || '',
          }
        : undefined,
      date: sale.date,
      status: sale.status || 'paid',
      payment_mode: sale.payment_mode,
      amount_paid: sale.amount_paid,
      is_pos: true,
      pos_session_id: sessionId,
      session_opening_cash: sale.session_opening_cash || 0,
      ...(sale.invoice_discount ? { invoice_discount: sale.invoice_discount } : {}),
      ...(sale.loyalty_points_redeemed ? { loyalty_points_redeemed: sale.loyalty_points_redeemed } : {}),
      items: sale.items || [],
    }

    try {
      const res = await apiFetch('/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': payload.client_sale_id,
        },
        body: JSON.stringify(payload),
        timeoutMs: 15000,
      })

      if (res.status === 401) {
        setPOSAuthExpired(true)
        break
      }

      if (res.ok) {
        const created = await res.json().catch(() => null)
        await offlineStorage.markPOSSaleSynced(item.id, {
          id: created?.id,
          invoice_number: created?.invoice_number,
        })
        synced += 1
        continue
      }

      const errData = await res.json().catch(() => ({}))
      const message = typeof errData.error === 'string' ? errData.error : `HTTP ${res.status}`
      if (res.status >= 500) {
        await offlineStorage.updateSyncStatus(item.id, 'pending', message)
      } else {
        await offlineStorage.markPOSSaleFailed(item.id, message)
        failed += 1
      }
    } catch (err) {
      await offlineStorage.updateSyncStatus(
        item.id,
        'pending',
        err instanceof Error ? err.message : 'Network error'
      )
      break
    }
  }

  const leftover = await offlineStorage.getUnsynced()
  return {
    synced,
    failed: leftover.filter((item) => item.status === 'failed').length,
    pending: leftover.length,
  }
}
