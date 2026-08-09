'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { limitDecimalInput, parseItemNumber, parseMoney, productSaleUnitPrice, productTaxRate, isProductGstEnabled } from '@/lib/numbers'
import { Plus, Trash2, Loader2, Save, Search, X, Edit2, Package, FileText, Gift, Scale, Printer } from 'lucide-react'
import BarcodeScannerInput from '@/components/ui/BarcodeScannerInput'
import { notifyError, notifySuccess } from '@/lib/notify'
import { fetchPrintSettings, printDocument } from '@/lib/printDocument'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { usePaymentMethodMappings } from '@/hooks/usePaymentMethodMappings'
import { computeLoyaltyDiscount, estimatePointsEarned } from '@/lib/loyalty'
import type { LoyaltySettings } from '@/lib/loyalty-types'
import InvoiceCustomFieldsForm, {
  type InvoiceCustomFieldDefinition,
  parseCustomFieldsFromInvoice,
} from '@/components/InvoiceCustomFieldsForm'
import { useWeighingScale } from '@/hooks/useWeighingScale'
import WeighingScalePanel from '@/components/WeighingScalePanel'
import { useFormKeyboardShortcuts } from '@/hooks/useFormKeyboardShortcuts'
import CreateProductDialog, { type CreatedProduct } from '@/components/CreateProductDialog'
import BulkCreateProductsDialog from '@/components/BulkCreateProductsDialog'
import { isWeightBasedUnit } from '@/lib/weighingScale'
import { looksLikeScaleBarcode, resolveScaleBarcodeForPos } from '@/lib/weighingScaleBarcode'
import { fetchProductBatches, formatBatchLabel, type ProductBatchStock } from '@/lib/productBatches'

interface Party {
  id: string
  name: string
  phone: string
  gstin: string
  state: string
  state_code: string
  party_type: string
  category?: string
  loyalty_points?: number
}

interface Product {
  id: string
  name: string
  sku: string
  item_code: string
  plu?: string
  hsn_code: string
  sale_price: number
  purchase_price: number
  tax_rate: number
  gst_enabled?: boolean
  unit: string
  stock_qty: number
  category: string
  sale_price_with_tax: boolean
  enable_batching?: boolean
}

interface InvoiceItem {
  product_id: string
  description: string
  hsn_code: string
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  unit: string
  cgst: number
  sgst: number
  igst: number
  total: number
  sale_price_with_tax: boolean
  batch_no: string
  exp_date: string
  enable_batching?: boolean
}

const ITEM_NUMBER_FIELDS: (keyof InvoiceItem)[] = [
  'quantity',
  'unit_price',
  'discount',
  'tax_rate',
  'cgst',
  'sgst',
  'igst',
  'total',
]

