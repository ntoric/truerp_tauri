'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { parseItemNumber, parseMoney } from '@/lib/numbers'
import { Plus, Trash2, Loader2, Save } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'

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
  party_id: string
}

interface ChallanItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  batch_no: string
}

export default function CreateDeliveryChallanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const {
    fieldErrors,
    clearFieldError,
    setError,
    handleApiError,
    showErrorToast,
  } = useFormErrors()
  
  const [parties, setParties] = useState<Party[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [challanNumber, setChallanNumber] = useState('')
  const [partyId, setPartyId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('draft')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [transportMode, setTransportMode] = useState('road')
  const [items, setItems] = useState<ChallanItem[]>([
    { description: '', quantity: 1, unit: 'PCS', unit_price: 0, total: 0, batch_no: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [partiesRes, invoicesRes, numRes] = await Promise.all([
        apiFetch('/parties'),
        apiFetch('/invoices'),
        apiFetch('/delivery-challans/next-number'),
      ])
      if (partiesRes.ok) {
        const partyData = await partiesRes.json()
        setParties(partyData.filter((p: Party) => p.party_type === 'customer'))
      }
      if (invoicesRes.ok) {
        const invoiceData = await invoicesRes.json()
        setInvoices(invoiceData)
      }
      if (numRes.ok) {
        const numData = await numRes.json()
        setChallanNumber(numData.challan_number)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateItem = (index: number, field: keyof ChallanItem, value: any) => {
    if (field === 'description') clearFieldError('items')
    const newItems = [...items]
    let nextValue = value
    if (field === 'quantity') nextValue = parseItemNumber(value)
    if (field === 'unit_price') nextValue = parseMoney(value)
    newItems[index] = { ...newItems[index], [field]: nextValue }

    // Recalculate total
    const qty = parseItemNumber(newItems[index].quantity)
    const price = parseMoney(newItems[index].unit_price)
    newItems[index].quantity = qty
    newItems[index].unit_price = price
    newItems[index].total = qty * price

    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit: 'PCS', unit_price: 0, total: 0, batch_no: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const subTotal = items.reduce((sum, item) => sum + parseMoney(item.total), 0)
  const totalQuantity = items.reduce((sum, item) => sum + parseItemNumber(item.quantity), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const res = await apiFetch('/delivery-challans', {
        method: 'POST',
        body: JSON.stringify({
          challan_number: challanNumber,
          party_id: partyId,
          invoice_id: invoiceId || null,
          date: new Date(date).toISOString(),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          status,
          notes,
          terms,
          vehicle_number: vehicleNumber,
          transport_mode: transportMode,
          items: items.map(item => ({
            description: item.description,
            quantity: parseItemNumber(item.quantity),
            unit: item.unit,
            unit_price: parseMoney(item.unit_price),
            batch_no: item.batch_no
          }))
        })
      })
      if (res.ok) {
        router.push('/delivery-challans')
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      showErrorToast('An error occurred')
    } finally {
      setSaving(false)
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Create Delivery Challan</h1>
          <Button variant="outline" onClick={() => router.push('/delivery-challans')}>Cancel</Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Challan Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Challan Number</Label>
                <Input value={challanNumber} onChange={(e) => setChallanNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Party *</Label>
                <select
                  value={partyId}
                  onChange={(e) => {
                    clearFieldError('party_id')
                    setPartyId(e.target.value)
                  }}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    fieldErrors.party_id && 'border-red-500'
                  )}
                  required
                >
                  <option value="">Select Party</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <FieldError message={fieldErrors.party_id} />
              </div>
              <div className="space-y-2">
                <Label>Link Invoice (Optional)</Label>
                <select
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select Invoice</option>
                  {invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Challan Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Transport Mode</Label>
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="road">Road</option>
                  <option value="rail">Rail</option>
                  <option value="air">Air</option>
                  <option value="sea">Sea</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldError message={fieldErrors.items} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Quantity</th>
                      <th className="pb-2 font-medium">Unit</th>
                      <th className="pb-2 font-medium text-right">Unit Price</th>
                      <th className="pb-2 font-medium">Batch No</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="h-8"
                            required
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            className="h-8 w-20 text-right"
                            required
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="h-8 w-16"
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            className="h-8 w-24 text-right"
                            required
                          />
                        </td>
                        <td className="py-2">
                          <Input
                            value={item.batch_no}
                            onChange={(e) => updateItem(index, 'batch_no', e.target.value)}
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                        <td className="py-2">
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
                  <span className="text-gray-600">Total Quantity</span>
                  <span className="font-medium">{totalQuantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub Total</span>
                  <span className="font-medium">{formatCurrency(subTotal)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Amount</span>
                    <span>{formatCurrency(subTotal)}</span>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Delivery Challan
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
