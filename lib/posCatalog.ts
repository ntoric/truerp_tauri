import { apiFetch } from '@/hooks/useAuth'
import { API_BASE, asArray } from '@/lib/utils'
import { offlineStorage, POS_META_KEYS } from '@/lib/offlineStorage'
import { fetchPrintSettings, type PrintSettingsSnapshot } from '@/lib/printDocument'
import type { POSReceiptBusiness } from '@/lib/posReceipt'

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function resolveAssetUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url
  const origin = API_BASE.replace(/\/api\/v1\/?$/, '')
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

export async function hydratePOSSnapshot(): Promise<void> {
  await offlineStorage.init()

  const tasks: Array<Promise<void>> = [
    (async () => {
      try {
        const res = await apiFetch('/inventory/stocks?available_only=true', { timeoutMs: 8000 })
        if (!res.ok) return
        const data = await res.json()
        await offlineStorage.cacheBatches(asArray(data))
      } catch {
        /* keep last snapshot */
      }
    })(),
    (async () => {
      try {
        const settings = await fetchPrintSettings()
        await offlineStorage.setMeta(POS_META_KEYS.PRINT_SETTINGS, settings)
      } catch {
        /* keep last snapshot */
      }
    })(),
    (async () => {
      try {
        const res = await apiFetch('/business', { timeoutMs: 5000 })
        if (!res.ok) return
        const business = await res.json()
        const logoUrl = resolveAssetUrl(String(business?.logo_url || ''))
        const logoDataUrl = logoUrl ? await toDataUrl(logoUrl) : null
        const snapshot: POSReceiptBusiness = {
          name: business?.name,
          gstin: business?.gstin,
          address: business?.address,
          city: business?.city,
          state: business?.state,
          pincode: business?.pincode,
          phone: business?.phone,
          logo_data_url: logoDataUrl || undefined,
        }
        await offlineStorage.setMeta(POS_META_KEYS.BUSINESS, snapshot)
      } catch {
        /* keep last snapshot */
      }
    })(),
    (async () => {
      try {
        const res = await apiFetch('/loyalty/settings', { timeoutMs: 5000 })
        if (!res.ok) return
        await offlineStorage.setMeta(POS_META_KEYS.LOYALTY, await res.json())
      } catch {
        /* keep last snapshot */
      }
    })(),
    (async () => {
      try {
        const res = await apiFetch('/invoices/next-number', { timeoutMs: 5000 })
        if (!res.ok) return
        const data = await res.json()
        if (data?.invoice_number) {
          await offlineStorage.seedInvoiceCursor(data.invoice_number)
        }
      } catch {
        /* keep last cursor */
      }
    })(),
    (async () => {
      try {
        const res = await apiFetch('/settings/invoice', { timeoutMs: 5000 })
        if (!res.ok) return
        const data = await res.json()
        if (data?.invoice_prefix) {
          const cursor = await offlineStorage.getMeta<{ prefix: string; next: number }>(POS_META_KEYS.INVOICE_CURSOR)
          await offlineStorage.setMeta(POS_META_KEYS.INVOICE_CURSOR, {
            prefix: data.invoice_prefix,
            next: cursor?.next || data.starting_number || 1,
          })
        }
      } catch {
        /* ignore */
      }
    })(),
  ]

  await Promise.allSettled(tasks)
}

export async function getCachedPrintSettings(): Promise<PrintSettingsSnapshot | null> {
  return offlineStorage.getMeta<PrintSettingsSnapshot>(POS_META_KEYS.PRINT_SETTINGS)
}

export async function getCachedBusiness(): Promise<POSReceiptBusiness | null> {
  return offlineStorage.getMeta<POSReceiptBusiness>(POS_META_KEYS.BUSINESS)
}
