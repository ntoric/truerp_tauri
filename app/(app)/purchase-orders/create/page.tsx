'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { Save, Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'

interface Party {
  id: string
  name: string
  party_type: string
}

interface PurchaseOrderItem {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total: number
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter()
  const { fieldErrors, clearFieldError, handleApiError, showErrorToast } = useFormErrors()
  const [form, setForm] = useState({
    party_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    notes: '',
    terms: '',
  })
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_amount: 0, total: 0 }
  ])
  const [parties, setParties] = useState<Party[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = async () => {
    try {
      const res = await apiFetch('/parties')
      if (res.ok) {
        const data = await res.json()
        setParties(data.filter((p: Party) => p.party_type === 'vendor'))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    clearFieldError(field)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    if (field === 'description') clearFieldError('items')
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    const item = newItems[index]
    const itemTotal = item.quantity * item.unit_price
    item.tax_amount = itemTotal * (item.tax_rate / 100)
    item.total = itemTotal + item.tax_amount
    
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_amount: 0, total: 0 }])
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
      const res = await apiFetch('/purchase/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          order_date: new Date(form.order_date).toISOString(),
          expected_date: form.expected_date ? new Date(form.expected_date).toISOString() : null,
          items: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
          })),
        }),
      })
      if (res.ok) {
        router.push('/purchase-orders')
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
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/purchase-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Create Purchase Order</h1>
        </div>
        
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="party_id">Vendor *</Label>
                  {loading ? (
                    <div className="h-10 animate-pulse rounded-md bg-gray-200" />
                  ) : (
                    <select 
                      id="party_id" 
                      value={form.party_id} 
                      onChange={(e) => handleChange('party_id', e.target.value)}
                      className={cn(
                        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                        fieldErrors.party_id && 'border-red-500'
                      )} 
                      required
                    >
                      <option value="">Select Vendor</option>
                      {parties.map(party => (
                        <option key={party.id} value={party.id}>{party.name}</option>
                      ))}
                    </select>
                  )}
                  <FieldError message={fieldErrors.party_id} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_date">Order Date *</Label>
                  <Input 
                    id="order_date" 
                    type="date" 
                    value={form.order_date} 
                    onChange={(e) => handleChange('order_date', e.target.value)} 
                    className={cn(fieldErrors.order_date && 'border-red-500')}
                    required 
                  />
                  <FieldError message={fieldErrors.order_date} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected_date">Expected Delivery Date</Label>
                  <Input 
                    id="expected_date" 
                    type="date" 
                    value={form.expected_date} 
                    onChange={(e) => handleChange('expected_date', e.target.value)} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input 
                  id="notes" 
                  value={form.notes} 
                  onChange={(e) => handleChange('notes', e.target.value)} 
                  placeholder="Any additional notes..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Input 
                  id="terms" 
                  value={form.terms} 
                  onChange={(e) => handleChange('terms', e.target.value)} 
                  placeholder="Payment terms, delivery terms, etc."
                />
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <FieldError message={fieldErrors.items} />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-7 items-end border rounded-lg p-3">
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
                        <Label htmlFor={`item-tax-${index}`} className="text-xs">Tax %</Label>
                        <Input
                          id={`item-tax-${index}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.tax_rate}
                          onChange={(e) => handleItemChange(index, 'tax_rate', Number(e.target.value))}
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax Total:</span>
                  <span className="font-medium">{formatCurrency(taxTotal)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Create Purchase Order
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  )
}
