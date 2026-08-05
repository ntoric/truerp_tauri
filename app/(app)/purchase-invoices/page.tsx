'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Download, MoreVertical, Edit, X, Trash2, Printer, Eye, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { notifyError } from '@/lib/notify'
import { downloadPurchaseBillPdf, printHtmlDocument } from '@/lib/printDocument'
import { printBarcodeLabels, type BarcodeLabelsPayload } from '@/lib/barcodeLabelPrint'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  BARCODE_LABEL_SIZE_OPTIONS,
  normalizeThermalPrintSize,
  type BarcodeLabelSize,
} from '@/lib/printSizes'

const THERMAL_LABEL_DIMENSIONS: Record<BarcodeLabelSize, { width: number; height: number }> = {
  '1inch': { width: 25.4, height: 15 },
  '1.5inch': { width: 38.1, height: 25 },
  '2inch': { width: 50.8, height: 30 },
  '3inch': { width: 76.2, height: 50 },
}

function isThermalLabelSize(size: string): size is BarcodeLabelSize {
  return size === '1inch' || size === '1.5inch' || size === '2inch' || size === '3inch'
}

interface PurchaseBill {
  id: string
  bill_number: string
  party: { name: string }
  total_amount: number
  status: string
  stock_status?: string
  bill_date: string
  due_date?: string
  balance_due: number
  items?: Array<{
    id: string
    description: string
    quantity: number
    unit: string
    unit_price: number
  }>
}

interface PurchaseBillStats {
  total_purchase: number
  paid: number
  unpaid: number
}

