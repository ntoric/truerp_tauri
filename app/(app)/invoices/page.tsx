'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadBlob, downloadCsv } from '@/lib/accountingExport'
import { notifyError, notifySuccess } from '@/lib/notify'
import { downloadInvoicePdf } from '@/lib/printDocument'
import { Plus, Search, FileText, Download, MoreVertical, Edit, X, Trash2, Eye, Upload, Loader2 } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface Invoice {
  id: string
  invoice_number: string
  customer?: { name: string }
  party?: { name: string }
  total_amount: number
  status: string
  date: string
  due_date?: string
  is_pos?: boolean
}

interface InvoiceStats {
  total_sales: number
  paid: number
  unpaid: number
  cancelled: number
}

const INVOICE_IMPORT_HEADERS = [
  'Invoice Number',
  'Date',
  'Party Name',
  'Due Date',
  'Status',
  'Payment Mode',
  'Amount Paid',
  'Is Inter State',
  'Notes',
  'Item Description',
  'Quantity',
  'Unit',
  'Unit Price',
  'Discount %',
  'Tax Rate %',
]

const INVOICE_IMPORT_SAMPLE_ROWS: (string | number)[][] = [
  ['INV-001', '2026-06-07', 'Acme Corp', '2026-07-07', 'sent', 'cash', 0, 'false', '', 'Widget A', 2, 'pcs', 500, 0, 18],
  ['INV-001', '2026-06-07', 'Acme Corp', '2026-07-07', 'sent', 'cash', 0, 'false', '', 'Widget B', 1, 'pcs', 300, 5, 18],
  ['', '2026-06-08', 'Test Customer', '', 'draft', '', 0, 'false', '', 'Consulting Service', 1, 'hrs', 5000, 0, 18],
]

