'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Loader2, Save, ArrowLeft, Search, Barcode, X, Package } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { notifyError } from '@/lib/notify'

interface Party {
  id: string
  name: string
  phone: string
  gstin: string
  state: string
  party_type: string
}

interface Invoice {
  id: string
  invoice_number: string
  customer: { name: string }
  date: string
  total_amount: number
  items: InvoiceItem[]
}

interface InvoiceItem {
  id: string
  product_id: string
  product: {
    id: string
    name: string
    sale_price: number
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
  sale_price: number
  tax_rate: number
  unit: string
  stock_qty: number
  category: string
}

interface SalesReturnItem {
  product_id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  unit: string
  total: number
  reason: string
}

export default function CreateSalesReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const invoiceParam = searchParams.get('invoice_id')
  const {
    fieldErrors,
    clearFieldError,
    setError,
    handleApiError,
    showErrorToast,
  } = useFormErrors()

  const [parties, setParties] = useState<Party[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [returnNumber, setReturnNumber] = useState('')
  const [partyId, setPartyId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [refundMode, setRefundMode] = useState('cash')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<SalesReturnItem[]>([
    { product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18, unit: 'PCS', total: 0, reason: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false)
  const invoiceDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
    if (invoiceParam) {
      setInvoiceId(invoiceParam)
      loadInvoiceItems(invoiceParam)
    }
  }, [editId, invoiceParam])

  useEffect(() => {
    filterInvoices()
  }, [invoiceSearch, invoices])

  useEffect(() => {
    filterProducts()
  }, [productSearch, selectedCategory, products])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (invoiceDropdownRef.current && !invoiceDropdownRef.current.contains(event.target as Node)) {
        setShowInvoiceDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      const [partiesRes, productsRes, invoicesRes] = await Promise.all([
        apiFetch('/parties?party_type=customer'),
        apiFetch('/products'),
        apiFetch('/invoices'),
      ])
      if (partiesRes.ok) {
        const data = await partiesRes.json()
        setParties(data.data || [])
      }
      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data.data || [])
        const cats = Array.from(new Set(data.data.map((p: Product) => p.category).filter(Boolean))) as string[]
        setCategories(cats)
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setInvoices(data.data || [])
      }
      if (!editId) {
        // Generate return number based on existing returns count
        const count = invoices.length + 1
        setReturnNumber(`SR-${String(count).padStart(4, '0')}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filterInvoices = () => {
    let filtered = invoices
    if (partyId) {
      filtered = filtered.filter(inv => inv.customer?.name && parties.find(p => p.id === partyId)?.name === inv.customer.name)
    }
    if (invoiceSearch) {
      const search = invoiceSearch.toLowerCase()
      filtered = filtered.filter(inv => 
        inv.invoice_number.toLowerCase().includes(search) ||
        inv.customer?.name?.toLowerCase().includes(search)
      )
    }
    setFilteredInvoices(filtered)
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

  const fetchSalesReturn = async () => {
    try {
      setLoading(true)
      const res = await apiFetch(`/sales-returns/${editId}`)
      if (res.ok) {
        const data = await res.json()
        setReturnNumber(data.return_number)
        setPartyId(data.party_id)
        setInvoiceId(data.invoice_id || '')
        setDate(data.date.split('T')[0])
        setReason(data.reason || '')
        setRefundMode(data.refund_mode || 'cash')
        setNotes(data.notes || '')
        setItems(data.items.map((item: SalesReturnItem) => ({
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

  const loadInvoiceItems = async (invoiceId: string) => {
    try {
      const res = await apiFetch(`/invoices/${invoiceId}`)
      if (res.ok) {
        const invoice = await res.json()
        setPartyId(invoice.customer_id)
        setItems(invoice.items.map((item: InvoiceItem) => ({
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
    const newItem: SalesReturnItem = {
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: product.sale_price,
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

  const handlePartyChange = (value: string) => {
    clearFieldError('party_id')
    setPartyId(value)
    setInvoiceId('')
    filterInvoices()
  }

  const handleInvoiceSelect = (invoice: Invoice) => {
    setInvoiceId(invoice.id)
    setInvoiceSearch(invoice.invoice_number)
    setShowInvoiceDropdown(false)
    loadInvoiceItems(invoice.id)
  }

  const addItem = () => {
    setItems([...items, { product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18, unit: 'PCS', total: 0, reason: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof SalesReturnItem, value: string | number) => {
    if (field === 'product_id') clearFieldError('items')
    const newItems = [...items]
    ;(newItems[index] as any)[field] = value

    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].description = product.name
        newItems[index].unit_price = product.sale_price
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
    if (!partyId) {
      setError('party_id', 'Please select a party')
      showErrorToast('Please fill in all required fields')
      return
    }
    if (items.some(item => !item.product_id)) {
      setError('items', 'Please select a product for each item')
      showErrorToast('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const payload = {
        party_id: partyId,
        invoice_id: invoiceId || null,
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

      const url = editId ? `/sales-returns/${editId}` : '/sales-returns'
      const method = editId ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        router.push('/sales-returns')
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to save sales return')
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
              {editId ? 'Edit Sales Return' : 'New Sales Return'}
            </h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
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
                    <Label htmlFor="returnNumber">Sales Return #</Label>
                    <Input
                      id="returnNumber"
                      value={returnNumber}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="party">Party Name *</Label>
                    <select
                      id="party"
                      value={partyId}
                      onChange={(e) => handlePartyChange(e.target.value)}
                      className={cn(
                        'mt-1 h-10 w-full rounded-md border border-input bg-background px-3',
                        fieldErrors.party_id && 'border-red-500'
                      )}
                      required
                    >
                      <option value="">Select Party</option>
                      {parties.map((party) => (
                        <option key={party.id} value={party.id}>
                          {party.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={fieldErrors.party_id} />
                  </div>
                  <div className="relative" ref={invoiceDropdownRef}>
                    <Label htmlFor="invoice">Invoice (Optional)</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="invoice"
                        placeholder="Search invoice..."
                        className="pl-10"
                        value={invoiceSearch}
                        onChange={(e) => {
                          setInvoiceSearch(e.target.value)
                          setShowInvoiceDropdown(true)
                        }}
                        onFocus={() => setShowInvoiceDropdown(true)}
                      />
                    </div>
                    {showInvoiceDropdown && filteredInvoices.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-60 overflow-auto">
                        {filteredInvoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleInvoiceSelect(invoice)}
                          >
                            <div>
                              <div className="font-medium">{invoice.invoice_number}</div>
                              <div className="text-sm text-gray-500">{invoice.customer?.name}</div>
                            </div>
                            <div className="text-sm text-gray-600">{formatCurrency(invoice.total_amount)}</div>
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
                <FieldError message={fieldErrors.items} />
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
                                  updateItem(index, 'unit_price', product.sale_price)
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
                                  {product.name} - {formatCurrency(product.sale_price)}
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
                        <td className="py-2 text-right font-medium">{formatCurrency(product.sale_price)}</td>
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
