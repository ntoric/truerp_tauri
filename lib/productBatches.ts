import { apiFetch } from '@/hooks/useAuth'
import { offlineStorage } from '@/lib/offlineStorage'

export interface ProductBatchStock {
  id: string
  product_id: string
  outlet_id: string
  outlet_name?: string
  batch_no: string
  mfg_date?: string | null
  exp_date?: string | null
  quantity: number
  available_qty: number
  average_cost: number
}

/** Batches with available qty for a product, ordered FEFO. Prefers the POS cache so billing never waits on the network. */
export async function fetchProductBatches(productId: string): Promise<ProductBatchStock[]> {
  if (!productId) return []
  const cached = await offlineStorage.getCachedBatchesForProduct(productId)
  if (cached.length) return cached as ProductBatchStock[]

  try {
    const res = await apiFetch(
      `/inventory/stocks?product_id=${encodeURIComponent(productId)}&available_only=true`,
      { timeoutMs: 3000 }
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function formatBatchLabel(batch: ProductBatchStock): string {
  const name = batch.batch_no?.trim() || 'No batch'
  const qty = Number(batch.available_qty ?? batch.quantity ?? 0)
  const exp = batch.exp_date
    ? ` · Exp ${new Date(batch.exp_date).toLocaleDateString('en-IN')}`
    : ''
  return `${name}${exp} · ${qty}`
}

/** Prefer earliest expiry (API already sorts FEFO); fall back to first row. */
export function pickDefaultBatch(batches: ProductBatchStock[]): ProductBatchStock | null {
  if (!batches.length) return null
  return batches[0]
}
