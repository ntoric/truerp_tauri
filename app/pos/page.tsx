'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { offlineStorage } from '@/lib/offlineStorage'
import { Search, Plus, Minus, Trash2, Wifi, WifiOff, ShoppingCart, Printer, CheckCircle, AlertCircle, Save, X, FileText, Copy, Scale, Barcode } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePaymentMethodMappings } from '@/hooks/usePaymentMethodMappings'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { computeLoyaltyDiscount, estimatePointsEarned } from '@/lib/loyalty'
import type { LoyaltySettings } from '@/lib/loyalty-types'
import { Gift } from 'lucide-react'
import { useWeighingScale } from '@/hooks/useWeighingScale'
import WeighingScalePanel from '@/components/WeighingScalePanel'
import { isWeightBasedUnit } from '@/lib/weighingScale'
import { resolveScaleBarcodeForPos, looksLikeScaleBarcode } from '@/lib/weighingScaleBarcode'
import BarcodeScanner from '@/components/ui/BarcodeScanner'
import { fetchPrintSettings, printDocument } from '@/lib/printDocument'

interface Product {
  id: string
  name: string
  sku: string
  item_code: string
  sale_price: number
  stock_qty: number
  unit: string
  tax_rate: number
  category: string
}

interface Party {
  id: string
  name: string
  phone: string
  gstin: string
  loyalty_points?: number
}

interface CartItem {
  product: Product
  quantity: number
  total: number
}

interface POSSession {
  id: string
  opening_cash: number
  total_sales: number
  status: string
}

