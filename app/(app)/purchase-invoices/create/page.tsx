'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { exclusiveUnitPrice, limitDecimalInput, parseItemNumber, parseMoney, productPurchaseUnitPrice, productTaxRate, isProductGstEnabled } from '@/lib/numbers'
import BarcodeScannerInput from '@/components/ui/BarcodeScannerInput'
import CreateProductDialog, { type CreatedProduct } from '@/components/CreateProductDialog'
import BulkCreateProductsDialog from '@/components/BulkCreateProductsDialog'
import { Plus, Trash2, Loader2, Save, ArrowLeft, Search, Package, X, Camera } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import {
  useBankAccounts,
  CASH_IN_HAND_ACCOUNT,
  bankAccountIdForApi,
  defaultBankAccountSelection,
  resolveBankAccountSelection,
} from '@/hooks/useBankAccounts'

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
  const [autoRoundOff, setAutoRoundOff] = useState(true)
  const [amountPaid, setAmountPaid] = useState(0)
  const [paidFrom, setPaidFrom] = useState(CASH_IN_HAND_ACCOUNT)
  const [pendingBillAccountId, setPendingBillAccountId] = useState<string | null | undefined>(undefined)
  const { accounts: bankAccounts, primaryAccount } = useBankAccounts()
  const [signature, setSignature] = useState('')
  const [items, setItems] = useState<PurchaseBillItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [selectedLineIndices, setSelectedLineIndices] = useState<Set<number>>(new Set())
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
  const [isDrawing, setIsDrawing] = useState(false)
  const [barcodeScannerEnabled, setBarcodeScannerEnabled] = useState(false)
  const [matchingProducts, setMatchingProducts] = useState<Product[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (pendingBillAccountId !== undefined) {
      setPaidFrom(resolveBankAccountSelection(pendingBillAccountId, bankAccounts))
      setPendingBillAccountId(undefined)
      return
    }
    setPaidFrom((prev) => {
      if (prev !== CASH_IN_HAND_ACCOUNT && bankAccounts.some((a) => a.id === prev)) {
        return prev
      }
      return defaultBankAccountSelection(bankAccounts, primaryAccount)
    })
  }, [bankAccounts, primaryAccount, pendingBillAccountId])

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
    if (editId && products.length > 0) {
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
          const taxRate = matchedProduct
            ? productTaxRate(matchedProduct)
            : parseItemNumber(item.tax_rate)
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
      const [vendorsRes, productsRes, warehousesRes] = await Promise.all([
        apiFetch('/parties?party_type=vendor'),
        apiFetch('/products'),
        apiFetch('/warehouses?is_active=true'),
      ])
      if (vendorsRes.ok) {
        const d = await vendorsRes.json()
        setVendors(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [])
      }
      if (productsRes.ok) {
        const productData = await productsRes.json()
        setProducts(productData)
        const cats = Array.from(new Set(productData.map((p: Product) => p.category).filter(Boolean))) as string[]
        setCategories(cats)
      }
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
        setAmountPaid(bill.paid_amount || 0)
        setPendingBillAccountId(bill.bank_account_id ?? null)
        setItems(
          (bill.items || []).map((item: any) => {
            const prod = products.find((p: Product) => p.id === item.product_id)
            return calcItemTotals({
              product_id: item.product_id || '',
              item_code: item.item_code || '',
              description: item.description || '',
              hsn_code: item.hsn_code || '',
              quantity: parseItemNumber(item.quantity),
              unit_price: parseItemNumber(item.unit_price),
              discount: parseItemNumber(item.discount),
              tax_rate: parseItemNumber(item.tax_rate),
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
            })
          })
        )
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

  const calcItemTotals = (item: PurchaseBillItem): PurchaseBillItem => {
    const qty = parseItemNumber(item.quantity)
    const price = parseItemNumber(item.unit_price)
    const disc = parseItemNumber(item.discount)
    const tax = parseItemNumber(item.tax_rate)

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

  const buildPurchaseItemFromProduct = (product: Product, scannedCode?: string): PurchaseBillItem => {
    const itemItemCode = scannedCode || product.item_code || ''
    return calcItemTotals({
      product_id: product.id,
      item_code: itemItemCode,
      description: product.name,
      hsn_code: product.hsn_code || '',
      quantity: 1,
      unit_price: productPurchaseUnitPrice(product),
      discount: 0,
      tax_rate: productTaxRate(product),
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
    scannedCode?: string
  ): PurchaseBillItem[] => {
    const itemItemCode = scannedCode || product.item_code || ''
    const existingItemIndex = prevItems.findIndex(
      (item) => item.product_id && item.product_id === product.id && item.item_code === itemItemCode
    )

    if (existingItemIndex >= 0) {
      const updatedItems = [...prevItems]
      const updated = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + 1,
      }
      updatedItems[existingItemIndex] = calcItemTotals(updated)
      return updatedItems
    }

    return [...prevItems, buildPurchaseItemFromProduct(product, scannedCode)]
  }

  const addProductsToInvoice = (products: Product[], options?: { closeModal?: boolean }) => {
    if (products.length === 0) return

    setItems((prevItems) => {
      let next = prevItems
      for (const product of products) {
        next = mergeProductIntoItems(next, product)
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
    }
  }

  const addProductToInvoice = (product: Product, scannedCode?: string) => {
    const itemItemCode = scannedCode || product.item_code || ''
    const hadExisting = items.some(
      (item) => item.product_id && item.product_id === product.id && item.item_code === itemItemCode
    )
    setItems((prevItems) => mergeProductIntoItems(prevItems, product, scannedCode))
    setToast({
      message: hadExisting ? `Quantity increased: ${product.name}` : `Added: ${product.name}`,
      type: 'success',
    })
    setTimeout(() => setToast(null), 2000)
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
  }

  const openProductModal = () => {
    setSelectedProductIds(new Set())
    setShowProductModal(true)
  }

  const closeProductModal = () => {
    setShowProductModal(false)
    setSelectedProductIds(new Set())
  }

  const handleItemCodeScan = async (code: string) => {
    try {
      const res = await apiFetch(`/inventory/stocks/search?item_code=${encodeURIComponent(code)}`)
      
      if (res.ok) {
        const data = await res.json()
        const stockMatches = data.data || []
        
        if (stockMatches.length === 0) {
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
        } else if (stockMatches.length === 1) {
          const stockMatch = stockMatches[0]
          const product = products.find(p => p.id === stockMatch.product_id)
          if (product) {
            addProductToInvoice(product, stockMatch.item_code)
            setToast({ message: `Added: ${product.name}`, type: 'success' })
            setTimeout(() => setToast(null), 2000)
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
        newItems[index].tax_rate = productTaxRate(product)
        newItems[index].mrp = parseItemNumber(product.mrp)
        newItems[index].sale_price = parseItemNumber(product.sale_price)
        newItems[index].unit = product.unit
        newItems[index].hsn_code = product.hsn_code || ''
        newItems[index].purchase_price_with_tax = isProductGstEnabled(product) ? (product.purchase_price_with_tax ?? false) : false
        newItems[index].enable_batching = product.enable_batching ?? false
        if (!(product.enable_batching ?? false)) {
          newItems[index].batch_no = ''
          newItems[index].mfg_date = ''
          newItems[index].exp_date = ''
        }
      }
    }

    // Recalculate totals
    newItems[index] = calcItemTotals(newItems[index])
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { product_id: '', item_code: '', description: '', hsn_code: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, mrp: 0, sale_price: 0, unit: 'PCS', tax_amount: 0, total: 0, purchase_price_with_tax: false, batch_no: '', mfg_date: '', exp_date: '', enable_batching: false }])
  }

  const removeItem = (index: number) => {
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
    setItems(items.filter((_, index) => !selectedLineIndices.has(index)))
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
  const balance = totalAmount - amountPaid

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
      const batched =
        Boolean(i.enable_batching) ||
        Boolean(products.find((p) => p.id === i.product_id)?.enable_batching)
      return batched && !String(i.batch_no || '').trim()
    })
    if (!asDraft && missingBatch) {
      setError('items', `Batch number is required for ${missingBatch.description || 'batched product'}`)
      showErrorToast(`Batch number is required for ${missingBatch.description || 'batched product'}`)
      return
    }
    setSaving(true)
    try {
      const url = editId ? `/purchase/bills/${editId}` : '/purchase/bills'
      const method = editId ? 'PUT' : 'POST'
      
      const status = asDraft ? 'draft' : (amountPaid >= totalAmount ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid'))

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          party_id: vendorId,
          bill_number: billNumber || `PINV-${Date.now()}`,
          bill_date: new Date(billDate).toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          warehouse_id: warehouseId || null,
          total_amount: totalAmount,
          paid_amount: amountPaid,
          balance_due: balance,
          payment_mode: paidFrom === CASH_IN_HAND_ACCOUNT ? 'cash' : 'bank_transfer',
          bank_account_id: bankAccountIdForApi(paidFrom),
          status,
          notes,
          terms,
          items: items.map(item => ({
            product_id: item.product_id || null,
            item_code: item.item_code,
            description: item.description,
            quantity: parseItemNumber(item.quantity),
            unit: item.unit,
            unit_price: parseMoney(item.unit_price),
            discount: parseItemNumber(item.discount),
            tax_rate: parseItemNumber(item.tax_rate),
            mrp: parseMoney(item.mrp),
            sale_price: parseMoney(item.sale_price),
            hsn_code: item.hsn_code,
            batch_no: item.batch_no || '',
            mfg_date: item.mfg_date || null,
            exp_date: item.exp_date || null,
          })),
        }),
      })
      if (res.ok) {
        const bill = await res.json().catch(() => null)
        if (!asDraft && bill?.stock_status === 'pending') {
          showSuccessToast('Purchase saved. Stock updates are pending approval in Inventory.')
        }
        router.push('/purchase-invoices')
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      showErrorToast('An error occurred')
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
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/purchase-invoices')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">{editId ? 'Edit' : 'Create'} Purchase Invoice</h1>
          </div>
          <Button type="button" variant="outline" onClick={() => router.push('/purchase-invoices/ai-parse')}>
            <Camera className="mr-2 h-4 w-4" />
            Scan Invoice
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Purchase Invoice Number</Label>
                <Input 
                  value={billNumber} 
                  onChange={(e) => setBillNumber(e.target.value)} 
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-1">
                <Label>Vendor *</Label>
                <div className="flex min-w-0 items-center gap-2">
                  <select
                    value={vendorId}
                    onChange={(e) => {
                      clearFieldError('vendor_id')
                      setVendorId(e.target.value)
                    }}
                    className={cn(
                      'flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm',
                      fieldErrors.vendor_id && 'border-red-500'
                    )}
                    required
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowAddVendor(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <FieldError message={fieldErrors.vendor_id} />
              </div>
              <div className="space-y-2">
                <Label>Purchase Invoice Date</Label>
                <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms (Days)</Label>
                <Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(Number(e.target.value))} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Default warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Linked products will create stock entries pending approval in Inventory.
                </p>
              </div>
            </CardContent>
          </Card>

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
                    placeholder="Scan product barcode…"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-2 w-10">
                        <Checkbox
                          checked={items.length > 0 && selectedLineIndices.size === items.length}
                          onCheckedChange={toggleSelectAllLineItems}
                          aria-label="Select all line items"
                        />
                      </th>
                      <th className="pb-2 font-medium w-48">Item</th>
                      <th className="pb-2 font-medium w-24">HSN</th>
                      <th className="pb-2 font-medium w-28">Batch</th>
                      <th className="pb-2 font-medium w-28">Expiry</th>
                      <th className="pb-2 font-medium text-right w-24">Quantity</th>
                      <th className="pb-2 font-medium text-right w-28">Unit Price</th>
                      <th className="pb-2 font-medium text-right w-24">Discount %</th>
                      <th className="pb-2 font-medium text-right w-20">Tax %</th>
                      <th className="pb-2 font-medium text-right w-28">Amount</th>
                      <th className="pb-2 font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const needsBatch =
                        Boolean(item.enable_batching) ||
                        Boolean(products.find((p) => p.id === item.product_id)?.enable_batching)
                      return (
                      <tr key={index} className="border-b">
                        <td className="py-2 pr-2 w-10">
                          <Checkbox
                            checked={selectedLineIndices.has(index)}
                            onCheckedChange={() => toggleLineItemSelection(index)}
                            aria-label={`Select line item ${index + 1}`}
                          />
                        </td>
                        <td className="py-2 w-48">
                          <select
                            value={item.product_id}
                            onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="">Select Product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="py-2 w-24">
                          <Input
                            value={item.hsn_code}
                            onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                            className="h-8 w-full"
                          />
                        </td>
                        <td className="py-2 w-28">
                          <Input
                            value={item.batch_no}
                            onChange={(e) => updateItem(index, 'batch_no', e.target.value)}
                            placeholder={needsBatch ? 'Required' : 'Optional'}
                            className={`h-8 w-full ${needsBatch && !item.batch_no ? 'border-amber-500' : ''}`}
                            required={needsBatch}
                          />
                        </td>
                        <td className="py-2 w-28">
                          <Input
                            type="date"
                            value={item.exp_date}
                            onChange={(e) => updateItem(index, 'exp_date', e.target.value)}
                            className="h-8 w-full"
                          />
                        </td>
                        <td className="py-2 w-24">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            className="h-8 w-full text-right"
                            required
                          />
                        </td>
                        <td className="py-2 w-28">
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
                        <td className="py-2 w-24">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount}
                            onChange={(e) => updateItem(index, 'discount', e.target.value)}
                            className="h-8 w-full text-right"
                          />
                        </td>
                        <td className="py-2 w-20">
                          <Input
                            type="number"
                            value={item.tax_rate}
                            onChange={(e) => updateItem(index, 'tax_rate', e.target.value)}
                            className="h-8 w-full text-right"
                            required
                          />
                        </td>
                        <td className="py-2 text-right font-medium w-28">{formatCurrency(item.total)}</td>
                        <td className="py-2 w-12">
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      )
                    })}
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
                  <Label>Paid From</Label>
                  <select
                    value={paidFrom}
                    onChange={(e) => setPaidFrom(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={CASH_IN_HAND_ACCOUNT}>Cash in-hand</option>
                    {bankAccounts.filter((a) => a.is_active).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name}
                        {account.bank_name ? ` (${account.bank_name})` : ''}
                        {' — '}
                        {formatCurrency(account.balance)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {amountPaid > 0
                      ? `${formatCurrency(amountPaid)} will be deducted from ${
                          paidFrom === CASH_IN_HAND_ACCOUNT
                            ? 'Cash in-hand'
                            : bankAccounts.find((a) => a.id === paidFrom)?.account_name || 'the selected account'
                        }.`
                      : 'Select the account to pay from when recording a payment.'}
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax Total</span>
                  <span className="font-medium">{formatCurrency(taxTotal)}</span>
                </div>
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={saving}
                    onClick={(e) => handleSubmit(e as any, true)}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save as Draft
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Invoice
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
                      placeholder="Search by name, SKU, item code, HSN, category..."
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
                        <th className="pb-2 pr-2 w-10">
                          <Checkbox
                            checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                            onCheckedChange={toggleSelectAllProducts}
                            aria-label="Select all products"
                          />
                        </th>
                        <th className="pb-2 font-medium w-64">Item Name</th>
                        <th className="pb-2 font-medium w-32">Item Code/SKU</th>
                        <th className="pb-2 font-medium text-right w-24">Stock</th>
                        <th className="pb-2 font-medium text-right w-28">Sale Price</th>
                        <th className="pb-2 font-medium text-right w-28">Purchase Price</th>
                        <th className="pb-2 font-medium w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 pr-2 w-10">
                            <Checkbox
                              checked={selectedProductIds.has(product.id)}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                              aria-label={`Select ${product.name}`}
                            />
                          </td>
                          <td className="py-2 font-medium w-64">{product.name}</td>
                          <td className="py-2 text-gray-600 w-32">{product.sku || product.item_code || '-'}</td>
                          <td className="py-2 text-right w-24">{product.stock_qty} {product.unit}</td>
                          <td className="py-2 text-right w-28">{formatCurrency(product.sale_price)}</td>
                          <td className="py-2 text-right text-gray-500 w-28">{formatCurrency(product.purchase_price)}</td>
                          <td className="py-2 w-20">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Create New Vendor</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowAddVendor(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-3 gap-4">
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
      </div>
    </DashboardLayout>
  )
}
