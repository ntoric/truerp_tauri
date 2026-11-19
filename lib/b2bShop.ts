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

const BULK_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

/**
 * Round bulk quantities to offer as one-tap chips on product cards.
 * - Whole-number MOQ above 1: multiples of the MOQ (MOQ 6 → 30, 60, 150) so every chip is a valid order.
 * - Otherwise: round numbers at least twice the MOQ (MOQ 1 → 5, 10, 25).
 * Never exceeds the per-order cap (max_qty, else visible stock).
 */
export function bulkQtySuggestions(product: PublicProduct, count = 3): number[] {
  const min = product.min_order_qty > 0 ? product.min_order_qty : 1
  const cap = product.max_qty ?? product.stock_qty ?? Number.POSITIVE_INFINITY
  const moqMultiples = Number.isInteger(min) && min > 1
  const out: number[] = []
  for (const step of BULK_STEPS) {
    const qty = moqMultiples ? min * step : step
    if (qty < min * 2) continue
    if (qty > cap) break
    out.push(qty)
    if (out.length === count) break
  }
  return out
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

// ---------------------------------------------------------------------------
// Business book — the businesses a buyer orders for, saved on this device.
// Buyers pick or add them from the shop header; checkout uses the active one.
// ---------------------------------------------------------------------------

export interface NewBuyerProfile {
  buyer_type: 'business' | 'individual'
  name: string
  phone: string
  email: string
  gstin: string
  address: string
  city: string
  state: string
  pincode: string
}

/**
 * `existing` — a party the seller already has (found by search, or created by a past order).
 * `draft`    — a new business typed in by the buyer; the seller creates the party on its first order.
 */
export type SavedBuyer =
  | ({ kind: 'existing'; key: string } & RememberedBuyer)
  | { kind: 'draft'; key: string; profile: NewBuyerProfile }

export interface BuyerBook {
  activeKey: string | null
  buyers: SavedBuyer[]
}

const bookKey = (slug: string) => `b2b-buyers:${slug}`
export const BUYER_BOOK_EVENT = 'b2b-buyer-book-changed'

export function savedBuyerName(b: SavedBuyer): string {
  return b.kind === 'existing' ? b.name : b.profile.name
}
export function savedBuyerCity(b: SavedBuyer): string {
  return b.kind === 'existing' ? b.city : b.profile.city
}

export function loadBuyerBook(slug: string): BuyerBook {
  const book = readStorage<BuyerBook | null>(bookKey(slug), null)
  if (book && Array.isArray(book.buyers)) return book
  // Migrate the single remembered buyer from earlier releases.
  const legacy = readStorage<RememberedBuyer | null>(buyerKey(slug), null)
  if (legacy?.party_id) {
    const key = `party:${legacy.party_id}`
    return { activeKey: key, buyers: [{ kind: 'existing', key, ...legacy }] }
  }
  return { activeKey: null, buyers: [] }
}

export function saveBuyerBook(slug: string, book: BuyerBook) {
  writeStorage(bookKey(slug), book.buyers.length ? book : null)
  writeStorage(buyerKey(slug), null) // legacy key is superseded by the book
  try {
    window.dispatchEvent(new CustomEvent(BUYER_BOOK_EVENT, { detail: { slug } }))
  } catch {
    // non-browser
  }
}

export function activeBuyer(book: BuyerBook): SavedBuyer | null {
  return book.buyers.find((b) => b.key === book.activeKey) ?? null
}

export function setActiveBuyer(slug: string, key: string | null) {
  const book = loadBuyerBook(slug)
  saveBuyerBook(slug, { ...book, activeKey: key && book.buyers.some((b) => b.key === key) ? key : null })
}

/**
 * Adds (or refreshes) a business and makes it the active one. Returns its key.
 * Pass `draftKey` when editing a draft so a changed phone doesn't duplicate it.
 */
export function upsertBuyer(slug: string, buyer: RememberedBuyer | NewBuyerProfile, draftKey?: string): string {
  const book = loadBuyerBook(slug)
  let entry: SavedBuyer
  if ('party_id' in buyer) {
    entry = { kind: 'existing', key: `party:${buyer.party_id}`, ...buyer }
  } else {
    const existingDraft = book.buyers.find(
      (b) => b.kind === 'draft' && b.profile.phone.replace(/\D/g, '') === buyer.phone.replace(/\D/g, '')
    )
    entry = { kind: 'draft', key: draftKey ?? existingDraft?.key ?? `draft:${Date.now().toString(36)}`, profile: buyer }
  }
  const buyers = book.buyers.some((b) => b.key === entry.key)
    ? book.buyers.map((b) => (b.key === entry.key ? entry : b))
    : [...book.buyers, entry]
  saveBuyerBook(slug, { activeKey: entry.key, buyers })
  return entry.key
}

export function removeBuyer(slug: string, key: string) {
  const book = loadBuyerBook(slug)
  saveBuyerBook(slug, {
    activeKey: book.activeKey === key ? null : book.activeKey,
    buyers: book.buyers.filter((b) => b.key !== key),
  })
}

/** Active business if it is an existing party (what checkout's "ordered before" flow needs). */
export const loadBuyer = (slug: string): RememberedBuyer | null => {
  const a = activeBuyer(loadBuyerBook(slug))
  return a && a.kind === 'existing' ? { party_id: a.party_id, name: a.name, city: a.city, phone: a.phone } : null
}

/**
 * Called after an order is placed. A verified buyer is saved (replacing the
 * draft it was created from); `null` drops an active existing entry because
 * its phone didn't match the seller's records.
 */
export const saveBuyer = (slug: string, buyer: RememberedBuyer | null) => {
  const book = loadBuyerBook(slug)
  const current = activeBuyer(book)
  if (!buyer) {
    // Keep drafts: the details the buyer typed are still right, only the match was unverified.
    if (current?.kind === 'existing') removeBuyer(slug, current.key)
    return
  }
  if (current?.kind === 'draft') {
    // The draft became a real party — swap it in place.
    const key = `party:${buyer.party_id}`
    const buyers = book.buyers
      .filter((b) => b.key !== key)
      .map((b): SavedBuyer => (b.key === current.key ? { kind: 'existing', key, ...buyer } : b))
    saveBuyerBook(slug, { activeKey: key, buyers })
    return
  }
  upsertBuyer(slug, buyer)
}