interface POSTab {
  id: string
  title: string
  cart: CartItem[]
  selectedParty: Party | null
  notes: string
  isDraft: boolean
  draftId?: string
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
  const { syncStatus, isSyncing, manualSync, queueOfflineOperation } = useOfflineSync()
  const [products, setProducts] = useState<Product[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [walkInCustomer, setWalkInCustomer] = useState<Party | null>(null)
  const [tabs, setTabs] = useState<POSTab[]>([
    { id: 'tab-1', title: 'New Order', cart: [], selectedParty: null, notes: '', isDraft: false }
  ])
  const [activeTabId, setActiveTabId] = useState('tab-1')
  const [searchTerm, setSearchTerm] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
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
  } = useWeighingScale()

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || tabs[0], [tabs, activeTabId])

  useEffect(() => {
    setMounted(true)
    // Load data
    loadProducts()
    loadParties()
    loadSession()
    loadDrafts()
    loadLoyaltySettings()
  }, [])

  useEffect(() => {
    setLoyaltyPointsToRedeem(0)
    prevLoyaltyDiscountRef.current = 0
  }, [activeTab.selectedParty?.id])

  const loadLoyaltySettings = async () => {
    try {
      const res = await apiFetch('/loyalty/settings')
      if (res.ok) setLoyaltySettings(await res.json())
    } catch {
      /* offline — skip */
    }
  }

  const loadProducts = async () => {
    try {
      const res = await apiFetch('/products')
      if (res.ok) {
        const data = await res.json()
        setProducts(data)
        // Cache products for offline use
        await offlineStorage.cacheProducts(data)
      }
    } catch (err) {
      console.error('Failed to load products, using cache')
      const cached = await offlineStorage.getCachedProducts()
      setProducts(cached)
    }
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
    try {
      const res = await apiFetch('/pos/sessions/active')
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        await offlineStorage.savePOSSession(data)
      } else {
        // Check offline session
        const offlineSession = await offlineStorage.getActivePOSSession()
        if (offlineSession) {
          setSession(offlineSession)
        } else {
          setShowSessionModal(true)
        }
      }
    } catch (err) {
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
      const res = await apiFetch('/pos/drafts')
      if (res.ok) {
        const data = await res.json()
        setDrafts(data)
      }
    } catch (err) {
      console.error('Failed to load drafts')
    }
  }

  const openSession = async () => {
    const cash = parseFloat(openingCash) || 0
    const newSession = {
      id: crypto.randomUUID(),
      opening_cash: cash,
      total_sales: 0,
      status: 'open',
      opened_at: new Date().toISOString()
    }

    try {
      const res = await apiFetch('/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_cash: cash })
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        await offlineStorage.savePOSSession(data)
        setShowSessionModal(false)
      }
    } catch (err) {
      // Save offline session
      await offlineStorage.savePOSSession(newSession)
      setSession(newSession)
      setShowSessionModal(false)
    }
  }

  const closeSession = async () => {
    if (!session) return

    try {
      const res = await apiFetch(`/pos/sessions/${session.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_cash: session.total_sales + session.opening_cash })
      })
      if (res.ok) {
        await offlineStorage.closePOSSession(session.id)
        setSession(null)
        // Clear cart when session closes
        updateTab(activeTabId, { cart: [], selectedParty: walkInCustomer })
        setIsEditingCustomer(false)
        setPaymentMethod('upi')
        setReceivedAmount('')
        // Redirect to dashboard
        window.location.href = '/dashboard'
      } else {
        const errorData = await res.json()
        console.error('Close session failed:', errorData)
        notifyError(`Failed to close session: ${errorData.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('Close session error:', err)
      await offlineStorage.closePOSSession(session.id)
      setSession(null)
      updateTab(activeTabId, { cart: [], selectedParty: walkInCustomer })
      setIsEditingCustomer(false)
      setPaymentMethod('upi')
      setReceivedAmount('')
      // Redirect to dashboard even in offline mode
      window.location.href = '/dashboard'
    }
  }

  const addToCartWithQuantity = (product: Product, quantity: number) => {
    const q = Math.max(quantity, 0.001)
    const existingItem = activeTab.cart.find(item => item.product.id === product.id)
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + q)
    } else {
      updateTab(activeTabId, {
        cart: [...activeTab.cart, { product, quantity: q, total: product.sale_price * q }]
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
    addToCartWithQuantity(product, quantity)
  }

  const handlePosItemCodeScan = (raw: string) => {
    const code = raw.trim()
    if (!code) return

    if (scaleSettings.enabled && scaleSettings.barcode_scan_enabled) {
      const scaleHit = resolveScaleBarcodeForPos(code, scaleSettings, products)
      if (scaleHit) {
        const product = products.find((p) => p.id === scaleHit.product.id)
        if (product) {
          addToCartWithQuantity(product, scaleHit.quantity)
          notifySuccess(`${product.name} · ${scaleHit.quantity} ${product.unit}`)
          setBarcodeInput('')
          barcodeInputRef.current?.focus()
          return
        }
      }
      if (looksLikeScaleBarcode(code, scaleSettings)) {
        notifyError('Scale barcode recognized but no matching product item code/SKU')
        setBarcodeInput('')
        return
      }
    }

    const byItemCode = products.find((p) => p.item_code?.trim() === code)
    const bySku = products.find((p) => p.sku?.trim() === code)
    const product = byItemCode ?? bySku
    if (product) {
      addToCart(product)
      notifySuccess(`Added: ${product.name}`)
      setBarcodeInput('')
      barcodeInputRef.current?.focus()
      return
    }

    notifyError('Product not found for scanned item code')
    setBarcodeInput('')
  }

  useEffect(() => {
    if (!scaleSettings.enabled || !scaleSettings.barcode_scan_enabled) return
    barcodeInputRef.current?.focus()
  }, [scaleSettings.enabled, scaleSettings.barcode_scan_enabled, activeTabId])

  const applyScaleWeightToCartItem = (productId: string, unit: string) => {
    const qty = getQuantityForProduct(unit)
    if (qty === null) {
      notifyError('No stable weight reading available')
      return
    }
    updateQuantity(productId, qty)
    notifySuccess(`Applied weight: ${qty} ${unit}`)
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    updateTab(activeTabId, {
      cart: activeTab.cart.map(item => {
        if (item.product.id === productId) {
          return { ...item, quantity, total: item.product.sale_price * quantity }
        }
        return item
      })
    })
  }

  const formatCartQuantity = (item: CartItem) =>
    isWeightBasedUnit(item.product.unit)
      ? item.quantity.toFixed(scaleSettings.decimal_places)
      : String(item.quantity)

  const commitQuantityEdit = (productId: string, raw: string, unit: string) => {
    const parsed = parseFloat(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setEditingQty(null)
      removeFromCart(productId)
      return
    }
    const quantity = isWeightBasedUnit(unit)
      ? Math.round(parsed * Math.pow(10, scaleSettings.decimal_places)) / Math.pow(10, scaleSettings.decimal_places)
      : Math.round(parsed * 1000) / 1000
    updateQuantity(productId, quantity)
    setEditingQty(null)
  }

  const removeFromCart = (productId: string) => {
    updateTab(activeTabId, {
      cart: activeTab.cart.filter(item => item.product.id !== productId)
    })
  }

  const getCartTotal = () => {
    return activeTab.cart.reduce((sum, item) => sum + item.total, 0)
  }

  const getTaxTotal = () => {
    return activeTab.cart.reduce((sum, item) => {
      const taxAmount = (item.total * item.product.tax_rate) / (100 + item.product.tax_rate)
      return sum + taxAmount
    }, 0)
  }

  const getLoyaltyDiscount = () => {
    if (!activeTab.selectedParty || !loyaltySettings?.is_enabled) return 0
    const { discount } = computeLoyaltyDiscount(
      loyaltySettings,
      activeTab.selectedParty.loyalty_points ?? 0,
      getCartTotal(),
      loyaltyPointsToRedeem
    )
    return discount
  }

  const getRoundedTotal = () => {
    const total = getCartTotal() - getLoyaltyDiscount()
    return Math.max(0, Math.round(total))
  }

  const applyPosLoyaltyChange = (nextPoints: number) => {
    const cartTotal = getCartTotal()
    const { discount: nextDiscount } = computeLoyaltyDiscount(
      loyaltySettings,
      activeTab.selectedParty?.loyalty_points ?? 0,
      cartTotal,
      nextPoints
    )
    const prevDiscount = prevLoyaltyDiscountRef.current
    const delta = nextDiscount - prevDiscount
    prevLoyaltyDiscountRef.current = nextDiscount
    setLoyaltyPointsToRedeem(nextPoints)

    const payable = Math.max(0, Math.round(cartTotal - nextDiscount))
    setReceivedAmount((prev) => {
      const n = parseFloat(prev)
      if (!prev || Number.isNaN(n)) {
        return payable.toString()
      }
      const prePayable = Math.max(0, Math.round(cartTotal - prevDiscount))
      if (n + 0.01 >= prePayable) {
        return payable.toString()
      }
      return Math.max(0, Math.min(n - delta, payable)).toString()
    })
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
      isDraft: false
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
      title: draftTitle,
      cart_data: JSON.stringify(activeTab.cart),
      party_id: activeTab.selectedParty?.id,
      notes: activeTab.notes,
      session_id: session?.id
    }

    try {
      const res = await apiFetch('/pos/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
      })
      if (res.ok) {
        await loadDrafts()
        setShowDraftModal(false)
        setDraftTitle('')
        notifySuccess('Draft saved successfully')
      }
    } catch (err) {
      console.error('Failed to save draft')
      notifyError('Failed to save draft')
    }
  }

  const loadDraft = async (draft: POSDraft) => {
    try {
      const cartData = JSON.parse(draft.cart_data)
      const party = parties.find(p => p.id === draft.party_id)
      
      const newTab: POSTab = {
        id: `draft-${draft.id}`,
        title: draft.title,
        cart: cartData,
        selectedParty: party || walkInCustomer,
        notes: draft.notes,
        isDraft: true,
        draftId: draft.id
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
        body: JSON.stringify(newCustomer)
      })
      if (res.ok) {
        const createdParty = await res.json()
        setParties([...parties, createdParty])
        selectCustomer(createdParty)
      }
    } catch (err) {
      console.error('Failed to create customer')
      notifyError('Failed to create customer')
    }
  }

  const handleCheckout = async (shouldPrint: boolean) => {
    if (activeTab.cart.length === 0) return
    if (!activeTab.selectedParty) {
      notifyError('Please select a customer')
      return
    }

    const roundedTotal = getRoundedTotal()
    const amountPaid = Math.min(parseFloat(receivedAmount) || roundedTotal, roundedTotal)

    const buildInvoicePayload = (invoiceNumber: string) => ({
      invoice_number: invoiceNumber,
      party_id: activeTab.selectedParty!.id,
      date: new Date().toISOString(),
      status: 'paid',
      payment_mode: paymentMethod,
      amount_paid: amountPaid,
      ...(loyaltyPointsToRedeem > 0 ? { loyalty_points_redeemed: loyaltyPointsToRedeem } : {}),
      items: activeTab.cart.map(item => ({
        description: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
        tax_rate: item.product.tax_rate,
        unit: item.product.unit || 'pcs',
      })),
    })

    const completeSaleLocally = async () => {
      updateTab(activeTabId, { cart: [], selectedParty: walkInCustomer })
      setIsEditingCustomer(false)
      setPaymentMethod('upi')
      setReceivedAmount('')
      setLoyaltyPointsToRedeem(0)
      if (session) {
        const updatedSession = { ...session, total_sales: session.total_sales + roundedTotal }
        setSession(updatedSession)
        await offlineStorage.savePOSSession(updatedSession)
      }
    }

    const printInvoice = async (invoiceId: string) => {
      try {
        const printSettings = await fetchPrintSettings()
        await printDocument({
          documentType: 'invoice',
          documentId: invoiceId,
          mode: printSettings.invoice_print_mode,
          printSize: printSettings.thermal_print_size,
        })
      } catch (printErr) {
        console.warn('POS print failed:', printErr)
        notifyError('Sale saved, but printing failed. Check Print Settings.')
      }
    }

    try {
      let invoiceNumber = `POS-${Date.now()}`
      const numRes = await apiFetch('/invoices/next-number')
      if (numRes.ok) {
        const numData = await numRes.json()
        if (numData.invoice_number) {
          invoiceNumber = numData.invoice_number
        }
      }

      const invoice = buildInvoicePayload(invoiceNumber)
      const res = await apiFetch('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      })

      if (res.ok) {
        const created = await res.json().catch(() => null)
        await completeSaleLocally()
        notifySuccess('Sale completed successfully')
        const invoiceId = created?.id as string | undefined
        if (shouldPrint && invoiceId) {
          await printInvoice(invoiceId)
        }
        return
      }

      const errData = await res.json().catch(() => ({}))
      notifyError(typeof errData.error === 'string' ? errData.error : 'Checkout failed')
    } catch (err) {
      const invoice = buildInvoicePayload(`POS-OFF-${Date.now()}`)
      await offlineStorage.saveOfflineInvoice(invoice)
      await queueOfflineOperation('create', 'invoice', invoice)
      await completeSaleLocally()
      notifySuccess('Invoice saved offline. Will sync when connection is restored.')
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
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">POS</h1>
          {session && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Sales: <span className="font-semibold text-gray-900">{formatCurrency(session.total_sales)}</span></span>
              <span className="text-gray-600">Opening: <span className="font-semibold">{formatCurrency(session.opening_cash)}</span></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mounted && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100">
              {syncStatus.isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs text-gray-600">{syncStatus.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          )}
          {mounted && syncStatus.pending > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={manualSync}
              disabled={isSyncing || !syncStatus.isOnline}
              className="h-8 px-2"
            >
              {isSyncing ? 'Syncing...' : `Sync ${syncStatus.pending}`}
            </Button>
          )}
          {session && (
            <Button variant="ghost" size="sm" onClick={closeSession} className="h-8">
              Close Session
            </Button>
          )}
        </div>
      </div>

      {/* Compact Tab Bar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-white border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTabId === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <FileText className="h-3.5 w-3.5" />
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
        <Button
          size="sm"
          variant="ghost"
          onClick={createNewTab}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          New
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={saveAsDraft}
          disabled={activeTab.cart.length === 0}
          className="h-7 px-2 text-xs"
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          Save Draft
        </Button>
        {drafts.length > 0 && (
          <select
            className="h-7 text-xs rounded border border-gray-300 bg-white px-2"
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
      </div>

      {/* Session Modal - Compact */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-80">
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
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={openSession} className="w-full h-9 text-sm">
                <CheckCircle className="mr-2 h-4 w-4" /> Open Session
              </Button>
              <Button
                variant="outline"
                onClick={() => { window.location.href = '/dashboard' }}
                className="w-full h-9 text-sm"
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 bg-white border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search products (name, SKU, item code)..."
                className="pl-9 h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  ref={barcodeInputRef}
                  data-pos-barcode="true"
                  placeholder={
                    scaleSettings.enabled && scaleSettings.barcode_scan_enabled
                      ? 'Scan scale or product item code…'
                      : 'Scan product item code…'
                  }
                  className="pl-9 h-9 text-sm font-mono"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handlePosItemCodeScan(barcodeInput)
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2"
                onClick={() => setShowBarcodeScanner(true)}
                title="Camera barcode scan"
              >
                <Barcode className="h-4 w-4" />
              </Button>
            </div>
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
                  <p className="text-xs text-gray-500 mb-1 truncate">{product.sku}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-600">
                      {formatCurrency(product.sale_price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {product.stock_qty}
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
        <div className="w-80 flex flex-col bg-white border-l shadow-lg">
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
              <div key={item.product.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-xs truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(item.product.sale_price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingQty(null)
                      updateQuantity(item.product.id, item.quantity - 1)
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.001}
                    step={isWeightBasedUnit(item.product.unit) ? Math.pow(10, -scaleSettings.decimal_places) : 1}
                    value={
                      editingQty?.productId === item.product.id
                        ? editingQty.value
                        : formatCartQuantity(item)
                    }
                    onFocus={(e) => {
                      setEditingQty({ productId: item.product.id, value: formatCartQuantity(item) })
                      e.target.select()
                    }}
                    onChange={(e) => {
                      setEditingQty({ productId: item.product.id, value: e.target.value })
                    }}
                    onBlur={() => {
                      if (qtyEditCancelledRef.current) {
                        qtyEditCancelledRef.current = false
                        setEditingQty(null)
                        return
                      }
                      if (editingQty?.productId === item.product.id) {
                        commitQuantityEdit(item.product.id, editingQty.value, item.product.unit)
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
                      onClick={() => applyScaleWeightToCartItem(item.product.id, item.product.unit)}
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
                      updateQuantity(item.product.id, item.quantity + 1)
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFromCart(item.product.id)}
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
              <div className="flex justify-between text-xs text-gray-500">
                <span>Rounded</span>
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
                  {estimatePointsEarned(loyaltySettings, getCartTotal() - getLoyaltyDiscount()) > 0 && (
                    <p className="text-[10px] text-amber-800">
                      Earn ~{estimatePointsEarned(loyaltySettings, getCartTotal() - getLoyaltyDiscount())} pts
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

          {/* Checkout Buttons */}
          {activeTab.cart.length > 0 && (
            <div className="p-2 border-t bg-gray-50 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-9 text-sm"
                onClick={() => handleCheckout(false)}
                disabled={!activeTab.selectedParty}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Checkout
              </Button>
              <Button
                className="h-9 text-sm"
                onClick={() => handleCheckout(true)}
                disabled={!activeTab.selectedParty}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Checkout & Print
              </Button>
            </div>
          )}
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

      <BarcodeScanner
        open={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        onScan={(code) => {
          handlePosItemCodeScan(code)
          setShowBarcodeScanner(false)
        }}
      />
    </div>
  )
}
