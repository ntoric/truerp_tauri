'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import { PAYMENT_METHODS, formatPaymentMethod } from '@/lib/paymentSplits'

interface PaymentOut {
  id: string
  amount_paid: number
  payment_out_discount: number
  payment_out_number: string
  mode: string
  date: string
  reference: string
  notes: string
  purchase_bill_id?: string
  sales_return_id?: string
  credit_note_id?: string
  invoice_id?: string
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
  sales_return?: {
    id: string
    return_number: string
  }
  credit_note?: {
    id: string
    credit_note_number: string
  }
  invoice?: {
    id: string
    invoice_number: string
  }
}

interface Party {
  id: string
  name: string
  party_type?: string
}

interface PurchaseBill {
  id: string
  bill_number: string
  party_id?: string
  vendor_id?: string
  total_amount: number
  paid_amount?: number
  balance_due: number
  status?: string
}

interface SalesReturnDoc {
  id: string
  return_number: string
  party_id: string
  status?: string
  refund_mode?: string
  amount?: number
  deduction_total?: number
  refund_amount?: number
}

interface CreditNoteDoc {
  id: string
  credit_note_number: string
  party_id: string
  status?: string
  total_amount: number
}

interface SalesInvoiceDoc {
  id: string
  invoice_number: string
  party_id: string
  status?: string
  total_amount: number
  amount_paid?: number
}

type BillDocKind = 'purchase_bill' | 'sales_return' | 'credit_note' | 'invoice'

interface BillDocOption {
  key: string
  kind: BillDocKind
  id: string
  number: string
  partyId: string
  due: number
}

const BILL_DOC_KIND_LABELS: Record<BillDocKind, string> = {
  purchase_bill: 'Purchase Bill',
  sales_return: 'Sales Return',
  credit_note: 'Credit Note',
  invoice: 'Sales Invoice',
}

// Refund modes that pay money out (mirroring the backend's
// refundSettlesInMoney). Credit-settled returns issue a credit note
// instead — the note itself is what appears in the picker.
const MONEY_REFUND_MODES = new Set([
  'cash',
  'bank',
  'upi',
  'card',
  'cheque',
  'bank_transfer',
  'original_payment',
])

