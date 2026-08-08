'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import BarcodeScanner from '@/components/ui/BarcodeScanner'
import { Warehouse, ArrowDownLeft, ArrowUpRight, RotateCcw, Plus, Search, Truck, AlertTriangle, Barcode, Upload, Download, CalendarRange, Check, X } from 'lucide-react'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { asArray } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  DATE_PERIOD_OPTIONS,
  DatePeriod,
  formatDateRangeLabel,
  getDateRangeForPeriod,
  isDateWithinRange,
} from '@/lib/dateFilter'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { isSuperAdmin } from '@/lib/roles'

interface InventoryItemOption {
  id: string
  name: string
  sku?: string
  type: string
  enable_batching?: boolean
}

interface StockBalance {
  product_id: string
  product_name: string
  sku: string
  stock_qty: number
  cost_price: number
  value: number
  outlet_id: string
  outlet_name: string
}

interface StockEntry {
  id: string
  product?: { name: string; sku: string }
  item_name: string
  entry_type: string
  quantity: number
  balance_qty: number
  cost_price: number
  batch_no: string
  item_code: string
  entry_date: string
  notes: string
  outlet_id: string
  outlet_name: string
  mfg_date?: string
  exp_date?: string
  approval_status?: string
  reference_type?: string
  reference_id?: string
  approved_at?: string
}

interface StockTransfer {
  id: string
  from_outlet_id: string
  to_outlet_id: string
  status: string
  total_items: number
  total_quantity: number
  created_at: string
}

interface InventoryStock {
  id: string
  product_id: string
  product?: { name: string; sku: string }
  outlet_id: string
  outlet_name: string
  batch_no?: string
  mfg_date?: string | null
  exp_date?: string | null
  quantity: number
  initial_quantity: number
  reserved_qty: number
  available_qty: number
  average_cost: number
  last_updated: string
}

interface LowStockAlert {
  product_id: string
  product_name: string
  sku: string
  current_stock: number
  min_stock: number
  outlet_id: string
  outlet_name: string
}

const STOCK_BULK_UPDATE_HEADERS = [
  'SKU',
  'Product Name',
  'Item Code',
  'Warehouse',
  'Update Mode',
  'Quantity',
  'Cost Price',
  'Batch No',
  'Notes',
]

const STOCK_BULK_UPDATE_SAMPLE_ROW: (string | number)[] = [
  'SKU001',
  'Sample Product',
  'ITEM001',
  'Main Warehouse',
  'set',
  100,
  50,
  'BATCH001',
  'Bulk stock update',
]

