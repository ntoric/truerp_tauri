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
}

interface Invoice {
  id: string
  invoice_number: string
  party_id: string
  total_amount: number
  status: string
}

interface CreditNoteItem {
  invoice_item_id?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  reason: string
}

export default function CreateCreditNotePage() {
  const router = useRouter()
  const { fieldErrors, clearFieldError, handleApiError, showErrorToast } = useFormErrors()
  const [form, setForm] = useState({
    invoice_id: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    refund_mode: 'cash',
  })
  const [items, setItems] = useState<CreditNoteItem[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 0, total: 0, reason: '' }
  ])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('/invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.filter((b: Invoice) => b.status === 'paid' || b.status === 'partial'))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceChange = (invoiceId: string) => {
    clearFieldError('invoice_id')
    setForm(prev => ({ ...prev, invoice_id: invoiceId }))
    const invoice = invoices.find(b => b.id === invoiceId)
    setSelectedInvoice(invoice || null)
  }

  const handleChange = (field: string, value: string) => {
    clearFieldError(field)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    const item = newItems[index]
    const itemTotal = item.quantity * item.unit_price
    item.total = itemTotal + (itemTotal * (item.tax_rate / 100))
    
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, tax_rate: 0, total: 0, reason: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const calculateTotals = () => {
    const total = items.reduce((sum, item) => sum + item.total, 0)
    return { total }
  }

  const { total } = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiFetch('/credit-notes', {
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
            reason: item.reason,
          })),
        }),
      })
      if (res.ok) {
        router.push('/credit-notes')
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
          <Button variant="ghost" size="sm" onClick={() => router.push('/credit-notes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Create Credit Note</h1>
        </div>
        
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Credit Note Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice_id">Sales Invoice *</Label>
                  {loading ? (
                    <div className="h-10 animate-pulse rounded-md bg-gray-200" />
                  ) : (
                    <select 
                      id="invoice_id" 
                      value={form.invoice_id} 
                      onChange={(e) => handleInvoiceChange(e.target.value)}
                      className={cn(
                        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                        fieldErrors.invoice_id && 'border-red-500'
                      )} 
                      required
                    >
                      <option value="">Select Invoice</option>
                      {invoices.map(invoice => (
                        <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} - {formatCurrency(invoice.total_amount)}</option>
                      ))}
                    </select>
                  )}
                  <FieldError message={fieldErrors.invoice_id} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={form.date} 
                    onChange={(e) => handleChange('date', e.target.value)} 
                    className={cn(fieldErrors.date && 'border-red-500')}
                    required 
                  />
                  <FieldError message={fieldErrors.date} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refund_mode">Refund Mode</Label>
                  <select 
                    id="refund_mode" 
                    value={form.refund_mode} 
                    onChange={(e) => handleChange('refund_mode', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="original_payment">Original Payment</option>
                    <option value="credit_note">Credit Note</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Credit Note</Label>
                <Input 
                  id="reason" 
                  value={form.reason} 
                  onChange={(e) => handleChange('reason', e.target.value)} 
                  placeholder="Reason for issuing credit note..."
                />
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
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Credit Amount:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Create Credit Note
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  )
}
