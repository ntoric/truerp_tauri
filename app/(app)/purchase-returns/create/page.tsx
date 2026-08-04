'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Loader2, Save, ArrowLeft, Search, Barcode, X, Package, Camera } from 'lucide-react'
import { notifyError } from '@/lib/notify'

interface Vendor {
  id: string
  name: string
  phone: string
  gstin: string
  state: string
}

interface PurchaseBill {
  id: string
  bill_number: string
  vendor?: { name: string }
  party?: { id: string; name: string }
  date: string
  total_amount: number
  items: PurchaseBillItem[]
}

interface PurchaseBillItem {
  id: string
  product_id: string
  product: {
    id: string
    name: string
    purchase_price: number
    tax_rate: number
    unit: string
  }
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
}

interface Product {
  id: string
  name: string
  sku: string
  item_code: string
  hsn_code: string
  purchase_price: number
  tax_rate: number
  unit: string
  stock_qty: number
  category: string
}

interface PurchaseReturnItem {
  product_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  unit: string
  total: number
  reason: string
}

export default function CreatePurchaseReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const billParam = searchParams.get('bill_id')

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [bills, setBills] = useState<PurchaseBill[]>([])
  const [filteredBills, setFilteredBills] = useState<PurchaseBill[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [returnNumber, setReturnNumber] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [billId, setBillId] = useState('')
  const [billSearch, setBillSearch] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [refundMode, setRefundMode] = useState('cash')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseReturnItem[]>([
    { product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18, unit: 'PCS', total: 0, reason: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const billDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
    if (billParam) {
      setBillId(billParam)
      loadBillItems(billParam)
    }
  }, [editId, billParam, vendors.length])

  // Check for parsed data from AI scan
  useEffect(() => {
    if (editId) return
    const parsedData = sessionStorage.getItem('parsedReturnData')
    if (!parsedData) return

    try {
      const data = JSON.parse(parsedData)

      // Populate form fields even before products load
      if (data.vendor_id) setVendorId(data.vendor_id)
      if (data.bill_number) setBillSearch(data.bill_number)
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
          return {
            product_id: matchedProduct?.id || '',
            description: matchedProduct?.name || item.description || '',
            quantity: item.quantity || 1,
            unit_price: matchedProduct?.purchase_price || item.unit_price || 0,
            tax_rate: matchedProduct?.tax_rate ?? (item.tax_rate || 0),
            unit: matchedProduct?.unit || item.unit || 'PCS',
            total: 0,
            reason: '',
          }
        })
        // Calculate totals for each item
        const itemsWithTotals = parsedItems.map((item: PurchaseReturnItem) => {
          const taxAmount = item.unit_price * item.quantity * (item.tax_rate / 100)
          return { ...item, total: item.unit_price * item.quantity + taxAmount }
        })
        setItems(itemsWithTotals)
      }

      sessionStorage.removeItem('parsedReturnData')
    } catch (err) {
      console.error('Error parsing stored return data:', err)
      // Clear on error to prevent retry loops
      sessionStorage.removeItem('parsedReturnData')
    }
  }, [editId, products])

  useEffect(() => {
    filterBills()
  }, [billSearch, bills])

  useEffect(() => {
    filterProducts()
  }, [productSearch, selectedCategory, products])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (billDropdownRef.current && !billDropdownRef.current.contains(event.target as Node)) {
        setShowBillDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      const [vendorsRes, productsRes, billsRes] = await Promise.all([
        apiFetch('/parties?party_type=vendor'),
        apiFetch('/products'),
        apiFetch('/purchase/bills'),
      ])
      if (vendorsRes.ok) {
        const data = await vendorsRes.json()
        setVendors(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [])
      }
      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data || [])
        const cats = Array.from(new Set(data.map((p: Product) => p.category).filter(Boolean))) as string[]
        setCategories(cats)
      }
      if (billsRes.ok) {
        const data = await billsRes.json()
        setBills(data || [])
      }
      if (!editId) {
        const count = bills.length + 1
        setReturnNumber(`PR-${String(count).padStart(4, '0')}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filterBills = () => {
    let filtered = bills
    if (vendorId) {
      filtered = filtered.filter(bill => bill.vendor?.name && vendors.find(v => v.id === vendorId)?.name === bill.vendor.name)
    }
    if (billSearch) {
      const search = billSearch.toLowerCase()
      filtered = filtered.filter(bill => 
        bill.bill_number.toLowerCase().includes(search) ||
        bill.vendor?.name?.toLowerCase().includes(search)
      )
    }
    setFilteredBills(filtered)
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

  const fetchPurchaseReturn = async () => {
    try {
      setLoading(true)
      const res = await apiFetch(`/purchase-returns/${editId}`)
      if (res.ok) {
        const data = await res.json()
        setReturnNumber(data.return_number)
        setVendorId(data.party_id)
        setBillId(data.purchase_bill_id || '')
        setDate(data.date.split('T')[0])
        setReason(data.reason || '')
        setRefundMode(data.refund_mode || 'cash')
        setNotes(data.notes || '')
        setItems(data.items.map((item: PurchaseReturnItem) => ({
          product_id: item.product_id,
          description: item.description || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          unit: item.unit || 'PCS',
          total: item.total,
          reason: item.reason || ''
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadBillItems = async (billId: string) => {
    try {
      const res = await apiFetch(`/purchase/bills/${billId}`)
      if (res.ok) {
        const bill = await res.json()

        // Match vendor by name from the bill against the vendors list
        const billVendorName = bill.party?.name || bill.vendor?.name || ''
        if (billVendorName && vendors.length > 0) {
          const matchedVendor = vendors.find((v: Vendor) =>
            v.name.toLowerCase() === billVendorName.toLowerCase()
          )
          setVendorId(matchedVendor?.id || '')
        } else {
          setVendorId('')
        }

        setItems(bill.items.map((item: PurchaseBillItem) => ({
          product_id: item.product_id,
          description: item.description || item.product?.name || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          unit: item.product?.unit || 'PCS',
          total: item.total,
          reason: ''
        })))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const addProductToReturn = (product: Product) => {
    const newItem: PurchaseReturnItem = {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: product.purchase_price,
      tax_rate: product.tax_rate,
      unit: product.unit,
      total: 0,
      reason: ''
    }
    setItems([...items, newItem])
    setShowProductModal(false)
    setProductSearch('')
  }

  const handleItemCodeScan = async (code: string) => {
    const product = products.find(p => p.item_code === code)
    if (product) {
      addProductToReturn(product)
    } else {
      notifyError('Product not found with this item code')
    }
  }

  const handleVendorChange = (value: string) => {
    setVendorId(value)
    setBillId('')
    filterBills()
  }

  const handleBillSelect = (bill: PurchaseBill) => {
    setBillId(bill.id)
    setBillSearch(bill.bill_number)
    setShowBillDropdown(false)
    loadBillItems(bill.id)
  }

  const addItem = () => {
    setItems([...items, { product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18, unit: 'PCS', total: 0, reason: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof PurchaseReturnItem, value: string | number) => {
    const newItems = [...items]
    ;(newItems[index] as any)[field] = value

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].description = product.name
        newItems[index].unit_price = product.purchase_price
        newItems[index].tax_rate = product.tax_rate
        newItems[index].unit = product.unit
      }
    }

    if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
      const item = newItems[index]
      const taxAmount = item.unit_price * item.quantity * (item.tax_rate / 100)
      item.total = item.unit_price * item.quantity + taxAmount
    }

    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  const handleSave = async () => {
    if (!vendorId || items.some(item => !item.product_id)) {
      notifyError('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const payload = {
        party_id: vendorId,
        purchase_bill_id: billId || null,
        date: date,
        reason: reason,
        refund_mode: refundMode,
        notes: notes,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          reason: item.reason
        }))
      }

      const url = editId ? `/purchase-returns/${editId}` : '/purchase-returns'
      const method = editId ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        router.push('/purchase-returns')
      } else {
        const error = await res.json()
        notifyError(error.error || 'Failed to save purchase return')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to save purchase return')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              {editId ? 'Edit Purchase Return' : 'New Purchase Return'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/purchase-returns/ai-parse')}>
              <Camera className="mr-2 h-4 w-4" />
              Scan Invoice
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="returnNumber">Purchase Return #</Label>
                    <Input
                      id="returnNumber"
                      value={returnNumber}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor">Vendor Name *</Label>
                    <select
                      id="vendor"
                      value={vendorId}
                      onChange={(e) => handleVendorChange(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                      required
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative" ref={billDropdownRef}>
                    <Label htmlFor="bill">Purchase Bill (Optional)</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="bill"
                        placeholder="Search bill..."
                        className="pl-10"
                        value={billSearch}
                        onChange={(e) => {
                          setBillSearch(e.target.value)
                          setShowBillDropdown(true)
                        }}
                        onFocus={() => setShowBillDropdown(true)}
                      />
                    </div>
                    {showBillDropdown && filteredBills.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-60 overflow-auto">
                        {filteredBills.map((bill) => (
                          <div
                            key={bill.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleBillSelect(bill)}
                          >
                            <div>
                              <div className="font-medium">{bill.bill_number}</div>
                              <div className="text-sm text-gray-500">{bill.vendor?.name}</div>
                            </div>
                            <div className="text-sm text-gray-600">{formatCurrency(bill.total_amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="refundMode">Refund Mode</Label>
                    <select
                      id="refundMode"
                      value={refundMode}
                      onChange={(e) => setRefundMode(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    >
                      <option value="cash">Cash</option>
                      <option value="original_payment">Original Payment</option>
                      <option value="credit_note">Credit Note</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for return"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                    placeholder="Additional notes"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="rounded-lg border p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <Label>Product *</Label>
                          <div className="flex gap-2 mt-1">
                            <select
                              value={item.product_id}
                              onChange={(e) => {
                                const product = products.find(p => p.id === e.target.value)
                                updateItem(index, 'product_id', e.target.value)
                                if (product) {
                                  updateItem(index, 'description', product.name)
                                  updateItem(index, 'unit_price', product.purchase_price)
                                  updateItem(index, 'tax_rate', product.tax_rate)
                                  updateItem(index, 'unit', product.unit)
                                }
                              }}
                              className="h-10 flex-1 rounded-md border border-input bg-background px-3"
                              required
                            >
                              <option value="">Select Product</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} - {formatCurrency(product.purchase_price)}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setShowProductModal(true)}
                              title="Search Products"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const barcode = prompt('Enter item code:')
                                if (barcode) handleItemCodeScan(barcode)
                              }}
                              title="Scan item code"
                            >
                              <Barcode className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-5">
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Input
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="bg-gray-50"
                            readOnly
                            disabled
                            placeholder="PCS"
                          />
                        </div>
                        <div>
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label>Tax Rate (%)</Label>
                          <Input
                            type="number"
                            value={item.tax_rate}
                            onChange={(e) => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label>Total</Label>
                          <Input
                            value={formatCurrency(item.total)}
                            readOnly
                            className="bg-gray-50"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Item Reason</Label>
                        <Input
                          value={item.reason}
                          onChange={(e) => updateItem(index, 'reason', e.target.value)}
                          placeholder="Reason for returning this item"
                        />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addItem} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(calculateTotal())}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Product Search Modal */}
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Product</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowProductModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search products by name, SKU, item code, or HSN code..."
                    className="pl-10"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="pb-2 text-left font-medium">Product</th>
                      <th className="pb-2 text-left font-medium">SKU</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Stock</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="py-2">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-gray-500">{product.hsn_code}</div>
                        </td>
                        <td className="py-2 text-gray-600">{product.sku || '-'}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(product.purchase_price)}</td>
                        <td className="py-2 text-right">{product.stock_qty}</td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            onClick={() => addProductToReturn(product)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