const emptyForm = () => ({
  party_id: '',
  bill_key: '',
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

// Outstanding amount on a bill. total - paid is authoritative; balance_due
// can be stale on older rows, so take the larger of the two.
function billDue(bill: PurchaseBill) {
  const derived = (bill.total_amount ?? 0) - (bill.paid_amount ?? 0)
  return Math.max(bill.balance_due ?? 0, derived, 0)
}

export default function PaymentOutsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm, confirmDialog } = useConfirmDialog()
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
  const [parties, setParties] = useState<Party[]>([])
  const [bills, setBills] = useState<PurchaseBill[]>([])
  const [salesReturns, setSalesReturns] = useState<SalesReturnDoc[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNoteDoc[]>([])
  const [invoices, setInvoices] = useState<SalesInvoiceDoc[]>([])
  // Return/credit-note ids that already have a payment out recorded —
  // a refunded document must not be offered for payment again.
  const [paidDocIds, setPaidDocIds] = useState<Set<string>>(new Set())
  // Net amount already refunded against each sales invoice — the picker
  // offers only the unrefunded share of what the invoice received.
  const [invoiceRefunds, setInvoiceRefunds] = useState<Map<string, number>>(new Map())
  const [docsLoading, setDocsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [partyFilter, setPartyFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  // Bills are only needed inside the create dialog and are fetched on open
  // (handleDialogOpenChange), so the page doesn't pull the full bills table
  // on every load.
  useEffect(() => {
    fetchParties()
  }, [])

  useEffect(() => {
    fetchPaymentOuts()
  }, [debouncedSearch, partyFilter, modeFilter, dateFrom, dateTo, page])

  // Debounce the search box so each keystroke doesn't hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  function getPartyName(paymentOut: PaymentOut) {
    return paymentOut.party?.name || paymentOut.vendor?.name || '-'
  }

  function getDocNumber(paymentOut: PaymentOut) {
    return (
      paymentOut.purchase_bill?.bill_number ||
      paymentOut.sales_return?.return_number ||
      paymentOut.credit_note?.credit_note_number ||
      paymentOut.invoice?.invoice_number ||
      '-'
    )
  }

  function getNetAmount(paymentOut: PaymentOut) {
    return paymentOut.amount_paid - paymentOut.payment_out_discount
  }

  const buildPaymentOutParams = (targetPage: number, perPage: number) => {
    const params = new URLSearchParams()
    if (partyFilter !== 'all') params.append('party_id', partyFilter)
    if (modeFilter !== 'all') params.append('mode', modeFilter)
    if (dateFrom) params.append('from', dateFrom)
    if (dateTo) params.append('to', dateTo)
    if (debouncedSearch) params.append('search', debouncedSearch)
    params.append('page', String(targetPage))
    params.append('per_page', String(perPage))
    return params
  }

  const fetchPaymentOuts = async () => {
    try {
      const res = await apiFetch(`/payment-outs?${buildPaymentOutParams(page, pageSize).toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows: PaymentOut[] = Array.isArray(data)
          ? data
          : data?.payment_outs ?? (Array.isArray(data?.data) ? data.data : [])
        // The current page may no longer exist after deletions or filter changes.
        const maxPage = Math.max(1, Math.ceil((data.total ?? rows.length) / pageSize))
        if (page > maxPage) {
          setPage(maxPage)
          return
        }
        setPaymentOuts(rows)
        setTotal(data.total ?? rows.length)
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

  // Payment outs can go to vendors or customers (e.g. refunds), so the
  // picker lists every party, grouped by type in the dropdown.
  const fetchParties = async () => {
    try {
      const res = await apiFetch('/parties')
      if (res.ok) {
        const data = await res.json()
        const list: Party[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        // When arriving from the parties page, the preselected party may be
        // missing from the list — fetch it so it still appears in the dropdown.
        const preselectId = searchParams.get('party_id')
        if (preselectId && !list.some((p) => p.id === preselectId)) {
          const partyRes = await apiFetch(`/parties/${preselectId}`)
          if (partyRes.ok) {
            const party = await partyRes.json()
            if (party?.id) {
              list.unshift({ id: party.id, name: party.name, party_type: party.party_type })
            }
          }
        }
        setParties(list)
      } else {
        showErrorToast('Unable to load parties', 'Load failed')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load parties. Please try again.')
    }
  }

  // The Bill picker offers every document money can still go out against:
  // unpaid purchase bills, sales returns awaiting a money refund, issued
  // credit notes not yet refunded, and sales invoices with money received
  // that can be refunded (a standalone refund when no return doc exists).
  const fetchPayableDocs = async () => {
    setDocsLoading(true)
    try {
      const [billsRes, returnsRes, notesRes, invoicesRes, paidRes] = await Promise.all([
        // payable=true returns only bills that still owe money — the picker
        // never offers fully-paid bills anyway.
        apiFetch('/purchase/bills?payable=true'),
        apiFetch('/sales-returns'),
        apiFetch('/credit-notes'),
        apiFetch('/invoices?per_page=0'),
        apiFetch('/payment-outs?per_page=0'),
      ])
      if (billsRes.ok) {
        const data = await billsRes.json()
        setBills(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : (Array.isArray(data?.bills) ? data.bills : []))
      } else {
        showErrorToast('Unable to load purchase bills', 'Load failed')
      }
      if (returnsRes.ok) {
        const data = await returnsRes.json()
        setSalesReturns(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
      } else {
        showErrorToast('Unable to load sales returns', 'Load failed')
      }
      if (notesRes.ok) {
        const data = await notesRes.json()
        setCreditNotes(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
      } else {
        showErrorToast('Unable to load credit notes', 'Load failed')
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        const rows: SalesInvoiceDoc[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.invoices)
            ? data.invoices
            : Array.isArray(data?.data)
              ? data.data
              : []
        setInvoices(rows)
      } else {
        showErrorToast('Unable to load sales invoices', 'Load failed')
      }
      if (paidRes.ok) {
        const data = await paidRes.json()
        const rows: PaymentOut[] = Array.isArray(data)
          ? data
          : data?.payment_outs ?? (Array.isArray(data?.data) ? data.data : [])
        const paid = new Set<string>()
        const refunded = new Map<string, number>()
        for (const row of rows) {
          if (row.sales_return_id) paid.add(row.sales_return_id)
          if (row.credit_note_id) paid.add(row.credit_note_id)
          if (row.invoice_id) {
            const net = row.amount_paid - row.payment_out_discount
            refunded.set(row.invoice_id, (refunded.get(row.invoice_id) ?? 0) + net)
          }
        }
        setPaidDocIds(paid)
        setInvoiceRefunds(refunded)
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load bills. Please try again.')
    } finally {
      setDocsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(emptyForm())
    clearErrors()
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      resetForm()
      return
    }
    // Refresh so documents created or paid since page load are reflected.
    void fetchPayableDocs()
  }

  const autoCreateHandled = useRef(false)
  useEffect(() => {
    if (autoCreateHandled.current) return
    if (searchParams.get('create') !== 'true') return
    autoCreateHandled.current = true
    const partyId = searchParams.get('party_id')
    if (partyId) {
      setFormData((prev) => ({ ...prev, party_id: partyId }))
      void (async () => {
        try {
          const res = await apiFetch(`/parties/${partyId}`)
          if (res.ok) {
            const party = await res.json()
            if (party?.id) {
              setParties((prev) =>
                prev.some((p) => p.id === party.id)
                  ? prev
                  : [{ id: party.id, name: party.name, party_type: party.party_type }, ...prev]
              )
            }
          }
        } catch (err) {
          console.error(err)
        }
      })()
    }
    handleDialogOpenChange(true)
    router.replace('/payment-outs', { scroll: false })
  }, [searchParams, router])

  const handlePartyChange = (value: string) => {
    clearFieldError('party_id')
    const currentDoc = formData.bill_key ? docByKey.get(formData.bill_key) : undefined
    setFormData({
      ...formData,
      party_id: value,
      bill_key: currentDoc && currentDoc.partyId === value ? formData.bill_key : '',
    })
  }

  const handleDocChange = (value: string) => {
    clearFieldError('bill')
    const doc = docByKey.get(value)
    setFormData({
      ...formData,
      bill_key: value,
      party_id: doc && doc.partyId ? doc.partyId : formData.party_id,
      amount_paid:
        doc && !formData.amount_paid && doc.due > 0
          ? String(doc.due)
          : formData.amount_paid,
    })
    if (doc && doc.partyId) clearFieldError('party_id')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !validateRequired(formData, {
        party_id: 'Party',
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

      const linkedDoc = formData.bill_key ? docByKey.get(formData.bill_key) : undefined
      if (linkedDoc) {
        if (linkedDoc.kind === 'purchase_bill') {
          payload.purchase_bill_id = linkedDoc.id
        } else if (linkedDoc.kind === 'sales_return') {
          payload.sales_return_id = linkedDoc.id
        } else if (linkedDoc.kind === 'invoice') {
          payload.invoice_id = linkedDoc.id
        } else {
          payload.credit_note_id = linkedDoc.id
        }
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
    if (!(await confirm({
      title: 'Delete payment out?',
      description: 'Are you sure you want to delete this payment out? This action cannot be undone.',
    }))) return
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

  const handleExport = async () => {
    try {
      // Export every row matching the active filters, not just the current page.
      const res = await apiFetch(`/payment-outs?${buildPaymentOutParams(1, 0).toString()}`, { timeoutMs: 30000 })
      if (!res.ok) {
        showErrorToast('Unable to export payment outs', 'Export failed')
        return
      }
      const data = await res.json()
      const exportRows: PaymentOut[] = Array.isArray(data)
        ? data
        : data?.payment_outs ?? (Array.isArray(data?.data) ? data.data : [])
      const rows: (string | number)[][] = [
        [
          'Date',
          'Payment Out Number',
          'Party',
          'Bill #',
          'Amount Paid',
          'Discount',
          'Net Amount',
          'Mode',
          'Reference',
          'Notes',
        ],
        ...exportRows.map((paymentOut) => [
          formatDate(paymentOut.date),
          paymentOut.payment_out_number || '',
          getPartyName(paymentOut),
          getDocNumber(paymentOut),
          paymentOut.amount_paid,
          paymentOut.payment_out_discount,
          getNetAmount(paymentOut),
          paymentOut.mode,
          paymentOut.reference || '',
          paymentOut.notes || '',
        ]),
      ]
      await downloadCsv(`payment_outs_${accountingExportDateStamp()}.csv`, rows, { label: 'Exporting payment outs' })
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to export payment outs. Please try again.')
    }
  }

  const hasActiveFilters =
    search !== '' ||
    partyFilter !== 'all' ||
    modeFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setPartyFilter('all')
    setModeFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // Every document a payment out can still settle: purchase bills owing
  // money, sales returns awaiting a money refund, issued credit notes not
  // yet refunded, and sales invoices with a refundable paid amount. Returns
  // settled as credit appear through their issued credit note instead of
  // the return itself.
  const billDocs: BillDocOption[] = []
  for (const bill of bills) {
    if (bill.status === 'paid') continue
    const due = billDue(bill)
    if (due <= 0) continue
    billDocs.push({
      key: `purchase_bill:${bill.id}`,
      kind: 'purchase_bill',
      id: bill.id,
      number: bill.bill_number,
      partyId: billPartyId(bill),
      due,
    })
  }
  for (const ret of salesReturns) {
    if (ret.status === 'cancelled') continue
    if (!MONEY_REFUND_MODES.has((ret.refund_mode || '').toLowerCase())) continue
    if (paidDocIds.has(ret.id)) continue
    const due = ret.refund_amount ?? Math.max((ret.amount ?? 0) - (ret.deduction_total ?? 0), 0)
    if (due <= 0) continue
    billDocs.push({
      key: `sales_return:${ret.id}`,
      kind: 'sales_return',
      id: ret.id,
      number: ret.return_number,
      partyId: ret.party_id,
      due,
    })
  }
  for (const note of creditNotes) {
    if (note.status !== 'issued' || note.total_amount <= 0) continue
    if (paidDocIds.has(note.id)) continue
    billDocs.push({
      key: `credit_note:${note.id}`,
      kind: 'credit_note',
      id: note.id,
      number: note.credit_note_number,
      partyId: note.party_id,
      due: note.total_amount,
    })
  }
  // A refund tagged to an invoice settles in money — the invoice itself
  // stays untouched — so the refundable amount is what it received minus
  // what earlier payment outs already refunded.
  for (const invoice of invoices) {
    if (invoice.status === 'draft' || invoice.status === 'cancelled') continue
    const due = Math.max((invoice.amount_paid ?? 0) - (invoiceRefunds.get(invoice.id) ?? 0), 0)
    if (due <= 0) continue
    billDocs.push({
      key: `invoice:${invoice.id}`,
      kind: 'invoice',
      id: invoice.id,
      number: invoice.invoice_number,
      partyId: invoice.party_id,
      due,
    })
  }
  const docByKey = new Map(billDocs.map((d) => [d.key, d]))
  const filteredDocs = billDocs.filter((d) => !formData.party_id || d.partyId === formData.party_id)

  const getModeIcon = (mode: string) => {
    const colors: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      upi: 'bg-blue-100 text-blue-700',
      bank_transfer: 'bg-purple-100 text-purple-700',
      cheque: 'bg-orange-100 text-orange-700',
      card: 'bg-pink-100 text-pink-700',
      initial_investment: 'bg-amber-100 text-amber-800',
    }
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[mode] || 'bg-gray-100 text-gray-700'}`}
      >
        {formatPaymentMethod(mode)}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Payments Out</h1>
          <PageHeaderActions>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || total === 0}
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
                      <Label htmlFor="party">Party *</Label>
                      <SearchableSelect
                        value={formData.party_id}
                        onValueChange={handlePartyChange}
                        options={parties.map((party) => ({
                          value: party.id,
                          label:
                            party.party_type === 'customer'
                              ? `${party.name} (Customer)`
                              : party.name,
                        }))}
                        placeholder="Select vendor or customer"
                        searchPlaceholder="Search parties..."
                        emptyMessage="No parties found"
                        clearable
                        className={cn(fieldErrors.party_id && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.party_id || fieldErrors.PartyID} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bill">Bill / Document (Optional)</Label>
                      <SearchableSelect
                        value={formData.bill_key}
                        onValueChange={handleDocChange}
                        options={filteredDocs.map((doc) => ({
                          value: doc.key,
                          label: `${doc.number} (${BILL_DOC_KIND_LABELS[doc.kind]}) - ${formatCurrency(doc.due)} ${doc.kind === 'invoice' ? 'refundable' : 'due'}`,
                        }))}
                        placeholder="Select bill or invoice"
                        searchPlaceholder="Search bills, invoices..."
                        emptyMessage={
                          docsLoading
                            ? 'Loading bills…'
                            : formData.party_id
                              ? 'No bills due for this party'
                              : 'No bills found'
                        }
                        clearable
                        className={cn(fieldErrors.bill && 'border-red-500')}
                      />
                      <FieldError
                        message={
                          fieldErrors.bill ||
                          fieldErrors.purchase_bill_id ||
                          fieldErrors.sales_return_id ||
                          fieldErrors.credit_note_id ||
                          fieldErrors.invoice_id
                        }
                      />
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
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
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
          </PageHeaderActions>
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
              <Select
                value={partyFilter}
                onValueChange={(value) => {
                  setPartyFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parties</SelectItem>
                  {parties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={modeFilter}
                onValueChange={(value) => {
                  setModeFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Payment mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                aria-label="From date"
              />
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
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
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Payment ID</th>
                      <th className="pb-3 font-medium">Party Name</th>
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
                          {hasActiveFilters
                            ? 'No payment outs match your filters'
                            : 'No payment outs recorded yet'}
                        </td>
                      </tr>
                    ) : (
                      paymentOuts.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 text-gray-600">{formatDate(p.date)}</td>
                          <td className="py-3 font-mono text-xs text-gray-600">{p.id.slice(0, 8)}...</td>
                          <td className="py-3 font-medium text-gray-900">{getPartyName(p)}</td>
                          <td className="py-3 text-gray-600">{getDocNumber(p)}</td>
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
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </CardContent>
        </Card>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
