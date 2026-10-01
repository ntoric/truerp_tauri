'use client'

import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import BarcodeScanner from '@/components/ui/BarcodeScanner'
import ExpandableTableCard from '@/components/ui/expandable-table-card'
import { Warehouse, ArrowDownLeft, ArrowUpRight, RotateCcw, Plus, Search, Truck, AlertTriangle, Barcode, Upload, Download, CalendarRange, Check, X, Filter, IndianRupee, Package, Boxes, RefreshCw, Pencil, BarChart3 } from 'lucide-react'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { asArray, formatCurrency } from '@/lib/utils'
import StatWidget from '@/components/widgets/StatWidget'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  DATE_PERIOD_OPTIONS,
  DatePeriod,
  formatDateRangeLabel,
  getDateRangeForPeriod,
} from '@/lib/dateFilter'
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { isSuperAdmin } from '@/lib/roles'
import PageHeaderActions from '@/components/layout/PageHeaderActions'

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

interface OpeningStockOverride {
  id: string
  effective_date: string
  quantity: number
  value: number
  notes?: string
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

interface InventoryStats {
  total_value: number
  total_qty: number
  product_count: number
  outlet_count: number
  low_stock_count: number
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

function HeaderIconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function StatWidgetSkeleton() {
  return (
    <Card className="rounded-xl border-[#e4e6ef] bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-14 w-14 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeletonRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export default function InventoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const canUseCameraBarcodeScanner = isSuperAdmin(user?.role)
  const canOverrideOpeningStock = isSuperAdmin(user?.role)
  const { confirm, confirmDialog } = useConfirmDialog()
  const [balance, setBalance] = useState<StockBalance[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [stocks, setStocks] = useState<InventoryStock[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [transfersLoading, setTransfersLoading] = useState(true)
  const [stocksLoading, setStocksLoading] = useState(true)
  const [lowStockLoading, setLowStockLoading] = useState(true)
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
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [approvingEntryId, setApprovingEntryId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [entriesPage, setEntriesPage] = useState(1)
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [stocksPage, setStocksPage] = useState(1)
  const [stocksTotal, setStocksTotal] = useState(0)
  const [transfersPage, setTransfersPage] = useState(1)
  const [transfersTotal, setTransfersTotal] = useState(0)
  const [balancePage, setBalancePage] = useState(1)
  const [balanceTotal, setBalanceTotal] = useState(0)
  const [lowStockPage, setLowStockPage] = useState(1)
  const [lowStockTotal, setLowStockTotal] = useState(0)
  const [pendingEntriesCount, setPendingEntriesCount] = useState(0)
  const [refreshingClosing, setRefreshingClosing] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [openingOverrides, setOpeningOverrides] = useState<OpeningStockOverride[]>([])
  const [savingOverride, setSavingOverride] = useState(false)
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null)
  const [overrideForm, setOverrideForm] = useState({
    date: '',
    quantity: 0,
    value: 0,
    notes: '',
  })
  const pageSize = DEFAULT_PAGE_SIZE
  const entriesTotalPages = Math.max(1, Math.ceil(entriesTotal / pageSize))
  const stocksTotalPages = Math.max(1, Math.ceil(stocksTotal / pageSize))
  const transfersTotalPages = Math.max(1, Math.ceil(transfersTotal / pageSize))
  const balanceTotalPages = Math.max(1, Math.ceil(balanceTotal / pageSize))
  const lowStockTotalPages = Math.max(1, Math.ceil(lowStockTotal / pageSize))

  const dateRange = useMemo(
    () => getDateRangeForPeriod(datePeriod, customFromDate, customToDate),
    [datePeriod, customFromDate, customToDate]
  )
  const dateRangeLabel = useMemo(() => formatDateRangeLabel(dateRange), [dateRange])
  const isDateFilterActive = datePeriod !== 'all' && (datePeriod !== 'custom' || Boolean(customFromDate || customToDate))
  const hasCustomizedFilters = datePeriod !== 'month'

  const entryNeedsBatching = useMemo(() => {
    const selectedItem = inventoryItems.find((item) => item.id === newEntry.selected_item_id)
    return Boolean(selectedItem?.type === 'product' && selectedItem.enable_batching)
  }, [inventoryItems, newEntry.selected_item_id])

  // Low-stock badge count comes from the stats endpoint so it shows before the
  // low-stock tab is opened; fall back to the tab's own total if stats failed.
  const lowStockCount = inventoryStats ? inventoryStats.low_stock_count : lowStockTotal

  // Inventory stocks always show current batch-level rows; date filter applies to entries/transfers only.
  const isProductSearchActive = productSearchQuery.trim().length > 0

  // Lightweight data needed regardless of the active tab: dropdown options for
  // the dialogs, the pending-approval badge, and the stat widgets.
  useEffect(() => { if (!authLoading && user) fetchStats() }, [authLoading, user])
  useEffect(() => { if (!authLoading && user) fetchInventoryItems() }, [authLoading, user])
  useEffect(() => { if (!authLoading && user) fetchWarehouses() }, [authLoading, user])
  useEffect(() => { if (!authLoading && user) fetchPendingCount() }, [authLoading, user])

  // Each tab fetches its own page of data when opened and when its
  // filters/page change while it is active.
  useEffect(() => { if (!authLoading && user && activeTab === 'balance') fetchBalance() }, [authLoading, user, activeTab, debouncedProductSearch, balancePage])
  useEffect(() => { if (!authLoading && user && activeTab === 'entries') fetchEntries() }, [authLoading, user, activeTab, debouncedProductSearch, entryApprovalFilter, dateRange, entriesPage])
  useEffect(() => { if (!authLoading && user && activeTab === 'stocks') fetchStocks() }, [authLoading, user, activeTab, debouncedProductSearch, stocksPage])
  useEffect(() => { if (!authLoading && user && activeTab === 'transfers') fetchTransfers() }, [authLoading, user, activeTab, dateRange, transfersPage])
  useEffect(() => { if (!authLoading && user && activeTab === 'low-stock') fetchLowStock() }, [authLoading, user, activeTab, lowStockPage])

  // Debounce the shared product search so each keystroke doesn't hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearchQuery.trim())
      setBalancePage(1)
      setEntriesPage(1)
      setStocksPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearchQuery])

  useEffect(() => {
    setEntriesPage(1)
    setTransfersPage(1)
  }, [datePeriod, customFromDate, customToDate, entryApprovalFilter])

  // In the override dialog, the opening defaults to the computed overall
  // closing stock of the previous day once a date is chosen.
  useEffect(() => {
    if (!showOverrideModal) return
    const { date } = overrideForm
    if (!date) return
    const d = new Date(`${date}T00:00:00`)
    if (Number.isNaN(d.getTime())) return
    d.setDate(d.getDate() - 1)
    const prevDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    apiFetch(`/inventory/snapshots/position?date=${prevDate}`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setOverrideForm((prev) => ({
          ...prev,
          quantity: Number(data.quantity) || 0,
          value: Number(data.value) || 0,
        }))
      })
      .catch(() => {})
  }, [showOverrideModal, overrideForm.date])

  const toYmd = (d: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''

  // Aggregate figures for the stat widgets, fetched once independently of the
  // tables so the widgets can render while a tab's data is still loading.
  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const res = await apiFetch('/inventory/stats')
      if (res.ok) {
        const data = await res.json()
        setInventoryStats({
          total_value: Number(data?.total_value) || 0,
          total_qty: Number(data?.total_qty) || 0,
          product_count: Number(data?.product_count) || 0,
          outlet_count: Number(data?.outlet_count) || 0,
          low_stock_count: Number(data?.low_stock_count) || 0,
        })
      }
    } catch (err) { console.error(err) }
    finally { setStatsLoading(false) }
  }

