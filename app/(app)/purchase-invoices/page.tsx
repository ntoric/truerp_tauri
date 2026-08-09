'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, asArray } from '@/lib/utils'
import { accountingExportDateStamp, downloadBlob, downloadCsv, rowsToCsv } from '@/lib/accountingExport'
import { runWithExportProgress } from '@/lib/exportProgress'
import { Plus, Search, Download, MoreVertical, Edit, X, Trash2, Printer, Eye, Loader2, Package } from 'lucide-react'
import BulkCreateProductsDialog from '@/components/BulkCreateProductsDialog'
import JSZip from 'jszip'
import { notifyError, notifySuccess } from '@/lib/notify'
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
import {
  A4_LABEL_SHEET_PRESETS,
  labelsPerSheet,
  layoutFromPresetKey,
  normalizeA4SheetPreset,
  stickerPositionToRowCol,
  type A4LabelSheetLayout,
  type A4LabelSheetPresetKey,
} from '@/lib/a4LabelSheets'

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
    paperSize: 'a4' as string,
    sheetPreset: '48.5x25.4' as A4LabelSheetPresetKey,
    labelWidth: 48.5,
    labelHeight: 25.4,
    cols: 4,
    rows: 11,
    margin: 5,
    marginTop: 8.8,
    marginLeft: 5,
    gapH: 2,
    gapV: 0,
    startPosition: 1,
  })
  const [generatingLabels, setGeneratingLabels] = useState(false)
  const [labelPreviewHtml, setLabelPreviewHtml] = useState('')
  const [labelPreviewLoading, setLabelPreviewLoading] = useState(false)
  const labelPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showBulkCreateProducts, setShowBulkCreateProducts] = useState(false)

  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})

  const isThermalSelected = isThermalLabelSize(labelConfig.paperSize)
  const sheetLabelsPerPage = labelsPerSheet({ columns: labelConfig.cols, rows: labelConfig.rows })
  const startHint = stickerPositionToRowCol(labelConfig.startPosition, labelConfig.cols)

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
        const data = asArray<PurchaseBill>(await res.json())
        // Fetch items for each bill (needed for barcode labels)
        const billsWithItems = await Promise.all(
          data.map(async (bill) => {
            try {
              const itemRes = await apiFetch(`/purchase/bills/${bill.id}`)
              if (itemRes.ok) {
                const billWithItems = await itemRes.json()
                return billWithItems as PurchaseBill
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

  const filteredBills = bills.filter((bill) => {
    const query = search.toLowerCase()
    if (!query) return true
    return (
      (bill.bill_number || '').toLowerCase().includes(query) ||
      (bill.party?.name || '').toLowerCase().includes(query)
    )
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredBills)

  useEffect(() => {
    resetPage()
  }, [search, filter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-orange-100 text-orange-700',
      partial: 'bg-yellow-100 text-yellow-700',
      draft: 'bg-slate-100 text-slate-700',
    }
    const label = status === 'draft' ? 'Draft' : status
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-700'}`}>{label}</span>
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
      approved: 'Stock updated',
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

  const buildExportRows = (list: PurchaseBill[]): (string | number)[][] => [
    ['Date', 'Purchase Invoice #', 'Party Name', 'Due In', 'Amount', 'Status'],
    ...list.map((bill) => [
      bill.bill_date ? formatDate(bill.bill_date) : '',
      bill.bill_number || '',
      bill.party?.name || 'N/A',
      getDueIn(bill.due_date),
      typeof bill.total_amount === 'number' ? bill.total_amount : Number(bill.total_amount) || 0,
      bill.status || '',
    ]),
  ]

  const handleExport = async () => {
    if (exporting) return
    if (filteredBills.length === 0) {
      notifyError('No purchase invoices to export')
      return
    }
    setExporting(true)
    try {
      await downloadCsv(
        `purchase-invoices_${accountingExportDateStamp()}.csv`,
        buildExportRows(filteredBills),
        { label: 'Exporting purchase invoices' }
      )
      notifySuccess(`Exported ${filteredBills.length} purchase invoice${filteredBills.length === 1 ? '' : 's'}`)
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'Failed to export purchase invoices')
    } finally {
      setExporting(false)
    }
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
    const selected = filteredBills.filter((b) => selectedBills.has(b.id))
    if (selected.length === 0) {
      notifyError('No purchase invoices selected')
      return
    }
    if (exporting) return
    setExporting(true)
    try {
      await runWithExportProgress('Exporting purchase invoices', async (update) => {
        update(10, 'Building ZIP…')
        const zip = new JSZip()
        zip.file('summary.csv', '\uFEFF' + rowsToCsv(buildExportRows(selected)))

        selected.forEach((bill, index) => {
          const safeName =
            (bill.bill_number || `invoice-${index + 1}`).replace(/[^a-zA-Z0-9-_]/g, '_') ||
            `invoice-${index + 1}`
          zip.file(`${safeName}.csv`, '\uFEFF' + rowsToCsv(buildExportRows([bill])))
        })

        update(55, 'Compressing…')
        const blob = await zip.generateAsync({ type: 'blob' })
        update(80, 'Saving…')
        await downloadBlob(`purchase-invoices_${accountingExportDateStamp()}.zip`, blob, {
          skipProgress: true,
        })
        update(100, 'Saved')
      })
      notifySuccess(`Exported ${selected.length} purchase invoice${selected.length === 1 ? '' : 's'}`)
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'Failed to export purchase invoices')
    } finally {
      setExporting(false)
    }
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

  const applySheetLayout = (layout: A4LabelSheetLayout, preset: A4LabelSheetPresetKey) => {
    setLabelConfig((prev) => ({
      ...prev,
      paperSize: 'a4',
      sheetPreset: preset,
      labelWidth: layout.labelWidthMm,
      labelHeight: layout.labelHeightMm,
      cols: layout.columns,
      rows: layout.rows,
      margin: layout.marginLeftMm,
      marginTop: layout.marginTopMm,
      marginLeft: layout.marginLeftMm,
      gapH: layout.gapHMm,
      gapV: layout.gapVMm,
    }))
  }

  const handlePrintLabels = async (billId: string) => {
    try {
      const bill = bills.find(b => b.id === billId)
      if (!bill || !bill.items?.length) {
        notifyError('No items found in this purchase invoice')
        return
      }

      try {
        const settingsRes = await apiFetch('/settings/print')
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          if (data.barcode_print_mode === 'label') {
            const size = normalizeThermalPrintSize(data.barcode_label_size)
            const dims = THERMAL_LABEL_DIMENSIONS[size]
            setLabelConfig((prev) => ({
              ...prev,
              paperSize: size,
              labelWidth: dims.width,
              labelHeight: dims.height,
              cols: 1,
              rows: 1,
              margin: 0,
              startPosition: 1,
            }))
          } else {
            const preset = normalizeA4SheetPreset(data.label_sheet_preset)
            applySheetLayout(
              {
                paperSize: data.label_paper_size || 'A4',
                labelWidthMm: Number(data.label_width_mm) || 48.5,
                labelHeightMm: Number(data.label_height_mm) || 25.4,
                columns: Number(data.label_columns) || 4,
                rows: Number(data.label_rows) || 11,
                marginTopMm: Number(data.label_margin_top_mm) || 8.8,
                marginLeftMm: Number(data.label_margin_left_mm) || 5,
                gapHMm: Number(data.label_gap_h_mm) ?? 2,
                gapVMm: Number(data.label_gap_v_mm) ?? 0,
              },
              preset
            )
            setLabelConfig((prev) => ({ ...prev, startPosition: 1 }))
          }
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

  const buildLabelRequestBody = useCallback(
    (billId: string, preview = false) => {
      const thermal = isThermalLabelSize(labelConfig.paperSize)
      const quantities: Record<string, number> = {}
      Object.entries(itemQuantities).forEach(([id, qty]) => {
        quantities[id] = Math.max(0, Math.round(Number(qty) || 0))
      })
      return {
        bill_id: billId,
        item_quantities: quantities,
        preview,
        format: thermal ? 'json' : 'html',
        config: {
          paper_size: labelConfig.paperSize,
          sheet_preset: thermal ? undefined : labelConfig.sheetPreset,
          label_width: labelConfig.labelWidth,
          label_height: labelConfig.labelHeight,
          cols: thermal ? 1 : labelConfig.cols,
          rows: thermal ? 1 : labelConfig.rows,
          margin: thermal ? 0 : labelConfig.margin,
          margin_top: thermal ? 0 : labelConfig.marginTop,
          margin_left: thermal ? 0 : labelConfig.marginLeft,
          gap_h: thermal ? 0 : labelConfig.gapH,
          gap_v: thermal ? 0 : labelConfig.gapV,
          start_position: thermal ? 1 : labelConfig.startPosition,
        },
      }
    },
    [itemQuantities, labelConfig]
  )

  const refreshLabelPreview = useCallback(async () => {
    if (!labelModal) {
      setLabelPreviewHtml('')
      return
    }

    setLabelPreviewLoading(true)
    try {
      if (isThermalLabelSize(labelConfig.paperSize)) {
        const size = normalizeThermalPrintSize(labelConfig.paperSize)
        const res = await apiFetch(
          `/printer/barcode/preview?mode=label&size=${encodeURIComponent(size)}`
        )
        if (res.ok) {
          const data = await res.json()
          setLabelPreviewHtml(data.html || '')
        } else {
          setLabelPreviewHtml('')
        }
        return
      }

      const res = await apiFetch('/purchase/bills/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildLabelRequestBody(labelModal, true)),
      })
      if (res.ok) {
        setLabelPreviewHtml(await res.text())
      } else {
        setLabelPreviewHtml('')
      }
    } catch {
      setLabelPreviewHtml('')
    } finally {
      setLabelPreviewLoading(false)
    }
  }, [buildLabelRequestBody, labelConfig.paperSize, labelModal])

  useEffect(() => {
    if (!labelModal) {
      setLabelPreviewHtml('')
      return
    }
    if (labelPreviewTimerRef.current) {
      clearTimeout(labelPreviewTimerRef.current)
    }
    labelPreviewTimerRef.current = setTimeout(() => {
      void refreshLabelPreview()
    }, 350)
    return () => {
      if (labelPreviewTimerRef.current) {
        clearTimeout(labelPreviewTimerRef.current)
      }
    }
  }, [labelModal, refreshLabelPreview])

  const handleGenerateLabels = async () => {
    if (!labelModal || generatingLabels) return

    setGeneratingLabels(true)
    try {
      const thermal = isThermalLabelSize(labelConfig.paperSize)

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
        body: JSON.stringify(buildLabelRequestBody(labelModal, false)),
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBulkCreateProducts(true)}
            >
              <Package className="mr-2 h-4 w-4" />
              Bulk Create Products
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleExport()}
              disabled={exporting || loading || filteredBills.length === 0}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export
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
                <option value="draft">Draft</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleBulkExport()}
                        disabled={exporting}
                      >
                        {exporting ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-1 h-3.5 w-3.5" />
                        )}
                        Export
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
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {isThermalSelected ? (
                  <>
                    Thermal label ·{' '}
                    <span className="font-medium text-foreground">
                      {BARCODE_LABEL_SIZE_OPTIONS.find((o) => o.value === labelConfig.paperSize)?.label ??
                        labelConfig.paperSize}
                    </span>
                    {' · '}
                    {labelConfig.labelWidth} × {labelConfig.labelHeight} mm
                  </>
                ) : (
                  <>
                    A4 sheet ·{' '}
                    <span className="font-medium text-foreground">
                      {A4_LABEL_SHEET_PRESETS.find((p) => p.key === labelConfig.sheetPreset)?.label ??
                        `${labelConfig.cols}×${labelConfig.rows} grid`}
                    </span>
                    {' · '}
                    {sheetLabelsPerPage} labels per sheet
                  </>
                )}
                <p className="mt-1 text-xs">
                  Print mode and paper size are configured in Settings → Print → Barcode.
                </p>
              </div>

              {!isThermalSelected ? (
                <div>
                  <Label className="text-sm font-medium">
                    Starting sticker (1–{sheetLabelsPerPage})
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={sheetLabelsPerPage}
                    value={labelConfig.startPosition}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') return
                      const n = Number(raw)
                      if (!Number.isFinite(n)) return
                      setLabelConfig({
                        ...labelConfig,
                        startPosition: Math.min(sheetLabelsPerPage, Math.max(1, Math.round(n))),
                      })
                    }}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    For partially used sheets — first label prints at row {startHint.row}, column{' '}
                    {startHint.col}.
                  </p>
                </div>
              ) : null}

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

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {isThermalSelected ? 'Label preview' : 'A4 sheet preview'}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={labelPreviewLoading}
                    onClick={() => void refreshLabelPreview()}
                  >
                    {labelPreviewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
                {labelPreviewHtml ? (
                  <iframe
                    title="Label print preview"
                    srcDoc={labelPreviewHtml}
                    className="h-[360px] w-full rounded border bg-white"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {labelPreviewLoading ? 'Loading preview…' : 'Preview unavailable'}
                  </p>
                )}
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
      <BulkCreateProductsDialog
        open={showBulkCreateProducts}
        onOpenChange={setShowBulkCreateProducts}
      />

      {confirmDialog}
    </DashboardLayout>
  )
}