export default function InvoicesPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats>({ total_sales: 0, paid: 0, unpaid: 0, cancelled: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement>(null)
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchInvoices()
    fetchStats()
  }, [filter, dateFrom, dateTo])

  useEffect(() => {
    if (previewId) {
      fetchPreview(previewId)
    } else {
      setPreviewData(null)
    }
  }, [previewId])

  const fetchInvoices = async () => {
    try {
      let url = '/invoices'
      const params = new URLSearchParams()
      if (filter) params.append('status', filter)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) setInvoices(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      let url = '/invoices/stats'
      const params = new URLSearchParams()
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) setStats(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const partyLabel = (inv: Invoice) => inv.party?.name || inv.customer?.name || 'N/A'

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    partyLabel(inv).toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredInvoices)

  useEffect(() => {
    resetPage()
    setSelectedInvoices(new Set())
  }, [search, filter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      sent: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
      overdue: 'bg-red-100 text-red-700',
      partial: 'bg-amber-100 text-amber-800',
      cancelled: 'bg-yellow-100 text-yellow-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || variants.draft}`}>{status}</span>
  }

  const getPosBadge = () => (
    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">POS</span>
  )

  const getDueIn = (dueDate?: string) => {
    if (!dueDate) return '-'
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)} days overdue`
    if (diff === 0) return 'Today'
    return `${diff} days`
  }

  const handleExport = async () => {
    try {
      await downloadCsv(
        `invoices_${accountingExportDateStamp()}.csv`,
        [
          ['Date', 'Invoice #', 'Party Name', 'Due In', 'Amount', 'Status'],
          ...filteredInvoices.map((inv) => [
            formatDate(inv.date),
            inv.invoice_number,
            partyLabel(inv),
            getDueIn(inv.due_date),
            formatCurrency(inv.total_amount),
            inv.status,
          ]),
        ],
        { label: 'Exporting invoices' }
      )
      notifySuccess('Invoices exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export invoices')
    }
  }

  const handleDownloadImportTemplate = () => {
    void downloadCsv(`sales_invoices_import_template_${accountingExportDateStamp()}.csv`, [
      INVOICE_IMPORT_HEADERS,
      ...INVOICE_IMPORT_SAMPLE_ROWS,
    ], { label: 'Exporting import template' })
  }

  const resetImportDialog = () => {
    setImportFile(null)
    setImportedCount(null)
    setImportErrors([])
    if (importFileRef.current) importFileRef.current.value = ''
  }

  const handleImportDialogChange = (open: boolean) => {
    setShowImportDialog(open)
    if (!open) resetImportDialog()
  }

  const handleImportInvoices = async () => {
    if (!importFile) {
      notifyError('Please select a CSV file to import')
      return
    }

    setImporting(true)
    setImportedCount(null)
    setImportErrors([])

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const res = await apiFetch('/invoices/import/csv', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        const count = data.imported ?? 0
        const errors: string[] = data.errors ?? []
        setImportedCount(count)
        setImportErrors(errors)

        if (count > 0) {
          fetchInvoices()
          fetchStats()
          notifySuccess(`Successfully imported ${count} invoice${count === 1 ? '' : 's'}`)
        }

        if (count === 0 && errors.length > 0) {
          notifyError('No invoices were imported. Please review the errors below.')
        } else if (errors.length > 0) {
          notifyError(`${errors.length} invoice${errors.length === 1 ? '' : 's'} could not be imported`)
        }
      } else {
        notifyError(data.error || 'Import failed')
      }
    } catch (err) {
      console.error(err)
      notifyError('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleCancelInvoice = async (id: string) => {
    try {
      const res = await apiFetch(`/invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', note: 'Cancelled from invoice list' })
      })
      if (res.ok) {
        fetchInvoices()
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteInvoice = async (id: string) => {
    if (!(await confirm({
      title: 'Delete invoice?',
      description: 'Are you sure you want to delete this invoice? Stock, payments, and accounts will be reversed. Stock transaction history is kept.',
    }))) return
    try {
      const res = await apiFetch(`/invoices/${id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Invoice deleted')
        fetchInvoices()
        fetchStats()
        return
      }
      const data = await res.json().catch(() => ({}))
      notifyError(data.error || 'Failed to delete invoice')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete invoice')
    }
  }

  const fetchPreview = async (id: string) => {
    try {
      setPreviewLoading(true)
      const res = await apiFetch(`/invoices/${id}`)
      if (res.ok) {
        setPreviewData(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewId(null)
    setPreviewData(null)
  }

  const handleDownloadPreviewPdf = async () => {
    if (!previewId || downloadingPdf) return
    setDownloadingPdf(true)
    try {
      await downloadInvoicePdf(previewId, {
        invoiceNumber: previewData?.invoice_number,
      })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to download PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllInvoices = () => {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set())
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)))
    }
  }

  const handleBulkExportInvoices = async () => {
    const selected = filteredInvoices.filter((inv) => selectedInvoices.has(inv.id))
    try {
      await downloadCsv(
        `selected-invoices_${accountingExportDateStamp()}.csv`,
        [
          ['Date', 'Invoice #', 'Party Name', 'Due In', 'Amount', 'Status'],
          ...selected.map((inv) => [
            formatDate(inv.date),
            inv.invoice_number,
            partyLabel(inv),
            getDueIn(inv.due_date),
            formatCurrency(inv.total_amount),
            inv.status,
          ]),
        ],
        { label: 'Exporting selected invoices' }
      )
      notifySuccess('Selected invoices exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export invoices')
    }
  }

  const handleBulkCancelInvoices = async () => {
    const eligible = filteredInvoices.filter(
      inv => selectedInvoices.has(inv.id) && inv.status !== 'cancelled' && inv.status !== 'paid'
    )
    if (eligible.length === 0) return
    try {
      await Promise.all(
        eligible.map(inv =>
          apiFetch(`/invoices/${inv.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled', note: 'Bulk cancelled from invoice list' })
          })
        )
      )
      setSelectedInvoices(new Set())
      fetchInvoices()
      fetchStats()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDeleteInvoices = async () => {
    if (!(await confirm({
      title: `Delete ${selectedInvoices.size} invoice(s)?`,
      description: `Are you sure you want to delete ${selectedInvoices.size} invoice(s)? Stock, payments, and accounts will be reversed for each invoice.`,
    }))) return
    try {
      const results = await Promise.all(
        Array.from(selectedInvoices).map(async (id) => {
          const res = await apiFetch(`/invoices/${id}`, { method: 'DELETE' })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            return data.error || 'Failed to delete invoice'
          }
          return null
        })
      )
      const errors = results.filter((msg): msg is string => Boolean(msg))
      if (errors.length === 0) {
        notifySuccess('Invoices deleted')
      } else if (errors.length < selectedInvoices.size) {
        notifyError(`${errors.length} invoice(s) could not be deleted`)
      } else {
        notifyError(errors[0] || 'Failed to delete invoices')
      }
      setSelectedInvoices(new Set())
      fetchInvoices()
      fetchStats()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete invoices')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <div className="flex gap-2">
            <Link href="/invoices/templates">
              <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Templates</Button>
            </Link>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 h-4 w-4" /> Bulk Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Link href="/invoices/create">
              <Button><Plus className="mr-2 h-4 w-4" /> New Invoice</Button>
            </Link>
          </div>
        </div>

        {/* Summary Widgets */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_sales)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.paid)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Unpaid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.unpaid)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Cancelled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.cancelled)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search invoices..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partial">Partially paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                {selectedInvoices.size > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedInvoices.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExportInvoices}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkCancelInvoices}>
                        Cancel
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteInvoices}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={filteredInvoices.length > 0 && selectedInvoices.size === filteredInvoices.length}
                          onChange={toggleSelectAllInvoices}
                        />
                      </th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Invoice #</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Due In</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedInvoices.has(inv.id)}
                            onChange={() => toggleSelectInvoice(inv.id)}
                          />
                        </td>
                        <td className="py-3 text-gray-500">{formatDate(inv.date)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreviewId(inv.id)}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {inv.invoice_number}
                            </button>
                            {inv.is_pos && getPosBadge()}
                          </div>
                        </td>
                        <td className="py-3 text-gray-600">{partyLabel(inv)}</td>
                        <td className="py-3 text-gray-500">{getDueIn(inv.due_date)}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(inv.total_amount)}</td>
                        <td className="py-3">{getStatusBadge(inv.status)}</td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setPreviewId(inv.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/invoices/create?id=${inv.id}`} className="flex items-center">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => handleCancelInvoice(inv.id)}>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No invoices found
                        </td>
                      </tr>
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
        {/* Preview Modal */}
        {previewId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {previewData?.invoice_number || 'Invoice Preview'}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadPreviewPdf()}
                    disabled={downloadingPdf}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PDF
                  </button>
                  <button
                    onClick={closePreview}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {previewLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
              ) : previewData ? (
                <div className="space-y-6 p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Invoice Date</p>
                      <p className="font-medium">{formatDate(previewData.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Due Date</p>
                      <p className="font-medium">{previewData.due_date ? formatDate(previewData.due_date) : '—'}</p>
                    </div>
                  </div>

                  {/* Party */}
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bill To</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{previewData.party?.name || 'N/A'}</p>
                    {previewData.party?.gstin && (
                      <p className="text-sm text-gray-600">GSTIN: {previewData.party.gstin}</p>
                    )}
                    {previewData.party?.address && (
                      <p className="text-sm text-gray-600">
                        {previewData.party.address}
                        {previewData.party.city && `, ${previewData.party.city}`}
                        {previewData.party.state && `, ${previewData.party.state}`}
                        {previewData.party.pincode && ` - ${previewData.party.pincode}`}
                      </p>
                    )}
                  </div>

                  {/* Status & Type */}
                  <div className="flex items-center gap-3">
                    {getStatusBadge(previewData.status)}
                    {previewData.is_inter_state && (
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">Inter-State</span>
                    )}
                    {previewData.payment_mode && (
                      <span className="text-sm text-gray-500">Mode: {previewData.payment_mode}</span>
                    )}
                  </div>

                  {/* Items */}
                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-700">Items</p>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-gray-600">
                            <th className="px-3 py-2 font-medium">Description</th>
                            <th className="px-3 py-2 font-medium text-right">Qty</th>
                            <th className="px-3 py-2 font-medium text-right">Rate</th>
                            <th className="px-3 py-2 font-medium text-right">Disc%</th>
                            <th className="px-3 py-2 font-medium text-right">Tax%</th>
                            <th className="px-3 py-2 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(previewData.items || []).map((item: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2">{item.description}</td>
                              <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                              <td className="px-3 py-2 text-right">{item.discount || 0}%</td>
                              <td className="px-3 py-2 text-right">{item.tax_rate || 0}%</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                          {(previewData.items || []).length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-gray-500">No items</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div>
                    <div className="w-full space-y-2 text-sm border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sub Total</span>
                        <span className="font-medium">{formatCurrency(previewData.sub_total)}</span>
                      </div>
                      {previewData.discount_total > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Discount</span>
                          <span className="font-medium text-red-600">-{formatCurrency(previewData.discount_total)}</span>
                        </div>
                      )}
                      {previewData.invoice_discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice Discount</span>
                          <span className="font-medium text-red-600">-{formatCurrency(previewData.invoice_discount)}</span>
                        </div>
                      )}
                      {previewData.additional_charges > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Additional Charges</span>
                          <span className="font-medium">{formatCurrency(previewData.additional_charges)}</span>
                        </div>
                      )}
                      {previewData.cgst_total > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">CGST</span>
                          <span className="font-medium">{formatCurrency(previewData.cgst_total)}</span>
                        </div>
                      )}
                      {previewData.sgst_total > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">SGST</span>
                          <span className="font-medium">{formatCurrency(previewData.sgst_total)}</span>
                        </div>
                      )}
                      {previewData.igst_total > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">IGST</span>
                          <span className="font-medium">{formatCurrency(previewData.igst_total)}</span>
                        </div>
                      )}
                      {previewData.round_off !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Round Off</span>
                          <span className="font-medium">{formatCurrency(previewData.round_off)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2 text-base font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(previewData.total_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount Paid</span>
                        <span className="font-medium text-green-600">{formatCurrency(previewData.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Balance</span>
                        <span className="font-medium text-orange-600">{formatCurrency(previewData.total_amount - previewData.amount_paid)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes / Terms */}
                  {(previewData.notes || previewData.terms) && (
                    <div className="space-y-2 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                      {previewData.notes && <p><span className="font-medium">Notes:</span> {previewData.notes}</p>}
                      {previewData.terms && <p><span className="font-medium">Terms:</span> {previewData.terms}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-gray-500">Failed to load preview</div>
              )}
            </div>
          </div>
        )}

      <Dialog open={showImportDialog} onOpenChange={handleImportDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Sales Invoices</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a CSV file to import sales invoices. Use the same invoice number on multiple rows to add multiple line items to one invoice. Party names must already exist in your contacts.
            </p>
            <Button variant="outline" onClick={handleDownloadImportTemplate} className="gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4" />
              Download Import Template
            </Button>
            <div className="space-y-2">
              <Label htmlFor="invoice_import_file">Import file</Label>
              <Input
                id="invoice_import_file"
                ref={importFileRef}
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile && (
                <p className="text-sm text-gray-500">Selected: {importFile.name}</p>
              )}
            </div>
            {importedCount !== null && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Imported {importedCount} invoice{importedCount === 1 ? '' : 's'} successfully.
              </div>
            )}
            {importErrors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {importErrors.map((error, index) => (
                  <p key={`${error}-${index}`}>{error}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleImportDialogChange(false)}>Cancel</Button>
            <Button onClick={handleImportInvoices} disabled={importing || !importFile}>
              {importing ? 'Importing...' : 'Import Invoices'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </DashboardLayout>
  )
}
