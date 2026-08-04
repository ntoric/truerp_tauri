'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn, formatCurrency } from '@/lib/utils'
import { Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'

interface Category {
  id: string
  name: string
  description: string
}

interface ExpenseItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total: number
}

export default function CreateExpensePage() {
  const router = useRouter()
  const { fieldErrors, clearFieldError, handleApiError, showErrorToast } = useFormErrors()
  const [form, setForm] = useState({
    category: '',
    description: '',
    original_invoice_num: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    payment_mode: 'cash',
    notes: '',
    with_gst: false,
    tax_rate: 18,
  })
  const [items, setItems] = useState<ExpenseItem[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 18, tax_amount: 0, total: 0 }
  ])
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/expense-categories?is_active=true')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
        if (data.length > 0) {
          setForm(prev => ({ ...prev, category: data[0].name }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number | boolean) => {
    clearFieldError(field)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Recalculate item totals
    const item = newItems[index]
    const itemTotal = item.quantity * item.unit_price
    if (form.with_gst) {
      item.tax_rate = form.tax_rate
      item.tax_amount = itemTotal * (form.tax_rate / 100)
      item.total = itemTotal + item.tax_amount
    } else {
      item.tax_amount = 0
      item.total = itemTotal
    }
    
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: form.tax_rate, tax_amount: 0, total: 0 }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const calculateTotals = () => {
    const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const taxTotal = items.reduce((sum, item) => sum + item.tax_amount, 0)
    const total = subTotal + taxTotal
    return { subTotal, taxTotal, total }
  }

  const { subTotal, taxTotal, total } = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiFetch('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          date: new Date(form.date).toISOString(),
          items: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
          })),
        }),
      })
      if (res.ok) {
        router.push('/expenses')
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      showErrorToast('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Expense</h1>
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Expense Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Expense Category *</Label>
                  {loading ? (
                    <div className="h-10 animate-pulse rounded-md bg-gray-200" />
                  ) : (
                    <select id="category" value={form.category} onChange={(e) => handleChange('category', e.target.value)}
                      className={cn(
                        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                        fieldErrors.category && 'border-red-500'
                      )} required>
                      {categories.length === 0 ? (
                        <option value="">No expense categories — add one from Expenses</option>
                      ) : (
                        categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))
                      )}
                    </select>
                  )}
                  <FieldError message={fieldErrors.category} />
                  {categories.length === 0 && !loading && (
                    <p className="text-xs text-gray-500">
                      Create expense categories from the{' '}
                      <Link href="/expenses" className="text-blue-600 hover:underline">Expenses</Link>
                      {' '}page. Product categories are managed separately.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="original_invoice_num">Original Invoice Number</Label>
                  <Input id="original_invoice_num" value={form.original_invoice_num} onChange={(e) => handleChange('original_invoice_num', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input id="date" type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} className={cn(fieldErrors.date && 'border-red-500')} required />
                  <FieldError message={fieldErrors.date} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_mode">Payment Mode</Label>
                  <select id="payment_mode" value={form.payment_mode} onChange={(e) => handleChange('payment_mode', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input id="vendor" value={form.vendor} onChange={(e) => handleChange('vendor', e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="with_gst" checked={form.with_gst} onCheckedChange={(checked) => handleChange('with_gst', checked)} />
                    <Label htmlFor="with_gst" className="cursor-pointer">Include GST</Label>
                  </div>
                  {form.with_gst && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tax_rate">Tax Rate (%):</Label>
                      <Input id="tax_rate" type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={(e) => handleChange('tax_rate', Number(e.target.value))} className="w-24" />
                    </div>
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-6 items-end border rounded-lg p-3">
                      <div className="sm:col-span-2">
                        <Label htmlFor={`item-desc-${index}`} className="text-xs">Description *</Label>
                        <Input
                          id={`item-desc-${index}`}
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Item description"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`item-qty-${index}`} className="text-xs">Quantity</Label>
                        <Input
                          id={`item-qty-${index}`}
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`item-price-${index}`} className="text-xs">Unit Price</Label>
                        <Input
                          id={`item-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', Number(e.target.value))}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <div className="h-10 flex items-center px-3 bg-gray-50 rounded-md text-sm font-medium">
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                      <div>
                        {items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="w-full">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Section */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub Total:</span>
                  <span className="font-medium">{formatCurrency(subTotal)}</span>
                </div>
                {form.with_gst && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({form.tax_rate}%):</span>
                    <span className="font-medium">{formatCurrency(taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Expense Amount:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Create Expense
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  )
}