export default function CreateInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const { confirm, confirmDialog } = useConfirmDialog()
  const {
    fieldErrors,
    clearFieldError,
    setError,
    handleApiError,
    showErrorToast,
  } = useFormErrors()
  
  const [parties, setParties] = useState<Party[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [partyId, setPartyId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState(30)
  const [dueDate, setDueDate] = useState('')
  const [isInterState, setIsInterState] = useState(false)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [invoiceDiscount, setInvoiceDiscount] = useState(0)
  const [additionalCharges, setAdditionalCharges] = useState(0)
  const [autoRoundOff, setAutoRoundOff] = useState(true)
  const [amountPaid, setAmountPaid] = useState(0)
  const [paymentMode, setPaymentMode] = useState('cash')
  const { accounts: bankAccounts } = useBankAccounts()
  const { getDepositHint } = usePaymentMethodMappings()
  const [signature, setSignature] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([
    { product_id: '', description: '', hsn_code: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 18, unit: 'PCS', cgst: 0, sgst: 0, igst: 0, total: 0, sale_price_with_tax: false, batch_no: '', exp_date: '', enable_batching: false }
  ] as InvoiceItem[])
  const [lineBatches, setLineBatches] = useState<Record<number, ProductBatchStock[]>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [selectedLineIndices, setSelectedLineIndices] = useState<Set<number>>(new Set())
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [showBulkCreateProducts, setShowBulkCreateProducts] = useState(false)
  const [barcodeScannerEnabled, setBarcodeScannerEnabled] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showAddParty, setShowAddParty] = useState(false)
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; payload: string; is_default: boolean }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [pdfTemplate, setPdfTemplate] = useState('')
  const [customFieldDefs, setCustomFieldDefs] = useState<InvoiceCustomFieldDefinition[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean>>({})
  const [activeWeightLineIndex, setActiveWeightLineIndex] = useState<number | null>(null)
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
  const [partyFormData, setPartyFormData] = useState({
    name: '',
    phone: '',
    email: '',
    category: '',
    party_type: 'customer',
    opening_balance: 0,
    credit_limit: 0,
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    tan: '',
    pan: '',
    notes: ''
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevLoyaltyDiscountRef = useRef(0)
  const [isDrawing, setIsDrawing] = useState(false)

  const partyCategories = useMemo(
    () => Array.from(new Set(parties.map(p => p.category).filter(Boolean))) as string[],
    [parties]
  )

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (date && paymentTerms) {
      const due = new Date(date)
      due.setDate(due.getDate() + paymentTerms)
      setDueDate(due.toISOString().split('T')[0])
    }
  }, [date, paymentTerms])

  useEffect(() => {
    filterProducts()
  }, [productSearch, selectedCategory, products])

  useEffect(() => { if (showDraftsModal) fetchDrafts() }, [showDraftsModal])

  useEffect(() => {
    if (editId && products.length > 0) {
      fetchInvoiceData()
    }
  }, [editId, products.length])

  const fetchData = async () => {
    try {
      const [partiesRes, productsRes, numRes, loyaltyRes, templatesRes, fieldsRes, invoiceSettingsRes] = await Promise.all([
        apiFetch('/parties'),
        apiFetch('/products'),
        apiFetch('/invoices/next-number'),
        apiFetch('/loyalty/settings'),
        apiFetch('/invoice-templates'),
        apiFetch('/settings/invoice-custom-fields'),
        apiFetch('/settings/invoice'),
      ])
      if (partiesRes.ok) {
        const partyData = await partiesRes.json()
        setParties(partyData.filter((p: Party) => p.party_type === 'customer'))
      }
      if (productsRes.ok) {
        const productData = await productsRes.json()
        setProducts(productData)
        const cats = Array.from(new Set(productData.map((p: Product) => p.category).filter(Boolean))) as string[]
        setCategories(cats)
      }
      if (numRes.ok) {
        const numData = await numRes.json()
        setInvoiceNumber(numData.invoice_number)
      }
      if (loyaltyRes.ok) {
        setLoyaltySettings(await loyaltyRes.json())
      }
      if (templatesRes.ok) {
        const tpls = await templatesRes.json()
        setSavedTemplates(tpls)
        const def = tpls.find((t: { is_default: boolean }) => t.is_default)
        if (def && !editId) setSelectedTemplateId(def.id)
      }
      if (fieldsRes.ok) {
        setCustomFieldDefs(await fieldsRes.json())
      }
      if (invoiceSettingsRes.ok) {
        const s = await invoiceSettingsRes.json()
        setPdfTemplate(s.template || 'classic')
        if (!terms && s.default_terms) setTerms(s.default_terms)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = products
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }
    if (productSearch) {
      const search = productSearch.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.sku?.toLowerCase().includes(search) ||
        p.item_code?.toLowerCase().includes(search) ||
        p.hsn_code?.toLowerCase().includes(search)
      )
    }
    setFilteredProducts(filtered)
  }

  const selectedParty = parties.find(p => p.id === partyId)

  useEffect(() => {
    if (selectedParty) {
      const businessState = 'same' // In real app, compare with business state
      setIsInterState(selectedParty.state !== businessState && selectedParty.state !== '')
    }
    setLoyaltyPointsToRedeem(0)
    prevLoyaltyDiscountRef.current = 0
  }, [partyId, selectedParty])

  const buildInvoiceItemFromProduct = (product: Product, overrideQuantity?: number): InvoiceItem | null => {
    let quantity = overrideQuantity ?? 1
    if (
      overrideQuantity === undefined &&
      scaleSettings.enabled &&
      isWeightBasedUnit(product.unit) &&
      scaleSettings.auto_apply_on_invoice &&
      scaleConnectionStatus === 'connected'
    ) {
      const scaleQty = getQuantityForProduct(product.unit)
      if (scaleQty !== null) {
        quantity = scaleQty
      } else if (scaleSettings.require_stable_weight) {
        notifyError('Wait for a stable weight reading on the scale')
        return null
      }
    }

    return {
      product_id: product.id,
      description: product.name,
      hsn_code: product.hsn_code || '',
      quantity: parseItemNumber(quantity, 1),
      unit_price: productSaleUnitPrice(product),
      discount: 0,
      tax_rate: productTaxRate(product),
      unit: product.unit,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0,
      sale_price_with_tax: isProductGstEnabled(product) ? (product.sale_price_with_tax ?? false) : false,
      batch_no: '',
      exp_date: '',
      enable_batching: product.enable_batching ?? false,
    }
  }

  const applyTaxToInvoiceItem = (item: InvoiceItem, interState: boolean): InvoiceItem => {
    const qty = parseItemNumber(item.quantity)
    const price = parseMoney(item.unit_price)
    const disc = parseItemNumber(item.discount)
    const tax = parseItemNumber(item.tax_rate)
    const itemTotal = qty * price
    const itemDiscount = itemTotal * (disc / 100)
    const taxable = itemTotal - itemDiscount
    const itemTax = taxable * (tax / 100)
    const next = { ...item, quantity: qty, unit_price: price, discount: disc, tax_rate: tax }
    if (interState) {
      next.igst = itemTax
      next.cgst = 0
      next.sgst = 0
    } else {
      next.cgst = itemTax / 2
      next.sgst = itemTax / 2
      next.igst = 0
    }
    next.total = taxable + next.cgst + next.sgst + next.igst
    return next
  }

  const applyBatchDefaults = (product: Product, lineIndex: number) => {
    if (!product.enable_batching) return
    void (async () => {
      const batches = await fetchProductBatches(product.id)
      setItems((prev) => {
        if (!prev[lineIndex]) return prev
        setLineBatches((lb) => ({ ...lb, [lineIndex]: batches }))
        if (!batches.length) return prev
        const copy = [...prev]
        copy[lineIndex] = {
          ...copy[lineIndex],
          batch_no: batches[0].batch_no || '',
          exp_date: batches[0].exp_date ? String(batches[0].exp_date).slice(0, 10) : '',
          enable_batching: true,
        }
        return copy
      })
    })()
  }

  const addProductsToInvoice = (products: Product[], options?: { closeModal?: boolean }) => {
    if (products.length === 0) return

    const builtItems = products
      .map((product) => buildInvoiceItemFromProduct(product))
      .filter((item): item is InvoiceItem => item !== null)
    if (builtItems.length === 0) return

    let startIndex = 0
    setItems((prev) => {
      startIndex = prev.length
      return [...prev, ...builtItems.map((item) => applyTaxToInvoiceItem(item, isInterState))]
    })
    products.forEach((product, offset) => {
      if (product.enable_batching) {
        applyBatchDefaults(product, startIndex + offset)
      }
    })

    if (options?.closeModal !== false) {
      setShowProductModal(false)
      setProductSearch('')
      setSelectedProductIds(new Set())
    }
  }

  const addProductToInvoice = (product: Product, overrideQuantity?: number) => {
    const item = buildInvoiceItemFromProduct(product, overrideQuantity)
    if (!item) return

    let lineIndex = 0
    setItems((prev) => {
      lineIndex = prev.length
      return [...prev, applyTaxToInvoiceItem(item, isInterState)]
    })
    if (product.enable_batching) {
      applyBatchDefaults(product, lineIndex)
    }
    setShowProductModal(false)
    setProductSearch('')
    setSelectedProductIds(new Set())
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleSelectAllProducts = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set())
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)))
    }
  }

  const handleAddSelectedProducts = () => {
    const selected = filteredProducts.filter((p) => selectedProductIds.has(p.id))
    addProductsToInvoice(selected, { closeModal: true })
    if (selected.length > 1) {
      notifySuccess(`Added ${selected.length} items to invoice`)
    }
  }

  const openProductModal = () => {
    setSelectedProductIds(new Set())
    setShowProductModal(true)
  }

  const closeProductModal = () => {
    setShowProductModal(false)
    setSelectedProductIds(new Set())
  }

  const applyScaleWeightToInvoiceLine = (index: number, unit: string) => {
    const qty = getQuantityForProduct(unit)
    if (qty === null) {
      notifyError('No stable weight reading available')
      return
    }
    updateItem(index, 'quantity', qty)
    notifySuccess(`Applied weight: ${qty} ${unit}`)
  }

  const findProductsByItemCodeOrSku = (code: string) => {
    const normalized = code.trim()
    if (!normalized) return []
    return products.filter(
      p =>
        p.item_code?.trim() === normalized ||
        p.sku?.trim() === normalized
    )
  }

  const productFromStockMatch = (match: Record<string, unknown>): Product | undefined => {
    const id = String(match.product_id ?? '')
    const fromList = products.find(p => p.id === id)
    if (fromList) return fromList
    if (!id) return undefined
    return {
      id,
      name: String(match.product_name ?? ''),
      sku: String(match.sku ?? ''),
      item_code: String(match.item_code ?? ''),
      hsn_code: String(match.hsn_code ?? ''),
      sale_price: Number(match.sale_price ?? 0),
      purchase_price: Number(match.purchase_price ?? 0),
      tax_rate: Number(match.tax_rate ?? 18),
      gst_enabled: typeof match.gst_enabled === 'boolean' ? match.gst_enabled : Number(match.tax_rate ?? 0) > 0,
      unit: String(match.unit ?? 'PCS'),
      stock_qty: Number(match.stock_qty ?? match.quantity ?? 0),
      category: '',
      sale_price_with_tax: true,
    }
  }

  const handleItemCodeScan = async (rawScannedCode: string) => {
    const code = rawScannedCode.trim()
    if (!code) return

    const localMatches = findProductsByItemCodeOrSku(code)
    if (localMatches.length === 1) {
      addProductToInvoice(localMatches[0], 1)
      notifySuccess(`Added: ${localMatches[0].name}`)
      return
    }
    if (localMatches.length > 1) {
      setProductSearch(code)
      setShowProductModal(true)
      notifyError('Multiple products match. Please select the correct item.')
      return
    }

    if (scaleSettings.barcode_scan_enabled) {
      const scaleHit = resolveScaleBarcodeForPos(code, scaleSettings, products)
      if (scaleHit) {
        const product = products.find((p) => p.id === scaleHit.product.id)
        if (product) {
          addProductToInvoice(product, scaleHit.quantity)
          notifySuccess(`Added: ${product.name} · ${scaleHit.quantity} ${product.unit}`)
          return
        }
      }
      if (looksLikeScaleBarcode(code, scaleSettings)) {
        notifyError('Scale barcode recognized but no matching product PLU')
        return
      }
    }

    try {
      const res = await apiFetch(`/inventory/stocks/search?item_code=${encodeURIComponent(code)}`)
      if (res.ok) {
        const data = await res.json()
        const stockMatches: Record<string, unknown>[] = data.data || []
        if (stockMatches.length === 0) {
          notifyError('Product not found with this item code/SKU')
          return
        }
        if (stockMatches.length > 1) {
          setProductSearch(code)
          setShowProductModal(true)
          notifyError('Multiple products match. Please select the correct item.')
          return
        }
        const product = productFromStockMatch(stockMatches[0])
        if (product) {
          addProductToInvoice(product, 1)
          notifySuccess(`Added: ${product.name}`)
        } else {
          notifyError('Product not found with this item code/SKU')
        }
        return
      }
    } catch (err) {
      console.error(err)
    }

    notifyError('Product not found with this item code/SKU')
  }

  const startDrawing = (e: React.MouseEvent) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
      }
    }
  }

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        ctx.stroke()
      }
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      setSignature(canvas.toDataURL())
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    setSignature('')
  }

  const updateItem = (index: number, field: keyof InvoiceItem, value: unknown) => {
    if (field === 'description') clearFieldError('items')
    const newItems = [...items]
    if (field === 'unit_price') {
      // Keep at most 2 decimal places for unit price
      const limited = limitDecimalInput(String(value ?? ''), 2)
      newItems[index] = { ...newItems[index], unit_price: parseMoney(limited) }
    } else if (ITEM_NUMBER_FIELDS.includes(field)) {
      newItems[index] = { ...newItems[index], [field]: parseItemNumber(value) }
    } else {
      newItems[index] = { ...newItems[index], [field]: value as InvoiceItem[typeof field] }
    }

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].description = product.name
        newItems[index].unit_price = productSaleUnitPrice(product)
        newItems[index].tax_rate = productTaxRate(product)
        newItems[index].unit = product.unit
        newItems[index].sale_price_with_tax = isProductGstEnabled(product) ? (product.sale_price_with_tax ?? false) : false
      }
    }

    // Recalculate totals - always tax on top of unit_price
    const qty = parseItemNumber(newItems[index].quantity)
    const price = parseMoney(newItems[index].unit_price)
    const disc = parseItemNumber(newItems[index].discount)
    const tax = parseItemNumber(newItems[index].tax_rate)

    const itemTotal = qty * price
    const itemDiscount = itemTotal * (disc / 100)
    const taxable = itemTotal - itemDiscount
    const itemTax = taxable * (tax / 100)

    newItems[index].quantity = qty
    newItems[index].unit_price = price
    newItems[index].discount = disc
    newItems[index].tax_rate = tax

    if (isInterState) {
      newItems[index].igst = itemTax
      newItems[index].cgst = 0
      newItems[index].sgst = 0
    } else {
      newItems[index].cgst = itemTax / 2
      newItems[index].sgst = itemTax / 2
      newItems[index].igst = 0
    }
    newItems[index].total = taxable + newItems[index].cgst + newItems[index].sgst + newItems[index].igst

    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { product_id: '', description: '', hsn_code: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 18, unit: 'PCS', cgst: 0, sgst: 0, igst: 0, total: 0, sale_price_with_tax: false, batch_no: '', exp_date: '', enable_batching: false }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
      setSelectedLineIndices((prev) => {
        const next = new Set<number>()
        prev.forEach((i) => {
          if (i < index) next.add(i)
          else if (i > index) next.add(i - 1)
        })
        return next
      })
    }
  }

  const toggleLineItemSelection = (index: number) => {
    setSelectedLineIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleSelectAllLineItems = () => {
    if (selectedLineIndices.size === items.length) {
      setSelectedLineIndices(new Set())
    } else {
      setSelectedLineIndices(new Set(items.map((_, index) => index)))
    }
  }

  const removeSelectedLineItems = () => {
    if (selectedLineIndices.size === 0) return
    if (items.length - selectedLineIndices.size < 1) {
      notifyError('At least one line item is required')
      return
    }
    setItems(items.filter((_, index) => !selectedLineIndices.has(index)))
    setSelectedLineIndices(new Set())
  }

  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const discountTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.discount / 100)), 0)
  const cgstTotal = items.reduce((sum, item) => sum + item.cgst, 0)
  const sgstTotal = items.reduce((sum, item) => sum + item.sgst, 0)
  const igstTotal = items.reduce((sum, item) => sum + item.igst, 0)
  const taxTotal = cgstTotal + sgstTotal + igstTotal
  
  const preLoyaltyTotal = subTotal - discountTotal + taxTotal - invoiceDiscount + additionalCharges
  const { discount: loyaltyDiscount } = computeLoyaltyDiscount(
    loyaltySettings,
    selectedParty?.loyalty_points ?? 0,
    preLoyaltyTotal,
    loyaltyPointsToRedeem
  )
  const pointsToEarn = estimatePointsEarned(
    loyaltySettings,
    Math.max(0, preLoyaltyTotal - loyaltyDiscount)
  )

  let totalBeforeRound = preLoyaltyTotal - loyaltyDiscount
  let roundOff = 0
  if (autoRoundOff) {
    const rounded = Math.round(totalBeforeRound)
    roundOff = rounded - totalBeforeRound
    totalBeforeRound = rounded
  }
  const totalAmount = totalBeforeRound
  const balance = totalAmount - amountPaid

  const applyLoyaltyRedemptionChange = (nextPoints: number) => {
    const { discount: nextDiscount } = computeLoyaltyDiscount(
      loyaltySettings,
      selectedParty?.loyalty_points ?? 0,
      preLoyaltyTotal,
      nextPoints
    )
    const prevDiscount = prevLoyaltyDiscountRef.current
    const delta = nextDiscount - prevDiscount
    prevLoyaltyDiscountRef.current = nextDiscount
    setLoyaltyPointsToRedeem(nextPoints)
    if (delta === 0) return

    let payableAfter = preLoyaltyTotal - nextDiscount
    if (autoRoundOff) {
      payableAfter = Math.round(payableAfter)
    }

    setAmountPaid((prev) => {
      const wasFullPay = prev + 0.01 >= preLoyaltyTotal - prevDiscount
      if (wasFullPay) {
        return Math.max(0, payableAfter)
      }
      return Math.max(0, Math.min(prev, payableAfter))
    })
  }

  const applySavedTemplate = (templateId: string) => {
    const tpl = savedTemplates.find((t) => t.id === templateId)
    if (!tpl) return
    try {
      const data = JSON.parse(tpl.payload)
      if (data.payment_terms != null) setPaymentTerms(Number(data.payment_terms))
      if (data.notes != null) setNotes(String(data.notes))
      if (data.terms != null) setTerms(String(data.terms))
      if (data.invoice_discount != null) setInvoiceDiscount(Number(data.invoice_discount))
      if (data.additional_charges != null) setAdditionalCharges(Number(data.additional_charges))
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((item: InvoiceItem) => ({
            product_id: item.product_id || '',
            description: item.description || '',
            hsn_code: item.hsn_code || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            discount: item.discount || 0,
            tax_rate: item.tax_rate ?? 18,
            unit: item.unit || 'PCS',
            cgst: item.cgst || 0,
            sgst: item.sgst || 0,
            igst: item.igst || 0,
            total: item.total || 0,
            sale_price_with_tax: item.sale_price_with_tax ?? false,
          }))
        )
      }
      notifySuccess(`Applied template "${tpl.name}"`)
    } catch {
      notifyError('Template payload is invalid JSON')
    }
  }

  const fetchInvoiceData = async () => {
    try {
      setLoading(true)
      const res = await apiFetch(`/invoices/${editId}`)
      if (res.ok) {
        const invoice = await res.json()
        setInvoiceNumber(invoice.invoice_number || '')
        setPartyId(invoice.party_id || invoice.customer_id || '')
        setDate(invoice.date?.split('T')[0] || new Date().toISOString().split('T')[0])
        setPaymentTerms(invoice.payment_terms || 30)
        setDueDate(invoice.due_date?.split('T')[0] || '')
        setIsInterState(invoice.is_inter_state || false)
        setNotes(invoice.notes || '')
        setTerms(invoice.terms || '')
        setInvoiceDiscount(invoice.invoice_discount || 0)
        setAdditionalCharges(invoice.additional_charges || 0)
        setAmountPaid(invoice.amount_paid || 0)
        setPaymentMode(invoice.payment_mode || 'cash')
        setSignature(invoice.signature || '')
        setPdfTemplate(invoice.pdf_template || pdfTemplate)
        setCustomFieldValues(parseCustomFieldsFromInvoice(invoice.custom_fields))
        setItems(
          (invoice.items || []).map((item: any) => {
            const prod = products.find((p: Product) => p.id === item.product_id)
            return {
              product_id: item.product_id || '',
              description: item.description || '',
              hsn_code: item.hsn_code || '',
              quantity: item.quantity || 0,
              unit_price: item.unit_price || 0,
              discount: item.discount || 0,
              tax_rate: item.tax_rate || 0,
              unit: item.unit || 'PCS',
              cgst: item.cgst || 0,
              sgst: item.sgst || 0,
              igst: item.igst || 0,
              total: item.total || 0,
              sale_price_with_tax: prod?.sale_price_with_tax ?? false,
            }
          })
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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
      console.warn('Invoice print failed:', printErr)
      notifyError('Invoice saved, but print/PDF failed. Check Print Settings.')
    }
  }

  const saveInvoice = async (shouldPrint = false) => {
    if (!partyId) {
      setError('party_id', 'Please select a party')
      showErrorToast('Please select a party')
      return
    }
    if (items.some(i => !i.description)) {
      setError('items', 'Please fill all item details')
      showErrorToast('Please fill all item details')
      return
    }
    setSaving(true)
    try {
      const url = editId ? `/invoices/${editId}` : '/invoices'
      const method = editId ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          invoice_number: invoiceNumber,
          party_id: partyId,
          customer_id: partyId,
          date: new Date(date).toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          payment_terms: Number(paymentTerms) || 0,
          status: amountPaid >= totalAmount ? 'paid' : 'sent',
          is_inter_state: isInterState,
          payment_mode: paymentMode,
          amount_paid: parseMoney(Math.min(amountPaid, totalAmount)),
          notes,
          terms,
          invoice_discount: parseMoney(invoiceDiscount),
          additional_charges: parseMoney(additionalCharges),
          ...( !editId && loyaltyPointsToRedeem > 0
            ? { loyalty_points_redeemed: loyaltyPointsToRedeem }
            : {}),
          items: items.map(item => ({
            product_id: item.product_id || undefined,
            description: item.description,
            hsn_code: item.hsn_code,
            quantity: Number(parseItemNumber(item.quantity, 1)),
            unit_price: parseMoney(item.unit_price),
            discount: parseItemNumber(item.discount),
            tax_rate: parseItemNumber(item.tax_rate),
            unit: item.unit,
            batch_no: item.batch_no || '',
            exp_date: item.exp_date || null,
          })),
          custom_fields: customFieldValues,
          pdf_template: pdfTemplate,
        })
      })
      if (res.ok) {
        const saved = await res.json().catch(() => null)
        const invoiceId = (saved?.id || editId) as string | undefined
        notifySuccess(editId ? 'Invoice updated successfully' : 'Invoice saved successfully')
        if (shouldPrint && invoiceId) {
          await printInvoice(invoiceId)
        }
        router.push('/invoices')
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      showErrorToast('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveInvoice(false)
  }

  useFormKeyboardShortcuts({
    onSave: () => saveInvoice(false),
    onCancel: () => router.push('/invoices'),
  })

  const fetchDrafts = async () => {
    try {
      setLoadingDraft(true)
      const res = await apiFetch('/drafts?entity_type=invoice')
      if (res.ok) {
        const d = await res.json()
        setDrafts(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [])
      }
    } catch (err) { console.error(err) }
    finally { setLoadingDraft(false) }
  }

  const handleSaveDraft = async () => {
    try {
      const title = `Invoice - ${parties.find(p => p.id === partyId)?.name || 'Untitled'}`
      const formData = {
        invoiceNumber, partyId, date, paymentTerms, dueDate, isInterState,
        notes, terms, invoiceDiscount, additionalCharges, autoRoundOff,
        amountPaid, paymentMode, signature, items
      }
      const res = await apiFetch('/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'invoice',
          title: title,
          data: JSON.stringify(formData)
        })
      })
      if (res.ok) {
        notifySuccess('Draft saved successfully')
      }
    } catch (err) { console.error(err) }
  }

  const handleLoadDraft = async (draftId: string) => {
    try {
      const res = await apiFetch(`/drafts/${draftId}`)
      if (res.ok) {
        const d = await res.json()
        const draftData = JSON.parse(d.data)
        setInvoiceNumber(draftData.invoiceNumber || '')
        setPartyId(draftData.partyId || '')
        setDate(draftData.date || new Date().toISOString().split('T')[0])
        setPaymentTerms(draftData.paymentTerms || 30)
        setDueDate(draftData.dueDate || '')
        setIsInterState(draftData.isInterState || false)
        setNotes(draftData.notes || '')
        setTerms(draftData.terms || '')
        setInvoiceDiscount(draftData.invoiceDiscount || 0)
        setAdditionalCharges(draftData.additionalCharges || 0)
        setAutoRoundOff(draftData.autoRoundOff !== undefined ? draftData.autoRoundOff : true)
        setAmountPaid(draftData.amountPaid || 0)
        setPaymentMode(draftData.paymentMode || 'cash')
        setSignature(draftData.signature || '')
        setItems(draftData.items || [])
        setShowDraftsModal(false)
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteDraft = async (draftId: string) => {
    if (!(await confirm({
      title: 'Delete draft?',
      description: 'Are you sure you want to delete this draft? This action cannot be undone.',
    }))) return
    try {
      await apiFetch(`/drafts/${draftId}`, { method: 'DELETE' })
      fetchDrafts()
    } catch (err) { console.error(err) }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Create Sales Invoice</h1>
          <Button variant="outline" onClick={() => router.push('/invoices')}>Cancel</Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-1">
                <Label>Party *</Label>
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={partyId}
                    onChange={(e) => {
                      clearFieldError('party_id')
                      setPartyId(e.target.value)
                    }}
                    className={cn(
                      'flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm',
                      fieldErrors.party_id && 'border-red-500'
                    )}
                    required
                  >
                    <option value="">Select Party</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowAddParty(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <FieldError message={fieldErrors.party_id} />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Payment Term (Days)</Label>
                <Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(Number(e.target.value))} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              {savedTemplates.length > 0 && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Apply template</Label>
                  <div className="flex gap-2">
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a saved template" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selectedTemplateId}
                      onClick={() => applySavedTemplate(selectedTemplateId)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>PDF layout</Label>
                <Select value={pdfTemplate} onValueChange={setPdfTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {customFieldDefs.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <InvoiceCustomFieldsForm
                  definitions={customFieldDefs}
                  values={customFieldValues}
                  onChange={(key, val) => setCustomFieldValues((p) => ({ ...p, [key]: val }))}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openProductModal}>
                    <Package className="mr-2 h-4 w-4" /> Add Item to Bill
                  </Button>
                  <BarcodeScannerInput
                    showToggle
                    enabled={barcodeScannerEnabled}
                    onEnabledChange={setBarcodeScannerEnabled}
                    onScan={handleItemCodeScan}
                    placeholder={
                      scaleSettings.barcode_scan_enabled
                        ? 'Scan scale or product barcode…'
                        : 'Scan product barcode…'
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <WeighingScalePanel
                enabled={scaleSettings.enabled}
                connectionStatus={scaleConnectionStatus}
                currentWeightKg={currentWeightKg}
                isStable={scaleStable}
                lastError={scaleError}
                onConnect={connectScale}
                onDisconnect={disconnectScale}
                onApplyWeight={() => {
                  if (activeWeightLineIndex === null) {
                    notifyError('Select a KG/GM line item first')
                    return
                  }
                  applyScaleWeightToInvoiceLine(activeWeightLineIndex, items[activeWeightLineIndex].unit)
                }}
                applyDisabled={
                  activeWeightLineIndex === null ||
                  !isWeightBasedUnit(items[activeWeightLineIndex]?.unit)
                }
              />
              <FieldError message={fieldErrors.items} />
              {selectedLineIndices.size > 0 && (
                <div className="flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-600">{selectedLineIndices.size} line item(s) selected</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto text-red-600 hover:bg-red-50"
                    onClick={removeSelectedLineItems}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove Selected
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[4%]" />
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[4%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-2">
                        <Checkbox
                          checked={items.length > 0 && selectedLineIndices.size === items.length}
                          onCheckedChange={toggleSelectAllLineItems}
                          aria-label="Select all line items"
                        />
                      </th>
                      <th className="pb-2 pr-2 font-medium">Item</th>
                      <th className="pb-2 px-1 font-medium">HSN</th>
                      <th className="pb-2 px-1 font-medium text-right">Quantity</th>
                      <th className="pb-2 px-1 font-medium text-right">Unit Price</th>
                      <th className="pb-2 px-1 font-medium text-right">Discount %</th>
                      <th className="pb-2 px-1 font-medium text-right">Tax %</th>
                      <th className="pb-2 px-1 font-medium text-right">Amount</th>
                      <th className="pb-2 pl-1 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 pr-2">
                          <Checkbox
                            checked={selectedLineIndices.has(index)}
                            onCheckedChange={() => toggleLineItemSelection(index)}
                            aria-label={`Select line item ${index + 1}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="h-8 w-full"
                            required
                          />
                          {(item.enable_batching ||
                            products.find((p) => p.id === item.product_id)?.enable_batching) && (
                            <select
                              value={item.batch_no}
                              onChange={(e) => {
                                const batches = lineBatches[index] || []
                                const selected = batches.find((b) => b.batch_no === e.target.value)
                                const next = [...items]
                                next[index] = {
                                  ...next[index],
                                  batch_no: e.target.value,
                                  exp_date: selected?.exp_date
                                    ? String(selected.exp_date).slice(0, 10)
                                    : '',
                                }
                                setItems(next)
                              }}
                              onFocus={() => {
                                if (item.product_id && !lineBatches[index]) {
                                  void fetchProductBatches(item.product_id).then((batches) => {
                                    setLineBatches((lb) => ({ ...lb, [index]: batches }))
                                  })
                                }
                              }}
                              className="mt-1 flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="">Select batch (FEFO)</option>
                              {(lineBatches[index] || []).map((b) => (
                                <option key={`${b.id}-${b.batch_no}`} value={b.batch_no}>
                                  {formatBatchLabel(b)}
                                </option>
                              ))}
                              {item.batch_no &&
                                !(lineBatches[index] || []).some((b) => b.batch_no === item.batch_no) && (
                                  <option value={item.batch_no}>{item.batch_no}</option>
                                )}
                            </select>
                          )}
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            value={item.hsn_code}
                            onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                            className="h-8 w-full"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              onFocus={() => setActiveWeightLineIndex(index)}
                              className="h-8 w-full min-w-0 text-right"
                              required
                            />
                            {isWeightBasedUnit(item.unit) && scaleSettings.enabled && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 shrink-0 p-0"
                                title="Apply scale weight"
                                onClick={() => applyScaleWeightToInvoiceLine(index, item.unit)}
                              >
                                <Scale className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', limitDecimalInput(e.target.value, 2))}
                            onBlur={() => updateItem(index, 'unit_price', parseMoney(item.unit_price))}
                            className="h-8 w-full text-right"
                            required
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount}
                            onChange={(e) => updateItem(index, 'discount', e.target.value)}
                            className="h-8 w-full text-right"
                          />
                        </td>
                        <td className="py-2 px-1">
                          <Input
                            type="number"
                            value={item.tax_rate}
                            onChange={(e) => updateItem(index, 'tax_rate', e.target.value)}
                            className="h-8 w-full text-right"
                            required
                          />
                        </td>
                        <td className="py-2 px-1 text-right font-medium">{formatCurrency(item.total)}</td>
                        <td className="py-2 pl-1">
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 space-y-4">
              <CardHeader>
                <CardTitle>Additional Charges & Discount</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Additional Charges</Label>
                  <Input type="number" min="0" step="0.01" value={additionalCharges} onChange={(e) => setAdditionalCharges(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Discount</Label>
                  <Input type="number" min="0" step="0.01" value={invoiceDiscount} onChange={(e) => setInvoiceDiscount(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Auto Round Off</Label>
                  <select
                    value={autoRoundOff ? 'true' : 'false'}
                    onChange={(e) => setAutoRoundOff(e.target.value === 'true')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </CardContent>

              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount Received</Label>
                  <Input type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Amount received is credited to: {getDepositHint(paymentMode, bankAccounts)}
                    {' '}(configure under Cash &amp; Bank → Payment method accounts)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Balance</Label>
                  <Input value={formatCurrency(balance)} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Mark as Fully Paid</Label>
                  <Button
                    type="button"
                    variant={amountPaid >= totalAmount ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setAmountPaid(totalAmount)}
                  >
                    {amountPaid >= totalAmount ? 'Fully Paid' : 'Mark Fully Paid'}
                  </Button>
                </div>
              </CardContent>

              <CardHeader>
                <CardTitle>Signature</CardTitle>
              </CardHeader>
              <CardContent>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="border rounded cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={clearSignature}>Clear</Button>
                </div>
              </CardContent>

              <CardHeader>
                <CardTitle>Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Additional notes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Terms & Conditions</Label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Terms and conditions..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taxable Amount</span>
                  <span className="font-medium">{formatCurrency(subTotal - discountTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Item Discount</span>
                  <span className="font-medium text-red-600">-{formatCurrency(discountTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Invoice Discount</span>
                  <span className="font-medium text-red-600">-{formatCurrency(invoiceDiscount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Additional Charges</span>
                  <span className="font-medium">{formatCurrency(additionalCharges)}</span>
                </div>
                {!editId && loyaltySettings?.is_enabled && selectedParty && (
                  <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                      <Gift className="h-4 w-4" />
                      Loyalty — {(selectedParty.loyalty_points ?? 0).toLocaleString()} pts available
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={selectedParty.loyalty_points ?? 0}
                        placeholder="Points to redeem"
                        value={loyaltyPointsToRedeem || ''}
                        onChange={(e) =>
                          applyLoyaltyRedemptionChange(parseInt(e.target.value, 10) || 0)
                        }
                        className="h-8 bg-white"
                      />
                    </div>
                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Loyalty discount</span>
                        <span className="font-medium text-green-600">-{formatCurrency(loyaltyDiscount)}</span>
                      </div>
                    )}
                    {pointsToEarn > 0 && (
                      <p className="text-xs text-amber-800">Earn ~{pointsToEarn} points on this bill</p>
                    )}
                  </div>
                )}
                {isInterState ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IGST</span>
                    <span className="font-medium">{formatCurrency(igstTotal)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">CGST</span>
                      <span className="font-medium">{formatCurrency(cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">SGST</span>
                      <span className="font-medium">{formatCurrency(sgstTotal)}</span>
                    </div>
                  </>
                )}
                {autoRoundOff && roundOff !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Round Off</span>
                    <span className="font-medium">{formatCurrency(roundOff)}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Amount</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Invoice
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={saving}
                    onClick={() => saveInvoice(true)}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Save & Print / PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>

        {/* Product Selection Modal */}
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="max-h-[80vh] w-full max-w-4xl overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Product</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={closeProductModal}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {selectedProductIds.size > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedProductIds.size} selected</span>
                    <Button type="button" size="sm" className="ml-auto" onClick={handleAddSelectedProducts}>
                      Add Selected ({selectedProductIds.size})
                    </Button>
                  </div>
                )}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search by name, SKU, item code, HSN..."
                      className="pl-10"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 pr-2">
                          <Checkbox
                            checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                            onCheckedChange={toggleSelectAllProducts}
                            aria-label="Select all products"
                          />
                        </th>
                        <th className="pb-2 font-medium">Item Name</th>
                        <th className="pb-2 font-medium">Item Code/SKU</th>
                        <th className="pb-2 font-medium text-right">Stock</th>
                        <th className="pb-2 font-medium text-right">Sale Price</th>
                        <th className="pb-2 font-medium text-right">Purchase Price</th>
                        <th className="pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 pr-2">
                            <Checkbox
                              checked={selectedProductIds.has(product.id)}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                              aria-label={`Select ${product.name}`}
                            />
                          </td>
                          <td className="py-2 font-medium">{product.name}</td>
                          <td className="py-2 text-gray-600">{product.sku || product.item_code || '-'}</td>
                          <td className="py-2 text-right">{product.stock_qty} {product.unit}</td>
                          <td className="py-2 text-right">{formatCurrency(product.sale_price)}</td>
                          <td className="py-2 text-right text-gray-500">{formatCurrency(product.purchase_price)}</td>
                          <td className="py-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => addProductToInvoice(product)}
                            >
                              Add
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500">
                            No products found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowProductModal(false)
                      setShowBulkCreateProducts(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Bulk Create
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowProductModal(false)
                      setShowCreateProduct(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Create New Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <CreateProductDialog
          open={showCreateProduct}
          onOpenChange={setShowCreateProduct}
          showDraftButton={false}
          onCreated={(created: CreatedProduct) => {
            const product: Product = {
              id: created.id,
              name: created.name,
              sku: created.sku,
              item_code: created.item_code,
              hsn_code: created.hsn_code,
              sale_price: created.sale_price,
              purchase_price: created.purchase_price,
              tax_rate: created.tax_rate,
              unit: created.unit,
              stock_qty: created.stock_qty,
              category: created.category,
              sale_price_with_tax: created.sale_price_with_tax,
              enable_batching: created.enable_batching ?? false,
            }
            setProducts((prev) => [product, ...prev.filter((p) => p.id !== product.id)])
            if (created.category && !categories.includes(created.category)) {
              setCategories((prev) => [...prev, created.category].sort())
            }
            addProductToInvoice(product)
          }}
        />

        <BulkCreateProductsDialog
          open={showBulkCreateProducts}
          onOpenChange={setShowBulkCreateProducts}
          onCreated={(createdList) => {
            if (createdList.length === 0) {
              // File import — refresh product catalog
              void (async () => {
                try {
                  const res = await apiFetch('/products')
                  if (res.ok) {
                    const data = await res.json()
                    setProducts(Array.isArray(data) ? data : data.products || [])
                  }
                } catch {
                  /* ignore */
                }
              })()
              return
            }
            const mapped: Product[] = createdList.map((created) => ({
              id: created.id,
              name: created.name,
              sku: created.sku,
              item_code: created.item_code,
              hsn_code: created.hsn_code,
              sale_price: created.sale_price,
              purchase_price: created.purchase_price,
              tax_rate: created.tax_rate,
              unit: created.unit,
              stock_qty: created.stock_qty,
              category: created.category,
              sale_price_with_tax: created.sale_price_with_tax,
              enable_batching: created.enable_batching ?? false,
            }))
            setProducts((prev) => {
              const next = [...mapped]
              for (const p of prev) {
                if (!next.some((n) => n.id === p.id)) next.push(p)
              }
              return next
            })
            setCategories((prev) => {
              const next = new Set(prev)
              for (const created of createdList) {
                if (created.category) next.add(created.category)
              }
              return Array.from(next).sort()
            })
            for (const product of mapped) {
              addProductToInvoice(product)
            }
          }}
        />

        {/* Add Party Modal */}
        {showAddParty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Create New Customer</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowAddParty(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_party_name">Name *</Label>
                      <Input 
                        id="new_party_name" 
                        value={partyFormData.name} 
                        onChange={e => {
                          clearFieldError('name')
                          setPartyFormData({ ...partyFormData, name: e.target.value })
                        }}
                        className={cn(fieldErrors.name && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.name} />
                    </div>
                    <div>
                      <Label htmlFor="new_party_phone">Mobile</Label>
                      <Input 
                        id="new_party_phone" 
                        value={partyFormData.phone} 
                        onChange={e => setPartyFormData({ ...partyFormData, phone: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_party_email">Email</Label>
                      <Input 
                        id="new_party_email" 
                        type="email" 
                        value={partyFormData.email} 
                        onChange={e => setPartyFormData({ ...partyFormData, email: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_party_category">Category</Label>
                      <Select
                        value={partyFormData.category || undefined}
                        onValueChange={v => setPartyFormData({ ...partyFormData, category: v })}
                      >
                        <SelectTrigger id="new_party_category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {partyCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new_party_gstin">GSTIN</Label>
                    <Input 
                      id="new_party_gstin" 
                      value={partyFormData.gstin} 
                      onChange={e => setPartyFormData({ ...partyFormData, gstin: e.target.value })} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_party_address">Address</Label>
                    <Input 
                      id="new_party_address" 
                      value={partyFormData.address} 
                      onChange={e => setPartyFormData({ ...partyFormData, address: e.target.value })} 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="new_party_city">City</Label>
                      <Input 
                        id="new_party_city" 
                        value={partyFormData.city} 
                        onChange={e => setPartyFormData({ ...partyFormData, city: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_party_state">State</Label>
                      <Input 
                        id="new_party_state" 
                        value={partyFormData.state} 
                        onChange={e => setPartyFormData({ ...partyFormData, state: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_party_pincode">Pincode</Label>
                      <Input 
                        id="new_party_pincode" 
                        value={partyFormData.pincode} 
                        onChange={e => setPartyFormData({ ...partyFormData, pincode: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_party_opening_balance">Opening Balance</Label>
                      <Input 
                        id="new_party_opening_balance" 
                        type="number" 
                        value={partyFormData.opening_balance} 
                        onChange={e => setPartyFormData({ ...partyFormData, opening_balance: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_party_credit_limit">Credit Limit</Label>
                      <Input 
                        id="new_party_credit_limit" 
                        type="number" 
                        value={partyFormData.credit_limit} 
                        onChange={e => setPartyFormData({ ...partyFormData, credit_limit: parseFloat(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAddParty(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    className="flex-1"
                    onClick={async () => {
                      if (!partyFormData.name) {
                        setError('name', 'Name is required')
                        showErrorToast('Name is required')
                        return
                      }
                      try {
                        const res = await apiFetch('/parties', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            ...partyFormData,
                            party_type: 'customer'
                          })
                        })
                        if (res.ok) {
                          const newParty = await res.json()
                          setParties([...parties, newParty])
                          setPartyId(newParty.id)
                          setPartyFormData({
                            name: '', phone: '', email: '', category: '', party_type: 'customer',
                            opening_balance: 0, credit_limit: 0, gstin: '', address: '', city: '',
                            state: '', pincode: '', tan: '', pan: '', notes: ''
                          })
                          setShowAddParty(false)
                        } else {
                          await handleApiError(res)
                        }
                      } catch (err) {
                        showErrorToast('An error occurred')
                      }
                    }}
                  >
                    Create Customer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
