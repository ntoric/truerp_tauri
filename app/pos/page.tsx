'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, asArray } from '@/lib/utils'
import { offlineStorage, POS_META_KEYS, type POSSaleRecord } from '@/lib/offlineStorage'
import Link from 'next/link'
import { Search, Plus, Minus, Trash2, ShoppingCart, Printer, CheckCircle, AlertCircle, Save, X, FileText, Copy, Scale, History, ChevronLeft, ChevronRight, Percent, Wifi, WifiOff } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePaymentMethodMappings } from '@/hooks/usePaymentMethodMappings'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { computeLoyaltyDiscount, estimatePointsEarned } from '@/lib/loyalty'
import type { LoyaltySettings } from '@/lib/loyalty-types'
import { Gift } from 'lucide-react'
import { useWeighingScale } from '@/hooks/useWeighingScale'
import WeighingScalePanel from '@/components/WeighingScalePanel'
import { isWeightBasedUnit } from '@/lib/weighingScale'
import {
  resolveScaleBarcodeForPos,
  looksLikeScaleBarcode,
  findProductByExactScanCode,
  normalizeScannedBarcode,
} from '@/lib/weighingScaleBarcode'
import BarcodeScannerInput, { type BarcodeScannerInputHandle } from '@/components/ui/BarcodeScannerInput'
import { printThermalContent } from '@/lib/printDocument'
import { formatQty, linePayableTotal, lineTaxAmount, productSaleUnitPrice, productTaxRate, isProductGstEnabled, parseMoney, limitDecimalInput, roundMoney } from '@/lib/numbers'
import { fetchProductBatches, pickDefaultBatch } from '@/lib/productBatches'
import { KeyboardShortcutsProvider } from '@/hooks/useKeyboardShortcuts'
import KeyboardShortcutsTrigger from '@/components/keyboard-shortcuts/KeyboardShortcutsTrigger'
import { hydratePOSSnapshot, getCachedPrintSettings, getCachedBusiness } from '@/lib/posCatalog'
import { buildPOSReceiptContent, receiptPaperWidthMm } from '@/lib/posReceipt'

interface Product {
  id: string
  name: string
  sku: string
  item_code: string
  plu?: string
  sale_price: number
  sale_price_with_tax?: boolean
  stock_qty: number
  unit: string
  tax_rate: number
  gst_enabled?: boolean
  category: string
  enable_batching?: boolean
}

interface Party {
  id: string
  name: string
  phone: string
  gstin: string
  loyalty_points?: number
  local_only?: boolean
}

interface CartItem {
  product: Product
  quantity: number
  total: number
  batch_no?: string
  exp_date?: string | null
}

const cartLineKey = (productId: string, batchNo?: string) => `${productId}::${batchNo || ''}`

interface POSSession {
  id: string
  opening_cash: number
  total_sales: number
  status: string
  local_only?: boolean
}

interface POSTab {
  id: string
  title: string
  cart: CartItem[]
  selectedParty: Party | null
  notes: string
  isDraft: boolean
  draftId?: string
  discountType: 'amount' | 'percent'
  discountValue: string
}

interface POSDraft {
  id: string
  title: string
  cart_data: string
  party_id?: string
  notes: string
  is_active: boolean
}

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer'

const findWalkInCustomer = (list: Party[]) =>
  list.find((p) => p.name?.trim().toLowerCase() === WALK_IN_CUSTOMER_NAME.toLowerCase()) || null