  const fetchBalance = async () => {
    setBalanceLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedProductSearch) params.append('search', debouncedProductSearch)
      params.append('page', String(balancePage))
      params.append('per_page', String(pageSize))
      const res = await apiFetch(`/inventory/balance?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows = asArray<StockBalance>(data)
        const nextTotal = typeof data?.total === 'number' ? data.total : rows.length
        // The current page may no longer exist after deletions or filter changes.
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (balancePage > maxPage) {
          setBalancePage(maxPage)
          return
        }
        setBalance(rows)
        setBalanceTotal(nextTotal)
      }
    } catch (err) { console.error(err) }
    finally { setBalanceLoading(false) }
  }

  const fetchLowStock = async () => {
    setLowStockLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', String(lowStockPage))
      params.append('per_page', String(pageSize))
      const res = await apiFetch(`/inventory/alerts/low-stock?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows = asArray<LowStockAlert>(data)
        const nextTotal = typeof data?.total === 'number' ? data.total : rows.length
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (lowStockPage > maxPage) {
          setLowStockPage(maxPage)
          return
        }
        setLowStockAlerts(rows)
        setLowStockTotal(nextTotal)
      }
    } catch (err) { console.error(err) }
    finally { setLowStockLoading(false) }
  }

  const fetchEntries = async () => {
    setEntriesLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.from) params.append('from_date', toYmd(dateRange.from))
      if (dateRange.to) params.append('to_date', toYmd(dateRange.to))
      if (entryApprovalFilter !== 'all') params.append('approval_status', entryApprovalFilter)
      if (debouncedProductSearch) params.append('search', debouncedProductSearch)
      params.append('page', String(entriesPage))
      params.append('per_page', String(pageSize))
      const res = await apiFetch(`/inventory/entries?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows = asArray<StockEntry>(data)
        const nextTotal = typeof data?.total === 'number' ? data.total : rows.length
        // The current page may no longer exist after deletions or filter changes.
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (entriesPage > maxPage) {
          setEntriesPage(maxPage)
          return
        }
        setEntries(rows)
        setEntriesTotal(nextTotal)
      }
    } catch (err) { console.error(err) }
    finally { setEntriesLoading(false) }
  }

  const fetchStocks = async () => {
    setStocksLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedProductSearch) params.append('search', debouncedProductSearch)
      params.append('page', String(stocksPage))
      params.append('per_page', String(pageSize))
      const res = await apiFetch(`/inventory/stocks?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows = asArray<InventoryStock>(data)
        const nextTotal = typeof data?.total === 'number' ? data.total : rows.length
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (stocksPage > maxPage) {
          setStocksPage(maxPage)
          return
        }
        setStocks(rows)
        setStocksTotal(nextTotal)
      }
    } catch (err) { console.error(err) }
    finally { setStocksLoading(false) }
  }

  const fetchTransfers = async () => {
    setTransfersLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.from) params.append('from_date', toYmd(dateRange.from))
      if (dateRange.to) params.append('to_date', toYmd(dateRange.to))
      params.append('page', String(transfersPage))
      params.append('per_page', String(pageSize))
      const res = await apiFetch(`/inventory/transfers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows = asArray<StockTransfer>(data)
        const nextTotal = typeof data?.total === 'number' ? data.total : rows.length
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (transfersPage > maxPage) {
          setTransfersPage(maxPage)
          return
        }
        setTransfers(rows)
        setTransfersTotal(nextTotal)
      }
    } catch (err) { console.error(err) }
    finally { setTransfersLoading(false) }
  }

  // The approval badge needs the pending count across all entries, not just
  // the loaded page — a per_page=1 query returns it via `total`.
  const fetchPendingCount = async () => {
    try {
      const res = await apiFetch('/inventory/entries?approval_status=pending&page=1&per_page=1')
      if (res.ok) {
        const data = await res.json()
        setPendingEntriesCount(typeof data?.total === 'number' ? data.total : asArray(data).length)
      }
    } catch (err) { console.error(err) }
  }

  // Refreshes the widgets and whichever tab is currently on screen; other tabs
  // refetch when they are opened.
  const fetchData = () => {
    fetchStats()
    fetchPendingCount()
    if (activeTab === 'balance') fetchBalance()
    else if (activeTab === 'entries') fetchEntries()
    else if (activeTab === 'transfers') fetchTransfers()
    else if (activeTab === 'stocks') fetchStocks()
    else if (activeTab === 'low-stock') fetchLowStock()
  }

  // Recalculates today's closing stock on the server and records it in the
  // daily snapshot table (insert or update under the current date).
  const handleRefreshClosingStock = async () => {
    setRefreshingClosing(true)
    try {
      const res = await apiFetch('/inventory/snapshots/refresh-closing', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        notifySuccess(
          `Closing stock updated for ${data.date}: ${formatCurrency(data.closing_value)} (${Number(data.closing_qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })} units)`
        )
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to refresh closing stock')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to refresh closing stock')
    } finally {
      setRefreshingClosing(false)
    }
  }

  const fetchOpeningOverrides = async () => {
    try {
      const res = await apiFetch('/inventory/snapshots/opening-overrides')
      if (res.ok) {
        setOpeningOverrides(asArray(await res.json()))
      }
    } catch (err) { console.error(err) }
  }

  const handleOpenOverrideModal = () => {
    setOverrideForm((prev) => ({ ...prev, date: prev.date || new Date().toISOString().slice(0, 10) }))
    setShowOverrideModal(true)
    fetchOpeningOverrides()
  }

  const handleSaveOverride = async () => {
    if (!overrideForm.date) {
      notifyError('Please select a date')
      return
    }
    setSavingOverride(true)
    try {
      const res = await apiFetch('/inventory/snapshots/opening-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrideForm),
      })
      if (res.ok) {
        notifySuccess('Opening stock override saved')
        setOverrideForm((prev) => ({ date: prev.date, quantity: 0, value: 0, notes: '' }))
        fetchOpeningOverrides()
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to save override')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to save override')
    } finally {
      setSavingOverride(false)
    }
  }

  const handleDeleteOverride = async (id: string) => {
    setDeletingOverrideId(id)
    try {
      const res = await apiFetch(`/inventory/snapshots/opening-override/${id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Override removed')
        fetchOpeningOverrides()
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to delete override')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to delete override')
    } finally {
      setDeletingOverrideId(null)
    }
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

  const warehouseName = (id: string) =>
    warehouses.find((wh) => wh.id === id)?.name || id

  const handleExportBalance = async () => {
    try {
      // per_page=0 returns every matching row for the export.
      const params = new URLSearchParams()
      if (debouncedProductSearch) params.append('search', debouncedProductSearch)
      params.append('page', '1')
      params.append('per_page', '0')
      const res = await apiFetch(`/inventory/balance?${params.toString()}`, { timeoutMs: 30000 })
      if (!res.ok) throw new Error('Failed to fetch stock balance')
      const rows = asArray<StockBalance>(await res.json())
      await downloadCsv(
        `stock_balance_${accountingExportDateStamp()}.csv`,
        [
          ['Product', 'SKU', 'Stock Qty', 'Cost Price', 'Value', 'Outlet'],
          ...rows.map((item) => [
            item.product_name,
            item.sku,
            item.stock_qty,
            item.cost_price.toFixed(2),
            item.value.toFixed(2),
            item.outlet_name || item.outlet_id,
          ]),
        ],
        { label: 'Exporting stock balance' }
      )
      notifySuccess('Stock balance exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export stock balance')
    }
  }

  const handleExportEntries = async () => {
    try {
      // per_page=0 returns every matching row for the export.
      const params = new URLSearchParams()
      if (dateRange.from) params.append('from_date', toYmd(dateRange.from))
      if (dateRange.to) params.append('to_date', toYmd(dateRange.to))
      if (entryApprovalFilter !== 'all') params.append('approval_status', entryApprovalFilter)
      if (debouncedProductSearch) params.append('search', debouncedProductSearch)
      params.append('page', '1')
      params.append('per_page', '0')
      const res = await apiFetch(`/inventory/entries?${params.toString()}`, { timeoutMs: 30000 })
      if (!res.ok) throw new Error('Failed to fetch stock entries')
      const rows = asArray<StockEntry>(await res.json())
      await downloadCsv(
        `stock_entries_${accountingExportDateStamp()}.csv`,
        [
          ['Item', 'SKU', 'Type', 'Approval', 'Quantity', 'Cost Price', 'Batch No', 'Item Code', 'Outlet', 'Date', 'Notes'],
          ...rows.map((entry) => [
            entry.product?.name || entry.item_name,
            entry.product?.sku || '',
            entry.entry_type,
            entry.approval_status || 'approved',
            entry.quantity,
            entry.cost_price.toFixed(2),
            entry.batch_no || '',
            entry.item_code || '',
            entry.outlet_name || entry.outlet_id,
            new Date(entry.entry_date).toLocaleDateString(),
            entry.notes || '',
          ]),
        ],
        { label: 'Exporting stock entries' }
      )
      notifySuccess('Stock entries exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export stock entries')
    }
  }

  const handleExportTransfers = async () => {
    try {
      // per_page=0 returns every matching row for the export.
      const params = new URLSearchParams()
      if (dateRange.from) params.append('from_date', toYmd(dateRange.from))
      if (dateRange.to) params.append('to_date', toYmd(dateRange.to))
      params.append('page', '1')
      params.append('per_page', '0')
      const res = await apiFetch(`/inventory/transfers?${params.toString()}`, { timeoutMs: 30000 })
      if (!res.ok) throw new Error('Failed to fetch stock transfers')
      const rows = asArray<StockTransfer>(await res.json())
      await downloadCsv(
        `stock_transfers_${accountingExportDateStamp()}.csv`,
        [
          ['From Outlet', 'To Outlet', 'Status', 'Items', 'Quantity', 'Date'],
          ...rows.map((transfer) => [
            transfer.from_outlet_id ? warehouseName(transfer.from_outlet_id) : '-',
            warehouseName(transfer.to_outlet_id),
            transfer.status,
            transfer.total_items,
            transfer.total_quantity,
            new Date(transfer.created_at).toLocaleDateString(),
          ]),
        ],
        { label: 'Exporting stock transfers' }
      )
      notifySuccess('Stock transfers exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export stock transfers')
    }
  }

  const handleExportStocks = async () => {
    try {
      // per_page=0 returns every matching row for the export.
      const params = new URLSearchParams()
      if (debouncedProductSearch) params.append('search', debouncedProductSearch)
      params.append('page', '1')
      params.append('per_page', '0')
      const res = await apiFetch(`/inventory/stocks?${params.toString()}`, { timeoutMs: 30000 })
      if (!res.ok) throw new Error('Failed to fetch inventory stocks')
      const rows = asArray<InventoryStock>(await res.json())
      await downloadCsv(
        `inventory_stocks_${accountingExportDateStamp()}.csv`,
        [
          ['Product', 'SKU', 'Batch', 'Expiry', 'Initial Qty', 'Quantity', 'Reserved', 'Available', 'Avg Cost', 'Outlet', 'Last Updated'],
          ...rows.map((stock) => [
            stock.product?.name || '',
            stock.product?.sku || '',
            stock.batch_no || '',
            stock.exp_date ? new Date(stock.exp_date).toLocaleDateString('en-IN') : '',
            stock.initial_quantity ?? 0,
            stock.quantity,
            stock.reserved_qty,
            stock.available_qty,
            stock.average_cost.toFixed(2),
            stock.outlet_name || stock.outlet_id,
            new Date(stock.last_updated).toLocaleDateString(),
          ]),
        ],
        { label: 'Exporting inventory stocks' }
      )
      notifySuccess('Inventory stocks exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export inventory stocks')
    }
  }

  const handleExportLowStock = async () => {
    try {
      // per_page=0 returns every matching row for the export.
      const res = await apiFetch('/inventory/alerts/low-stock?page=1&per_page=0', { timeoutMs: 30000 })
      if (!res.ok) throw new Error('Failed to fetch low stock alerts')
      const rows = asArray<LowStockAlert>(await res.json())
      await downloadCsv(
        `low_stock_alerts_${accountingExportDateStamp()}.csv`,
        [
          ['Product', 'SKU', 'Current Stock', 'Min Stock', 'Outlet'],
          ...rows.map((alert) => [
            alert.product_name,
            alert.sku,
            alert.current_stock,
            alert.min_stock,
            alert.outlet_name || alert.outlet_id,
          ]),
        ],
        { label: 'Exporting low stock alerts' }
      )
      notifySuccess('Low stock alerts exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export low stock alerts')
    }
  }

  const exportButton = (onClick: () => void) => (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-2">
      <Download className="h-4 w-4" />
      Export
    </Button>
  )

  const productSearchInput = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        placeholder="Search by name, SKU, or item code..."
        value={productSearchQuery}
        onChange={(e) => setProductSearchQuery(e.target.value)}
        className="w-full pl-9 sm:w-[280px]"
        aria-label="Product search"
      />
    </div>
  )

  if (authLoading) {
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
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Inventory Management</h1>
          </div>
          <PageHeaderActions>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`relative shrink-0 ${showFilters ? 'border-slate-300 bg-slate-100 text-slate-800' : ''}`}
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label={showFilters ? 'Hide period and search filters' : 'Show period and search filters'}
              aria-expanded={showFilters}
              title={showFilters ? 'Hide filters' : 'Period & search'}
            >
              <Filter className="h-4 w-4" />
              {datePeriod !== 'month' && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`relative shrink-0 ${showStats ? 'border-slate-300 bg-slate-100 text-slate-800' : ''}`}
              onClick={() => setShowStats((prev) => !prev)}
              aria-label={showStats ? 'Hide inventory stats' : 'Show inventory stats'}
              aria-expanded={showStats}
              title={showStats ? 'Hide stats' : 'Show stats'}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <HeaderIconAction
              label="Refresh Closing Stock"
              onClick={handleRefreshClosingStock}
              disabled={refreshingClosing}
              icon={<RefreshCw className={`h-4 w-4 ${refreshingClosing ? 'animate-spin' : ''}`} />}
            />
            {canOverrideOpeningStock && (
              <HeaderIconAction
                label="Override Opening Stock"
                onClick={handleOpenOverrideModal}
                icon={<Pencil className="h-4 w-4" />}
              />
            )}
            <HeaderIconAction
              label="Bulk Stock Update"
              onClick={() => setShowBulkStockUpdateDialog(true)}
              icon={<Upload className="h-4 w-4" />}
            />
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
          </PageHeaderActions>
        </div>

        {/* Opening Stock Override Modal — superadmin only */}
        <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Override Opening Stock</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500">
              Declares the overall opening stock — all products and warehouses — at the
              start of the selected date. It defaults to the previous day&apos;s closing
              stock; edit to override. Stock reports and P&L will use this value instead
              of the computed opening.
            </p>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label>Opening as of Date</Label>
                <Input
                  type="date"
                  value={overrideForm.date}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={overrideForm.quantity}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Stock Value</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={overrideForm.value}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                  placeholder="Defaults to computed closing value"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={overrideForm.notes}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Reason for override"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOverrideModal(false)}>Close</Button>
              <Button onClick={handleSaveOverride} disabled={savingOverride}>
                {savingOverride ? 'Saving...' : 'Save Override'}
              </Button>
            </DialogFooter>

            {openingOverrides.length > 0 && (
              <div className="mt-2 border-t pt-3">
                <p className="mb-2 text-sm font-medium text-gray-700">Existing overrides</p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {openingOverrides.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{o.effective_date?.slice(0, 10)}</span>
                        <span className="ml-2 text-gray-500">
                          {o.quantity} units · {formatCurrency(o.value)}
                          {o.notes ? ` · ${o.notes}` : ''}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteOverride(o.id)}
                        disabled={deletingOverrideId === o.id}
                        title="Remove override"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
                <SearchableSelect
                  value={reserveStock.product_id}
                  onValueChange={(value) => setReserveStock({ ...reserveStock, product_id: value })}
                  options={inventoryItems
                    .filter(item => item.type === 'product')
                    .map(item => ({ value: item.id, label: item.sku ? `${item.name} (${item.sku})` : item.name }))}
                  placeholder="Select product"
                  searchPlaceholder="Search products..."
                />
              </div>
              <div>
                <Label>Outlet / Warehouse</Label>
                <SearchableSelect
                  value={reserveStock.outlet_id}
                  onValueChange={(value) => setReserveStock({ ...reserveStock, outlet_id: value })}
                  options={warehouses.map(wh => ({ value: wh.id, label: `${wh.name} (${wh.code})` }))}
                  placeholder="Select outlet"
                  searchPlaceholder="Search outlets..."
                />
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
                <SearchableSelect
                  value={releaseStock.product_id}
                  onValueChange={(value) => setReleaseStock({ ...releaseStock, product_id: value })}
                  options={inventoryItems
                    .filter(item => item.type === 'product')
                    .map(item => ({ value: item.id, label: item.sku ? `${item.name} (${item.sku})` : item.name }))}
                  placeholder="Select product"
                  searchPlaceholder="Search products..."
                />
              </div>
              <div>
                <Label>Outlet / Warehouse</Label>
                <SearchableSelect
                  value={releaseStock.outlet_id}
                  onValueChange={(value) => setReleaseStock({ ...releaseStock, outlet_id: value })}
                  options={warehouses.map(wh => ({ value: wh.id, label: `${wh.name} (${wh.code})` }))}
                  placeholder="Select outlet"
                  searchPlaceholder="Search outlets..."
                />
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

        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
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
                  {isProductSearchActive && (
                    <p className="mt-1">
                      Product search applies to Stock Balance, Stock Entries, and Inventory Stocks.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!showFilters && hasCustomizedFilters && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {isDateFilterActive && (
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50"
              >
                <CalendarRange className="h-3.5 w-3.5 text-gray-500" />
                {dateRangeLabel}
              </button>
            )}
          </div>
        )}

        {showStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {inventoryStats === null && statsLoading ? (
            <>
              <StatWidgetSkeleton />
              <StatWidgetSkeleton />
              <StatWidgetSkeleton />
              <StatWidgetSkeleton />
            </>
          ) : (
            <>
              <StatWidget
                title="Total Stock Value"
                value={formatCurrency(inventoryStats?.total_value ?? 0)}
                icon={IndianRupee}
                color="success"
                highlight
                description={`Across ${inventoryStats?.outlet_count ?? 0} outlet${inventoryStats?.outlet_count === 1 ? '' : 's'}`}
              />
              <StatWidget
                title="Units in Stock"
                value={(inventoryStats?.total_qty ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                icon={Boxes}
                color="info"
              />
              <StatWidget
                title="Products in Stock"
                value={inventoryStats?.product_count ?? 0}
                icon={Package}
                color="warning"
              />
              <StatWidget
                title="Low Stock Items"
                value={lowStockCount}
                icon={AlertTriangle}
                color="danger"
              />
            </>
          )}
        </div>
        )}

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
            <TabsTrigger value="low-stock">
              Low Stock Alerts
              {lowStockCount > 0 && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                  {lowStockCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="balance">
            <ExpandableTableCard
              title="Stock Balance"
              headerActions={
                <>
                  {productSearchInput}
                  {exportButton(handleExportBalance)}
                </>
              }
              description={
                <p className="text-sm text-gray-500">
                  Totals consolidated across all batches per product and outlet.
                  {isProductSearchActive && (
                    <> · {balanceTotal} records match your product search</>
                  )}
                </p>
              }
            >
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
                  {balanceLoading ? (
                    <TableSkeletonRows cols={6} />
                  ) : balance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                        {isProductSearchActive
                          ? 'No stock balance records match your product search'
                          : 'No stock balance records'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    balance.map((item) => (
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
                page={balancePage}
                totalPages={balanceTotalPages}
                totalItems={balanceTotal}
                pageSize={pageSize}
                onPageChange={setBalancePage}
              />
            </ExpandableTableCard>
          </TabsContent>

          <TabsContent value="entries">
            <ExpandableTableCard
              title={
                <div>
                  <CardTitle>Stock Entries</CardTitle>
                  {isDateFilterActive && (
                    <p className="mt-1 text-sm text-gray-500">
                      Filtered by {dateRangeLabel} · {entriesTotal} entries
                    </p>
                  )}
                  {isProductSearchActive && !isDateFilterActive && (
                    <p className="mt-1 text-sm text-gray-500">
                      {entriesTotal} entries match your product search
                    </p>
                  )}
                  {pendingEntriesCount > 0 && (
                    <p className="mt-1 text-sm text-amber-700">
                      {pendingEntriesCount} purchase stock update{pendingEntriesCount === 1 ? '' : 's'} pending approval
                    </p>
                  )}
                </div>
              }
              headerActions={
                <>
                  {productSearchInput}
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
                  {exportButton(handleExportEntries)}
                </>
              }
            >
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
                  {entriesLoading ? (
                    <TableSkeletonRows cols={11} />
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-gray-500">
                        {isDateFilterActive || isProductSearchActive || entryApprovalFilter !== 'all'
                          ? 'No stock entries found for the selected filters'
                          : 'No stock entries found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => {
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
                page={entriesPage}
                totalPages={entriesTotalPages}
                totalItems={entriesTotal}
                pageSize={pageSize}
                onPageChange={setEntriesPage}
              />
            </ExpandableTableCard>
          </TabsContent>

          <TabsContent value="transfers">
            <ExpandableTableCard
              title="Stock Transfers"
              headerActions={exportButton(handleExportTransfers)}
              description={
                isDateFilterActive ? (
                  <p className="text-sm text-gray-500">
                    Filtered by {dateRangeLabel} · {transfersTotal} transfers
                  </p>
                ) : undefined
              }
            >
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
                  {transfersLoading ? (
                    <TableSkeletonRows cols={6} />
                  ) : transfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                        {isDateFilterActive
                          ? 'No stock transfers found for the selected period'
                          : 'No stock transfers found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transfers.map((transfer) => (
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
                page={transfersPage}
                totalPages={transfersTotalPages}
                totalItems={transfersTotal}
                pageSize={pageSize}
                onPageChange={setTransfersPage}
              />
            </ExpandableTableCard>
          </TabsContent>

          <TabsContent value="stocks">
            <ExpandableTableCard
              title="Inventory Stocks"
              headerActions={
                <>
                  {productSearchInput}
                  {exportButton(handleExportStocks)}
                </>
              }
              description={
                <p className="text-sm text-gray-500">
                  Current stock by batch where batch tracking applies; one row per product when no batch is used.
                  {isProductSearchActive && (
                    <> · {stocksTotal} records</>
                  )}
                </p>
              }
            >
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
                  {stocksLoading ? (
                    <TableSkeletonRows cols={11} />
                  ) : stocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-gray-500">
                        {isProductSearchActive
                          ? 'No inventory stock records match your product search'
                          : 'No inventory stock records'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stocks.map((stock) => (
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
                page={stocksPage}
                totalPages={stocksTotalPages}
                totalItems={stocksTotal}
                pageSize={pageSize}
                onPageChange={setStocksPage}
              />
            </ExpandableTableCard>
          </TabsContent>

          <TabsContent value="low-stock">
            <ExpandableTableCard
              className={lowStockCount > 0 ? 'border-orange-200 bg-orange-50/40' : undefined}
              title={
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Alerts
                  {lowStockTotal > 0 && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      {lowStockTotal}
                    </span>
                  )}
                </CardTitle>
              }
              headerActions={exportButton(handleExportLowStock)}
              description={
                <p className="text-sm text-gray-500">
                  Products at or below their minimum stock level. Always shows current data.
                </p>
              }
            >
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
                  {lowStockLoading ? (
                    <TableSkeletonRows cols={5} />
                  ) : lowStockAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                        No low stock alerts
                      </TableCell>
                    </TableRow>
                  ) : (
                    lowStockAlerts.map((alert) => (
                      <TableRow key={`${alert.product_id}-${alert.outlet_id}`}>
                        <TableCell className="font-medium">{alert.product_name}</TableCell>
                        <TableCell>{alert.sku}</TableCell>
                        <TableCell className="font-medium text-red-600">{alert.current_stock}</TableCell>
                        <TableCell>{alert.min_stock}</TableCell>
                        <TableCell>{alert.outlet_name || alert.outlet_id}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                page={lowStockPage}
                totalPages={lowStockTotalPages}
                totalItems={lowStockTotal}
                pageSize={pageSize}
                onPageChange={setLowStockPage}
              />
            </ExpandableTableCard>
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
