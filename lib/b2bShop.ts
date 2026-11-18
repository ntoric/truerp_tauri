import { API_BASE } from '@/lib/utils'
import type { StatusBadgeTone } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface B2BShopSettings {
  id: string
  is_enabled: boolean
  slug: string
  shop_name: string
  tagline: string
  announcement: string
  contact_phone: string
  contact_email: string
  min_order_value: number
  show_stock: boolean
  allow_backorders: boolean
  hide_out_of_stock: boolean
  allow_new_buyers: boolean
  require_delivery_address: boolean
  terms: string
}

export interface B2BCatalogRow {
  product_id: string
  name: string
  category: string
  unit: string
  item_code: string
  item_type: string
  sale_price: number
  purchase_price: number
  mrp: number
  image_url: string
  is_active: boolean
  stock_qty: number
  catalog_id: string | null
  is_listed: boolean
  b2b_price: number
  min_order_qty: number
  is_featured: boolean
  description: string
}

export type B2BOrderStatus = 'pending' | 'confirmed' | 'processing' | 'dispatched' | 'delivered' | 'cancelled'

export interface B2BOrderEvent {
  status: B2BOrderStatus
  note?: string
  by?: string
  at: string
}

export interface B2BOrderItem {
  id: string
  product_id?: string
  name: string
  unit: string
  hsn_code: string
  image_url: string
  quantity: number
  unit_price: number
  total: number
}

export interface B2BOrder {
  id: string
  order_number: string
  party_id: string
  status: B2BOrderStatus
  buyer_verified: boolean
  is_new_buyer: boolean
  /** selected | phone | gstin | name | created */
  buyer_match?: string
  buyer_name: string
  contact_person: string
  buyer_phone: string
  buyer_email: string
  buyer_gstin: string
  shipping_address: string
  city: string
  state: string
  pincode: string
  notes: string
  internal_notes: string
  item_count: number
  total_qty: number
  total_amount: number
  quotation_id?: string
  invoice_id?: string
  timeline: B2BOrderEvent[] | null
  items?: B2BOrderItem[]
  created_at: string
  updated_at: string
}

export interface PublicShop {
  slug: string
  name: string
  tagline: string
  announcement: string
  logo_url: string
  city: string
  state: string
  contact_phone: string
  contact_email: string
  min_order_value: number
  show_stock: boolean
  allow_backorders: boolean
  allow_new_buyers: boolean
  require_delivery_address: boolean
  terms: string
  categories: string[]
}

export interface PublicProduct {
  id: string
  name: string
  category: string
  unit: string
  price: number
  mrp: number
  min_order_qty: number
  is_featured: boolean
  description: string
  image_url: string
  hsn_code: string
  in_stock: boolean
  stock_qty?: number
  max_qty?: number
}

export interface PublicProductDetail {
  product: PublicProduct
  images: string[]
  item_code: string
  related: PublicProduct[]
}

export interface BuyerMatch {
  id: string
  name: string
  city: string
  phone_hint: string
  has_phone: boolean
}

// ---------------------------------------------------------------------------
// Order status presentation
// ---------------------------------------------------------------------------

export const B2B_STATUS_FLOW: B2BOrderStatus[] = ['pending', 'confirmed', 'processing', 'dispatched', 'delivered']

export const B2B_STATUS_META: Record<B2BOrderStatus, { label: string; tone: StatusBadgeTone; action: string }> = {
  pending: { label: 'Pending', tone: 'warning', action: 'Reopen' },
  confirmed: { label: 'Confirmed', tone: 'brand', action: 'Confirm' },
  processing: { label: 'Processing', tone: 'violet', action: 'Start processing' },
  dispatched: { label: 'Dispatched', tone: 'info', action: 'Mark dispatched' },
  delivered: { label: 'Delivered', tone: 'success', action: 'Mark delivered' },
  cancelled: { label: 'Cancelled', tone: 'danger', action: 'Cancel order' },
}

/** Forward statuses an order can move to from `status` (mirrors the API rules). */
export function nextB2BStatuses(status: B2BOrderStatus): B2BOrderStatus[] {
  if (status === 'cancelled') return ['pending']
  const idx = B2B_STATUS_FLOW.indexOf(status)
  return B2B_STATUS_FLOW.slice(idx + 1)
}

export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

// ---------------------------------------------------------------------------
// Public storefront API (no auth)
// ---------------------------------------------------------------------------

async function shopRequest<T>(slug: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/shop/${encodeURIComponent(slug)}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // empty body
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || 'Something went wrong. Please try again.'
    throw Object.assign(new Error(message), { status: res.status })
  }
  return data as T
}

export const shopApi = {
  info: (slug: string) => shopRequest<PublicShop>(slug, ''),
  products: (slug: string, params: Record<string, string | number>) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
    return shopRequest<{ products: PublicProduct[]; total: number; page: number; per_page: number }>(slug, `/products?${qs}`)
  },
  product: (slug: string, id: string) =>
    shopRequest<PublicProductDetail>(slug, `/products/${encodeURIComponent(id)}`),
  searchBuyers: (slug: string, q: string) =>
    shopRequest<BuyerMatch[]>(slug, `/buyers?q=${encodeURIComponent(q)}`),
  placeOrder: (slug: string, body: unknown) =>
    shopRequest<{ order_number: string; party_id: string; buyer_match: string; verified: boolean; status: string; total_amount: number; item_count: number; buyer_name: string }>(
      slug,
      '/orders',
      { method: 'POST', body: JSON.stringify(body) }
    ),
  track: (slug: string, orderNumber: string, phone: string) =>
    shopRequest<{
      order_number: string
      status: B2BOrderStatus
      buyer_name: string
      total_amount: number
      item_count: number
      shipping_address: string
      city: string
      created_at: string
      timeline: { status: B2BOrderStatus; note?: string; at: string }[]
      items: { name: string; unit: string; quantity: number; unit_price: number; total: number }[]
      invoiced: boolean
    }>(slug, `/orders/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`),
}

// ---------------------------------------------------------------------------
// Cart persistence (per shop, per browser)
// ---------------------------------------------------------------------------

export interface CartLine {
  product: PublicProduct
  quantity: number
}

const cartKey = (slug: string) => `b2b-cart:${slug}`
const buyerKey = (slug: string) => `b2b-buyer:${slug}`

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode) — cart just won't persist
  }
}

export const loadCart = (slug: string) => readStorage<CartLine[]>(cartKey(slug), [])
export const saveCart = (slug: string, lines: CartLine[]) => writeStorage(cartKey(slug), lines.length ? lines : null)

/** Remembered buyer, so returning buyers skip the lookup next time. */
export interface RememberedBuyer {
  party_id: string
  name: string
  city: string
  phone: string
}
export const loadBuyer = (slug: string) => readStorage<RememberedBuyer | null>(buyerKey(slug), null)
export const saveBuyer = (slug: string, buyer: RememberedBuyer | null) => writeStorage(buyerKey(slug), buyer)