export default function POSPage() {
  const { syncStatus, isSyncing, manualSync, checkSyncStatus } = useOfflineSync()
  const [products, setProducts] = useState<Product[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [walkInCustomer, setWalkInCustomer] = useState<Party | null>(null)
  const [tabs, setTabs] = useState<POSTab[]>([
    { id: 'tab-1', title: 'New Order', cart: [], selectedParty: null, notes: '', isDraft: false, discountType: 'amount', discountValue: '' }
  ])
  const [activeTabId, setActiveTabId] = useState('tab-1')
  const [searchTerm, setSearchTerm] = useState('')
  const barcodeInputRef = useRef<BarcodeScannerInputHandle>(null)
  const tabListRef = useRef<HTMLDivElement>(null)
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false)
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false)
  const [session, setSession] = useState<POSSession | null>(null)
  const [openingCash, setOpeningCash] = useState('')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [drafts, setDrafts] = useState<POSDraft[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState<Party[]>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [editingQty, setEditingQty] = useState<{ productId: string; value: string } | null>(null)
  const qtyEditCancelledRef = useRef(false)
  const prevLoyaltyDiscountRef = useRef(0)
  const checkoutInFlightRef = useRef(false)
  const { accounts: bankAccounts } = useBankAccounts()
  const { getDepositHint } = usePaymentMethodMappings()
  const [mounted, setMounted] = useState(false)
  const {
    settings: scaleSettings,
    connectionStatus: scaleConnectionStatus,
    currentWeightKg,
    isStable: scaleStable,
    lastError: scaleError,
    connect: connectScale,
    disconnect: disconnectScale,
    getQuantityForProduct,
    clearReading: clearScaleReading,
  } = useWeighingScale()

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || tabs[0], [tabs, activeTabId])

  useEffect(() => {
    setMounted(true)
    void (async () => {
      await offlineStorage.init()
      await Promise.all([
        loadProducts(),
        loadParties(),
        loadSession(),
        loadDrafts(),
        loadLoyaltySettings(),
      ])
      await hydratePOSSnapshot()
    })()
  }, [])

  useEffect(() => {
    setLoyaltyPointsToRedeem(0)
    prevLoyaltyDiscountRef.current = 0
  }, [activeTab.selectedParty?.id])

  const loadLoyaltySettings = async () => {
    try {
      const res = await apiFetch('/loyalty/settings', { timeoutMs: 5000 })
      if (res.ok) {
        const data = await res.json()
        setLoyaltySettings(data)
        await offlineStorage.setMeta(POS_META_KEYS.LOYALTY, data)
        return
      }
    } catch {
      /* offline — use cache */
    }
    const cached = await offlineStorage.getMeta<LoyaltySettings>(POS_META_KEYS.LOYALTY)
    if (cached) setLoyaltySettings(cached)
  }

  const loadProducts = async () => {
    try {
      const res = await apiFetch('/products', { timeoutMs: 8000 })
      if (res.ok) {
        const data = await res.json()
        const list = asArray<Product>(data)
        setProducts(list)
        await offlineStorage.cacheProducts(list)
        return
      }
    } catch (err) {
      console.error('Failed to load products, using cache')
    }
    const cached = await offlineStorage.getCachedProducts()
    setProducts(cached)
  }

  const applyDefaultCustomer = (party: Party | null) => {
    if (!party) return
    setWalkInCustomer(party)
    setTabs((prev) =>
      prev.map((tab) => (tab.selectedParty ? tab : { ...tab, selectedParty: party }))
    )
  }

  const ensureWalkInCustomer = async (list: Party[]): Promise<{ party: Party | null; parties: Party[] }> => {
    const existing = findWalkInCustomer(list)
    if (existing) return { party: existing, parties: list }

    const payload = {
      name: WALK_IN_CUSTOMER_NAME,
      phone: '',
      party_type: 'customer',
    }

    try {
      const res = await apiFetch('/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created: Party = await res.json()
        const next = [...list, created]
        await offlineStorage.cacheParties(next)
        return { party: created, parties: next }
      }
    } catch {
      /* offline — fall through */
    }

    // Offline / create failed: keep a local walk-in for this session.
    // Next online load will find-or-create the real party on the server.
    const offlineParty: Party = {
      id: crypto.randomUUID(),
      name: WALK_IN_CUSTOMER_NAME,
      phone: '',
      gstin: '',
      local_only: true,
    }
    const next = [...list, offlineParty]
    await offlineStorage.cacheParties(next)
    return { party: offlineParty, parties: next }
  }

  const loadParties = async () => {
    try {
      const res = await apiFetch('/parties?party_type=customer')
      if (res.ok) {
        const data = await res.json()
        const { party, parties: next } = await ensureWalkInCustomer(Array.isArray(data) ? data : [])
        setParties(next)
        await offlineStorage.cacheParties(next)
        applyDefaultCustomer(party)
        return
      }
    } catch (err) {
      console.error('Failed to load parties, using cache')
    }

    const cached = await offlineStorage.getCachedParties()
    const { party, parties: next } = await ensureWalkInCustomer(cached || [])
    setParties(next)
    applyDefaultCustomer(party)
  }

  const loadSession = async () => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    try {
      const res = await apiFetch('/pos/sessions/active')
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        await offlineStorage.savePOSSession(data)
        return
      }

      if (res.status === 404) {
        // Server has no open session — don't reuse stale IndexedDB sessions while online.
        if (isOnline) {
          await offlineStorage.clearOpenPOSSessions()
        } else {
          const offlineSession = await offlineStorage.getActivePOSSession()
          if (offlineSession) {
            setSession(offlineSession)
            return
          }
        }
        setShowSessionModal(true)
        return
      }

      const offlineSession = await offlineStorage.getActivePOSSession()
      if (offlineSession) {
        setSession(offlineSession)
      } else {
        setShowSessionModal(true)
      }
    } catch {
      const offlineSession = await offlineStorage.getActivePOSSession()
      if (offlineSession) {
        setSession(offlineSession)
      } else {
        setShowSessionModal(true)
      }
    }
  }

  const loadDrafts = async () => {
    try {
      const res = await apiFetch('/pos/drafts', { timeoutMs: 5000 })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setDrafts(list)
        for (const draft of list) {
          await offlineStorage.saveLocalDraft(draft)
        }
        return
      }
    } catch (err) {
      console.error('Failed to load drafts')
    }
    const cached = await offlineStorage.getLocalDrafts()
    setDrafts(cached)
  }

  const openSession = async () => {
    const cash = parseFloat(openingCash) || 0
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    if (!isOnline) {
      const newSession: POSSession = {
        id: crypto.randomUUID(),
        opening_cash: cash,
        total_sales: 0,
        status: 'open',
        local_only: true,
      }
      await offlineStorage.savePOSSession(newSession)
      setSession(newSession)
      setShowSessionModal(false)
      return
    }

    try {
      const res = await apiFetch('/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_cash: cash }),
        timeoutMs: 5000,
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        await offlineStorage.savePOSSession(data)
        setShowSessionModal(false)
        return
      }

      const errorData = await res.json().catch(() => ({}))
      if (
        res.status === 400 &&
        typeof errorData.error === 'string' &&
        errorData.error.toLowerCase().includes('active session already exists')
      ) {
        const activeRes = await apiFetch('/pos/sessions/active')
        if (activeRes.ok) {
          const data = await activeRes.json()
          setSession(data)
          await offlineStorage.savePOSSession(data)
          setShowSessionModal(false)
          return
        }
      }
      notifyError(`Failed to open session: ${errorData.error || 'Unknown error'}`)
    } catch {
      const newSession: POSSession = {
        id: crypto.randomUUID(),
        opening_cash: cash,
        total_sales: 0,
        status: 'open',
        local_only: true,
      }
      await offlineStorage.savePOSSession(newSession)
      setSession(newSession)
      setShowSessionModal(false)
    }
  }

  const closeSession = async () => {
    if (!session) return

    const finishClose = async () => {
      await offlineStorage.closePOSSession(session.id)
      setSession(null)
      updateTab(activeTabId, { cart: [], selectedParty: walkInCustomer, discountType: 'amount', discountValue: '' })
      setIsEditingCustomer(false)
      setPaymentMethod('upi')
      setReceivedAmount('')
      window.location.href = '/dashboard'
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    if (session.local_only || !isOnline) {
      await finishClose()
      return
    }

    try {
      const res = await apiFetch(`/pos/sessions/${session.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_cash: session.total_sales + session.opening_cash }),
      })
      if (res.ok) {
        await finishClose()
        return
      }

      const errorData = await res.json().catch(() => ({}))
      if (res.status === 404) {
        // Session existed only in local cache (never synced to server).
        await finishClose()
        return
      }
      console.error('Close session failed:', errorData)
      notifyError(`Failed to close session: ${errorData.error || 'Unknown error'}`)
    } catch (err) {
      console.error('Close session error:', err)
      await finishClose()
    }
  }

  const cartLineTotal = (product: Product, quantity: number) =>
    linePayableTotal(
      product.sale_price,
      quantity,
      productTaxRate(product),
      isProductGstEnabled(product) ? (product.sale_price_with_tax ?? true) : false
    )

  const addToCartWithQuantity = async (product: Product, quantity: number) => {
    const q = isWeightBasedUnit(product.unit)
      ? Math.max(quantity, 0.001)
      : Math.max(1, Math.round(quantity))
    let batch_no = ''
    let exp_date: string | null = null

    if (product.enable_batching) {
      const batches = await fetchProductBatches(product.id)
      const picked = pickDefaultBatch(batches)
      if (!picked) {
        notifyError(`No batch stock for ${product.name}. Add purchase stock with a batch first.`)
        return
      }
      batch_no = picked.batch_no || ''
      exp_date = picked.exp_date ?? null
    }

    const key = cartLineKey(product.id, batch_no)
    const existingItem = activeTab.cart.find(
      (item) => cartLineKey(item.product.id, item.batch_no) === key
    )
    if (existingItem) {
      const nextQty = isWeightBasedUnit(product.unit)
        ? existingItem.quantity + q
        : Math.round(existingItem.quantity) + Math.round(q)
      updateQuantity(product.id, nextQty, batch_no)
    } else {
      updateTab(activeTabId, {
        cart: [
          ...activeTab.cart,
          { product, quantity: q, total: cartLineTotal(product, q), batch_no, exp_date },
        ],
      })
    }
  }

  const addToCart = (product: Product) => {
    let quantity = 1
    if (scaleSettings.enabled && isWeightBasedUnit(product.unit)) {
      if (scaleSettings.auto_apply_on_pos && scaleConnectionStatus === 'connected') {
        const scaleQty = getQuantityForProduct(product.unit)
        if (scaleQty !== null) {
          quantity = scaleQty
        } else if (scaleSettings.require_stable_weight) {
          notifyError('Wait for a stable weight reading on the scale')
          return
        }
      }
    }
    void addToCartWithQuantity(product, quantity)
  }

  const handlePosItemCodeScan = async (raw: string) => {
    const code = normalizeScannedBarcode(raw)
    if (!code) return

    // Retail barcodes: exact item_code/sku match — always qty 1 (never stale scale weight).
    const exactProduct = findProductByExactScanCode(code, products)
    if (exactProduct) {
      void addToCartWithQuantity(exactProduct, 1)
      notifySuccess(`Added: ${exactProduct.name}`)
      barcodeInputRef.current?.clear()
      barcodeInputRef.current?.focus()
      return
    }

    if (syncStatus.isOnline) {
      try {
        const res = await apiFetch(`/inventory/stocks/search?item_code=${encodeURIComponent(code)}`, {
          timeoutMs: 3000,
        })
        if (res.ok) {
          const data = await res.json()
          const matches: Array<Record<string, unknown>> = data.data || []
          if (matches.length > 0) {
            const id = String(matches[0].product_id ?? '')
            const product = products.find((p) => p.id === id)
            if (product) {
              void addToCartWithQuantity(product, 1)
              notifySuccess(`Added: ${product.name}`)
              barcodeInputRef.current?.clear()
              barcodeInputRef.current?.focus()
              return
            }
          }
        }
      } catch {
        /* offline — fall through to local-only scale / not-found */
      }
    }

    if (scaleSettings.barcode_scan_enabled) {
      const scaleHit = resolveScaleBarcodeForPos(code, scaleSettings, products)
      if (scaleHit) {
        const product = products.find((p) => p.id === scaleHit.product.id)
        if (product) {
          addToCartWithQuantity(product, scaleHit.quantity)
          notifySuccess(`${product.name} · ${formatQty(scaleHit.quantity, scaleSettings.decimal_places)} ${product.unit}`)
          barcodeInputRef.current?.clear()
          barcodeInputRef.current?.focus()
          return
        }
      }
      if (looksLikeScaleBarcode(code, scaleSettings)) {
        notifyError('Scale barcode recognized but no matching product PLU')
        barcodeInputRef.current?.clear()
        return
      }
    }

    notifyError('Product not found for scanned item code')
    barcodeInputRef.current?.clear()
  }

  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [activeTabId])

  const updateTabScrollState = () => {
    const container = tabListRef.current
    if (!container) return
    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollTabsLeft(scrollLeft > 1)
    setCanScrollTabsRight(scrollLeft + clientWidth < scrollWidth - 1)
  }

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = tabListRef.current
    if (!container) return
    const amount = Math.max(160, Math.floor(container.clientWidth * 0.6))
    container.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const container = tabListRef.current
    if (!container) return
    const activeEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`)
    if (!activeEl) return
    activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeTabId, tabs.length])

  useEffect(() => {
    const container = tabListRef.current
    if (!container) return

    updateTabScrollState()
    container.addEventListener('scroll', updateTabScrollState, { passive: true })

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateTabScrollState)
      : null
    resizeObserver?.observe(container)

    return () => {
      container.removeEventListener('scroll', updateTabScrollState)
      resizeObserver?.disconnect()
    }
  }, [tabs.length])

  const applyScaleWeightToCartItem = (productId: string, unit: string, batchNo?: string) => {
    const qty = getQuantityForProduct(unit)
    if (qty === null) {
      notifyError('No stable weight reading available')
      return
    }
    updateQuantity(productId, qty, batchNo)
    notifySuccess(`Applied weight: ${qty} ${unit}`)
  }

  const updateQuantity = (productId: string, quantity: number, batchNo?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, batchNo)
      return
    }
    const key = cartLineKey(productId, batchNo)
    updateTab(activeTabId, {
      cart: activeTab.cart.map((item) => {
        if (cartLineKey(item.product.id, item.batch_no) === key) {
          return { ...item, quantity, total: cartLineTotal(item.product, quantity) }
        }
        return item
      }),
    })
  }

  const formatCartQuantity = (item: CartItem) =>
    isWeightBasedUnit(item.product.unit)
      ? item.quantity.toFixed(scaleSettings.decimal_places)
      : String(Math.round(item.quantity))

  const adjustCartQuantity = (item: CartItem, delta: number) => {
    const next = isWeightBasedUnit(item.product.unit)
      ? item.quantity + delta
      : Math.round(item.quantity) + delta
    updateQuantity(item.product.id, next, item.batch_no)
  }

  const commitQuantityEdit = (productId: string, raw: string, unit: string, batchNo?: string) => {
    const parsed = parseFloat(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setEditingQty(null)
      removeFromCart(productId, batchNo)
      return
    }
    const quantity = isWeightBasedUnit(unit)
      ? Math.round(parsed * Math.pow(10, scaleSettings.decimal_places)) / Math.pow(10, scaleSettings.decimal_places)
      : Math.round(parsed)
    updateQuantity(productId, quantity, batchNo)
    setEditingQty(null)
  }

  const removeFromCart = (productId: string, batchNo?: string) => {
    const key = cartLineKey(productId, batchNo)
    updateTab(activeTabId, {
      cart: activeTab.cart.filter((item) => cartLineKey(item.product.id, item.batch_no) !== key),
    })
  }

  const getCartTotal = () => {
    return activeTab.cart.reduce((sum, item) => sum + item.total, 0)
  }

  const getTaxTotal = () => {
    return activeTab.cart.reduce((sum, item) => {
      return (
        sum +
        lineTaxAmount(
          item.product.sale_price,
          item.quantity,
          productTaxRate(item.product),
          isProductGstEnabled(item.product) ? (item.product.sale_price_with_tax ?? true) : false
        )
      )
    }, 0)
  }

  const computeSaleDiscount = (cartTotal: number, type: 'amount' | 'percent', value: string) => {
    if (cartTotal <= 0) return 0
    const raw = parseMoney(value)
    if (raw <= 0) return 0
    if (type === 'percent') {
      return Math.min(cartTotal, parseMoney(cartTotal * (Math.min(raw, 100) / 100)))
    }
    return Math.min(cartTotal, raw)
  }

  const getSaleDiscount = () =>
    computeSaleDiscount(getCartTotal(), activeTab.discountType || 'amount', activeTab.discountValue || '')

  const getLoyaltyDiscount = (saleDiscount = getSaleDiscount()) => {
    if (!activeTab.selectedParty || !loyaltySettings?.is_enabled) return 0
    const { discount } = computeLoyaltyDiscount(
      loyaltySettings,
      activeTab.selectedParty.loyalty_points ?? 0,
      Math.max(0, getCartTotal() - saleDiscount),
      loyaltyPointsToRedeem
    )
    return discount
  }

  const getExactTotal = () => {
    const saleDiscount = getSaleDiscount()
    return getCartTotal() - saleDiscount - getLoyaltyDiscount(saleDiscount)
  }

  const getRoundedTotal = () => Math.max(0, Math.round(getExactTotal()))

  const getRoundOff = () => roundMoney(getRoundedTotal() - getExactTotal())

  const syncReceivedToPayable = (prevPayable: number, nextPayable: number, delta = 0) => {
    setReceivedAmount((prev) => {
      const n = parseFloat(prev)
      if (!prev || Number.isNaN(n)) {
        return nextPayable > 0 ? nextPayable.toString() : ''
      }
      if (n + 0.01 >= prevPayable) {
        return nextPayable.toString()
      }
      return Math.max(0, Math.min(n - delta, nextPayable)).toString()
    })
  }

  const applyPosDiscountChange = (nextValue: string, nextType: 'amount' | 'percent' = activeTab.discountType || 'amount') => {
    const cartTotal = getCartTotal()
    const prevSale = getSaleDiscount()
    const nextSale = computeSaleDiscount(cartTotal, nextType, nextValue)
    const prevLoyalty = getLoyaltyDiscount(prevSale)
    const nextLoyalty = (() => {
      if (!activeTab.selectedParty || !loyaltySettings?.is_enabled) return 0
      const { discount } = computeLoyaltyDiscount(
        loyaltySettings,
        activeTab.selectedParty.loyalty_points ?? 0,
        Math.max(0, cartTotal - nextSale),
        loyaltyPointsToRedeem
      )
      return discount
    })()
    prevLoyaltyDiscountRef.current = nextLoyalty
    updateTab(activeTabId, { discountType: nextType, discountValue: nextValue })
    syncReceivedToPayable(
      Math.max(0, Math.round(cartTotal - prevSale - prevLoyalty)),
      Math.max(0, Math.round(cartTotal - nextSale - nextLoyalty)),
      nextSale - prevSale + (nextLoyalty - prevLoyalty)
    )
  }

  const applyPosLoyaltyChange = (nextPoints: number) => {
    const cartTotal = getCartTotal()
    const saleDiscount = getSaleDiscount()
    const billTotal = Math.max(0, cartTotal - saleDiscount)
    const { discount: nextDiscount } = computeLoyaltyDiscount(
      loyaltySettings,
      activeTab.selectedParty?.loyalty_points ?? 0,
      billTotal,
      nextPoints
    )
    const prevDiscount = prevLoyaltyDiscountRef.current
    const delta = nextDiscount - prevDiscount
    prevLoyaltyDiscountRef.current = nextDiscount
    setLoyaltyPointsToRedeem(nextPoints)
    syncReceivedToPayable(
      Math.max(0, Math.round(billTotal - prevDiscount)),
      Math.max(0, Math.round(billTotal - nextDiscount)),
      delta
    )
  }

  const getBalance = () => {
    const received = parseFloat(receivedAmount) || 0
    return getRoundedTotal() - received
  }

  const setFullyPaid = () => {
    setReceivedAmount(getRoundedTotal().toString())
  }

  const updateTab = (tabId: string, updates: Partial<POSTab>) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, ...updates } : tab
    ))
  }

  const createNewTab = () => {
    const newTab: POSTab = {
      id: `tab-${Date.now()}`,
      title: `Order ${tabs.length + 1}`,
      cart: [],
      selectedParty: walkInCustomer,
      notes: '',
      isDraft: false,
      discountType: 'amount',
      discountValue: '',
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
    setIsEditingCustomer(false)
  }

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id)
    }
  }

  const saveAsDraft = async () => {
    if (activeTab.cart.length === 0) {
      notifyError('Cart is empty')
      return
    }
    setShowDraftModal(true)
  }

  const handleSaveDraft = async () => {
    if (!draftTitle.trim()) {
      notifyError('Please enter a draft title')
      return
    }

    const draftData = {
      id: crypto.randomUUID(),
      title: draftTitle,
      cart_data: JSON.stringify({
        items: activeTab.cart,
        discountType: activeTab.discountType || 'amount',
        discountValue: activeTab.discountValue || '',
      }),
      party_id: activeTab.selectedParty?.id,
      notes: activeTab.notes,
      session_id: session?.id,
      is_active: true,
    }

    try {
      const res = await apiFetch('/pos/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData),
        timeoutMs: 5000,
      })
      if (res.ok) {
        await loadDrafts()
        setShowDraftModal(false)
        setDraftTitle('')
        notifySuccess('Draft saved successfully')
        return
      }
    } catch (err) {
      console.error('Failed to save draft online, saving locally')
    }

    await offlineStorage.saveLocalDraft(draftData)
    setDrafts((prev) => [...prev, draftData])
    setShowDraftModal(false)
    setDraftTitle('')
    notifySuccess('Draft saved on this device')
  }

  const loadDraft = async (draft: POSDraft) => {
    try {
      const parsed = JSON.parse(draft.cart_data) as CartItem[] | { items?: CartItem[]; discountType?: string; discountValue?: string }
      const rawItems = Array.isArray(parsed) ? parsed : (parsed.items || [])
      const cartData = rawItems.map((item) => ({
        ...item,
        total: cartLineTotal(item.product, item.quantity),
      }))
      const party = parties.find(p => p.id === draft.party_id)
      const discountType = !Array.isArray(parsed) && parsed.discountType === 'percent' ? 'percent' as const : 'amount' as const
      const discountValue = !Array.isArray(parsed) && typeof parsed.discountValue === 'string' ? parsed.discountValue : ''
      
      const newTab: POSTab = {
        id: `draft-${draft.id}`,
        title: draft.title,
        cart: cartData,
        selectedParty: party || walkInCustomer,
        notes: draft.notes,
        isDraft: true,
        draftId: draft.id,
        discountType,
        discountValue,
      }
      
      setTabs([...tabs, newTab])
      setActiveTabId(newTab.id)
      setIsEditingCustomer(false)
    } catch (err) {
      console.error('Failed to load draft')
      notifyError('Failed to load draft')
    }
  }

  const searchCustomers = () => {
    const query = customerName.trim() || customerPhone.trim()
    if (!query) {
      setCustomerSuggestions([])
      return
    }
    
    const filtered = parties.filter(party =>
      party.name?.toLowerCase().includes(query.toLowerCase()) ||
      party.phone?.includes(query)
    )
    setCustomerSuggestions(filtered)
  }

  const selectCustomer = (party: Party) => {
    updateTab(activeTabId, { selectedParty: party })
    setCustomerName('')
    setCustomerPhone('')
    setCustomerSuggestions([])
    setShowCustomerSuggestions(false)
    setIsEditingCustomer(false)
  }

  const startEditingCustomer = () => {
    setIsEditingCustomer(true)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerSuggestions([])
    setShowCustomerSuggestions(false)
  }

  const cancelEditingCustomer = () => {
    setIsEditingCustomer(false)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerSuggestions([])
    setShowCustomerSuggestions(false)
    if (!activeTab.selectedParty && walkInCustomer) {
      updateTab(activeTabId, { selectedParty: walkInCustomer })
    }
  }

  const useWalkInCustomer = () => {
    if (walkInCustomer) {
      selectCustomer(walkInCustomer)
      return
    }
    cancelEditingCustomer()
  }

  const createQuickCustomer = async () => {
    if (!customerPhone.trim()) {
      notifyError('Phone number is required')
      return
    }

    const newCustomer = {
      name: customerName.trim() || WALK_IN_CUSTOMER_NAME,
      phone: customerPhone.trim(),
      party_type: 'customer'
    }

    try {
      const res = await apiFetch('/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
        timeoutMs: 5000,
      })
      if (res.ok) {
        const createdParty = await res.json()
        const next = [...parties, createdParty]
        setParties(next)
        await offlineStorage.cacheParties(next)
        selectCustomer(createdParty)
        return
      }
    } catch (err) {
      console.error('Failed to create customer online, using local party')
    }

    const localParty: Party = {
      id: crypto.randomUUID(),
      name: newCustomer.name,
      phone: newCustomer.phone,
      gstin: '',
      local_only: true,
    }
    const next = [...parties, localParty]
    setParties(next)
    await offlineStorage.putParty(localParty)
    selectCustomer(localParty)
  }

  const handleCheckout = async (shouldPrint: boolean) => {
    if (activeTab.cart.length === 0) return
    if (!activeTab.selectedParty) {
      notifyError('Please select a customer')
      return
    }
    if (checkoutInFlightRef.current) return
    checkoutInFlightRef.current = true

    const roundedTotal = getRoundedTotal()
    const amountPaid = Math.min(parseFloat(receivedAmount) || roundedTotal, roundedTotal)
    const saleDiscount = getSaleDiscount()
    const cartSnapshot = [...activeTab.cart]
    const partySnapshot = activeTab.selectedParty
    const clientSaleId = crypto.randomUUID()

    try {
      const invoiceNumber = await offlineStorage.allocateInvoiceNumber()
      const sale: POSSaleRecord = {
        id: clientSaleId,
        client_sale_id: clientSaleId,
        invoice_number: invoiceNumber,
        party_id: partySnapshot.id,
        party: {
          id: partySnapshot.id,
          name: partySnapshot.name,
          phone: partySnapshot.phone,
          gstin: partySnapshot.gstin,
          local_only: partySnapshot.local_only,
        },
        date: new Date().toISOString(),
        status: 'paid',
        payment_mode: paymentMethod,
        amount_paid: amountPaid,
        is_pos: true,
        pos_session_id: session?.id,
        session_local_only: session?.local_only,
        session_opening_cash: session?.opening_cash,
        ...(saleDiscount > 0 ? { invoice_discount: saleDiscount } : {}),
        ...(loyaltyPointsToRedeem > 0 ? { loyalty_points_redeemed: loyaltyPointsToRedeem } : {}),
        items: cartSnapshot.map((item) => ({
          product_id: item.product.id,
          description: item.product.name,
          quantity: item.quantity,
          unit_price: productSaleUnitPrice(item.product),
          tax_rate: productTaxRate(item.product),
          unit: item.product.unit || 'pcs',
          batch_no: item.batch_no || '',
          exp_date: item.exp_date || null,
          total: item.total,
        })),
        tax_total: getTaxTotal(),
        round_off: getRoundOff(),
        total: roundedTotal,
        sync_status: 'pending_sync',
      }

      await offlineStorage.savePendingPOSSale(sale)

      const nextProducts = products.map((product) => {
        const sold = cartSnapshot
          .filter((item) => item.product.id === product.id)
          .reduce((sum, item) => sum + item.quantity, 0)
        if (!sold) return product
        return { ...product, stock_qty: Math.max(0, Number(product.stock_qty || 0) - sold) }
      })
      setProducts(nextProducts)
      for (const item of cartSnapshot) {
        await offlineStorage.decrementLocalStock(item.product.id, item.quantity, item.batch_no)
      }

      updateTab(activeTabId, { cart: [], selectedParty: walkInCustomer, discountType: 'amount', discountValue: '' })
      setIsEditingCustomer(false)
      setEditingQty(null)
      setPaymentMethod('upi')
      setReceivedAmount('')
      setLoyaltyPointsToRedeem(0)
      clearScaleReading()
      if (session) {
        const updatedSession = { ...session, total_sales: session.total_sales + roundedTotal }
        setSession(updatedSession)
        await offlineStorage.savePOSSession(updatedSession)
      }

      notifySuccess('Sale completed')

      if (shouldPrint) {
        try {
          const printSettings = await getCachedPrintSettings()
          const business = await getCachedBusiness()
          const printSize = printSettings?.thermal_print_size || '2inch'
          const content = buildPOSReceiptContent(
            business || {},
            {
              invoice_number: invoiceNumber,
              date: sale.date,
              party_name: partySnapshot.name,
              party_phone: partySnapshot.phone,
              payment_mode: paymentMethod,
              amount_paid: amountPaid,
              invoice_discount: saleDiscount,
              tax_total: sale.tax_total,
              round_off: sale.round_off,
              total: roundedTotal,
              items: sale.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                tax_rate: item.tax_rate,
                total: item.total || 0,
              })),
            },
            printSize
          )
          await printThermalContent({
            content,
            printerName: printSettings?.thermal_printer_name || '',
            paperWidthMm: receiptPaperWidthMm(printSize),
            title: invoiceNumber,
            logoUrl: business?.logo_data_url,
          })
        } catch (printErr) {
          console.warn('POS print failed:', printErr)
          const detail =
            printErr instanceof Error && printErr.message
              ? printErr.message
              : 'Check Print Settings (thermal printer / paper size).'
          notifyError(`Sale saved, but print failed: ${detail}`)
        }
      }

      void (async () => {
        await checkSyncStatus()
        await manualSync().catch(() => undefined)
      })()
    } catch (err) {
      console.error('POS checkout failed', err)
      notifyError('Could not save the sale on this device. Try again.')
    } finally {
      checkoutInFlightRef.current = false
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.item_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <KeyboardShortcutsProvider>
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">POS</h1>
          <div
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              syncStatus.authExpired
                ? 'bg-red-50 text-red-700'
                : isSyncing
                  ? 'bg-blue-50 text-blue-700'
                  : syncStatus.isOnline
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-800'
            }`}
            title={syncStatus.authExpired ? 'Sign in again to sync pending sales' : undefined}
          >
            {syncStatus.isOnline && !syncStatus.authExpired ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span>
              {syncStatus.authExpired
                ? 'Sign-in required to sync'
                : isSyncing
                  ? `Syncing ${syncStatus.pending}`
                  : syncStatus.isOnline
                    ? syncStatus.pending > 0
                      ? `Online · ${syncStatus.pending} pending`
                      : 'Online'
                    : 'Offline'}
            </span>
          </div>
          {session && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Sales: <span className="font-semibold text-gray-900">{formatCurrency(session.total_sales)}</span></span>
              <span className="text-gray-600">Opening: <span className="font-semibold">{formatCurrency(session.opening_cash)}</span></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mounted && syncStatus.pending > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void manualSync().catch(() => undefined) }}
              disabled={isSyncing || !syncStatus.isOnline || syncStatus.authExpired}
              className="h-8 px-2"
            >
              {isSyncing ? 'Syncing...' : `Sync ${syncStatus.pending}`}
            </Button>
          )}
          <KeyboardShortcutsTrigger variant="compact" />
          <Button
            variant="ghost"
            size="sm"
            onClick={saveAsDraft}
            disabled={activeTab.cart.length === 0}
            className="h-8"
          >
            <Save className="h-4 w-4 mr-1" />
            Save Draft
          </Button>
          {drafts.length > 0 && (
            <select
              className="h-8 text-xs rounded border border-gray-300 bg-white px-2"
              onChange={(e) => {
                if (e.target.value) {
                  const draft = drafts.find(d => d.id === e.target.value)
                  if (draft) loadDraft(draft)
                  e.target.value = ''
                }
              }}
              value=""
            >
              <option value="">Load Draft...</option>
              {drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.title}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" size="sm" asChild className="h-8">
            <Link href="/pos/sessions">
              <History className="h-4 w-4 mr-1" />
              History
            </Link>
          </Button>
          {session && (
            <Button
              variant="ghost"
              size="sm"
              onClick={closeSession}
              className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Close Session
            </Button>
          )}
        </div>
      </div>

      {/* Compact Tab Bar */}
      <div className="flex items-center gap-2 px-2 py-1 bg-white border-b min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {canScrollTabsLeft && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => scrollTabs('left')}
              className="h-7 w-7 shrink-0 p-0"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div
            ref={tabListRef}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded text-sm transition-colors ${
                  activeTabId === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{tab.title}</span>
                {tab.cart.length > 0 && (
                  <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded">
                    {tab.cart.length}
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className="ml-0.5 hover:text-red-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}
          </div>
          {canScrollTabsRight && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => scrollTabs('right')}
              className="h-7 w-7 shrink-0 p-0"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={createNewTab}
            className="h-7 px-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
          <div className="relative w-80 sm:w-96">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search products..."
              className="h-7 pl-8 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Session Modal - Compact */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <form
            className="bg-white rounded-lg shadow-xl p-4 w-80"
            onSubmit={(e) => {
              e.preventDefault()
              void openSession()
            }}
          >
            <h3 className="font-semibold text-gray-900 mb-3">Open POS Session</h3>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Opening Cash
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full h-9 text-sm">
                <CheckCircle className="mr-2 h-4 w-4" /> Open Session
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { window.location.href = '/dashboard' }}
                className="w-full h-9 text-sm"
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barcode scanner */}
          <div className="p-3 bg-white border-b">
            <BarcodeScannerInput
              ref={barcodeInputRef}
              onScan={handlePosItemCodeScan}
              placeholder={
                scaleSettings.barcode_scan_enabled
                  ? 'Scan scale or product barcode…'
                  : 'Scan product barcode…'
              }
              className="w-full"
            />
          </div>
          
          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-2 bg-white border rounded hover:border-blue-400 hover:shadow-sm transition-all text-left"
                >
                  <h3 className="font-semibold text-gray-900 text-xs mb-0.5 truncate">{product.name}</h3>
                  <div className="text-xs text-gray-500 mb-1 space-y-0.5">
                    {product.sku && <p className="truncate">SKU: {product.sku}</p>}
                    {product.plu?.trim() && (
                      <p className="truncate">PLU: {product.plu.trim()}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-600">
                      {formatCurrency(product.sale_price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatQty(product.stock_qty)}
                    </span>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 text-sm">
                  No products found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="w-80 flex flex-col bg-white border-l">
          {/* Cart Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-sm text-gray-900">Cart ({activeTab.cart.length})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateTab(activeTabId, { cart: [] })}
              disabled={activeTab.cart.length === 0}
              className="h-7 px-2 text-xs"
            >
              Clear
            </Button>
          </div>

          {/* Customer Selection - Compact */}
          <div className="p-2 border-b">
            {activeTab.selectedParty && !isEditingCustomer ? (
              <div className="flex items-center justify-between gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-xs truncate">{activeTab.selectedParty.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {activeTab.selectedParty.phone || 'No phone'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startEditingCustomer}
                  className="h-7 px-2 text-xs shrink-0"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-600">Select customer</p>
                  <div className="flex items-center gap-1">
                    {walkInCustomer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={useWalkInCustomer}
                        className="h-6 px-1.5 text-xs text-blue-600"
                      >
                        Use Walk-in
                      </Button>
                    )}
                    {activeTab.selectedParty && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditingCustomer}
                        className="h-6 px-1.5 text-xs text-gray-500"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {walkInCustomer && (
                  <button
                    type="button"
                    onClick={() => selectCustomer(walkInCustomer)}
                    className="w-full text-left p-2 rounded border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900 text-xs">{walkInCustomer.name}</p>
                    <p className="text-xs text-gray-500">Default customer</p>
                  </button>
                )}
                <Input
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value)
                    searchCustomers()
                    setShowCustomerSuggestions(true)
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  className="h-8 text-xs"
                />
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="Mobile *"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value)
                      searchCustomers()
                      setShowCustomerSuggestions(true)
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customerPhone.trim()) {
                        createQuickCustomer()
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  {showCustomerSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full border rounded bg-white shadow-lg max-h-40 overflow-y-auto">
                      {customerSuggestions.map((party) => (
                        <div
                          key={party.id}
                          className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                          onClick={() => selectCustomer(party)}
                        >
                          <p className="font-medium text-gray-900 text-xs">{party.name}</p>
                          <p className="text-xs text-gray-500">{party.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {showCustomerSuggestions && (customerName.trim() || customerPhone.trim()) && customerSuggestions.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full border rounded bg-white shadow-lg p-2">
                      <Button
                        size="sm"
                        onClick={createQuickCustomer}
                        className="w-full h-7 text-xs"
                        disabled={!customerPhone.trim()}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add New
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <WeighingScalePanel
            enabled={scaleSettings.enabled}
            connectionStatus={scaleConnectionStatus}
            currentWeightKg={currentWeightKg}
            isStable={scaleStable}
            lastError={scaleError}
            compact
            onConnect={connectScale}
            onDisconnect={disconnectScale}
            className="mx-2 mt-2"
          />

          {/* Cart Items - Scrollable */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {activeTab.cart.map((item) => (
              <div key={cartLineKey(item.product.id, item.batch_no)} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-xs truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(item.product.sale_price)}</p>
                  {item.product.enable_batching && (
                    <p className="text-[10px] text-amber-700 truncate">
                      Batch: {item.batch_no || '—'}
                      {item.exp_date
                        ? ` · Exp ${new Date(item.exp_date).toLocaleDateString('en-IN')}`
                        : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingQty(null)
                      adjustCartQuantity(item, -1)
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    inputMode={isWeightBasedUnit(item.product.unit) ? 'decimal' : 'numeric'}
                    min={isWeightBasedUnit(item.product.unit) ? 0.001 : 1}
                    step={isWeightBasedUnit(item.product.unit) ? Math.pow(10, -scaleSettings.decimal_places) : 1}
                    value={
                      editingQty?.productId === cartLineKey(item.product.id, item.batch_no)
                        ? editingQty.value
                        : formatCartQuantity(item)
                    }
                    onFocus={(e) => {
                      setEditingQty({
                        productId: cartLineKey(item.product.id, item.batch_no),
                        value: formatCartQuantity(item),
                      })
                      e.target.select()
                    }}
                    onChange={(e) => {
                      setEditingQty({
                        productId: cartLineKey(item.product.id, item.batch_no),
                        value: e.target.value,
                      })
                    }}
                    onBlur={() => {
                      if (qtyEditCancelledRef.current) {
                        qtyEditCancelledRef.current = false
                        setEditingQty(null)
                        return
                      }
                      if (editingQty?.productId === cartLineKey(item.product.id, item.batch_no)) {
                        commitQuantityEdit(
                          item.product.id,
                          editingQty.value,
                          item.product.unit,
                          item.batch_no
                        )
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      } else if (e.key === 'Escape') {
                        qtyEditCancelledRef.current = true
                        setEditingQty(null)
                        e.currentTarget.blur()
                      }
                    }}
                    className="h-6 w-14 px-1 text-center text-xs font-medium tabular-nums"
                    aria-label={`Quantity for ${item.product.name}`}
                  />
                  {isWeightBasedUnit(item.product.unit) && scaleSettings.enabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Apply scale weight"
                      onClick={() =>
                        applyScaleWeightToCartItem(item.product.id, item.product.unit, item.batch_no)
                      }
                      className="h-6 w-6 p-0"
                    >
                      <Scale className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingQty(null)
                      adjustCartQuantity(item, 1)
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFromCart(item.product.id, item.batch_no)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            ))}
            {activeTab.cart.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">
                Cart is empty
              </div>
            )}
          </div>

          {/* Totals - Compact */}
          {activeTab.cart.length > 0 && (
            <div className="p-2 border-t bg-gray-50 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(getCartTotal() - getTaxTotal())}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">{formatCurrency(getTaxTotal())}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(getCartTotal())}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 shrink-0">Discount</span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex overflow-hidden rounded border border-gray-300">
                    <button
                      type="button"
                      onClick={() => applyPosDiscountChange(activeTab.discountValue || '', 'amount')}
                      className={`h-7 px-1.5 text-[10px] font-medium ${
                        (activeTab.discountType || 'amount') === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
                      }`}
                      aria-label="Discount as amount"
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPosDiscountChange(activeTab.discountValue || '', 'percent')}
                      className={`h-7 px-1.5 text-[10px] font-medium ${
                        activeTab.discountType === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
                      }`}
                      aria-label="Discount as percent"
                    >
                      <Percent className="h-3 w-3" />
                    </button>
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder={(activeTab.discountType || 'amount') === 'percent' ? '%' : '0.00'}
                    value={activeTab.discountValue || ''}
                    onChange={(e) => applyPosDiscountChange(limitDecimalInput(e.target.value))}
                    className="h-7 w-16 px-1 text-right text-xs"
                    aria-label="Sale discount"
                  />
                </div>
              </div>
              {getSaleDiscount() > 0 && (
                <div className="flex justify-between text-xs text-green-700">
                  <span>
                    {activeTab.discountType === 'percent' ? `${parseMoney(activeTab.discountValue)}% off` : 'Discount'}
                  </span>
                  <span>−{formatCurrency(getSaleDiscount())}</span>
                </div>
              )}
              {getRoundOff() !== 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Round Off</span>
                  <span className="font-medium">
                    {getRoundOff() > 0 ? '+' : ''}
                    {formatCurrency(getRoundOff())}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-500">
                <span>Payable</span>
                <span className="font-medium">{formatCurrency(getRoundedTotal())}</span>
              </div>
              {loyaltySettings?.is_enabled && activeTab.selectedParty && (
                <div className="rounded border border-amber-100 bg-amber-50/80 p-2 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-amber-900">
                    <Gift className="h-3 w-3" />
                    {(activeTab.selectedParty.loyalty_points ?? 0).toLocaleString()} pts
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={activeTab.selectedParty.loyalty_points ?? 0}
                    placeholder="Redeem pts"
                    className="h-7 text-xs"
                    value={loyaltyPointsToRedeem || ''}
                    onChange={(e) => applyPosLoyaltyChange(parseInt(e.target.value, 10) || 0)}
                  />
                  {getLoyaltyDiscount() > 0 && (
                    <p className="text-[10px] text-green-700">
                      −{formatCurrency(getLoyaltyDiscount())} loyalty discount
                    </p>
                  )}
                  {estimatePointsEarned(loyaltySettings, getCartTotal() - getSaleDiscount() - getLoyaltyDiscount()) > 0 && (
                    <p className="text-[10px] text-amber-800">
                      Earn ~{estimatePointsEarned(loyaltySettings, getCartTotal() - getSaleDiscount() - getLoyaltyDiscount())} pts
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payment - Compact */}
          {activeTab.cart.length > 0 && (
            <div className="p-2 border-t space-y-2">
              <select
                className="w-full h-8 text-xs rounded border border-gray-300 bg-white px-2"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
              <p className="text-[10px] text-gray-500 leading-tight">
                Credited to: {getDepositHint(paymentMethod, bankAccounts)}
              </p>
              <div className="flex gap-1">
                <Input
                  type="number"
                  placeholder="Received"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setFullyPaid}
                  className="h-8 px-2 text-xs"
                >
                  Full
                </Button>
              </div>
              {receivedAmount && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Balance</span>
                  <span className={`font-medium ${getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(getBalance()))} {getBalance() >= 0 ? 'due' : 'change'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom menubar — full width, cart-aligned actions on the right */}
      <div className="z-40 flex shrink-0 border-t bg-white">
        <div className="min-w-0 flex-1" />
        <div className="flex w-80 shrink-0 items-center justify-end gap-2 px-2 py-2">
          <Button
            variant="outline"
            className="h-10 flex-1 text-sm"
            onClick={() => handleCheckout(false)}
            disabled={activeTab.cart.length === 0 || !activeTab.selectedParty}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Checkout
          </Button>
          <Button
            className="h-10 flex-1 text-sm"
            onClick={() => handleCheckout(true)}
            disabled={activeTab.cart.length === 0 || !activeTab.selectedParty}
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Checkout & Print
          </Button>
        </div>
      </div>

      {/* Draft Save Modal - Compact */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-80">
            <h3 className="font-semibold text-gray-900 mb-3">Save as Draft</h3>
            <Input
              placeholder="Draft title..."
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="mb-3 h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveDraft} className="flex-1 h-8 text-sm">
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDraftModal(false)
                  setDraftTitle('')
                }}
                className="flex-1 h-8 text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
    </KeyboardShortcutsProvider>
  )
}