export default function PurchaseInvoicesPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [bills, setBills] = useState<PurchaseBill[]>([])
  const [stats, setStats] = useState<PurchaseBillStats>({ total_purchase: 0, paid: 0, unpaid: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [labelModal, setLabelModal] = useState<string | null>(null)
  const [labelConfig, setLabelConfig] = useState({
    paperSize: '2inch' as string,
    labelWidth: 50.8,
    labelHeight: 30,
    cols: 1,
    rows: 1,
    margin: 0,
  })
  const [generatingLabels, setGeneratingLabels] = useState(false)

  const paperDimensions: Record<string, { width: number; height: number }> = {
    a4: { width: 210, height: 297 },
    letter: { width: 216, height: 279 },
    a5: { width: 148, height: 210 },
    ...THERMAL_LABEL_DIMENSIONS,
  }

  const autoCalculateLabelSize = (paperSize: string, cols: number, rows: number, margin: number) => {
    if (isThermalLabelSize(paperSize)) {
      const dims = THERMAL_LABEL_DIMENSIONS[paperSize]
      return { labelWidth: dims.width, labelHeight: dims.height }
    }
    const paper = paperDimensions[paperSize] || paperDimensions.a4
    const labelWidth = Math.max(10, (paper.width - 2 * margin) / cols)
    const labelHeight = Math.max(10, (paper.height - 2 * margin) / rows)
    return { labelWidth: Math.round(labelWidth * 100) / 100, labelHeight: Math.round(labelHeight * 100) / 100 }
  }

  const isThermalSelected = isThermalLabelSize(labelConfig.paperSize)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchBills()
    fetchStats()
  }, [filter, dateFrom, dateTo])

  useEffect(() => {
    if (previewId) {
      fetchPreview(previewId)
    } else {
      setPreviewData(null)
    }
  }, [previewId])

  const fetchBills = async () => {
    try {
      let url = '/purchase/bills'
      const params = new URLSearchParams()
      if (filter) params.append('status', filter)
      if (dateFrom) params.append('from_date', dateFrom)
      if (dateTo) params.append('to_date', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        // Fetch items for each bill
        const billsWithItems = await Promise.all(
          data.map(async (bill: PurchaseBill) => {
            try {
              const itemRes = await apiFetch(`/purchase/bills/${bill.id}`)
              if (itemRes.ok) {
                const billWithItems = await itemRes.json()
                return billWithItems
              }
              return bill
            } catch {
              return bill
            }
          })
        )
        setBills(billsWithItems)
        setSelectedBills(new Set())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      let url = '/purchase/bills/stats'
      const params = new URLSearchParams()
      if (dateFrom) params.append('from_date', dateFrom)
      if (dateTo) params.append('to_date', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) setStats(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const filteredBills = bills.filter(bill =>
    bill.bill_number.toLowerCase().includes(search.toLowerCase()) ||
    bill.party?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredBills)

  useEffect(() => {
    resetPage()
  }, [search, filter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-orange-100 text-orange-700',
      partial: 'bg-yellow-100 text-yellow-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>
  }

  const getStockStatusBadge = (status?: string) => {
    if (!status || status === 'none') {
      return <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">No stock</span>
    }
    const variants: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      partial: 'bg-yellow-100 text-yellow-800',
    }
    const labels: Record<string, string> = {
      pending: 'Stock pending',
      approved: 'Stock approved',
      rejected: 'Stock rejected',
      partial: 'Stock partial',
    }
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getDueIn = (dueDate?: string) => {
    if (!dueDate) return '-'
    const due = new Date(dueDate)
    const now = new Date()
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)} days overdue`
    if (diff === 0) return 'Today'
    return `${diff} days`
  }

  const handleExport = () => {
    const headers = ['Date', 'Purchase Invoice #', 'Party Name', 'Due In', 'Amount', 'Status']
    const rows = filteredBills.map(bill => [
      formatDate(bill.bill_date),
      bill.bill_number,
      bill.party?.name || 'N/A',
      getDueIn(bill.due_date),
      formatCurrency(bill.total_amount),
      bill.status
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'purchase-invoices.csv'
    a.click()
  }

  const handleMarkPaid = async (id: string) => {
    try {
      const res = await apiFetch(`/purchase/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' })
      })
      if (res.ok) {
        fetchBills()
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    }
    setActionMenu(null)
  }

  const handleDeleteBill = async (id: string) => {
    if (!(await confirm({
      title: 'Delete purchase invoice?',
      description: 'Are you sure you want to delete this purchase invoice? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/purchase/bills/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchBills()
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    }
    setActionMenu(null)
  }

  const fetchPreview = async (id: string) => {
    try {
      setPreviewLoading(true)
      const res = await apiFetch(`/purchase/bills/${id}`)
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
      await downloadPurchaseBillPdf(previewId, {
        billNumber: previewData?.bill_number,
      })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to download PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const toggleSelectBill = (id: string) => {
    setSelectedBills(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedBills.size === filteredBills.length) {
      setSelectedBills(new Set())
    } else {
      setSelectedBills(new Set(filteredBills.map(b => b.id)))
    }
  }

  const handleBulkExport = async () => {
    const selected = filteredBills.filter(b => selectedBills.has(b.id))
    const zip = new JSZip()

    // Summary CSV
    const summaryHeaders = ['Date', 'Purchase Invoice #', 'Party Name', 'Due In', 'Amount', 'Status']
    const summaryRows = selected.map(bill => [
      formatDate(bill.bill_date),
      bill.bill_number,
      bill.party?.name || 'N/A',
      getDueIn(bill.due_date),
      formatCurrency(bill.total_amount),
      bill.status
    ])
    const summaryCsv = [summaryHeaders.join(','), ...summaryRows.map(r => r.join(','))].join('\n')
    zip.file('summary.csv', summaryCsv)

    // Individual CSV per invoice
    selected.forEach(bill => {
      const headers = ['Date', 'Purchase Invoice #', 'Party Name', 'Due In', 'Amount', 'Status']
      const rows = [[
        formatDate(bill.bill_date),
        bill.bill_number,
        bill.party?.name || 'N/A',
        getDueIn(bill.due_date),
        formatCurrency(bill.total_amount),
        bill.status
      ]]
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const safeName = bill.bill_number.replace(/[^a-zA-Z0-9-_]/g, '_')
      zip.file(`${safeName}.csv`, csv)
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'purchase-invoices.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkDelete = async () => {
    if (!(await confirm({
      title: `Delete ${selectedBills.size} purchase invoices?`,
      description: `Are you sure you want to delete ${selectedBills.size} purchase invoices? This action cannot be undone.`,
    }))) return
    try {
      const promises = Array.from(selectedBills).map(id =>
        apiFetch(`/purchase/bills/${id}`, { method: 'DELETE' })
      )
      await Promise.all(promises)
      setSelectedBills(new Set())
      fetchBills()
      fetchStats()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkMarkPaid = async () => {
    try {
      const promises = Array.from(selectedBills).map(id =>
        apiFetch(`/purchase/bills/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paid' })
        })
      )
      await Promise.all(promises)
      setSelectedBills(new Set())
      fetchBills()
      fetchStats()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePrintLabels = async (billId: string) => {
    try {
      const bill = bills.find(b => b.id === billId)
      if (!bill || !bill.items?.length) {
        notifyError('No items found in this purchase invoice')
        return
      }

      // Prefer saved barcode label size from print settings
      try {
        const settingsRes = await apiFetch('/settings/print')
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          const size = normalizeThermalPrintSize(data.barcode_label_size)
          const dims = THERMAL_LABEL_DIMENSIONS[size]
          setLabelConfig({
            paperSize: size,
            labelWidth: dims.width,
            labelHeight: dims.height,
            cols: 1,
            rows: 1,
            margin: 0,
          })
        }
      } catch {
        /* keep current defaults */
      }

      // Initialize item quantities with default values from invoice
      const quantities: Record<string, number> = {}
      bill.items.forEach(item => {
        quantities[item.id] = Math.max(1, Math.round(Number(item.quantity) || 1))
      })
      setItemQuantities(quantities)
      setLabelModal(billId)
    } catch (err) {
      console.error(err)
      notifyError('Failed to load bill items')
    }
  }

  const handleGenerateLabels = async () => {
    if (!labelModal || generatingLabels) return

    setGeneratingLabels(true)
    try {
      const thermal = isThermalLabelSize(labelConfig.paperSize)
      const quantities: Record<string, number> = {}
      Object.entries(itemQuantities).forEach(([id, qty]) => {
        quantities[id] = Math.max(0, Math.round(Number(qty) || 0))
      })

      let thermalPrinterName = ''
      if (thermal) {
        try {
          const settingsRes = await apiFetch('/settings/print')
          if (settingsRes.ok) {
            const settings = await settingsRes.json()
            thermalPrinterName = settings.thermal_printer_name || ''
          }
        } catch {
          /* optional */
        }
      }

      const res = await apiFetch('/purchase/bills/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(thermal ? { Accept: 'application/json' } : {}),
        },
        body: JSON.stringify({
          bill_id: labelModal,
          item_quantities: quantities,
          format: thermal ? 'json' : 'html',
          config: {
            paper_size: labelConfig.paperSize,
            label_width: labelConfig.labelWidth,
            label_height: labelConfig.labelHeight,
            cols: thermal ? 1 : labelConfig.cols,
            rows: thermal ? 1 : labelConfig.rows,
            margin: thermal ? 0 : labelConfig.margin,
            margin_top: thermal ? 0 : labelConfig.margin,
            margin_left: thermal ? 0 : labelConfig.margin,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to generate labels')
        return
      }

      if (thermal) {
        const payload = (await res.json()) as BarcodeLabelsPayload
        if (!payload?.labels?.length) {
          notifyError('Label print returned empty content')
          return
        }
        await printBarcodeLabels(
          {
            ...payload,
            size: normalizeThermalPrintSize(payload.size || labelConfig.paperSize),
            width_mm: payload.width_mm || labelConfig.labelWidth,
            height_mm: payload.height_mm || labelConfig.labelHeight,
            title: payload.title || 'Purchase Labels',
          },
          { printerName: thermalPrinterName }
        )
        setLabelModal(null)
        return
      }

      const html = await res.text()
      if (!html.trim()) {
        notifyError('Label print returned empty content')
        return
      }
      await printHtmlDocument(html, { title: 'Purchase Labels' })
      setLabelModal(null)
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'An error occurred while generating labels')
    } finally {
      setGeneratingLabels(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Link href="/purchase-invoices/create">
              <Button><Plus className="mr-2 h-4 w-4" /> New Purchase Invoice</Button>
            </Link>
          </div>
        </div>

        {/* Summary Widgets */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_purchase)}</div>
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
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search purchase invoices..."
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
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
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
              <div>
                {selectedBills.size > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">
                      {selectedBills.size} selected
                    </span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExport}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkMarkPaid}>
                        Mark as Paid
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDelete}>
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
                          checked={filteredBills.length > 0 && selectedBills.size === filteredBills.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Purchase Invoice #</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Due In</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Stock</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((bill) => (
                      <tr key={bill.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedBills.has(bill.id)}
                            onChange={() => toggleSelectBill(bill.id)}
                          />
                        </td>
                        <td className="py-3 text-gray-500">{formatDate(bill.bill_date)}</td>
                        <td className="py-3">
                          <button
                            onClick={() => setPreviewId(bill.id)}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {bill.bill_number}
                          </button>
                        </td>
                        <td className="py-3 text-gray-600">{bill.party?.name || 'N/A'}</td>
                        <td className="py-3 text-gray-500">{getDueIn(bill.due_date)}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(bill.total_amount)}</td>
                        <td className="py-3">{getStatusBadge(bill.status)}</td>
                        <td className="py-3">{getStockStatusBadge(bill.stock_status)}</td>
                        <td className="py-3">
                          <div className="relative">
                            <button
                              onClick={() => setActionMenu(actionMenu === bill.id ? null : bill.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-500" />
                            </button>
                            {actionMenu === bill.id && (
                              <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border bg-white shadow-lg">
                                <div className="py-1">
                                  <button
                                    onClick={() => { setPreviewId(bill.id); setActionMenu(null) }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Eye className="h-4 w-4" /> Preview
                                  </button>
                                  <Link
                                    href={`/purchase-invoices/view?id=${bill.id}`}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={() => setActionMenu(null)}
                                  >
                                    <Eye className="h-4 w-4" /> View
                                  </Link>
                                  <Link
                                    href={`/purchase-invoices/create?id=${bill.id}`}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={() => setActionMenu(null)}
                                  >
                                    <Edit className="h-4 w-4" /> Edit
                                  </Link>
                                  <button
                                    onClick={() => {
                                      handlePrintLabels(bill.id)
                                      setActionMenu(null)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Printer className="h-4 w-4" /> Print Labels
                                  </button>
                                  {bill.status !== 'paid' && (
                                    <button
                                      onClick={() => handleMarkPaid(bill.id)}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      <X className="h-4 w-4" /> Mark as Paid
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteBill(bill.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
                                  >
                                    <Trash2 className="h-4 w-4" /> Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBills.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No purchase invoices found
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
                  {previewData?.bill_number || 'Purchase Invoice Preview'}
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
                      <p className="text-sm text-gray-500">Bill Date</p>
                      <p className="font-medium">{formatDate(previewData.bill_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Due Date</p>
                      <p className="font-medium">{previewData.due_date ? formatDate(previewData.due_date) : '—'}</p>
                    </div>
                  </div>

                  {/* Party */}
                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vendor</p>
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

                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-3">
                    {getStatusBadge(previewData.status)}
                    {getStockStatusBadge(previewData.stock_status)}
                    {previewData.paid_amount > 0 && (
                      <span className="text-sm text-gray-500">Paid: {formatCurrency(previewData.paid_amount)}</span>
                    )}
                    {previewData.stock_status === 'pending' && (
                      <Link href="/inventory" className="text-sm font-medium text-amber-700 hover:underline">
                        Review in Inventory →
                      </Link>
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
                      {previewData.tax_total > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax</span>
                          <span className="font-medium">{formatCurrency(previewData.tax_total)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2 text-base font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(previewData.total_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount Paid</span>
                        <span className="font-medium text-green-600">{formatCurrency(previewData.paid_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Balance Due</span>
                        <span className="font-medium text-orange-600">{formatCurrency(previewData.balance_due)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {previewData.notes && (
                    <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                      <p><span className="font-medium">Notes:</span> {previewData.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-gray-500">Failed to load preview</div>
              )}
            </div>
          </div>
        )}

      {/* Label Printing Modal */}
      {labelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Print Item Labels</h2>
              <button
                onClick={() => setLabelModal(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Paper Size Selection */}
              <div>
                <Label className="text-sm font-medium">Paper Size</Label>
                <select
                  value={labelConfig.paperSize}
                  onChange={(e) => {
                    const paperSize = e.target.value
                    if (isThermalLabelSize(paperSize)) {
                      const dims = THERMAL_LABEL_DIMENSIONS[paperSize]
                      setLabelConfig({
                        ...labelConfig,
                        paperSize,
                        labelWidth: dims.width,
                        labelHeight: dims.height,
                        cols: 1,
                        rows: 1,
                        margin: 0,
                      })
                      return
                    }
                    const cols = labelConfig.cols || 4
                    const rows = labelConfig.rows || 8
                    const margin = labelConfig.margin || 10
                    const { labelWidth, labelHeight } = autoCalculateLabelSize(paperSize, cols, rows, margin)
                    setLabelConfig({ ...labelConfig, paperSize, labelWidth, labelHeight, cols, rows, margin })
                  }}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <optgroup label="Sheet paper">
                    <option value="a4">A4 (210 x 297 mm)</option>
                    <option value="letter">Letter (216 x 279 mm)</option>
                    <option value="a5">A5 (148 x 210 mm)</option>
                  </optgroup>
                  <optgroup label="Thermal label printer">
                    {BARCODE_LABEL_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {isThermalSelected && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {BARCODE_LABEL_SIZE_OPTIONS.find((o) => o.value === labelConfig.paperSize)?.description}
                    {' · '}
                    Name → barcode → MRP / price · prints directly to the thermal printer
                  </p>
                )}
              </div>

              {!isThermalSelected && (
                <>
                  {/* Label Dimensions */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Label Width (mm)</Label>
                      <Input
                        type="number"
                        value={labelConfig.labelWidth}
                        onChange={(e) => setLabelConfig({ ...labelConfig, labelWidth: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Label Height (mm)</Label>
                      <Input
                        type="number"
                        value={labelConfig.labelHeight}
                        onChange={(e) => setLabelConfig({ ...labelConfig, labelHeight: Number(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Grid Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Columns</Label>
                      <Input
                        type="number"
                        value={labelConfig.cols}
                        onChange={(e) => {
                          const cols = Number(e.target.value)
                          const { labelWidth, labelHeight } = autoCalculateLabelSize(labelConfig.paperSize, cols, labelConfig.rows, labelConfig.margin)
                          setLabelConfig({ ...labelConfig, cols, labelWidth, labelHeight })
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Rows</Label>
                      <Input
                        type="number"
                        value={labelConfig.rows}
                        onChange={(e) => {
                          const rows = Number(e.target.value)
                          const { labelWidth, labelHeight } = autoCalculateLabelSize(labelConfig.paperSize, labelConfig.cols, rows, labelConfig.margin)
                          setLabelConfig({ ...labelConfig, rows, labelWidth, labelHeight })
                        }}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Margin (even on all sides) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Margin (mm)</Label>
                      <Input
                        type="number"
                        value={labelConfig.margin}
                        onChange={(e) => {
                          const margin = Number(e.target.value)
                          const { labelWidth, labelHeight } = autoCalculateLabelSize(labelConfig.paperSize, labelConfig.cols, labelConfig.rows, margin)
                          setLabelConfig({ ...labelConfig, margin, labelWidth, labelHeight })
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end text-xs text-gray-500 pb-3">
                      Applied evenly to top, bottom, left and right
                    </div>
                  </div>
                </>
              )}

              {isThermalSelected && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Label size:{' '}
                  <span className="font-medium text-foreground">
                    {labelConfig.labelWidth} × {labelConfig.labelHeight} mm
                  </span>
                </div>
              )}

              {/* Item Quantities */}
              <div>
                <Label className="text-sm font-medium">Label Quantities (default: invoice quantity)</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {bills.find(b => b.id === labelModal)?.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="flex-1">{item.description}</span>
                      <Input
                        type="number"
                        value={itemQuantities[item.id] || item.quantity}
                        onChange={(e) => setItemQuantities({
                          ...itemQuantities,
                          [item.id]: Number(e.target.value)
                        })}
                        className="w-20 h-8"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setLabelModal(null)} disabled={generatingLabels}>
                Cancel
              </Button>
              <Button onClick={handleGenerateLabels} disabled={generatingLabels}>
                {generatingLabels ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Generate & Print
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </DashboardLayout>
  )
}
