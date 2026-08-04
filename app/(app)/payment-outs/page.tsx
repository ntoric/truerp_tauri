'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { Plus, Search, Download, MoreVertical, Trash2 } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'

interface PaymentOut {
  id: string
  amount_paid: number
  payment_out_discount: number
  payment_out_number: string
  mode: string
  date: string
  reference: string
  notes: string
  party?: {
    id: string
    name: string
  }
  vendor?: {
    id: string
    name: string
  }
  purchase_bill?: {
    id: string
    bill_number: string
  }
}

interface Vendor {
  id: string
  name: string
}

interface PurchaseBill {
  id: string
  bill_number: string
  party_id?: string
  vendor_id?: string
  total_amount: number
  balance_due: number
}

const emptyForm = () => ({
  party_id: '',
  purchase_bill_id: '',
  amount_paid: '',
  payment_out_discount: '0',
  payment_out_number: '',
  mode: '',
  date: new Date().toISOString().split('T')[0],
  reference: '',
  notes: '',
})

function billPartyId(bill: PurchaseBill) {
  return bill.party_id || bill.vendor_id || ''
}

export default function PaymentOutsPage() {
  const {
    fieldErrors,
    clearErrors,
    clearFieldError,
    setError,
    validateRequired,
    handleApiError,
    showErrorToast,
    showSuccessToast,
  } = useFormErrors()
  const [paymentOuts, setPaymentOuts] = useState<PaymentOut[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [bills, setBills] = useState<PurchaseBill[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    fetchVendors()
    fetchBills()
  }, [])

  useEffect(() => {
    fetchPaymentOuts()
  }, [vendorFilter])

  function getVendorName(paymentOut: PaymentOut) {
    return paymentOut.party?.name || paymentOut.vendor?.name || '-'
  }

  function getBillNumber(paymentOut: PaymentOut) {
    return paymentOut.purchase_bill?.bill_number || '-'
  }

  function getNetAmount(paymentOut: PaymentOut) {
    return paymentOut.amount_paid - paymentOut.payment_out_discount
  }

  const filteredPaymentOuts = paymentOuts.filter((paymentOut) => {
    const query = search.toLowerCase()
    const vendorName = getVendorName(paymentOut).toLowerCase()
    const paymentDate = paymentOut.date.split('T')[0]

    const matchesSearch =
      !search ||
      vendorName.includes(query) ||
      paymentOut.purchase_bill?.bill_number?.toLowerCase().includes(query) ||
      paymentOut.payment_out_number?.toLowerCase().includes(query) ||
      paymentOut.reference?.toLowerCase().includes(query) ||
      paymentOut.notes?.toLowerCase().includes(query) ||
      paymentOut.mode?.toLowerCase().includes(query)

    const matchesVendor =
      vendorFilter === 'all' ||
      paymentOut.party?.id === vendorFilter ||
      paymentOut.vendor?.id === vendorFilter
    const matchesMode = modeFilter === 'all' || paymentOut.mode === modeFilter
    const matchesDateFrom = !dateFrom || paymentDate >= dateFrom
    const matchesDateTo = !dateTo || paymentDate <= dateTo

    return matchesSearch && matchesVendor && matchesMode && matchesDateFrom && matchesDateTo
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } =
    usePagination(filteredPaymentOuts)

  useEffect(() => {
    resetPage()
  }, [search, vendorFilter, modeFilter, dateFrom, dateTo])

  const fetchPaymentOuts = async () => {
    try {
      let url = '/payment-outs'
      if (vendorFilter !== 'all') {
        url += `?party_id=${vendorFilter}`
      }
      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        setPaymentOuts(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
      } else {
        showErrorToast('Unable to load payment outs', 'Load failed')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load payment outs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchVendors = async () => {
    try {
      const res = await apiFetch('/parties?party_type=vendor')
      if (res.ok) {
        const data = await res.json()
        setVendors(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
      } else {
        showErrorToast('Unable to load vendors', 'Load failed')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load vendors. Please try again.')
    }
  }

  const fetchBills = async () => {
    try {
      const res = await apiFetch('/purchase/bills')
      if (res.ok) {
        const data = await res.json()
        setBills(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
      } else {
        showErrorToast('Unable to load purchase bills', 'Load failed')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load purchase bills. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData(emptyForm())
    clearErrors()
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) resetForm()
  }

  const handleVendorChange = (value: string) => {
    clearFieldError('party_id')
    const currentBill = bills.find((b) => b.id === formData.purchase_bill_id)
    const billMatches = currentBill && billPartyId(currentBill) === value
    setFormData({
      ...formData,
      party_id: value,
      purchase_bill_id: billMatches ? formData.purchase_bill_id : '',
    })
  }

  const handleBillChange = (value: string) => {
    clearFieldError('purchase_bill_id')
    const bill = bills.find((b) => b.id === value)
    setFormData({
      ...formData,
      purchase_bill_id: value,
      party_id: bill ? billPartyId(bill) || formData.party_id : formData.party_id,
      amount_paid:
        bill && bill.balance_due != null && !formData.amount_paid
          ? String(bill.balance_due)
          : formData.amount_paid,
    })
    if (bill && billPartyId(bill)) clearFieldError('party_id')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !validateRequired(formData, {
        party_id: 'Vendor',
        amount_paid: 'Amount paid',
        mode: 'Payment mode',
        date: 'Payment date',
      })
    ) {
      return
    }

    const amountPaid = parseFloat(formData.amount_paid)
    const discount = parseFloat(formData.payment_out_discount || '0')
    if (Number.isNaN(amountPaid) || amountPaid <= 0) {
      setError('amount_paid', 'Amount paid must be greater than 0')
      showErrorToast('Amount paid must be greater than 0', 'Invalid amount')
      return
    }
    if (Number.isNaN(discount) || discount < 0) {
      setError('payment_out_discount', 'Discount cannot be negative')
      showErrorToast('Discount cannot be negative', 'Invalid discount')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, string | number> = {
        party_id: formData.party_id,
        amount_paid: amountPaid,
        payment_out_discount: discount,
        payment_out_number: formData.payment_out_number,
        mode: formData.mode,
        date: new Date(formData.date).toISOString(),
        reference: formData.reference,
        notes: formData.notes,
      }

      if (formData.purchase_bill_id) {
        payload.purchase_bill_id = formData.purchase_bill_id
      }

      const res = await apiFetch('/payment-outs', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        showSuccessToast('Payment out created successfully')
        handleDialogOpenChange(false)
        fetchPaymentOuts()
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to create payment out. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment out?')) return
    try {
      const res = await apiFetch(`/payment-outs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccessToast('Payment out deleted')
        fetchPaymentOuts()
      } else {
        await handleApiError(res, { toastTitle: 'Unable to delete' })
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to delete payment out. Please try again.')
    }
  }

  const handleExport = () => {
    const rows: (string | number)[][] = [
      [
        'Date',
        'Payment Out Number',
        'Vendor',
        'Bill #',
        'Amount Paid',
        'Discount',
        'Net Amount',
        'Mode',
        'Reference',
        'Notes',
      ],
      ...filteredPaymentOuts.map((paymentOut) => [
        formatDate(paymentOut.date),
        paymentOut.payment_out_number || '',
        getVendorName(paymentOut),
        getBillNumber(paymentOut),
        paymentOut.amount_paid,
        paymentOut.payment_out_discount,
        getNetAmount(paymentOut),
        paymentOut.mode,
        paymentOut.reference || '',
        paymentOut.notes || '',
      ]),
    ]
    downloadCsv(`payment_outs_${accountingExportDateStamp()}.csv`, rows)
  }

  const hasActiveFilters =
    search !== '' ||
    vendorFilter !== 'all' ||
    modeFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  const clearFilters = () => {
    setSearch('')
    setVendorFilter('all')
    setModeFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const filteredBills = bills.filter(
    (b) => !formData.party_id || billPartyId(b) === formData.party_id
  )

  const getModeIcon = (mode: string) => {
    const colors: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      upi: 'bg-blue-100 text-blue-700',
      bank_transfer: 'bg-purple-100 text-purple-700',
      cheque: 'bg-orange-100 text-orange-700',
      card: 'bg-pink-100 text-pink-700',
    }
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[mode] || 'bg-gray-100 text-gray-700'}`}
      >
        {mode.replace('_', ' ')}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Payments Out</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || filteredPaymentOuts.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Payment Out
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Payment Out</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="vendor">Vendor Name *</Label>
                      <Select value={formData.party_id || undefined} onValueChange={handleVendorChange}>
                        <SelectTrigger
                          className={cn(fieldErrors.party_id && 'border-red-500 focus:ring-red-500')}
                        >
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-gray-500">No vendors found</div>
                          ) : (
                            vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FieldError message={fieldErrors.party_id || fieldErrors.PartyID} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="purchase_bill">Purchase Bill (Optional)</Label>
                      <Select
                        value={formData.purchase_bill_id || undefined}
                        onValueChange={handleBillChange}
                      >
                        <SelectTrigger
                          className={cn(
                            fieldErrors.purchase_bill_id && 'border-red-500 focus:ring-red-500'
                          )}
                        >
                          <SelectValue placeholder="Select bill" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredBills.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-gray-500">
                              {formData.party_id
                                ? 'No bills due for this vendor'
                                : 'No purchase bills found'}
                            </div>
                          ) : (
                            filteredBills.map((bill) => (
                              <SelectItem key={bill.id} value={bill.id}>
                                {bill.bill_number} - {formatCurrency(bill.balance_due)} due
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FieldError message={fieldErrors.purchase_bill_id} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="amount_paid">Amount Paid *</Label>
                      <Input
                        id="amount_paid"
                        type="number"
                        step="0.01"
                        value={formData.amount_paid}
                        onChange={(e) => {
                          clearFieldError('amount_paid')
                          setFormData({ ...formData, amount_paid: e.target.value })
                        }}
                        className={cn(fieldErrors.amount_paid && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.amount_paid} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="payment_out_discount">Payment Out Discount</Label>
                      <Input
                        id="payment_out_discount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={formData.payment_out_discount}
                        onChange={(e) => {
                          clearFieldError('payment_out_discount')
                          setFormData({ ...formData, payment_out_discount: e.target.value })
                        }}
                        onBlur={() => {
                          if (formData.payment_out_discount === '' || Number.isNaN(parseFloat(formData.payment_out_discount))) {
                            setFormData({ ...formData, payment_out_discount: '0' })
                          }
                        }}
                        className={cn(fieldErrors.payment_out_discount && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.payment_out_discount} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="payment_out_number">Payment Out Number</Label>
                      <Input
                        id="payment_out_number"
                        value={formData.payment_out_number}
                        onChange={(e) =>
                          setFormData({ ...formData, payment_out_number: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mode">Payment Mode *</Label>
                      <Select
                        value={formData.mode || undefined}
                        onValueChange={(value) => {
                          clearFieldError('mode')
                          setFormData({ ...formData, mode: value })
                        }}
                      >
                        <SelectTrigger
                          className={cn(fieldErrors.mode && 'border-red-500 focus:ring-red-500')}
                        >
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError message={fieldErrors.mode} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="date">Payment Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => {
                          clearFieldError('date')
                          setFormData({ ...formData, date: e.target.value })
                        }}
                        className={cn(fieldErrors.date && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.date} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reference">Reference</Label>
                      <Input
                        id="reference"
                        value={formData.reference}
                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogOpenChange(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Payment'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="mb-4">Payment Out History</CardTitle>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search payments..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Payment mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
              />
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Payment ID</th>
                      <th className="pb-3 font-medium">Vendor Name</th>
                      <th className="pb-3 font-medium">Bill #</th>
                      <th className="pb-3 font-medium">Amount Paid</th>
                      <th className="pb-3 font-medium">Discount</th>
                      <th className="pb-3 font-medium">Net Amount</th>
                      <th className="pb-3 font-medium">Payment Mode</th>
                      <th className="pb-3 font-medium">Payment Out Number</th>
                      <th className="pb-3 font-medium">Notes</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentOuts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-gray-500">
                          No payment outs recorded yet
                        </td>
                      </tr>
                    ) : filteredPaymentOuts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-gray-500">
                          No payment outs match your filters
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 text-gray-600">{formatDate(p.date)}</td>
                          <td className="py-3 font-mono text-xs text-gray-600">{p.id.slice(0, 8)}...</td>
                          <td className="py-3 font-medium text-gray-900">{getVendorName(p)}</td>
                          <td className="py-3 text-gray-600">{getBillNumber(p)}</td>
                          <td className="py-3 font-medium text-gray-900">{formatCurrency(p.amount_paid)}</td>
                          <td className="py-3 font-medium text-gray-900">
                            {formatCurrency(p.payment_out_discount)}
                          </td>
                          <td className="py-3 font-medium text-gray-900">{formatCurrency(getNetAmount(p))}</td>
                          <td className="py-3">{getModeIcon(p.mode)}</td>
                          <td className="py-3 text-gray-600">{p.payment_out_number || '-'}</td>
                          <td className="py-3 text-gray-600">{p.notes || '-'}</td>
                          <td className="py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleDelete(p.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && (
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
