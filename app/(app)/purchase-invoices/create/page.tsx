'use client'

import { useEffect, useState, useRef, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton, { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import PageHeader from '@/components/layout/PageHeader'
import PageActionBar from '@/components/layout/PageActionBar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, asArray } from '@/lib/utils'
import { DEFAULT_CATEGORY_NAME, pickDefaultCategoryName } from '@/lib/defaultCategories'
import { isDefaultVendorName, pickDefaultVendor, DEFAULT_VENDOR_NAME } from '@/lib/defaultVendor'
import { exclusiveUnitPrice, limitDecimalInput, parseItemNumber, parseMoney, productPurchaseUnitPrice, productTaxRate, isProductGstEnabled } from '@/lib/numbers'
import BarcodeScannerInput, { type BarcodeScannerInputHandle } from '@/components/ui/BarcodeScannerInput'
import CreateProductDialog, { type CreatedProduct } from '@/components/CreateProductDialog'
import BulkCreateProductsDialog from '@/components/BulkCreateProductsDialog'
import NewPurchaseItemForm, {
  emptyNewProductDraft,
  type NewProductDraft,
  type NewPurchaseLineItem,
} from '@/components/NewPurchaseItemForm'
import { Plus, Trash2, Loader2, Save, Search, Package, X, Camera, Copy, ChevronRight, ChevronDown, Clock } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ProductCombobox } from '@/components/ui/ProductCombobox'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { usePaymentMethodMappings } from '@/hooks/usePaymentMethodMappings'
import { PAYMENT_METHODS } from '@/lib/paymentSplits'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import ItemsEmptyState, { type PastedItemRow } from '@/components/ItemsEmptyState'

interface Vendor {
  id: string
  name: string
  phone: string
  gstin: string
  address: string
  city: string
  state: string
}

interface Product {
  id: string
  name: string
  sku: string
  item_code: string
  hsn_code: string
  purchase_price: number
  sale_price: number
  mrp: number
  tax_rate: number
  gst_enabled?: boolean
  unit: string
  stock_qty: number
  category: string
  purchase_price_with_tax: boolean
  enable_batching?: boolean
}

interface Warehouse {
  id: string
  name: string
  code?: string
  is_default?: boolean
}

interface RecentVendorProduct {
  product_id: string
  description: string
  item_code: string
  hsn_code: string
  unit: string
  unit_price: number
  quantity: number
  tax_rate: number
  discount: number
  mrp: number
  sale_price: number
  frequency: number
  last_date: string
}

interface PurchaseBillItem {
  product_id: string
  item_code: string
  description: string
  hsn_code: string
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  mrp: number
  sale_price: number
  unit: string
  tax_amount: number
  total: number
  purchase_price_with_tax: boolean
  batch_no: string
  mfg_date: string
  exp_date: string
  enable_batching?: boolean
}

const ITEM_NUMBER_FIELDS: (keyof PurchaseBillItem)[] = [
  'quantity',
  'unit_price',
  'discount',
  'tax_rate',
  'mrp',
  'sale_price',
  'tax_amount',
  'total',
]

function remapIndexSet(prev: Set<number>, mapIndex: (i: number) => number | null): Set<number> {
  const next = new Set<number>()
  prev.forEach((i) => {
    const mapped = mapIndex(i)
    if (mapped !== null) next.add(mapped)
  })
  return next
}

function remapIndexRecord<T>(prev: Record<number, T>, mapIndex: (i: number) => number | null): Record<number, T> {
  const next: Record<number, T> = {}
  Object.entries(prev).forEach(([key, val]) => {
    const mapped = mapIndex(Number(key))
    if (mapped !== null) next[mapped] = val
  })
  return next
}

export default function CreatePurchaseInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const {
    fieldErrors,
    clearFieldError,
    setError,
    handleApiError,
    showErrorToast,
    showSuccessToast,
  } = useFormErrors()
  
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [billNumber, setBillNumber] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentTerms, setPaymentTerms] = useState(30)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [additionalCharges, setAdditionalCharges] = useState(0)
  const [invoiceDiscount, setInvoiceDiscount] = useState(0)
  const [taxExempt, setTaxExempt] = useState(true)
  const [autoRoundOff, setAutoRoundOff] = useState(true)
  const [amountPaid, setAmountPaid] = useState(0)
  const [amountPaidEdited, setAmountPaidEdited] = useState(false)
  const [paidFrom, setPaidFrom] = useState('cash')
  const { accounts: bankAccounts } = useBankAccounts()
  const { getDepositHint } = usePaymentMethodMappings()
  const [signature, setSignature] = useState('')
  const [items, setItems] = useState<PurchaseBillItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [productAddQuantities, setProductAddQuantities] = useState<Record<string, string>>({})
  const [selectedLineIndices, setSelectedLineIndices] = useState<Set<number>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [showBulkCreateProducts, setShowBulkCreateProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    opening_balance: 0
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barcodeScannerRef = useRef<BarcodeScannerInputHandle>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [matchingProducts, setMatchingProducts] = useState<Product[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [savedBillId, setSavedBillId] = useState<string | null>(editId)
  const [billStatus, setBillStatus] = useState<string>(editId ? '' : 'draft')
  const [autosaveEnabled, setAutosaveEnabled] = useState(!editId)
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'need_vendor'>('idle')
  const [draftSaveError, setDraftSaveError] = useState('')
  const [draftSaveTick, setDraftSaveTick] = useState(0)
  const [recentVendorProducts, setRecentVendorProducts] = useState<RecentVendorProduct[]>([])
  const [recentProductsLoading, setRecentProductsLoading] = useState(false)
  const [showRecentProducts, setShowRecentProducts] = useState(true)
  const [newProductRows, setNewProductRows] = useState<Set<number>>(new Set())
  const [newProductExtras, setNewProductExtras] = useState<Record<number, NewProductDraft>>({})
  const [creatingProducts, setCreatingProducts] = useState(false)
  const draftAutosaveInFlightRef = useRef(false)
  const draftAutosaveQueuedRef = useRef(false)
  const skipNextBillFetchRef = useRef(false)
  const formHydratedRef = useRef(!editId)
  const suppressAutosaveRef = useRef(false)
  const persistDraftRef = useRef<() => Promise<void>>(async () => {})
  /** Line tax rates captured before Exempt Tax is turned on, so turning it off restores them. */
  const preExemptTaxRatesRef = useRef<number[] | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Listen for bottom menubar action buttons (purchase invoice create page only)
  useEffect(() => {
    const handleAddItem = () => openProductModal()
    const handleAddRow = () => addItem()
    const handleScanBarcode = () => barcodeScannerRef.current?.focus()
    const handleRemoveSelected = () => removeSelectedLineItems()
    window.addEventListener('pi-action:add-item', handleAddItem)
    window.addEventListener('pi-action:add-row', handleAddRow)
    window.addEventListener('pi-action:scan-barcode', handleScanBarcode)
    window.addEventListener('pi-action:remove-selected', handleRemoveSelected)
    return () => {
      window.removeEventListener('pi-action:add-item', handleAddItem)
      window.removeEventListener('pi-action:add-row', handleAddRow)
      window.removeEventListener('pi-action:scan-barcode', handleScanBarcode)
      window.removeEventListener('pi-action:remove-selected', handleRemoveSelected)
    }
  }, [items, selectedLineIndices])

  // Notify bottom menubar of selection changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pi-action:selection-changed', { detail: selectedLineIndices.size }))
  }, [selectedLineIndices])

  useEffect(() => {
    if (!vendorId) {
      setRecentVendorProducts([])
      return
    }
    let cancelled = false
    setRecentProductsLoading(true)
    apiFetch(`/purchase/bills/vendor/${vendorId}/recent-products`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RecentVendorProduct[]) => {
        if (!cancelled) setRecentVendorProducts(Array.isArray(data) ? data : [])
      })
      .catch(() => { if (!cancelled) setRecentVendorProducts([]) })
      .finally(() => { if (!cancelled) setRecentProductsLoading(false) })
    return () => { cancelled = true }
  }, [vendorId])

  useEffect(() => {
    if (billDate && paymentTerms) {
      const due = new Date(billDate)
      due.setDate(due.getDate() + paymentTerms)
      setDueDate(due.toISOString().split('T')[0])
    }
  }, [billDate, paymentTerms])

  useEffect(() => {
    filterProducts()
  }, [productSearch, selectedCategory, products])

  useEffect(() => {
    if (editId) {
      setSavedBillId(editId)
    }
  }, [editId])

  useEffect(() => {
    if (editId && products.length > 0) {
      if (skipNextBillFetchRef.current) {
        skipNextBillFetchRef.current = false
        formHydratedRef.current = true
        return
      }
      fetchBillData()
    }
  }, [editId, products.length])

  useEffect(() => {
    if (editId) return
    const parsedData = sessionStorage.getItem('parsedInvoiceData')
    if (!parsedData) return

    try {
      const data = JSON.parse(parsedData)

      // Populate form fields even before products load
      if (data.vendor_id) setVendorId(data.vendor_id)
      if (data.bill_number) setBillNumber(data.bill_number)
      if (data.bill_date) setBillDate(data.bill_date)
      if (data.due_date) setDueDate(data.due_date)
      if (data.notes) setNotes(data.notes)

      // Wait for products to load before matching items
      if (products.length === 0) return

      if (data.items && Array.isArray(data.items)) {
        const parsedItems = data.items.map((item: any) => {
          // Try to match by product name or barcode
          const matchedProduct = products.find((p: Product) =>
            p.name.toLowerCase() === (item.description || '').toLowerCase() ||
            (item.item_code && p.item_code === item.item_code)
          )
          // Prefer the parsed line tax (including explicit 0). Only fall back to the
          // product master rate when the scan omitted tax_rate entirely.
          const hasParsedTax = item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== ''
          const taxRate = hasParsedTax
            ? parseItemNumber(item.tax_rate)
            : matchedProduct
              ? productTaxRate(matchedProduct)
              : 0
          const withTax = matchedProduct?.purchase_price_with_tax ?? item.purchase_price_with_tax ?? false
          const rawPrice = matchedProduct
            ? matchedProduct.purchase_price
            : item.unit_price
          return calcItemTotals({
            product_id: matchedProduct?.id || '',
            item_code: matchedProduct?.item_code || item.item_code || '',
            description: matchedProduct?.name || item.description || '',
            hsn_code: matchedProduct?.hsn_code || item.hsn_code || '',
            quantity: parseItemNumber(item.quantity, 1),
            unit_price: exclusiveUnitPrice(rawPrice, taxRate, withTax),
            discount: parseItemNumber(item.discount),
            tax_rate: taxRate,
            mrp: parseItemNumber(matchedProduct?.mrp ?? item.mrp),
            sale_price: parseItemNumber(matchedProduct?.sale_price ?? item.sale_price),
            unit: matchedProduct?.unit || item.unit || 'PCS',
            tax_amount: 0,
            total: 0,
            purchase_price_with_tax: withTax,
            batch_no: item.batch_no || '',
            mfg_date: item.mfg_date ? String(item.mfg_date).slice(0, 10) : '',
            exp_date: item.exp_date ? String(item.exp_date).slice(0, 10) : '',
            enable_batching: matchedProduct?.enable_batching ?? Boolean(item.batch_no),
          })
        })
        setItems(parsedItems)
      }

      // Clear the session storage after loading
      sessionStorage.removeItem('parsedInvoiceData')

      setToast({ message: 'Invoice data loaded from AI scan', type: 'success' })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      console.error('Error parsing stored invoice data:', err)
      // Clear on error to prevent retry loops
      sessionStorage.removeItem('parsedInvoiceData')
    }
  }, [editId, products])

  const fetchData = async () => {
    try {
      const [vendorsRes, productsRes, warehousesRes, categoriesRes] = await Promise.all([
        apiFetch('/parties?party_type=vendor'),
        apiFetch('/products'),
        apiFetch('/warehouses?is_active=true'),
        apiFetch('/categories'),
      ])
      if (vendorsRes.ok) {
        const d = await vendorsRes.json()
        const list: Vendor[] = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : []
        setVendors(list)
        if (!editId) {
          const defaultVendor = pickDefaultVendor(list)
          if (defaultVendor) {
            setVendorId((prev) => prev || defaultVendor.id)
          }
        }
      }
      const categoryNames = new Set<string>()
      if (productsRes.ok) {
        const productData = await productsRes.json()
        setProducts(productData)
        if (Array.isArray(productData)) {
          productData.forEach((p: Product) => {
            if (p.category) categoryNames.add(p.category)
          })
        }
      }
      if (categoriesRes.ok) {
        const categoryData = await categoriesRes.json()
        asArray<{ name?: string }>(categoryData).forEach((cat) => {
          if (cat.name) categoryNames.add(cat.name)
        })
      }
      setCategories(Array.from(categoryNames).sort())
      if (warehousesRes.ok) {
        const warehouseData = await warehousesRes.json()
        const list: Warehouse[] = Array.isArray(warehouseData)
          ? warehouseData
          : Array.isArray(warehouseData.data)
            ? warehouseData.data
            : []
        setWarehouses(list)
        const defaultWh = list.find((w) => w.is_default) || list[0]
        if (defaultWh) {
          setWarehouseId((prev) => prev || defaultWh.id)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBillData = async () => {
    try {
      setLoading(true)
      const res = await apiFetch(`/purchase/bills/${editId}`)
      if (res.ok) {
        const bill = await res.json()
        setBillNumber(bill.bill_number || '')
        setVendorId(bill.vendor_id || bill.party_id || '')
        setBillDate(bill.bill_date?.split('T')[0] || '')
        setDueDate(bill.due_date?.split('T')[0] || '')
        setWarehouseId(bill.warehouse_id || '')
        setNotes(bill.notes || '')
        const loadedPaid = bill.paid_amount || 0
        const loadedTotal = bill.total_amount || 0
        setAmountPaid(loadedPaid)
        setAmountPaidEdited(loadedPaid + 0.01 < loadedTotal)
        setPaidFrom(bill.payment_mode || 'cash')
        setBillStatus(bill.status || '')
        setSavedBillId(bill.id || editId)
        setAutosaveEnabled((bill.status || '') === 'draft')
        const billItems = bill.items || []
        // Prefer persisted flag; if missing (older bills), treat all-zero tax lines as exempt
        // so reopening does not look like product GST (often 18%) should apply.
        const allLinesZeroTax =
          billItems.length > 0 &&
          billItems.every((item: any) => parseItemNumber(item.tax_rate) === 0) &&
          parseItemNumber(bill.tax_total) === 0
        const loadedTaxExempt = Boolean(bill.tax_exempt) || allLinesZeroTax
        setTaxExempt(loadedTaxExempt)
        preExemptTaxRatesRef.current = null
        formHydratedRef.current = true
        suppressAutosaveRef.current = true
        const loadedItems = billItems.map((item: any) => {
            const prod = products.find((p: Product) => p.id === item.product_id)
            // Always use the saved line tax_rate — never the product master rate.
            const savedTaxRate = loadedTaxExempt ? 0 : parseItemNumber(item.tax_rate)
            return calcItemTotals({
              product_id: item.product_id || '',
              item_code: item.item_code || '',
              description: item.description || '',
              hsn_code: item.hsn_code || '',
              quantity: parseItemNumber(item.quantity),
              unit_price: parseItemNumber(item.unit_price),
              discount: parseItemNumber(item.discount),
              tax_rate: savedTaxRate,
              mrp: parseItemNumber(item.mrp),
              sale_price: parseItemNumber(item.sale_price),
              unit: item.unit || 'PCS',
              tax_amount: parseItemNumber(item.tax_amount),
              total: parseItemNumber(item.total),
              purchase_price_with_tax: prod?.purchase_price_with_tax ?? false,
              batch_no: item.batch_no || '',
              mfg_date: item.mfg_date ? String(item.mfg_date).slice(0, 10) : '',
              exp_date: item.exp_date ? String(item.exp_date).slice(0, 10) : '',
              enable_batching: prod?.enable_batching ?? Boolean(item.batch_no),
            }, loadedTaxExempt)
          })
        setItems(loadedItems)
        const defaultCategory = pickDefaultCategoryName(categories.map((c) => ({ name: c })))
        const restoredNewRows = new Set<number>()
        const restoredExtras: Record<number, NewProductDraft> = {}
        const restoredExpanded = new Set<number>()
        loadedItems.forEach((item: PurchaseBillItem, index: number) => {
          const raw = billItems[index] || {}
          const isNew =
            Boolean(raw.is_new_item) ||
            ((bill.status || '') === 'draft' && !item.product_id)
          if (!isNew) return
          restoredNewRows.add(index)
          restoredExtras[index] = {
            item_code: item.item_code || '',
            category: String(raw.category || '').trim() || defaultCategory,
          }
          restoredExpanded.add(index)
        })
        setNewProductRows(restoredNewRows)
        setNewProductExtras(restoredExtras)
        setExpandedRows((prev) => {
          const next = new Set(prev)
          restoredExpanded.forEach((i) => next.add(i))
          return next
        })
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
        p.hsn_code?.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search)
      )
    }
    setFilteredProducts(filtered)
  }

  const calcItemTotals = (item: PurchaseBillItem, exempt = taxExempt): PurchaseBillItem => {
    const qty = parseItemNumber(item.quantity)
    const price = parseItemNumber(item.unit_price)
    const disc = parseItemNumber(item.discount)
    const tax = exempt ? 0 : parseItemNumber(item.tax_rate)

    const itemTotal = qty * price
    const itemDiscount = itemTotal * (disc / 100)
    const taxable = itemTotal - itemDiscount
    const itemTax = taxable * (tax / 100)
    return {
      ...item,
      quantity: qty,
      unit_price: price,
      discount: disc,
      tax_rate: tax,
      tax_amount: itemTax,
      total: taxable + itemTax,
    }
  }

  const applyTaxExempt = (exempt: boolean) => {
    setTaxExempt(exempt)
    setItems((prev) => {
      if (exempt) {
        // Snapshot current rates so disabling exempt can restore them (not product master 18%).
        preExemptTaxRatesRef.current = prev.map((item) => parseItemNumber(item.tax_rate))
        return prev.map((item) => calcItemTotals({ ...item, tax_rate: 0 }, true))
      }
      const stashed = preExemptTaxRatesRef.current
      preExemptTaxRatesRef.current = null
      return prev.map((item, index) => {
        // Prefer rates from before exempt was enabled. Never pull product master tax here —
        // that was overwriting intentionally saved 0% with the product's 18% GST.
        const restoredRate =
          stashed && stashed[index] !== undefined
            ? stashed[index]
            : parseItemNumber(item.tax_rate)
        return calcItemTotals({ ...item, tax_rate: restoredRate }, false)
      })
    })
  }

  const buildPurchaseItemFromProduct = (
    product: Product,
    scannedCode?: string,
    quantity = 1
  ): PurchaseBillItem => {
    const itemItemCode = scannedCode || product.item_code || ''
    const qty = parseItemNumber(quantity, 1)
    return calcItemTotals({
      product_id: product.id,
      item_code: itemItemCode,
      description: product.name,
      hsn_code: product.hsn_code || '',
      quantity: qty > 0 ? qty : 1,
      unit_price: productPurchaseUnitPrice(product),
      discount: 0,
      tax_rate: taxExempt ? 0 : productTaxRate(product),
      mrp: parseItemNumber(product.mrp),
      sale_price: parseItemNumber(product.sale_price),
      unit: product.unit,
      tax_amount: 0,
      total: 0,
      purchase_price_with_tax: product.purchase_price_with_tax ?? false,
      batch_no: '',
      mfg_date: '',
      exp_date: '',
      enable_batching: product.enable_batching ?? false,
    })
  }

  const mergeProductIntoItems = (
    prevItems: PurchaseBillItem[],
    product: Product,
    scannedCode?: string,
    quantity = 1
  ): PurchaseBillItem[] => {
    const itemItemCode = scannedCode || product.item_code || ''
    const addQty = (() => {
      const parsed = parseItemNumber(quantity, 1)
      return parsed > 0 ? parsed : 1
    })()
    const existingItemIndex = prevItems.findIndex(
      (item) => item.product_id && item.product_id === product.id && item.item_code === itemItemCode
    )

    if (existingItemIndex >= 0) {
      const updatedItems = [...prevItems]
      const updated = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + addQty,
      }
      updatedItems[existingItemIndex] = calcItemTotals(updated)
      return updatedItems
    }

    return [...prevItems, buildPurchaseItemFromProduct(product, scannedCode, addQty)]
  }

  const getProductAddQuantity = (productId: string) => {
    const parsed = parseItemNumber(productAddQuantities[productId], 1)
    return parsed > 0 ? parsed : 1
  }

  const setProductAddQuantity = (productId: string, value: string) => {
    setProductAddQuantities((prev) => ({ ...prev, [productId]: value }))
  }

  const addProductsToInvoice = (products: Product[], options?: { closeModal?: boolean }) => {
    if (products.length === 0) return

    setItems((prevItems) => {
      let next = prevItems
      for (const product of products) {
        next = mergeProductIntoItems(next, product, undefined, getProductAddQuantity(product.id))
      }
      return next
    })

    if (products.length === 1) {
      setToast({ message: `Added: ${products[0].name}`, type: 'success' })
    } else {
      setToast({ message: `Added ${products.length} items`, type: 'success' })
    }
    setTimeout(() => setToast(null), 2000)

    if (options?.closeModal !== false) {
      setShowProductModal(false)
      setProductSearch('')
      setSelectedProductIds(new Set())
      setProductAddQuantities({})
    }
  }

  const addProductToInvoice = (product: Product, scannedCode?: string, quantity = 1) => {
    const itemItemCode = scannedCode || product.item_code || ''
    const addQty = (() => {
      const parsed = parseItemNumber(quantity, 1)
      return parsed > 0 ? parsed : 1
    })()
    const hadExisting = items.some(
      (item) => item.product_id && item.product_id === product.id && item.item_code === itemItemCode
    )
    setItems((prevItems) => mergeProductIntoItems(prevItems, product, scannedCode, addQty))
    setToast({
      message: hadExisting ? `Quantity increased: ${product.name}` : `Added: ${product.name}`,
      type: 'success',
    })
    setTimeout(() => setToast(null), 2000)
    setShowProductModal(false)
    setProductSearch('')
    setSelectedProductIds(new Set())
    setProductAddQuantities({})
  }

  const addCustomItemToInvoice = (description: string) => {
    const trimmed = description.trim()
    if (!trimmed) return
    const item = calcItemTotals({
      product_id: '',
      item_code: '',
      description: trimmed,
      hsn_code: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax_rate: taxExempt ? 0 : 0,
      mrp: 0,
      sale_price: 0,
      unit: 'PCS',
      tax_amount: 0,
      total: 0,
      purchase_price_with_tax: false,
      batch_no: '',
      mfg_date: '',
      exp_date: '',
      enable_batching: false,
    })
    setItems((prev) => [...prev, item])
    setShowProductModal(false)
    setProductSearch('')
    setSelectedProductIds(new Set())
    setProductAddQuantities({})
    setToast({ message: `Added custom item: ${trimmed}`, type: 'success' })
    setTimeout(() => setToast(null), 2000)
  }

  const handleCreateNewItem = (index: number, name: string) => {
    const trimmed = name.trim()
    const defaultCategory = pickDefaultCategoryName(categories.map((c) => ({ name: c })))
    setNewProductRows((prev) => new Set(prev).add(index))
    setNewProductExtras((prev) => ({
      ...prev,
      [index]: emptyNewProductDraft(defaultCategory),
    }))
    setExpandedRows((prev) => new Set(prev).add(index))
    setItems((prev) => {
      const next = [...prev]
      if (!next[index]) return prev
      next[index] = calcItemTotals({
        ...next[index],
        product_id: '',
        description: trimmed || next[index].description,
      })
      return next
    })
  }

  const updateNewProductExtras = (index: number, patch: Partial<NewProductDraft>) => {
    setNewProductExtras((prev) => ({
      ...prev,
      [index]: { ...(prev[index] || emptyNewProductDraft()), ...patch },
    }))
  }

  const cancelNewProductRow = (index: number) => {
    setNewProductRows((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
    setNewProductExtras((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const addRecentProductToInvoice = (rp: RecentVendorProduct) => {
    const product = rp.product_id ? products.find((p) => p.id === rp.product_id) : undefined
    const item = calcItemTotals({
      product_id: rp.product_id || '',
      item_code: rp.item_code || product?.item_code || '',
      description: rp.description || product?.name || '',
      hsn_code: rp.hsn_code || product?.hsn_code || '',
      quantity: parseItemNumber(rp.quantity, 1),
      unit_price: parseMoney(rp.unit_price),
      discount: parseItemNumber(rp.discount),
      tax_rate: taxExempt ? 0 : parseItemNumber(rp.tax_rate),
      mrp: parseItemNumber(rp.mrp),
      sale_price: parseItemNumber(rp.sale_price),
      unit: rp.unit || product?.unit || 'PCS',
      tax_amount: 0,
      total: 0,
      purchase_price_with_tax: product?.purchase_price_with_tax ?? false,
      batch_no: '',
      mfg_date: '',
      exp_date: '',
      enable_batching: product?.enable_batching ?? false,
    })

    const existingIndex = items.findIndex(
      (i) => i.product_id && i.product_id === rp.product_id && i.item_code === (rp.item_code || '')
    )
    if (existingIndex >= 0) {
      const newItems = [...items]
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity + parseItemNumber(rp.quantity, 1),
      }
      newItems[existingIndex] = calcItemTotals(newItems[existingIndex])
      setItems(newItems)
      setToast({ message: `Quantity increased: ${rp.description}`, type: 'success' })
    } else {
      setItems((prev) => [...prev, item])
      setToast({ message: `Added: ${rp.description}`, type: 'success' })
    }
    setTimeout(() => setToast(null), 2000)
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
  }

  const openProductModal = () => {
    setSelectedProductIds(new Set())
    setProductAddQuantities({})
    setShowProductModal(true)
  }

  const closeProductModal = () => {
    setShowProductModal(false)
    setSelectedProductIds(new Set())
    setProductAddQuantities({})
  }

  const handleItemCodeScan = async (code: string) => {
    try {
      const res = await apiFetch(`/inventory/stocks/search?item_code=${encodeURIComponent(code.trim())}`)
      
      if (res.ok) {
        const data = await res.json()
        const stockMatches = data.data || []
        
        if (stockMatches.length === 0) {
          const localMatches = products.filter(
            p => p.item_code?.trim() === code.trim() || p.sku?.trim() === code.trim()
          )
          
          if (localMatches.length === 0) {
            setToast({ message: 'Product not found with this item code/SKU', type: 'error' })
            setTimeout(() => setToast(null), 3000)
          } else if (localMatches.length === 1) {
            addProductToInvoice(localMatches[0], code.trim())
            setToast({ message: `Added: ${localMatches[0].name}`, type: 'success' })
            setTimeout(() => setToast(null), 2000)
          } else {
            setMatchingProducts(localMatches)
            setShowProductSelector(true)
          }
        } else if (stockMatches.length === 1) {
          const stockMatch = stockMatches[0]
          const product = products.find(p => p.id === stockMatch.product_id)
          if (product) {
            addProductToInvoice(product, stockMatch.item_code || code.trim())
            setToast({ message: `Added: ${product.name}`, type: 'success' })
            setTimeout(() => setToast(null), 2000)
          } else {
            setToast({ message: 'Product not found with this item code/SKU', type: 'error' })
            setTimeout(() => setToast(null), 3000)
          }
        } else {
          const matchingProducts = stockMatches.map((s: any) => ({
            id: s.product_id,
            name: s.product_name,
            sku: s.sku,
            item_code: s.item_code,
            purchase_price: s.purchase_price,
            sale_price: s.sale_price,
            mrp: s.mrp || 0,
            tax_rate: s.tax_rate,
            hsn_code: s.hsn_code,
            unit: s.unit,
            stock_qty: s.available_qty
          }))
          setMatchingProducts(matchingProducts)
          setShowProductSelector(true)
        }
      } else {
        const skuMatches = products.filter(p => p.sku === code)
        
        if (skuMatches.length === 0) {
          setToast({ message: 'Product not found with this item code/SKU', type: 'error' })
          setTimeout(() => setToast(null), 3000)
        } else if (skuMatches.length === 1) {
          addProductToInvoice(skuMatches[0], code)
          setToast({ message: `Added: ${skuMatches[0].name}`, type: 'success' })
          setTimeout(() => setToast(null), 2000)
        } else {
          setMatchingProducts(skuMatches)
          setShowProductSelector(true)
        }
      }
    } catch (err) {
      console.error(err)
      const skuMatches = products.filter(p => p.sku === code)
      
      if (skuMatches.length === 0) {
        setToast({ message: 'Product not found with this item code/SKU', type: 'error' })
        setTimeout(() => setToast(null), 3000)
      } else if (skuMatches.length === 1) {
        addProductToInvoice(skuMatches[0], code)
        setToast({ message: `Added: ${skuMatches[0].name}`, type: 'success' })
        setTimeout(() => setToast(null), 2000)
      } else {
        setMatchingProducts(skuMatches)
        setShowProductSelector(true)
      }
    }
  }

  const selectProductFromModal = (product: Product) => {
    addProductToInvoice(product)
    setShowProductSelector(false)
    setMatchingProducts([])
    setToast({ message: `Added: ${product.name}`, type: 'success' })
    setTimeout(() => setToast(null), 2000)
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

  const updateItem = (index: number, field: keyof PurchaseBillItem, value: unknown) => {
    if (field === 'product_id' || field === 'description') clearFieldError('items')
    const newItems = [...items]
    if (field === 'unit_price') {
      newItems[index] = { ...newItems[index], unit_price: parseMoney(limitDecimalInput(String(value ?? ''), 2)) }
    } else if (ITEM_NUMBER_FIELDS.includes(field)) {
      newItems[index] = { ...newItems[index], [field]: parseItemNumber(value) }
    } else {
      newItems[index] = { ...newItems[index], [field]: value as PurchaseBillItem[typeof field] }
    }

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].description = product.name
        newItems[index].unit_price = productPurchaseUnitPrice(product)
        newItems[index].tax_rate = taxExempt ? 0 : productTaxRate(product)
        newItems[index].mrp = parseItemNumber(product.mrp)
        newItems[index].sale_price = parseItemNumber(product.sale_price)
        newItems[index].unit = product.unit
        newItems[index].hsn_code = product.hsn_code || ''
        newItems[index].purchase_price_with_tax = isProductGstEnabled(product) ? (product.purchase_price_with_tax ?? false) : false
        newItems[index].enable_batching = product.enable_batching ?? false
      }
    }

    if (field === 'tax_rate' && taxExempt) {
      newItems[index].tax_rate = 0
    }

    // Recalculate totals
    newItems[index] = calcItemTotals(newItems[index])
    setItems(newItems)
  }

  const patchItem = (index: number, patch: Partial<PurchaseBillItem>) => {
    if (patch.product_id !== undefined || patch.description !== undefined) clearFieldError('items')
    setItems((prev) => {
      const newItems = [...prev]
      if (!newItems[index]) return prev
      const merged: PurchaseBillItem = { ...newItems[index], ...patch }
      if (patch.unit_price !== undefined) {
        merged.unit_price = parseMoney(limitDecimalInput(String(patch.unit_price ?? ''), 2))
      }
      if (patch.quantity !== undefined) merged.quantity = parseItemNumber(patch.quantity)
      if (patch.discount !== undefined) merged.discount = parseItemNumber(patch.discount)
      if (patch.tax_rate !== undefined) merged.tax_rate = parseItemNumber(patch.tax_rate)
      if (patch.mrp !== undefined) merged.mrp = parseItemNumber(patch.mrp)
      if (patch.sale_price !== undefined) merged.sale_price = parseItemNumber(patch.sale_price)
      if (taxExempt) merged.tax_rate = 0
      newItems[index] = calcItemTotals(merged)
      return newItems
    })
  }

  const addItem = () => {
    setItems([...items, { product_id: '', item_code: '', description: '', hsn_code: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, mrp: 0, sale_price: 0, unit: 'PCS', tax_amount: 0, total: 0, purchase_price_with_tax: false, batch_no: '', mfg_date: '', exp_date: '', enable_batching: false }])
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-pi-row="${items.length}"]`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handlePasteFromExcel = (rows: PastedItemRow[]) => {
    const newItems = rows.map((row) =>
      calcItemTotals({
        product_id: '',
        item_code: '',
        description: row.description,
        hsn_code: row.hsnCode,
        quantity: parseItemNumber(row.quantity, 1),
        unit_price: parseMoney(row.unitPrice),
        discount: 0,
        tax_rate: parseItemNumber(row.taxRate),
        mrp: 0,
        sale_price: 0,
        unit: 'PCS',
        tax_amount: 0,
        total: 0,
        purchase_price_with_tax: false,
        batch_no: '',
        mfg_date: '',
        exp_date: '',
        enable_batching: false,
      })
    )
    setItems((prev) => [...prev, ...newItems])
    setToast({ message: `Added ${newItems.length} item(s) from clipboard`, type: 'success' })
    setTimeout(() => setToast(null), 3000)
  }

  const removeItem = (index: number) => {
    const mapIndex = (i: number) => (i < index ? i : i > index ? i - 1 : null)
    setItems(items.filter((_, i) => i !== index))
    setSelectedLineIndices((prev) => remapIndexSet(prev, mapIndex))
    setNewProductRows((prev) => remapIndexSet(prev, mapIndex))
    setNewProductExtras((prev) => remapIndexRecord(prev, mapIndex))
    setExpandedRows((prev) => remapIndexSet(prev, mapIndex))
  }

  const duplicateItem = (index: number) => {
    const newItem = { ...items[index] }
    const newItems = [...items]
    newItems.splice(index + 1, 0, newItem)
    setItems(newItems)
    const mapIndex = (i: number) => (i <= index ? i : i + 1)
    setSelectedLineIndices((prev) => remapIndexSet(prev, mapIndex))
    setNewProductRows((prev) => {
      const next = remapIndexSet(prev, mapIndex)
      if (prev.has(index)) next.add(index + 1)
      return next
    })
    setNewProductExtras((prev) => {
      const next = remapIndexRecord(prev, mapIndex)
      if (prev[index]) next[index + 1] = { ...prev[index] }
      return next
    })
    setExpandedRows((prev) => remapIndexSet(prev, mapIndex))
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
    const mapIndex = (i: number) => {
      if (selectedLineIndices.has(i)) return null
      let mapped = i
      selectedLineIndices.forEach((s) => {
        if (s < i) mapped -= 1
      })
      return mapped
    }
    setItems(items.filter((_, index) => !selectedLineIndices.has(index)))
    setNewProductRows((prev) => remapIndexSet(prev, mapIndex))
    setNewProductExtras((prev) => remapIndexRecord(prev, mapIndex))
    setExpandedRows((prev) => remapIndexSet(prev, mapIndex))
    setSelectedLineIndices(new Set())
  }

  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const discountTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * (item.discount / 100)), 0)
  const taxTotal = items.reduce((sum, item) => sum + item.tax_amount, 0)
  
  let totalBeforeRound = subTotal - discountTotal + taxTotal - invoiceDiscount + additionalCharges
  let roundOff = 0
  if (autoRoundOff) {
    const rounded = Math.round(totalBeforeRound)
    roundOff = rounded - totalBeforeRound
    totalBeforeRound = rounded
  }
  const totalAmount = totalBeforeRound
  const effectiveAmountPaid = amountPaidEdited ? amountPaid : totalAmount
  const balance = totalAmount - effectiveAmountPaid

  const itemNeedsBatch = (item: PurchaseBillItem, productList: Product[] = products) =>
    Boolean(item.enable_batching) ||
    Boolean(productList.find((p) => p.id === item.product_id)?.enable_batching)

  const isItemReadyForDraft = (item: PurchaseBillItem) => {
    const hasIdentity = Boolean(item.product_id || String(item.description || '').trim())
    if (!hasIdentity) return false
    if (parseItemNumber(item.quantity) <= 0) return false
    return true
  }

  const serializeBillItem = (item: PurchaseBillItem, index: number) => {
    const extras = newProductExtras[index]
    const isNew = newProductRows.has(index) && !item.product_id
    return {
      product_id: item.product_id || null,
      item_code: extras?.item_code || item.item_code,
      description: item.description || 'Item',
      quantity: parseItemNumber(item.quantity),
      unit: item.unit,
      unit_price: parseMoney(item.unit_price),
      discount: parseItemNumber(item.discount),
      tax_rate: taxExempt ? 0 : parseItemNumber(item.tax_rate),
      mrp: parseMoney(item.mrp),
      sale_price: parseMoney(item.sale_price),
      hsn_code: item.hsn_code,
      batch_no: item.batch_no || '',
      mfg_date: item.mfg_date || null,
      exp_date: item.exp_date || null,
      is_new_item: isNew,
      category: extras?.category || '',
    }
  }

  const buildBillPayload = (asDraft: boolean, sourceItems: PurchaseBillItem[]) => {
    const status = asDraft
      ? 'draft'
      : (effectiveAmountPaid >= totalAmount ? 'paid' : (effectiveAmountPaid > 0 ? 'partial' : 'unpaid'))
    const resolvedBillNumber = billNumber || `PINV-${Date.now()}`
    return {
      resolvedBillNumber,
      body: {
        party_id: vendorId,
        bill_number: resolvedBillNumber,
        bill_date: new Date(billDate).toISOString(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        warehouse_id: warehouseId || null,
        total_amount: totalAmount,
        paid_amount: effectiveAmountPaid,
        balance_due: balance,
        payment_mode: paidFrom,
        bank_account_id: null,
        status,
        notes,
        terms,
        tax_exempt: taxExempt,
        items: sourceItems.map((item, index) => serializeBillItem(item, index)),
      },
    }
  }

  const persistDraftSilently = async () => {
    if (!autosaveEnabled || saving || loading) return

    const readyItems = items.filter((item) => isItemReadyForDraft(item))
    const hasAnyLine = items.some(
      (item) => item.product_id || String(item.description || '').trim()
    )

    if (!vendorId) {
      if (hasAnyLine) {
        setDraftSaveStatus('need_vendor')
        setDraftSaveError('')
      }
      return
    }

    // New drafts need at least one line; existing drafts may sync an empty list after removals.
    if (readyItems.length === 0 && !savedBillId) return

    if (draftAutosaveInFlightRef.current) {
      draftAutosaveQueuedRef.current = true
      return
    }

    draftAutosaveInFlightRef.current = true
    setDraftSaveStatus('saving')
    setDraftSaveError('')

    const billIdAtStart = savedBillId
    const resolvedBillNumber = billNumber || `PINV-${Date.now()}`
    if (!billNumber) {
      setBillNumber(resolvedBillNumber)
    }

    try {
      const url = billIdAtStart ? `/purchase/bills/${billIdAtStart}` : '/purchase/bills'
      const method = billIdAtStart ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          party_id: vendorId,
          bill_number: resolvedBillNumber,
          bill_date: new Date(billDate).toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          warehouse_id: warehouseId || null,
          total_amount: totalAmount,
          paid_amount: effectiveAmountPaid,
          balance_due: balance,
          payment_mode: paidFrom,
          bank_account_id: null,
          status: 'draft',
          notes,
          terms,
          tax_exempt: taxExempt,
          items: items.flatMap((item, index) => {
            if (!isItemReadyForDraft(item)) return []
            return [serializeBillItem(item, index)]
          }),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        setDraftSaveStatus('error')
        setDraftSaveError(errBody?.error || `Save failed (${res.status})`)
        return
      }

      const bill = await res.json().catch(() => null)
      const newId = bill?.id as string | undefined
      setBillStatus('draft')
      setAutosaveEnabled(true)
      if (newId && !billIdAtStart) {
        setSavedBillId(newId)
        skipNextBillFetchRef.current = true
        formHydratedRef.current = true
        router.replace(`/purchase-invoices/create?id=${newId}`, { scroll: false })
      }
      setDraftSaveStatus('saved')
      setDraftSaveError('')
    } catch (err) {
      setDraftSaveStatus('error')
      setDraftSaveError(err instanceof Error ? err.message : 'Draft autosave failed')
    } finally {
      draftAutosaveInFlightRef.current = false
      if (draftAutosaveQueuedRef.current) {
        draftAutosaveQueuedRef.current = false
        setDraftSaveTick((tick) => tick + 1)
      }
    }
  }

  persistDraftRef.current = persistDraftSilently

  // Autosave draft whenever the form changes (debounced).
  useEffect(() => {
    if (!autosaveEnabled || saving || loading || !formHydratedRef.current) return
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false
      return
    }

    const timer = setTimeout(() => {
      void persistDraftRef.current()
    }, 700)

    return () => clearTimeout(timer)
  }, [
    autosaveEnabled,
    saving,
    loading,
    vendorId,
    billNumber,
    billDate,
    dueDate,
    warehouseId,
    notes,
    terms,
    amountPaid,
    amountPaidEdited,
    paidFrom,
    invoiceDiscount,
    additionalCharges,
    autoRoundOff,
    taxExempt,
    items,
    newProductRows,
    newProductExtras,
    totalAmount,
    savedBillId,
    draftSaveTick,
  ])

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault()
    if (!vendorId) {
      setError('vendor_id', 'Please select a vendor')
      showErrorToast('Please select a vendor')
      return
    }
    if (!asDraft && items.some(i => !i.description)) {
      setError('items', 'Please fill all item details')
      showErrorToast('Please fill all item details')
      return
    }
    const missingBatch = items.find((i) => {
      return itemNeedsBatch(i) && !String(i.batch_no || '').trim()
    })
    if (!asDraft && missingBatch) {
      setError('items', `Batch number is required for ${missingBatch.description || 'batched product'}`)
      showErrorToast(`Batch number is required for ${missingBatch.description || 'batched product'}`)
      return
    }
    const invalidNewProduct = items.find((item, i) => {
      if (!newProductRows.has(i)) return false
      return !item.description.trim() || parseItemNumber(item.quantity) <= 0
    })
    if (!asDraft && invalidNewProduct) {
      setError('items', `Please fill product name and quantity for new item`)
      showErrorToast('Please fill product name and quantity for new item')
      return
    }
    setSaving(true)
    if (!asDraft) setAutosaveEnabled(false)
    try {
      let itemsToSave = [...items]

      if (!asDraft && newProductRows.size > 0) {
        setCreatingProducts(true)
        const sortedIndices = Array.from(newProductRows).sort((a, b) => a - b)
        for (const idx of sortedIndices) {
          const item = itemsToSave[idx]
          if (!item?.description.trim()) {
            if (asDraft) continue
            throw new Error('Please fill product name for new item')
          }
          const extras = newProductExtras[idx] || emptyNewProductDraft()
          const enableBatching = Boolean(String(item.batch_no || '').trim())
          const productRes = await apiFetch('/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.description.trim(),
              item_code: extras.item_code || undefined,
              category: extras.category || DEFAULT_CATEGORY_NAME,
              unit: item.unit || 'PCS',
              purchase_price: parseMoney(item.unit_price),
              sale_price: parseMoney(item.sale_price),
              mrp: parseMoney(item.mrp),
              tax_rate: 0,
              gst_enabled: false,
              item_type: 'product',
              enable_batching: enableBatching,
              sale_price_with_tax: true,
              purchase_price_with_tax: false,
              is_active: true,
            }),
          })
          if (!productRes.ok) {
            const errBody = await productRes.json().catch(() => null)
            throw new Error(errBody?.error || `Failed to create product: ${item.description}`)
          }
          const created = await productRes.json()
          const newProduct: Product = {
            id: created.id,
            name: created.name || item.description,
            sku: created.sku || '',
            item_code: created.item_code || extras.item_code,
            hsn_code: created.hsn_code || item.hsn_code,
            purchase_price: parseMoney(item.unit_price),
            sale_price: parseMoney(item.sale_price),
            mrp: parseMoney(item.mrp),
            tax_rate: 0,
            unit: created.unit || item.unit || 'PCS',
            stock_qty: 0,
            category: created.category || extras.category || '',
            purchase_price_with_tax: false,
            gst_enabled: false,
            enable_batching: created.enable_batching ?? enableBatching,
          }
          setProducts((prev) => [newProduct, ...prev.filter((p) => p.id !== newProduct.id)])
          if (newProduct.category && !categories.includes(newProduct.category)) {
            setCategories((prev) => [...prev, newProduct.category].sort())
          }
          itemsToSave[idx] = {
            ...itemsToSave[idx],
            product_id: created.id,
            item_code: created.item_code || extras.item_code || itemsToSave[idx].item_code,
            enable_batching: created.enable_batching ?? enableBatching,
            purchase_price_with_tax: false,
          }
          setItems([...itemsToSave])
          setNewProductRows((prev) => {
            const next = new Set(prev)
            next.delete(idx)
            return next
          })
          setNewProductExtras((prev) => {
            const next = { ...prev }
            delete next[idx]
            return next
          })
        }
        setCreatingProducts(false)
        setItems(itemsToSave)
        setNewProductRows(new Set())
        setNewProductExtras({})
      }

      const billId = savedBillId || editId
      const url = billId ? `/purchase/bills/${billId}` : '/purchase/bills'
      const method = billId ? 'PUT' : 'POST'
      const { resolvedBillNumber, body } = buildBillPayload(asDraft, itemsToSave)
      if (!billNumber) setBillNumber(resolvedBillNumber)

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const bill = await res.json().catch(() => null)
        if (!asDraft && bill?.stock_status === 'approved') {
          showSuccessToast('Purchase saved. Inventory stock has been updated.')
        }
        router.push('/purchase-invoices')
      } else {
        if (!asDraft) setAutosaveEnabled(true)
        await handleApiError(res)
      }
    } catch (err) {
      if (!asDraft) setAutosaveEnabled(true)
      setCreatingProducts(false)
      showErrorToast(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleAddVendor = async () => {
    if (!vendorFormData.name) {
      setError('name', 'Vendor name is required')
      showErrorToast('Vendor name is required')
      return
    }
    try {
      const res = await apiFetch('/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...vendorFormData, party_type: 'vendor' })
      })
      if (res.ok) {
        const newVendor = await res.json()
        setVendors([...vendors, newVendor])
        setVendorId(newVendor.id)
        setShowAddVendor(false)
        setVendorFormData({ name: '', phone: '', email: '', gstin: '', address: '', city: '', state: '', pincode: '', opening_balance: 0 })
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      showErrorToast('Failed to create vendor')
    }
  }

  const renderNewPurchaseItemCard = (index: number, idPrefix: string) => {
    const item = items[index]
    const extras = newProductExtras[index] || emptyNewProductDraft()
    const reservedItemCodes = Object.entries(newProductExtras)
      .filter(([key]) => Number(key) !== index)
      .map(([, draft]) => draft.item_code)
      .filter(Boolean)
    return (
      <NewPurchaseItemForm
        idPrefix={idPrefix}
        item={item}
        extras={extras}
        categories={categories}
        reservedItemCodes={reservedItemCodes}
        selected={selectedLineIndices.has(index)}
        expanded={expandedRows.has(index)}
        onToggleExpand={() => {
          setExpandedRows((prev) => {
            const next = new Set(prev)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
          })
        }}
        onToggleSelect={() => toggleLineItemSelection(index)}
        onPatchItem={(patch: Partial<NewPurchaseLineItem>) => patchItem(index, patch)}
        onPatchExtras={(patch) => {
          updateNewProductExtras(index, patch)
          if (patch.item_code !== undefined) {
            patchItem(index, { item_code: patch.item_code })
          }
        }}
        onCancel={() => cancelNewProductRow(index)}
        onRemove={() => removeItem(index)}
      />
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 space-y-4 pb-2">
        <PageHeader
          title={`${editId || savedBillId ? 'Edit' : 'Create'} Purchase Invoice`}
          backHref="/purchase-invoices"
          actions={
            <Button type="button" variant="outline" onClick={() => router.push('/purchase-invoices/ai-parse')}>
              <Camera className="mr-2 h-4 w-4" />
              Scan Invoice
            </Button>
          }
        />

        <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 space-y-2 xl:col-span-2">
                <Label>Purchase Invoice Number</Label>
                <Input
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="w-full min-w-0"
                />
              </div>
              <div className="min-w-0 space-y-2 xl:col-span-2">
                <Label>Vendor *</Label>
                <SearchableSelect
                  value={vendorId}
                  onValueChange={(value) => {
                    clearFieldError('vendor_id')
                    setVendorId(value)
                  }}
                  options={vendors.map((v) => ({
                    value: v.id,
                    label: isDefaultVendorName(v.name) ? `${v.name} (Default)` : v.name,
                  }))}
                  placeholder="Select Vendor"
                  searchPlaceholder="Search vendors..."
                  emptyMessage="No vendors found"
                  onAddNew={() => setShowAddVendor(true)}
                  addNewLabel="Add New Vendor"
                  className={cn('w-full min-w-0', fieldErrors.vendor_id && 'border-red-500')}
                />
                <FieldError message={fieldErrors.vendor_id} />
                <p className="text-xs leading-snug text-gray-500">
                  {DEFAULT_VENDOR_NAME} is selected by default. Choose another vendor if needed.
                </p>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Purchase Invoice Date</Label>
                <Input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full min-w-0"
                  required
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Payment Terms (Days)</Label>
                <Input
                  type="number"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(Number(e.target.value))}
                  min="0"
                  className="w-full min-w-0"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full min-w-0"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Warehouse</Label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="flex h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                >
                  <option value="">Default warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-snug text-gray-500">
                  Linked products will update inventory stock when this purchase is saved.
                </p>
              </div>
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-4">
                <Label htmlFor="tax_exempt">Exempt Tax</Label>
                <div className="flex min-h-8 items-center gap-3">
                  <Switch
                    id="tax_exempt"
                    checked={taxExempt}
                    onCheckedChange={applyTaxExempt}
                    className="shrink-0"
                  />
                  <span className="min-w-0 text-sm leading-snug text-gray-600">
                    {taxExempt ? 'Tax set to 0% on all items' : 'Use each line item tax %'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {vendorId && (recentProductsLoading || recentVendorProducts.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <button
                  type="button"
                  onClick={() => setShowRecentProducts((prev) => !prev)}
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4 text-gray-500" />
                  <CardTitle className="text-base">Frequently Purchased from this Vendor</CardTitle>
                  <span className="text-xs font-normal text-gray-500">
                    ({recentVendorProducts.length})
                  </span>
                  <ChevronDown
                    className={cn('ml-auto h-4 w-4 text-gray-400 transition-transform', showRecentProducts && 'rotate-180')}
                  />
                </button>
              </CardHeader>
              {showRecentProducts && (
                <CardContent>
                  {recentProductsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading recent products…
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {recentVendorProducts.map((rp) => {
                        const alreadyInInvoice = items.some(
                          (i) => i.product_id && i.product_id === rp.product_id
                        )
                        return (
                          <button
                            key={rp.product_id || rp.description}
                            type="button"
                            onClick={() => addRecentProductToInvoice(rp)}
                            className={cn(
                              'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                              alreadyInInvoice
                                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
                            )}
                            title={`Last purchased: ${rp.last_date}\nQty: ${rp.quantity} ${rp.unit}\nPrice: ${formatCurrency(rp.unit_price)}\nFrequency: ${rp.frequency}x`}
                          >
                            <span className="font-medium">{rp.description}</span>
                            <span className="text-xs text-gray-500">
                              {formatCurrency(rp.unit_price)} × {rp.quantity}
                            </span>
                            {alreadyInInvoice && (
                              <span className="text-xs text-blue-500">✓</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Click a product to add it with its last-used price and quantity.
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          <Card className="min-w-0">
            <CardHeader>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Items</CardTitle>
                <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={openProductModal}>
                    <Package className="mr-2 h-4 w-4" />
                    <span className="hidden min-[420px]:inline">Add Item to Bill</span>
                    <span className="min-[420px]:hidden">Add Item</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" /> New Row
                  </Button>
                  <BarcodeScannerInput
                    ref={barcodeScannerRef}
                    enabled
                    autoFocusWhenEnabled={false}
                    onScan={handleItemCodeScan}
                    placeholder="Scan product barcode…"
                    className="min-w-0 w-full basis-full sm:w-56 sm:basis-[14rem] sm:flex-none"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <FieldError message={fieldErrors.items} />
              {selectedLineIndices.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-600">{selectedLineIndices.size} line item(s) selected</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:ml-auto text-red-600 hover:bg-red-50"
                    onClick={removeSelectedLineItems}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove Selected
                  </Button>
                </div>
              )}
              <div className="hidden min-w-0 overflow-x-auto xl:block">
                <table className={cn('w-full text-sm', taxExempt ? 'min-w-[44rem]' : 'min-w-[48rem]')}>
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="w-8 min-w-8 whitespace-nowrap pb-2 pr-0"></th>
                      <th className="w-10 min-w-10 whitespace-nowrap pb-2 pr-2">
                        <Checkbox
                          checked={items.length > 0 && selectedLineIndices.size === items.length}
                          onCheckedChange={toggleSelectAllLineItems}
                          aria-label="Select all line items"
                        />
                      </th>
                      <th className="min-w-[12rem] whitespace-nowrap pb-2 pr-2 font-medium">Item</th>
                      <th className="min-w-[6rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Quantity</th>
                      <th className="min-w-[7rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Unit Price</th>
                      <th className="min-w-[6.5rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Discount %</th>
                      {!taxExempt && (
                        <th className="min-w-[5rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Tax %</th>
                      )}
                      <th className="min-w-[7rem] whitespace-nowrap pb-2 px-1 font-medium">Batch No</th>
                      <th className="min-w-[7rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Amount</th>
                      <th className="w-12 min-w-12 pb-2 pl-1 font-medium"></th>
                    </tr>
                  </thead>
                  {items.length === 0 ? (
                    <ItemsEmptyState
                      onAddProduct={openProductModal}
                      onScanBarcode={() => barcodeScannerRef.current?.focus()}
                    />
                  ) : (
                  <tbody>
                    {items.map((item, index) => {
                      const needsBatch =
                        Boolean(item.enable_batching) ||
                        Boolean(products.find((p) => p.id === item.product_id)?.enable_batching)
                      const isExpanded = expandedRows.has(index)
                      const isNewProduct = newProductRows.has(index)
                      const toggleExpand = () => {
                        setExpandedRows((prev) => {
                          const next = new Set(prev)
                          if (next.has(index)) next.delete(index)
                          else next.add(index)
                          return next
                        })
                      }
                      const detailColSpan = taxExempt ? 9 : 10

                      if (isNewProduct) {
                        return (
                          <tr key={index} className="border-b" data-pi-row={index}>
                            <td colSpan={detailColSpan} className="px-1 py-2">
                              {renderNewPurchaseItemCard(index, `new-item-${index}`)}
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <Fragment key={index}>
                        <tr className="border-b" data-pi-row={index}>
                          <td className="py-2 pr-0">
                            <button
                              type="button"
                              onClick={toggleExpand}
                              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600"
                              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                            </button>
                          </td>
                          <td className="py-2 pr-2">
                            <Checkbox
                              checked={selectedLineIndices.has(index)}
                              onCheckedChange={() => toggleLineItemSelection(index)}
                              aria-label={`Select line item ${index + 1}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <ProductCombobox
                              products={products}
                              value={item.product_id}
                              onChange={(productId) => updateItem(index, 'product_id', productId)}
                              onCreateNew={(query) => handleCreateNewItem(index, query)}
                              className="w-full min-w-0"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className="h-8 w-full min-w-0 text-right"
                              required
                            />
                          </td>
                          <td className="px-1 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', limitDecimalInput(e.target.value, 2))}
                              onBlur={() => updateItem(index, 'unit_price', parseMoney(item.unit_price))}
                              className="h-8 w-full min-w-0 text-right"
                              required
                            />
                          </td>
                          <td className="px-1 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount}
                              onChange={(e) => updateItem(index, 'discount', e.target.value)}
                              className="h-8 w-full min-w-0 text-right"
                            />
                          </td>
                          {!taxExempt && (
                            <td className="px-1 py-2">
                              <Input
                                type="number"
                                value={item.tax_rate}
                                onChange={(e) => updateItem(index, 'tax_rate', e.target.value)}
                                className="h-8 w-full min-w-0 text-right"
                                required
                              />
                            </td>
                          )}
                          <td className="px-1 py-2">
                            <Input
                              value={item.batch_no}
                              onChange={(e) => updateItem(index, 'batch_no', e.target.value)}
                              placeholder={needsBatch ? 'Required' : 'Optional'}
                              className={cn('h-8 w-full min-w-0', needsBatch && !item.batch_no && 'border-amber-500')}
                              required={needsBatch}
                            />
                          </td>
                          <td className="whitespace-nowrap px-1 py-2 text-right font-medium tabular-nums">
                            {formatCurrency(item.total)}
                          </td>
                          <td className="py-2 pl-1">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => duplicateItem(index)} className="text-gray-500 hover:text-gray-700" title="Duplicate line item">
                                <Copy className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b bg-gray-50/50">
                            <td colSpan={detailColSpan} className="px-4 pb-3 pt-1">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:items-end">
                                <div className="min-w-0 space-y-1">
                                  <Label className="text-xs text-gray-500">HSN Code</Label>
                                  <Input
                                    value={item.hsn_code}
                                    onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                                    className="h-8 w-full min-w-0 xl:w-32"
                                  />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <Label className="text-xs text-gray-500">Expiry Date</Label>
                                  <Input
                                    type="date"
                                    value={item.exp_date}
                                    onChange={(e) => updateItem(index, 'exp_date', e.target.value)}
                                    className="h-8 w-full min-w-0 xl:w-40"
                                  />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <Label className="text-xs text-gray-500">Mfg Date</Label>
                                  <Input
                                    type="date"
                                    value={item.mfg_date}
                                    onChange={(e) => updateItem(index, 'mfg_date', e.target.value)}
                                    className="h-8 w-full min-w-0 xl:w-40"
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  )}
                </table>
              </div>
              {/* Phone / tablet card layout — table is too wide below xl */}
              <div className="space-y-3 xl:hidden">
                {items.length === 0 ? (
                  <ItemsEmptyState
                    variant="block"
                    onAddProduct={openProductModal}
                    onScanBarcode={() => barcodeScannerRef.current?.focus()}
                  />
                ) : (
                  items.map((item, index) => {
                    const needsBatch =
                      Boolean(item.enable_batching) ||
                      Boolean(products.find((p) => p.id === item.product_id)?.enable_batching)
                    if (newProductRows.has(index)) {
                      return (
                        <div key={index} className="min-w-0" data-pi-row={index}>
                          {renderNewPurchaseItemCard(index, `m-new-item-${index}`)}
                        </div>
                      )
                    }
                    return (
                      <div key={index} className="min-w-0 space-y-3 rounded-lg border p-3" data-pi-row={index}>
                        <div className="flex min-w-0 items-start gap-2">
                          <Checkbox
                            checked={selectedLineIndices.has(index)}
                            onCheckedChange={() => toggleLineItemSelection(index)}
                            aria-label={`Select line item ${index + 1}`}
                            className="mt-1.5 shrink-0"
                          />
                          <ProductCombobox
                            products={products}
                            value={item.product_id}
                            onChange={(productId) => updateItem(index, 'product_id', productId)}
                            onCreateNew={(query) => handleCreateNewItem(index, query)}
                            className="min-w-0 flex-1"
                          />
                          <div className="flex shrink-0 items-center gap-1 pt-1">
                            <button type="button" onClick={() => duplicateItem(index)} className="text-gray-500 hover:text-gray-700" title="Duplicate line item">
                              <Copy className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">Quantity</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className="h-8 w-full min-w-0 text-right"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">Unit Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', limitDecimalInput(e.target.value, 2))}
                              onBlur={() => updateItem(index, 'unit_price', parseMoney(item.unit_price))}
                              className="h-8 w-full min-w-0 text-right"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">Discount %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount}
                              onChange={(e) => updateItem(index, 'discount', e.target.value)}
                              className="h-8 w-full min-w-0 text-right"
                            />
                          </div>
                          {!taxExempt && (
                            <div className="min-w-0 space-y-1">
                              <Label className="text-xs text-gray-500">Tax %</Label>
                              <Input
                                type="number"
                                value={item.tax_rate}
                                onChange={(e) => updateItem(index, 'tax_rate', e.target.value)}
                                className="h-8 w-full min-w-0 text-right"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t pt-2">
                          <span className="text-xs text-gray-500">Amount</span>
                          <span className="font-medium tabular-nums">{formatCurrency(item.total)}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 border-t pt-2 min-[420px]:grid-cols-2">
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">HSN Code</Label>
                            <Input
                              value={item.hsn_code}
                              onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                              className="h-8 w-full min-w-0"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">Batch No</Label>
                            <Input
                              value={item.batch_no}
                              onChange={(e) => updateItem(index, 'batch_no', e.target.value)}
                              placeholder={needsBatch ? 'Required' : 'Optional'}
                              className={cn('h-8 w-full min-w-0', needsBatch && !item.batch_no && 'border-amber-500')}
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">Expiry Date</Label>
                            <Input
                              type="date"
                              value={item.exp_date}
                              onChange={(e) => updateItem(index, 'exp_date', e.target.value)}
                              className="h-8 w-full min-w-0"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-xs text-gray-500">Mfg Date</Label>
                            <Input
                              type="date"
                              value={item.mfg_date}
                              onChange={(e) => updateItem(index, 'mfg_date', e.target.value)}
                              className="h-8 w-full min-w-0"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="space-y-4 xl:col-span-2">
              <CardHeader>
                <CardTitle>Additional Charges & Discount</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Additional Charges</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Invoice Discount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Auto Round Off</Label>
                  <select
                    value={autoRoundOff ? 'true' : 'false'}
                    onChange={(e) => setAutoRoundOff(e.target.value === 'true')}
                    className="flex h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </CardContent>

              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Amount Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={effectiveAmountPaid}
                    onChange={(e) => {
                      setAmountPaidEdited(true)
                      setAmountPaid(Number(e.target.value))
                    }}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Paid From</Label>
                  <select
                    value={paidFrom}
                    onChange={(e) => setPaidFrom(e.target.value)}
                    className="flex h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {effectiveAmountPaid > 0
                      ? `${formatCurrency(effectiveAmountPaid)} will be deducted from ${getDepositHint(paidFrom, bankAccounts)} (configure under Cash & Bank → Payment method accounts).`
                      : 'Select the payment method to pay from when recording a payment.'}
                  </p>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Balance</Label>
                  <Input value={formatCurrency(balance)} readOnly className="w-full min-w-0 bg-gray-50" />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Mark as Fully Paid</Label>
                  <Button
                    type="button"
                    variant={effectiveAmountPaid >= totalAmount ? "default" : "outline"}
                    className="h-8 w-full"
                    onClick={() => {
                      setAmountPaidEdited(false)
                      setAmountPaid(totalAmount)
                    }}
                  >
                    {effectiveAmountPaid >= totalAmount ? 'Fully Paid' : 'Mark Fully Paid'}
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
                  className="max-w-full cursor-crosshair rounded border"
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
                {!taxExempt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax Total</span>
                    <span className="font-medium">{formatCurrency(taxTotal)}</span>
                  </div>
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
              </CardContent>
            </Card>
          </div>

          <PageActionBar
            meta={
              autosaveEnabled && draftSaveStatus !== 'idle' ? (
                <span
                  className={cn(
                    'text-xs sm:text-sm',
                    draftSaveStatus === 'saving' && 'text-gray-500',
                    draftSaveStatus === 'saved' && 'text-green-600',
                    draftSaveStatus === 'need_vendor' && 'text-amber-600',
                    draftSaveStatus === 'error' && 'text-red-600',
                  )}
                >
                  {draftSaveStatus === 'saving' && 'Saving draft…'}
                  {draftSaveStatus === 'saved' && 'Draft saved'}
                  {draftSaveStatus === 'need_vendor' && 'Select a vendor to autosave draft'}
                  {draftSaveStatus === 'error' && (draftSaveError || 'Draft autosave failed')}
                </span>
              ) : (
                <span className="font-semibold tabular-nums text-slate-800">
                  Total {formatCurrency(totalAmount)}
                </span>
              )
            }
          >
            <Button type="button" variant="outline" onClick={() => router.push('/purchase-invoices')}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={(e) => handleSubmit(e as React.FormEvent, true)}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              <span className="sm:hidden">Draft</span>
              <span className="hidden sm:inline">Save as Draft</span>
            </Button>
            <Button type="submit" disabled={saving || creatingProducts}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              <span className="sm:hidden">{creatingProducts ? 'Creating…' : 'Save'}</span>
              <span className="hidden sm:inline">{creatingProducts ? 'Creating products…' : 'Save Invoice'}</span>
            </Button>
          </PageActionBar>
        </form>

        {/* Product Selection Modal */}
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="max-h-[80vh] w-full max-w-4xl overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Select Product</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={closeProductModal}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {selectedProductIds.size > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedProductIds.size} selected</span>
                    <Button type="button" size="sm" className="sm:ml-auto" onClick={handleAddSelectedProducts}>
                      Add Selected ({selectedProductIds.size})
                    </Button>
                  </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search by name, SKU, item code, HSN, category..."
                      className="pl-10"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto sm:min-w-[10rem]"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="table-scroll max-h-[60vh]">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="w-10 min-w-10 whitespace-nowrap pb-2 pr-2">
                          <Checkbox
                            checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                            onCheckedChange={toggleSelectAllProducts}
                            aria-label="Select all products"
                          />
                        </th>
                        <th className="min-w-[12rem] whitespace-nowrap pb-2 pr-2 font-medium">Item Name</th>
                        <th className="min-w-[8rem] whitespace-nowrap pb-2 px-1 font-medium">Item Code/SKU</th>
                        <th className="min-w-[5rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Stock</th>
                        <th className="min-w-[7rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Sale Price</th>
                        <th className="min-w-[7rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Purchase Price</th>
                        <th className="min-w-[5rem] whitespace-nowrap pb-2 px-1 font-medium text-right">Qty</th>
                        <th className="min-w-[5rem] whitespace-nowrap pb-2 pl-1 font-medium">Action</th>
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
                          <td className="py-2 pr-2 font-medium">{product.name}</td>
                          <td className="px-1 py-2 text-gray-600">{product.sku || product.item_code || '-'}</td>
                          <td className="whitespace-nowrap px-1 py-2 text-right">{product.stock_qty} {product.unit}</td>
                          <td className="whitespace-nowrap px-1 py-2 text-right tabular-nums">{formatCurrency(product.sale_price)}</td>
                          <td className="whitespace-nowrap px-1 py-2 text-right tabular-nums text-gray-500">{formatCurrency(product.purchase_price)}</td>
                          <td className="px-1 py-2 text-right">
                            <Input
                              type="number"
                              min="0.001"
                              step="any"
                              className="ml-auto h-8 w-20 text-right"
                              value={productAddQuantities[product.id] ?? '1'}
                              onChange={(e) => setProductAddQuantity(product.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Quantity for ${product.name}`}
                            />
                          </td>
                          <td className="py-2 pl-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => addProductToInvoice(product, undefined, getProductAddQuantity(product.id))}
                            >
                              Add
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center">
                            {productSearch.trim() ? (
                              <button
                                type="button"
                                onClick={() => addCustomItemToInvoice(productSearch)}
                                className="inline-flex items-center gap-2 rounded-md border border-dashed border-blue-400 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
                              >
                                <Plus className="h-4 w-4" />
                                Add as custom item: '{productSearch.trim()}'
                              </button>
                            ) : (
                              <span className="text-gray-500">No products found</span>
                            )}
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
              purchase_price_with_tax: false,
              mrp: 0,
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
              purchase_price_with_tax: false,
              mrp: 0,
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

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Product Selector Modal for Multiple item code matches */}
        {showProductSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Product</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => {
                    setShowProductSelector(false)
                    setMatchingProducts([])
                  }}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Multiple products found with this item code/SKU. Please select one:
                </p>
                <div className="space-y-2">
                  {matchingProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => selectProductFromModal(product)}
                      className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-600">
                          SKU: {product.sku} | Item code: {product.item_code} | Stock: {product.stock_qty} {product.unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(product.purchase_price)}</div>
                        <div className="text-sm text-gray-600">Purchase Price</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Vendor Modal */}
        {showAddVendor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Create New Vendor</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowAddVendor(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="new_vendor_name">Name *</Label>
                      <Input 
                        id="new_vendor_name" 
                        value={vendorFormData.name} 
                        onChange={e => {
                          clearFieldError('name')
                          setVendorFormData({ ...vendorFormData, name: e.target.value })
                        }}
                        className={cn(fieldErrors.name && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.name} />
                    </div>
                    <div>
                      <Label htmlFor="new_vendor_phone">Mobile</Label>
                      <Input 
                        id="new_vendor_phone" 
                        value={vendorFormData.phone} 
                        onChange={e => setVendorFormData({ ...vendorFormData, phone: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="new_vendor_email">Email</Label>
                      <Input 
                        id="new_vendor_email" 
                        type="email" 
                        value={vendorFormData.email} 
                        onChange={e => setVendorFormData({ ...vendorFormData, email: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_vendor_gstin">GSTIN</Label>
                      <Input 
                        id="new_vendor_gstin" 
                        value={vendorFormData.gstin} 
                        onChange={e => setVendorFormData({ ...vendorFormData, gstin: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new_vendor_address">Address</Label>
                    <Input 
                      id="new_vendor_address" 
                      value={vendorFormData.address} 
                      onChange={e => setVendorFormData({ ...vendorFormData, address: e.target.value })} 
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="new_vendor_city">City</Label>
                      <Input 
                        id="new_vendor_city" 
                        value={vendorFormData.city} 
                        onChange={e => setVendorFormData({ ...vendorFormData, city: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_vendor_state">State</Label>
                      <Input 
                        id="new_vendor_state" 
                        value={vendorFormData.state} 
                        onChange={e => setVendorFormData({ ...vendorFormData, state: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_vendor_pincode">Pincode</Label>
                      <Input 
                        id="new_vendor_pincode" 
                        value={vendorFormData.pincode} 
                        onChange={e => setVendorFormData({ ...vendorFormData, pincode: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new_vendor_opening_balance">Opening Balance</Label>
                    <Input 
                      id="new_vendor_opening_balance" 
                      type="number" 
                      value={vendorFormData.opening_balance} 
                      onChange={e => setVendorFormData({ ...vendorFormData, opening_balance: Number(e.target.value) })} 
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddVendor(false)}>Cancel</Button>
                  <Button type="button" onClick={handleAddVendor}>Create Vendor</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <datalist id="product-categories">
          {categories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
      </div>
    </DashboardLayout>
  )
}
