import { desktopInvoke, hasDesktopIpc, isTauriShell } from '@/lib/desktopBridge'

export interface DesktopPosQueueItem {
  clientSaleId: string
  payload: string
  status: 'pending' | 'failed' | 'synced' | string
  errorMessage?: string | null
}

type QueueSale = {
  id?: string
  client_sale_id?: string
  sync_status?: string
  error_message?: string
}

export function hasDesktopPosQueue(): boolean {
  return hasDesktopIpc()
}

export function shouldRetryDesktopPosQueue(): boolean {
  return isTauriShell() && !hasDesktopIpc()
}

export async function desktopPosQueueUpsert(
  sale: QueueSale,
  status?: string,
  errorMessage?: string
): Promise<void> {
  if (!hasDesktopIpc()) return
  const clientSaleId = sale.client_sale_id || sale.id
  if (!clientSaleId) return
  try {
    await desktopInvoke('pos_queue_upsert', {
      clientSaleId,
      payload: JSON.stringify(sale),
      status: status || sale.sync_status || 'pending',
      errorMessage: errorMessage || sale.error_message || null,
    })
  } catch (err) {
    console.warn('Desktop POS queue upsert failed:', err)
  }
}

export async function desktopPosQueueListUnsynced(): Promise<DesktopPosQueueItem[]> {
  if (!hasDesktopIpc()) return []
  try {
    const rows = await desktopInvoke<DesktopPosQueueItem[]>('pos_queue_list_unsynced')
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    console.warn('Desktop POS queue list failed:', err)
    return []
  }
}

export async function desktopPosQueueUpdateStatus(
  clientSaleId: string,
  status: 'pending' | 'failed' | 'synced',
  errorMessage?: string
): Promise<void> {
  if (!hasDesktopIpc() || !clientSaleId) return
  try {
    await desktopInvoke('pos_queue_update_status', {
      clientSaleId,
      status,
      errorMessage: errorMessage || null,
    })
  } catch (err) {
    console.warn('Desktop POS queue status update failed:', err)
  }
}

export async function desktopPosQueueRequeueFailed(): Promise<void> {
  if (!hasDesktopIpc()) return
  try {
    await desktopInvoke('pos_queue_requeue_failed')
  } catch (err) {
    console.warn('Desktop POS queue requeue failed:', err)
  }
}

export function parseDesktopPosSalePayload(payload: string): QueueSale | null {
  try {
    const data = JSON.parse(payload) as QueueSale
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}