export default function InventoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const canUseCameraBarcodeScanner = isSuperAdmin(user?.role)
  const { confirm, confirmDialog } = useConfirmDialog()
  const [balance, setBalance] = useState<StockBalance[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [stocks, setStocks] = useState<InventoryStock[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateEntryModal, setShowCreateEntryModal] = useState(false)
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showEditEntryModal, setShowEditEntryModal] = useState(false)
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [editingEntry, setEditingEntry] = useState<StockEntry | null>(null)
  const [reserveStock, setReserveStock] = useState({
    product_id: '',
    outlet_id: '',
    quantity: 0,
    reason: ''
  })
  const [releaseStock, setReleaseStock] = useState({
    product_id: '',
    outlet_id: '',
    quantity: 0,
    reason: ''
  })
  const [newEntry, setNewEntry] = useState({
    selected_item_id: '',
    item_name: '',
    product_id: '',
    outlet_id: '',
    entry_type: 'purchase',
    quantity: 0,
    cost_price: 0,
    batch_no: '',
    mfg_date: '',
    exp_date: '',
    item_code: '',
    notes: ''
  })
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [isEditingBarcode, setIsEditingBarcode] = useState(false)
  const [adjustStock, setAdjustStock] = useState({
    selected_item_id: '',
    item_name: '',
    product_id: '',
    outlet_id: '',
    quantity: 0,
    reason: ''
  })
  const [showBulkStockUpdateDialog, setShowBulkStockUpdateDialog] = useState(false)
  const [bulkStockUpdateFile, setBulkStockUpdateFile] = useState<File | null>(null)
  const [bulkStockUpdating, setBulkStockUpdating] = useState(false)
  const [bulkStockUpdatedCount, setBulkStockUpdatedCount] = useState<number | null>(null)
  const [bulkStockUpdateErrors, setBulkStockUpdateErrors] = useState<string[]>([])
  const bulkStockUpdateFileRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState('balance')
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('month')
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [entryApprovalFilter, setEntryApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [approvingEntryId, setApprovingEntryId] = useState<string | null>(null)

  const dateRange = useMemo(
    () => getDateRangeForPeriod(datePeriod, customFromDate, customToDate),
    [datePeriod, customFromDate, customToDate]
  )
  const dateRangeLabel = useMemo(() => formatDateRangeLabel(dateRange), [dateRange])
  const isDateFilterActive = datePeriod !== 'all' && (datePeriod !== 'custom' || Boolean(customFromDate || customToDate))

  const pendingEntriesCount = useMemo(
    () => entries.filter((entry) => (entry.approval_status || 'approved') === 'pending').length,
    [entries]
  )

  const entryNeedsBatching = useMemo(() => {
    const selectedItem = inventoryItems.find((item) => item.id === newEntry.selected_item_id)
    return Boolean(selectedItem?.type === 'product' && selectedItem.enable_batching)
  }, [inventoryItems, newEntry.selected_item_id])

  const filteredEntries = useMemo(
    () => entries.filter((entry) => {
      if (!isDateWithinRange(entry.entry_date, dateRange.from, dateRange.to)) return false
      if (entryApprovalFilter === 'all') return true
      const status = entry.approval_status || 'approved'
      return status === entryApprovalFilter
    }),
    [entries, dateRange, entryApprovalFilter]
  )
  const filteredTransfers = useMemo(
    () => transfers.filter((transfer) => isDateWithinRange(transfer.created_at, dateRange.from, dateRange.to)),
    [transfers, dateRange]
  )
  // Inventory stocks always show current batch-level rows; date filter applies to entries/transfers only.

  useEffect(() => { if (!authLoading && user) fetchData() }, [authLoading, user])
  useEffect(() => { if (!authLoading && user) fetchInventoryItems() }, [authLoading, user])
  useEffect(() => { if (!authLoading && user) fetchWarehouses() }, [authLoading, user])

  const lowStockPagination = usePagination(lowStockAlerts)
  const balancePagination = usePagination(balance)
  const entriesPagination = usePagination(filteredEntries)
  const transfersPagination = usePagination(filteredTransfers)
  const stocksPagination = usePagination(stocks)

  useEffect(() => {
    entriesPagination.resetPage()
    transfersPagination.resetPage()
  }, [datePeriod, customFromDate, customToDate, entryApprovalFilter])

  const fetchData = async () => {
    try {
      const [b, e, t, s, l] = await Promise.all([
        apiFetch('/inventory/balance'),
        apiFetch('/inventory/entries'),
        apiFetch('/inventory/transfers'),
        apiFetch('/inventory/stocks'),
        apiFetch('/inventory/alerts/low-stock')
      ])
      if (b.ok) { setBalance(asArray(await b.json())) }
      if (e.ok) { setEntries(asArray(await e.json())) }
      if (t.ok) { setTransfers(asArray(await t.json())) }
      if (s.ok) { setStocks(asArray(await s.json())) }
      if (l.ok) { setLowStockAlerts(asArray(await l.json())) }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchInventoryItems = async () => {
    try {
      const res = await apiFetch('/inventory/items')
      if (res.ok) {
        setInventoryItems(asArray(await res.json()))
      }
    } catch (err) { console.error(err) }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await apiFetch('/warehouses?is_active=true')
      if (res.ok) {
        setWarehouses(asArray(await res.json()))
      }
    } catch (err) { console.error(err) }
  }

  const handleSelectInventoryItem = (itemId: string, target: 'entry' | 'adjust') => {
    const selectedItem = inventoryItems.find((item) => item.id === itemId)
    const update = {
      selected_item_id: itemId,
      item_name: selectedItem?.name || '',
      product_id: selectedItem?.type === 'product' ? selectedItem.id : '',
    }
    if (target === 'entry') {
      const needsBatching = Boolean(selectedItem?.type === 'product' && selectedItem.enable_batching)
      setNewEntry((prev) => ({
        ...prev,
        ...update,
        ...(needsBatching ? {} : { batch_no: '', mfg_date: '', exp_date: '' }),
      }))
    } else {
      setAdjustStock((prev) => ({ ...prev, ...update }))
    }
  }

  const handleOpenCreateProductForm = () => {
    setShowCreateEntryModal(false)
    setShowAdjustStockModal(false)
    router.push('/products/create')
  }

  const handleOpenCreateWarehouseForm = () => {
    setShowCreateEntryModal(false)
    setShowAdjustStockModal(false)
    router.push('/warehouses/create')
  }

  const handleCreateEntry = async () => {
    if (!newEntry.selected_item_id || !newEntry.item_name.trim()) {
      notifyError('Please select an item')
      return
    }
    if (!newEntry.outlet_id) {
      notifyError('Please select a warehouse')
      return
    }
    if (entryNeedsBatching && !newEntry.batch_no.trim()) {
      notifyError('Batch number is required for this product')
      return
    }

    const payload = {
      item_name: newEntry.item_name,
      product_id: newEntry.product_id || null,
      outlet_id: newEntry.outlet_id,
      entry_type: newEntry.entry_type,
      quantity: newEntry.quantity,
      cost_price: newEntry.cost_price,
      item_code: newEntry.item_code,
      notes: newEntry.notes,
      batch_no: entryNeedsBatching ? newEntry.batch_no.trim() : '',
      mfg_date: entryNeedsBatching && newEntry.mfg_date ? newEntry.mfg_date : '',
      exp_date: entryNeedsBatching && newEntry.exp_date ? newEntry.exp_date : '',
    }

    try {
      const res = await apiFetch('/inventory/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setShowCreateEntryModal(false)
        setNewEntry({
          selected_item_id: '',
          item_name: '',
          product_id: '',
          outlet_id: '',
          entry_type: 'purchase',
          quantity: 0,
          cost_price: 0,
          batch_no: '',
          mfg_date: '',
          exp_date: '',
          item_code: '',
          notes: ''
        })
        fetchData()
        notifySuccess('Stock entry created')
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to create stock entry')
      }
    } catch (err) { console.error(err) }
  }

  const handleStockBarcodeScan = async (code: string) => {
    try {
      const res = await apiFetch(`/inventory/stocks/search?item_code=${encodeURIComponent(code)}`)
      
      if (res.ok) {
        const data = await res.json()
        const stockMatches = data.data || []
        
        if (stockMatches.length > 0) {
          const stockMatch = stockMatches[0]
          setNewEntry((prev) => ({
            ...prev,
            item_name: stockMatch.product_name,
            product_id: stockMatch.product_id,
            selected_item_id: stockMatch.product_id,
            item_code: stockMatch.item_code || code,
          }))
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditBarcodeScan = (code: string) => {
    if (!editingEntry) return
    setEditingEntry({
      ...editingEntry,
      item_code: code,
    })
  }

  const handleAdjustStock = async () => {
    if (!adjustStock.reason.trim()) {
      notifyError('Please enter a reason for the stock adjustment')
      return
    }

    try {
      const res = await apiFetch('/inventory/stocks/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adjustStock,
          reason: adjustStock.reason.trim(),
          product_id: adjustStock.product_id || null
        })
      })
      if (res.ok) {
        setShowAdjustStockModal(false)
        setAdjustStock({
          selected_item_id: '',
          item_name: '',
          product_id: '',
          outlet_id: '',
          quantity: 0,
          reason: ''
        })
        fetchData()
        notifySuccess('Stock adjusted successfully')
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to adjust stock')
      }
    } catch (err) { console.error(err); notifyError('Failed to adjust stock') }
  }

  const handleDownloadBulkStockUpdateTemplate = () => {
    void downloadCsv(
      `stock_bulk_update_template_${accountingExportDateStamp()}.csv`,
      [STOCK_BULK_UPDATE_HEADERS, STOCK_BULK_UPDATE_SAMPLE_ROW],
      { label: 'Exporting stock template' }
    )
  }

  const resetBulkStockUpdateDialog = () => {
    setBulkStockUpdateFile(null)
    setBulkStockUpdatedCount(null)
    setBulkStockUpdateErrors([])
    if (bulkStockUpdateFileRef.current) bulkStockUpdateFileRef.current.value = ''
  }

  const handleBulkStockUpdateDialogChange = (open: boolean) => {
    setShowBulkStockUpdateDialog(open)
    if (!open) resetBulkStockUpdateDialog()
  }

  const handleBulkStockUpdate = async () => {
    if (!bulkStockUpdateFile) {
      notifyError('Please select a CSV or Excel file to upload')
      return
    }

    setBulkStockUpdating(true)
    setBulkStockUpdatedCount(null)
    setBulkStockUpdateErrors([])

    try {
      const formData = new FormData()
      formData.append('file', bulkStockUpdateFile)
      const fileName = bulkStockUpdateFile.name.toLowerCase()
      const endpoint = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
        ? '/inventory/stocks/bulk-update/excel'
        : '/inventory/stocks/bulk-update/csv'

      const res = await apiFetch(endpoint, { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        const count = data.updated ?? 0
        const errors: string[] = data.errors ?? []
        setBulkStockUpdatedCount(count)
        setBulkStockUpdateErrors(errors)

        if (count > 0) {
          fetchData()
          notifySuccess(`Successfully updated stock for ${count} row${count === 1 ? '' : 's'}`)
        }

        if (count === 0 && errors.length > 0) {
          notifyError('No stock rows were updated. Please review the errors below.')
        } else if (errors.length > 0) {
          notifyError(`${errors.length} row${errors.length === 1 ? '' : 's'} could not be updated`)
        }
      } else {
        notifyError(data.error || 'Bulk stock update failed')
      }
    } catch (err) {
      console.error(err)
      notifyError('Bulk stock update failed')
    } finally {
      setBulkStockUpdating(false)
    }
  }

  const handleEditEntry = (entry: StockEntry) => {
    // Format dates for date input (YYYY-MM-DD)
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ''
      return date.toISOString().split('T')[0]
    }
    
    setEditingEntry({
      ...entry,
      mfg_date: formatDate(entry.mfg_date),
      exp_date: formatDate(entry.exp_date)
    })
    setShowEditEntryModal(true)
  }

  const handleUpdateEntry = async () => {
    if (!editingEntry) return
    try {
      const res = await apiFetch(`/inventory/entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: editingEntry.quantity,
          cost_price: editingEntry.cost_price,
          batch_no: editingEntry.batch_no,
          item_code: editingEntry.item_code,
          mfg_date: editingEntry.mfg_date || '',
          exp_date: editingEntry.exp_date || '',
          notes: editingEntry.notes
        })
      })
      if (res.ok) {
        setShowEditEntryModal(false)
        setEditingEntry(null)
        fetchData()
      }
    } catch (err) { console.error(err) }
  }

  const handleReserveStock = async () => {
    if (!reserveStock.reason.trim()) {
      notifyError('Please enter a reason for the stock reservation')
      return
    }

    try {
      const res = await apiFetch('/inventory/stocks/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reserveStock,
          reason: reserveStock.reason.trim(),
        })
      })
      if (res.ok) {
        setShowReserveModal(false)
        setReserveStock({
          product_id: '',
          outlet_id: '',
          quantity: 0,
          reason: ''
        })
        fetchData()
        notifySuccess('Stock reserved successfully')
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to reserve stock')
      }
    } catch (err) { console.error(err); notifyError('Failed to reserve stock') }
  }

  const handleReleaseStock = async () => {
    if (!releaseStock.reason.trim()) {
      notifyError('Please enter a reason for the stock release')
      return
    }

    try {
      const res = await apiFetch('/inventory/stocks/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...releaseStock,
          reason: releaseStock.reason.trim(),
        })
      })
      if (res.ok) {
        setShowReleaseModal(false)
        setReleaseStock({
          product_id: '',
          outlet_id: '',
          quantity: 0,
          reason: ''
        })
        fetchData()
        notifySuccess('Stock released successfully')
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to release stock')
      }
    } catch (err) { console.error(err); notifyError('Failed to release stock') }
  }

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'bg-green-100 text-green-800'
      case 'sale': return 'bg-red-100 text-red-800'
      case 'adjustment': return 'bg-yellow-100 text-yellow-800'
      case 'transfer': return 'bg-blue-100 text-blue-800'
      case 'opening': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getApprovalStatusColor = (status?: string) => {
    switch (status || 'approved') {
      case 'pending': return 'bg-amber-100 text-amber-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleApproveEntry = async (entry: StockEntry) => {
    const itemName = entry.product?.name || entry.item_name
    if (!(await confirm({
      title: 'Approve stock entry?',
      description: `Approve ${entry.entry_type} of ${entry.quantity} for "${itemName}"? This will update inventory stock.`,
      confirmLabel: 'Approve',
    }))) return

    setApprovingEntryId(entry.id)
    try {
      const res = await apiFetch(`/inventory/entries/${entry.id}/approve`, { method: 'POST' })
      if (res.ok) {
        notifySuccess('Stock update approved')
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to approve stock entry')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to approve stock entry')
    } finally {
      setApprovingEntryId(null)
    }
  }

  const handleRejectEntry = async (entry: StockEntry) => {
    const itemName = entry.product?.name || entry.item_name
    if (!(await confirm({
      title: 'Reject stock entry?',
      description: `Reject ${entry.entry_type} of ${entry.quantity} for "${itemName}"? This will not update inventory stock.`,
      confirmLabel: 'Reject',
      variant: 'destructive',
    }))) return

    setApprovingEntryId(entry.id)
    try {
      const res = await apiFetch(`/inventory/entries/${entry.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected from inventory' }),
      })
      if (res.ok) {
        notifySuccess('Stock update rejected')
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to reject stock entry')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to reject stock entry')
    } finally {
      setApprovingEntryId(null)
    }
  }

  const handleApproveAllPending = async () => {
    if (!(await confirm({
      title: 'Approve all pending stock entries?',
      description: `Approve ${pendingEntriesCount} pending stock update${pendingEntriesCount === 1 ? '' : 's'}? This will update inventory stock for all approved entries.`,
      confirmLabel: 'Approve all',
    }))) return

    setApprovingEntryId('all')
    try {
      const res = await apiFetch('/inventory/entries/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        notifySuccess(`Approved ${data.approved_count || 0} pending stock update${data.approved_count === 1 ? '' : 's'}`)
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to approve pending stock entries')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to approve pending stock entries')
    } finally {
      setApprovingEntryId(null)
    }
  }

  const getTransferStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'received': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-500">Track stock levels, movements, and transfers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkStockUpdateDialog(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Stock Update
            </Button>
            <Dialog open={showCreateEntryModal} onOpenChange={setShowCreateEntryModal}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Stock Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Stock Entry</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Item Name</Label>
                      <SearchableSelect
                        value={newEntry.selected_item_id}
                        onValueChange={(value) => handleSelectInventoryItem(value, 'entry')}
                        options={inventoryItems.map((item) => ({
                          value: item.id,
                          label: item.sku ? `${item.name} (${item.sku})` : item.name,
                        }))}
                        placeholder="Select item"
                        searchPlaceholder="Search items..."
                        emptyMessage="No items found"
                        onAddNew={handleOpenCreateProductForm}
                        addNewLabel="Add New Item"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Outlet / Warehouse</Label>
                      <SearchableSelect
                        value={newEntry.outlet_id}
                        onValueChange={(value) => setNewEntry((prev) => ({ ...prev, outlet_id: value }))}
                        options={warehouses.map((wh) => ({
                          value: wh.id,
                          label: `${wh.name} (${wh.code})`,
                        }))}
                        placeholder="Select outlet"
                        searchPlaceholder="Search warehouses..."
                        emptyMessage="No warehouses found"
                        onAddNew={handleOpenCreateWarehouseForm}
                        addNewLabel="Add New Warehouse"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Entry Type</Label>
                      <Select value={newEntry.entry_type} onValueChange={(v) => setNewEntry({ ...newEntry, entry_type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purchase">Purchase</SelectItem>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="adjustment">Adjustment</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="opening">Opening Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={newEntry.quantity}
                        onChange={(e) => setNewEntry({ ...newEntry, quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost Price</Label>
                      <Input
                        type="number"
                        value={newEntry.cost_price}
                        onChange={(e) => setNewEntry({ ...newEntry, cost_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Item code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newEntry.item_code}
                          onChange={(e) => setNewEntry({ ...newEntry, item_code: e.target.value })}
                          placeholder="Enter item code or scan"
                        />
                        {canUseCameraBarcodeScanner && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowBarcodeScanner(true)}
                          >
                            <Barcode className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {entryNeedsBatching && (
                    <div className="grid grid-cols-2 gap-4 rounded-lg border border-dashed p-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Batch No *</Label>
                        <Input
                          value={newEntry.batch_no}
                          onChange={(e) => setNewEntry({ ...newEntry, batch_no: e.target.value })}
                          placeholder="BATCH001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Manufacturing Date</Label>
                        <Input
                          type="date"
                          value={newEntry.mfg_date}
                          onChange={(e) => setNewEntry({ ...newEntry, mfg_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={newEntry.exp_date}
                          onChange={(e) => setNewEntry({ ...newEntry, exp_date: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateEntry}>Create Entry</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={showAdjustStockModal} onOpenChange={setShowAdjustStockModal}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Adjust Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Stock</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Item Name</Label>
                    <SearchableSelect
                      value={adjustStock.selected_item_id}
                      onValueChange={(value) => handleSelectInventoryItem(value, 'adjust')}
                      options={inventoryItems.map((item) => ({
                        value: item.id,
                        label: item.sku ? `${item.name} (${item.sku})` : item.name,
                      }))}
                      placeholder="Select item"
                      searchPlaceholder="Search items..."
                      emptyMessage="No items found"
                      onAddNew={handleOpenCreateProductForm}
                      addNewLabel="Add New Item"
                    />
                  </div>
                  <div>
                    <Label>Outlet / Warehouse</Label>
                    <SearchableSelect
                      value={adjustStock.outlet_id}
                      onValueChange={(value) => setAdjustStock((prev) => ({ ...prev, outlet_id: value }))}
                      options={warehouses.map((wh) => ({
                        value: wh.id,
                        label: `${wh.name} (${wh.code})`,
                      }))}
                      placeholder="Select outlet"
                      searchPlaceholder="Search warehouses..."
                      emptyMessage="No warehouses found"
                      onAddNew={handleOpenCreateWarehouseForm}
                      addNewLabel="Add New Warehouse"
                    />
                  </div>
                  <div>
                    <Label>Quantity (+/-)</Label>
                    <Input
                      type="number"
                      value={adjustStock.quantity}
                      onChange={(e) => setAdjustStock({ ...adjustStock, quantity: parseFloat(e.target.value) || 0 })}
                      placeholder="Positive to add, negative to reduce"
                    />
                  </div>
                  <div>
                    <Label>Reason *</Label>
                    <Input
                      value={adjustStock.reason}
                      onChange={(e) => setAdjustStock({ ...adjustStock, reason: e.target.value })}
                      placeholder="Reason for adjustment"
                      required
                    />
                  </div>
                  <Button onClick={handleAdjustStock} className="w-full">Adjust Stock</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => setShowReserveModal(true)}>
              <Warehouse className="h-4 w-4 mr-2" />
              Reserve Stock
            </Button>
            <Button variant="outline" onClick={() => setShowReleaseModal(true)}>
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              Release Stock
            </Button>
          </div>
        </div>

        {/* Edit Stock Entry Modal */}
        <Dialog open={showEditEntryModal} onOpenChange={setShowEditEntryModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Stock Entry</DialogTitle>
            </DialogHeader>
                {editingEntry && (
                  <div className="space-y-4">
                    <div>
                      <Label>Item</Label>
                      <Input
                        value={editingEntry.product?.name || editingEntry.item_name}
                        disabled
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={editingEntry.quantity}
                        onChange={(e) => setEditingEntry({ ...editingEntry, quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Cost Price</Label>
                      <Input
                        type="number"
                        value={editingEntry.cost_price}
                        onChange={(e) => setEditingEntry({ ...editingEntry, cost_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Batch No</Label>
                      <Input
                        value={editingEntry.batch_no}
                        onChange={(e) => setEditingEntry({ ...editingEntry, batch_no: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Item code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={editingEntry.item_code || ''}
                          onChange={(e) => setEditingEntry({ ...editingEntry, item_code: e.target.value })}
                          placeholder="Enter item code or scan"
                        />
                        {canUseCameraBarcodeScanner && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowBarcodeScanner(true)}
                          >
                            <Barcode className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Manufacturing Date</Label>
                        <Input
                          type="date"
                          value={editingEntry.mfg_date || ''}
                          onChange={(e) => setEditingEntry({ ...editingEntry, mfg_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={editingEntry.exp_date || ''}
                          onChange={(e) => setEditingEntry({ ...editingEntry, exp_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={editingEntry.notes}
                        onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateEntry} className="flex-1">Update Entry</Button>
                      <Button variant="outline" onClick={() => setShowEditEntryModal(false)} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                )}
          </DialogContent>
        </Dialog>

        {/* Reserve Stock Modal */}
        <Dialog open={showReserveModal} onOpenChange={setShowReserveModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reserve Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select
                  value={reserveStock.product_id}
                  onValueChange={(value) => setReserveStock({ ...reserveStock, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.filter(item => item.type === 'product').map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} {item.sku && `(${item.sku})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Outlet / Warehouse</Label>
                <Select
                  value={reserveStock.outlet_id}
                  onValueChange={(value) => setReserveStock({ ...reserveStock, outlet_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={reserveStock.quantity}
                  onChange={(e) => setReserveStock({ ...reserveStock, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Input
                  value={reserveStock.reason}
                  onChange={(e) => setReserveStock({ ...reserveStock, reason: e.target.value })}
                  placeholder="Reason for reservation"
                  required
                />
              </div>
              <Button onClick={handleReserveStock} className="w-full">Reserve Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Release Stock Modal */}
        <Dialog open={showReleaseModal} onOpenChange={setShowReleaseModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Release Reserved Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select
                  value={releaseStock.product_id}
                  onValueChange={(value) => setReleaseStock({ ...releaseStock, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.filter(item => item.type === 'product').map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} {item.sku && `(${item.sku})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Outlet / Warehouse</Label>
                <Select
                  value={releaseStock.outlet_id}
                  onValueChange={(value) => setReleaseStock({ ...releaseStock, outlet_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={releaseStock.quantity}
                  onChange={(e) => setReleaseStock({ ...releaseStock, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Input
                  value={releaseStock.reason}
                  onChange={(e) => setReleaseStock({ ...releaseStock, reason: e.target.value })}
                  placeholder="Reason for release"
                  required
                />
              </div>
              <Button onClick={handleReleaseStock} className="w-full">Release Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Low Stock Alerts */}
        {lowStockAlerts.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Alerts ({lowStockAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Stock</TableHead>
                    <TableHead>Outlet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockPagination.paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                        No low stock alerts
                      </TableCell>
                    </TableRow>
                  ) : (
                    lowStockPagination.paginatedItems.map((alert) => (
                      <TableRow key={`${alert.product_id}-${alert.outlet_id}`}>
                        <TableCell className="font-medium">{alert.product_name}</TableCell>
                        <TableCell>{alert.sku}</TableCell>
                        <TableCell className="text-red-600 font-medium">{alert.current_stock}</TableCell>
                        <TableCell>{alert.min_stock}</TableCell>
                        <TableCell>{alert.outlet_name || alert.outlet_id}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                page={lowStockPagination.page}
                totalPages={lowStockPagination.totalPages}
                totalItems={lowStockPagination.totalItems}
                pageSize={lowStockPagination.pageSize}
                onPageChange={lowStockPagination.setPage}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <Label htmlFor="inventory_date_period">Period</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-gray-500" />
                    <Select
                      value={datePeriod}
                      onValueChange={(value) => setDatePeriod(value as DatePeriod)}
                    >
                      <SelectTrigger id="inventory_date_period" className="w-[180px]">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_PERIOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {datePeriod === 'custom' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-full sm:w-auto"
                        aria-label="From date"
                      />
                      <span className="hidden text-sm text-gray-400 sm:inline">to</span>
                      <Input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="w-full sm:w-auto"
                        aria-label="To date"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {isDateFilterActive ? (
                  <p>
                    Showing <span className="font-medium text-gray-700">{dateRangeLabel}</span> on Stock Entries and Transfers.
                    Stock Balance, Inventory Stocks, and Low Stock Alerts always show current data.
                  </p>
                ) : (
                  <p>Stock Balance, Inventory Stocks, and Low Stock Alerts always show current data.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="balance">Stock Balance</TabsTrigger>
            <TabsTrigger value="entries">
              Stock Entries
              {pendingEntriesCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {pendingEntriesCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="stocks">Inventory Stocks</TabsTrigger>
          </TabsList>

          <TabsContent value="balance">
            <Card>
              <CardHeader>
                <CardTitle>Stock Balance</CardTitle>
                <p className="text-sm text-gray-500">
                  Totals consolidated across all batches per product and outlet.
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Stock Qty</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Outlet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balancePagination.paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          No stock balance records
                        </TableCell>
                      </TableRow>
                    ) : (
                      balancePagination.paginatedItems.map((item) => (
                        <TableRow key={`${item.product_id}-${item.outlet_id}`}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell>{item.stock_qty}</TableCell>
                          <TableCell>₹{item.cost_price.toFixed(2)}</TableCell>
                          <TableCell>₹{item.value.toFixed(2)}</TableCell>
                          <TableCell>{item.outlet_name || item.outlet_id}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={balancePagination.page}
                  totalPages={balancePagination.totalPages}
                  totalItems={balancePagination.totalItems}
                  pageSize={balancePagination.pageSize}
                  onPageChange={balancePagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entries">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Stock Entries</CardTitle>
                    {isDateFilterActive && (
                      <p className="text-sm text-gray-500">
                        Filtered by {dateRangeLabel} · {filteredEntries.length} of {entries.length} entries
                      </p>
                    )}
                    {pendingEntriesCount > 0 && (
                      <p className="mt-1 text-sm text-amber-700">
                        {pendingEntriesCount} purchase stock update{pendingEntriesCount === 1 ? '' : 's'} pending approval
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={entryApprovalFilter}
                      onValueChange={(v) => setEntryApprovalFilter(v as typeof entryApprovalFilter)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Approval status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    {pendingEntriesCount > 0 && (
                      <Button
                        size="sm"
                        onClick={handleApproveAllPending}
                        disabled={approvingEntryId === 'all'}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve all pending
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Batch No</TableHead>
                      <TableHead>Item code</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesPagination.paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-gray-500">
                          {entries.length === 0
                            ? 'No stock entries found'
                            : 'No stock entries found for the selected filters'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      entriesPagination.paginatedItems.map((entry) => {
                        const approvalStatus = entry.approval_status || 'approved'
                        const isPending = approvalStatus === 'pending'
                        return (
                        <TableRow key={entry.id} className={isPending ? 'bg-amber-50/60' : undefined}>
                          <TableCell className="font-medium">
                            {entry.product?.name || entry.item_name}
                            {entry.product?.sku && <span className="text-gray-500 text-xs ml-2">({entry.product.sku})</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEntryTypeColor(entry.entry_type)}`}>
                              {entry.entry_type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getApprovalStatusColor(approvalStatus)}`}>
                              {approvalStatus}
                            </span>
                          </TableCell>
                          <TableCell className={entry.quantity < 0 ? 'text-red-600' : 'text-green-600'}>
                            {entry.quantity}
                          </TableCell>
                          <TableCell>₹{entry.cost_price.toFixed(2)}</TableCell>
                          <TableCell>{entry.batch_no || '-'}</TableCell>
                          <TableCell>{entry.item_code || '-'}</TableCell>
                          <TableCell>{entry.outlet_name || entry.outlet_id}</TableCell>
                          <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                          <TableCell>{entry.notes || '-'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {isPending && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-700 border-green-200 hover:bg-green-50"
                                    disabled={approvingEntryId === entry.id}
                                    onClick={() => handleApproveEntry(entry)}
                                  >
                                    <Check className="mr-1 h-3.5 w-3.5" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-700 border-red-200 hover:bg-red-50"
                                    disabled={approvingEntryId === entry.id}
                                    onClick={() => handleRejectEntry(entry)}
                                  >
                                    <X className="mr-1 h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditEntry(entry)}
                              >
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={entriesPagination.page}
                  totalPages={entriesPagination.totalPages}
                  totalItems={entriesPagination.totalItems}
                  pageSize={entriesPagination.pageSize}
                  onPageChange={entriesPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers">
            <Card>
              <CardHeader>
                <CardTitle>Stock Transfers</CardTitle>
                {isDateFilterActive && (
                  <p className="text-sm text-gray-500">
                    Filtered by {dateRangeLabel} · {filteredTransfers.length} of {transfers.length} transfers
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From Outlet</TableHead>
                      <TableHead>To Outlet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfersPagination.paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          {transfers.length === 0
                            ? 'No stock transfers found'
                            : 'No stock transfers found for the selected period'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transfersPagination.paginatedItems.map((transfer) => (
                        <TableRow key={transfer.id}>
                          <TableCell>{transfer.from_outlet_id || '-'}</TableCell>
                          <TableCell>{transfer.to_outlet_id}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransferStatusColor(transfer.status)}`}>
                              {transfer.status}
                            </span>
                          </TableCell>
                          <TableCell>{transfer.total_items}</TableCell>
                          <TableCell>{transfer.total_quantity}</TableCell>
                          <TableCell>{new Date(transfer.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={transfersPagination.page}
                  totalPages={transfersPagination.totalPages}
                  totalItems={transfersPagination.totalItems}
                  pageSize={transfersPagination.pageSize}
                  onPageChange={transfersPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stocks">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Stocks</CardTitle>
                <p className="text-sm text-gray-500">
                  Current stock by batch where batch tracking applies; one row per product when no batch is used.
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Initial Qty</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Avg Cost</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stocksPagination.paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-gray-500">
                          No inventory stock records
                        </TableCell>
                      </TableRow>
                    ) : (
                      stocksPagination.paginatedItems.map((stock) => (
                        <TableRow key={stock.id}>
                          <TableCell className="font-medium">{stock.product?.name || '-'}</TableCell>
                          <TableCell>{stock.product?.sku || '-'}</TableCell>
                          <TableCell>{stock.batch_no || '-'}</TableCell>
                          <TableCell>
                            {stock.exp_date
                              ? new Date(stock.exp_date).toLocaleDateString('en-IN')
                              : '-'}
                          </TableCell>
                          <TableCell>{stock.initial_quantity ?? 0}</TableCell>
                          <TableCell>{stock.quantity}</TableCell>
                          <TableCell>{stock.reserved_qty}</TableCell>
                          <TableCell className="font-medium text-green-600">{stock.available_qty}</TableCell>
                          <TableCell>₹{stock.average_cost.toFixed(2)}</TableCell>
                          <TableCell>{stock.outlet_name || stock.outlet_id}</TableCell>
                          <TableCell>{new Date(stock.last_updated).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={stocksPagination.page}
                  totalPages={stocksPagination.totalPages}
                  totalItems={stocksPagination.totalItems}
                  pageSize={stocksPagination.pageSize}
                  onPageChange={stocksPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showBulkStockUpdateDialog} onOpenChange={handleBulkStockUpdateDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Stock Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a CSV or Excel file to update stock in bulk. Use <strong>set</strong> to set absolute quantity, or <strong>adjust</strong> to add or subtract stock. Identify products by SKU, product name, or item code.
            </p>
            <Button variant="outline" onClick={handleDownloadBulkStockUpdateTemplate} className="gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4" />
              Download Stock Update Template
            </Button>
            <div className="space-y-2">
              <Label htmlFor="bulk_stock_update_file">Update file</Label>
              <Input
                id="bulk_stock_update_file"
                ref={bulkStockUpdateFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setBulkStockUpdateFile(e.target.files?.[0] ?? null)}
              />
              {bulkStockUpdateFile && (
                <p className="text-sm text-gray-500">Selected: {bulkStockUpdateFile.name}</p>
              )}
            </div>
            {bulkStockUpdatedCount !== null && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Updated stock for {bulkStockUpdatedCount} row{bulkStockUpdatedCount === 1 ? '' : 's'} successfully.
              </div>
            )}
            {bulkStockUpdateErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 max-h-40 overflow-y-auto space-y-1">
                {bulkStockUpdateErrors.map((error, index) => (
                  <p key={`${error}-${index}`}>{error}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleBulkStockUpdateDialogChange(false)}>Cancel</Button>
            <Button onClick={handleBulkStockUpdate} disabled={bulkStockUpdating || !bulkStockUpdateFile}>
              {bulkStockUpdating ? 'Updating...' : 'Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {canUseCameraBarcodeScanner && (
        <BarcodeScanner
          open={showBarcodeScanner}
          onOpenChange={setShowBarcodeScanner}
          onScan={showEditEntryModal ? handleEditBarcodeScan : handleStockBarcodeScan}
        />
      )}

      {confirmDialog}
    </DashboardLayout>
  )
}
