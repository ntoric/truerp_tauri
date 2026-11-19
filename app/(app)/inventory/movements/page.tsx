'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PaginationControls from '@/components/ui/pagination-controls'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { asArray, cn, formatCurrency } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownUp,
  Download,
  Package,
  RefreshCw,
  TrendingUp,
  Warehouse,
  X,
} from 'lucide-react'
import BrandLoader from '@/components/BrandLoader'

const PAGE_SIZE = 50

interface MovementRow {
  id: string
  date: string
  product_id: string
  product_name: string
  sku: string
  item_code: string
  unit: string
  outlet_name: string
  transaction_type: string
  type_label: string
  document_no: string
  reference_type: string
  reference_id?: string
  batch_no: string
  notes: string
  qty_in: number
  qty_out: number
  stock: number
  unit_cost: number
  stock_value: number
  total: number
  sale_price: number
  profit: number
  has_sale_price: boolean
  cost_estimated: boolean
}

interface MovementSummary {
  opening_qty: number
  opening_value: number
  in_qty: number
  out_qty: number
  closing_qty: number
  closing_value: number
  purchase_cost: number
  sales_amount: number
  cogs: number
  profit: number
  count: number
}

interface MovementResponse {
  start_date: string
  end_date: string
  data: MovementRow[]
  total: number
}

interface MovementSummaryResponse {
  summary: MovementSummary
  opening_closing_filtered: boolean
}

interface InventoryItem {
  id: string
  name: string
  sku: string
  type: string
  unit: string
}

interface WarehouseOption {
  id: string
  name: string
}

type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom'

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
]

const TRANSACTION_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All transactions' },
  { value: 'in', label: 'All inflows' },
  { value: 'out', label: 'All outflows' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'sales_return', label: 'Sales Return' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'opening', label: 'Opening Stock' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'untracked', label: 'Untracked Stock' },
]

const TYPE_BADGE: Record<string, string> = {
  purchase: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sale: 'bg-blue-50 text-blue-700 border-blue-200',
  sales_return: 'bg-amber-50 text-amber-700 border-amber-200',
  purchase_return: 'bg-orange-50 text-orange-700 border-orange-200',
  opening: 'bg-slate-50 text-slate-700 border-slate-200',
  adjustment: 'bg-violet-50 text-violet-700 border-violet-200',
  transfer: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  untracked: 'bg-gray-50 text-gray-600 border-gray-200',
}

function localISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function presetRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: localISO(now), to: localISO(now) }
    case 'this_week': {
      const start = new Date(now)
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
      return { from: localISO(start), to: localISO(now) }
    }
    case 'this_month':
      return {
        from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: localISO(now),
      }
    case 'last_month':
      return {
        from: localISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: localISO(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    case 'this_year':
      return {
        from: localISO(new Date(now.getFullYear(), 0, 1)),
        to: localISO(now),
      }
    default:
      return null
  }
}

function formatQty(qty: number, unit?: string) {
  const formatted = qty.toLocaleString(undefined, { maximumFractionDigits: 3 })
  return unit ? `${formatted} ${unit}` : formatted
}

function formatDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function documentHref(row: MovementRow): string | null {
  if (!row.reference_id) return null
  switch (row.reference_type) {
    case 'invoice':
      return `/invoices/view?id=${row.reference_id}`
    case 'purchase_bill':
      return `/purchase-invoices/view?id=${row.reference_id}`
    case 'sales_return':
      return '/sales-returns'
    default:
      return null
  }
}

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function StockMovementPage() {
  const { user, loading: authLoading } = useAuth()
  const initial = presetRange('this_month')!

  const [preset, setPreset] = useState<DatePreset>('this_month')
  const [fromDate, setFromDate] = useState(initial.from)
  const [toDate, setToDate] = useState(initial.to)
  const [productId, setProductId] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [unit, setUnit] = useState('all')
  const [txType, setTxType] = useState('all')
  const [outletId, setOutletId] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [data, setData] = useState<MovementResponse | null>(null)
  const [summaryData, setSummaryData] = useState<MovementSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const debouncedItemName = useDebounced(itemName.trim())
  const debouncedItemCode = useDebounced(itemCode.trim())
  const debouncedSearch = useDebounced(search.trim())

  useEffect(() => {
    if (authLoading || !user) return
    void (async () => {
      try {
        const [itemsRes, whRes] = await Promise.all([
          apiFetch('/inventory/items'),
          apiFetch('/warehouses?is_active=true'),
        ])
        if (itemsRes.ok) {
          setItems(asArray<InventoryItem>(await itemsRes.json()).filter((i) => i.type === 'product'))
        }
        if (whRes.ok) setWarehouses(asArray<WarehouseOption>(await whRes.json()))
      } catch (err) {
        console.error(err)
      }
    })()
  }, [authLoading, user])

  const itemOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: i.sku ? `${i.name} (${i.sku})` : i.name,
      })),
    [items],
  )
  const unitOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => (i.unit || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items],
  )

  /** Filter params shared by the rows and summary endpoints. */
  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('from_date', fromDate)
    params.set('to_date', toDate)
    if (productId) params.set('product_id', productId)
    if (debouncedItemName) params.set('item_name', debouncedItemName)
    if (debouncedItemCode) params.set('item_code', debouncedItemCode)
    if (unit !== 'all') params.set('unit', unit)
    if (txType !== 'all') params.set('type', txType)
    if (outletId !== 'all') params.set('outlet_id', outletId)
    if (debouncedSearch) params.set('search', debouncedSearch)
    return params.toString()
  }, [fromDate, toDate, productId, debouncedItemName, debouncedItemCode, unit, txType, outletId, debouncedSearch])

  const buildParams = useCallback(
    (pageNum: number, perPage: number) => {
      const params = new URLSearchParams(filterParams)
      params.set('sort', sort)
      params.set('page', String(pageNum))
      params.set('per_page', String(perPage))
      return params
    },
    [filterParams, sort],
  )

  const rangeValid = !!fromDate && !!toDate && toDate >= fromDate

  // Any filter or sort change returns to the first page.
  useEffect(() => {
    setPage(1)
  }, [filterParams, sort])

  // Period totals need the full cost history, so they are fetched once per
  // filter change — not on every page turn.
  useEffect(() => {
    if (authLoading || !user || !rangeValid) return
    let cancelled = false
    setSummaryLoading(true)
    void (async () => {
      try {
        const res = await apiFetch(`/inventory/movements/summary?${filterParams}`, { timeoutMs: 120000 })
        if (!res.ok) throw new Error('Failed to load stock movement summary')
        const json: MovementSummaryResponse = await res.json()
        if (!cancelled) setSummaryData(json)
      } catch (err) {
        if (!cancelled) {
          setSummaryData(null)
          console.error(err)
        }
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, filterParams, rangeValid])

  useEffect(() => {
    if (authLoading || !user || !rangeValid) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await apiFetch(`/inventory/movements?${buildParams(page, PAGE_SIZE).toString()}`, {
          timeoutMs: 60000,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load stock movements')
        }
        const json: MovementResponse = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) {
          setData(null)
          notifyError(err instanceof Error ? err.message : 'Failed to load stock movements')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, buildParams, page, rangeValid])

  const onPresetChange = (value: DatePreset) => {
    setPreset(value)
    const range = presetRange(value)
    if (range) {
      setFromDate(range.from)
      setToDate(range.to)
    }
  }

  const hasFilters =
    !!productId || !!itemName || !!itemCode || unit !== 'all' || txType !== 'all' || outletId !== 'all' || !!search

  const clearFilters = () => {
    setProductId('')
    setItemName('')
    setItemCode('')
    setUnit('all')
    setTxType('all')
    setOutletId('all')
    setSearch('')
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await apiFetch(`/inventory/movements?${buildParams(1, 0).toString()}`, { timeoutMs: 120000 })
      if (!res.ok) throw new Error('Failed to fetch stock movements')
      const json: MovementResponse = await res.json()
      await downloadCsv(
        `stock_movements_${accountingExportDateStamp()}.csv`,
        [
          [
            'Date',
            'Document No',
            'Transaction Type',
            'Item',
            'Item Code',
            'SKU',
            'Unit',
            'Warehouse',
            'Batch',
            'Qty In',
            'Qty Out',
            'Stock',
            'Transaction Cost',
            'Stock Value',
            'Total',
            'Sale Price',
            'Profit',
          ],
          ...json.data.map((r) => [
            r.date,
            r.document_no,
            r.type_label,
            r.product_name,
            r.item_code,
            r.sku,
            r.unit,
            r.outlet_name,
            r.batch_no,
            r.qty_in || '',
            r.qty_out || '',
            r.stock,
            r.unit_cost.toFixed(2),
            r.stock_value.toFixed(2),
            r.total.toFixed(2),
            r.has_sale_price ? r.sale_price.toFixed(2) : '',
            r.has_sale_price ? r.profit.toFixed(2) : '',
          ]),
        ],
        { label: 'Exporting stock movements' },
      )
      notifySuccess('Stock movements exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export stock movements')
    } finally {
      setExporting(false)
    }
  }

  const summary = summaryData?.summary
  const rows = data?.data ?? []
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const singleProduct = !!productId
  const singleUnit = singleProduct ? items.find((i) => i.id === productId)?.unit : undefined

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="app-page-title">Stock Movement</h1>
          <div className="flex items-center gap-3">
            <Link href="/inventory" className="text-sm font-medium text-blue-600 hover:underline">
              Stock
            </Link>
            <Link href="/reports/stock" className="text-sm font-medium text-blue-600 hover:underline">
              Stock report
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={preset} onValueChange={(v) => onPresetChange(v as DatePreset)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => {
                    setPreset('custom')
                    setFromDate(e.target.value)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => {
                    setPreset('custom')
                    setToDate(e.target.value)
                  }}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-1 xl:col-span-2">
                <Label>Item</Label>
                <SearchableSelect
                  value={productId}
                  onValueChange={setProductId}
                  options={itemOptions}
                  placeholder="All items"
                  searchPlaceholder="Search items…"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label>Transaction type</Label>
                <Select value={txType} onValueChange={setTxType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Item name</Label>
                <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Contains…" />
              </div>
              <div className="space-y-1.5">
                <Label>Item code / SKU</Label>
                <Input value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="Code or SKU" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All units</SelectItem>
                    {unitOptions.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse</Label>
                <Select value={outletId} onValueChange={setOutletId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 xl:col-span-2">
                <Label>Search</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Document no, batch, notes…"
                />
              </div>
            </div>
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            )}
            {toDate < fromDate && (
              <p className="text-sm text-red-600">The end date must be on or after the start date.</p>
            )}
          </CardContent>
        </Card>

        {summary && (
          <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5', summaryLoading && 'opacity-60')}>
            <SummaryStat
              tone="brand"
              icon={Package}
              label="Opening stock"
              value={formatCurrency(summary.opening_value)}
              hint={`${formatQty(summary.opening_qty, singleUnit)}${summaryData?.opening_closing_filtered ? ' · all types' : ''}`}
            />
            <SummaryStat
              tone="success"
              icon={ArrowDownToLine}
              label="Qty in"
              value={formatQty(summary.in_qty, singleUnit)}
              hint={`Purchases ${formatCurrency(summary.purchase_cost)}`}
            />
            <SummaryStat
              tone="warning"
              icon={ArrowUpFromLine}
              label="Qty out"
              value={formatQty(summary.out_qty, singleUnit)}
              hint={`Net sales ${formatCurrency(summary.sales_amount)}`}
            />
            <SummaryStat
              tone="brand"
              icon={Warehouse}
              label="Closing stock"
              value={formatCurrency(summary.closing_value)}
              hint={`${formatQty(summary.closing_qty, singleUnit)}${summaryData?.opening_closing_filtered ? ' · all types' : ''}`}
            />
            <SummaryStat
              tone={summary.profit >= 0 ? 'success' : 'danger'}
              icon={TrendingUp}
              label="Gross profit"
              value={formatCurrency(summary.profit)}
              hint={`COGS ${formatCurrency(summary.cogs)}`}
            />
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Transactions</CardTitle>
                {data && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(data.start_date)} → {formatDate(data.end_date)} · {data.total} movement
                    {data.total === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
                >
                  <ArrowDownUp className="h-4 w-4" />
                  {sort === 'desc' ? 'Newest first' : 'Oldest first'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  onClick={() => void exportCsv()}
                  disabled={exporting || !data || data.total === 0}
                >
                  {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="flex h-48 items-center justify-center">
                <BrandLoader />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No stock movements match these filters.</p>
            ) : (
              <>
                <div className={cn('table-scroll rounded-lg border', loading && 'opacity-60')}>
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Document No</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        {!singleProduct && <th className="px-3 py-2.5 font-medium">Item</th>}
                        <th className="px-3 py-2.5 text-right font-medium">Qty In</th>
                        <th className="px-3 py-2.5 text-right font-medium">Qty Out</th>
                        <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                        <th className="px-3 py-2.5 text-right font-medium">Txn Cost</th>
                        <th className="px-3 py-2.5 text-right font-medium">Stock Value</th>
                        <th className="px-3 py-2.5 text-right font-medium">Total</th>
                        <th className="px-3 py-2.5 text-right font-medium">Sale Price</th>
                        <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const href = documentHref(r)
                        return (
                          <tr key={r.id} className="border-t hover:bg-gray-50/60">
                            <td className="px-3 py-2.5 text-gray-700">{formatDate(r.date)}</td>
                            <td className="px-3 py-2.5">
                              {r.document_no ? (
                                href ? (
                                  <Link href={href} className="font-medium text-blue-600 hover:underline">
                                    {r.document_no}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-gray-900">{r.document_no}</span>
                                )
                              ) : (
                                <span className="text-gray-400" title={r.notes || undefined}>
                                  {r.reference_id ? r.reference_id.slice(0, 8) : '—'}
                                </span>
                              )}
                              {r.batch_no && <div className="text-xs text-gray-500">Batch {r.batch_no}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant="outline"
                                className={cn('font-medium', TYPE_BADGE[r.transaction_type])}
                                title={r.notes || undefined}
                              >
                                {r.type_label}
                              </Badge>
                            </td>
                            {!singleProduct && (
                              <td className="px-3 py-2.5">
                                <div
                                  className="max-w-[16rem] truncate font-medium text-gray-900"
                                  title={r.product_name}
                                >
                                  {r.product_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {[r.item_code || r.sku, r.unit, r.outlet_name].filter(Boolean).join(' · ')}
                                </div>
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-right text-emerald-700">
                              {r.qty_in > 0 ? `+${formatQty(r.qty_in)}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-red-700">
                              {r.qty_out > 0 ? `−${formatQty(r.qty_out)}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                              {formatQty(r.stock, r.unit)}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right text-gray-700"
                              title={r.cost_estimated ? 'Estimated from product purchase price' : undefined}
                            >
                              {formatCurrency(r.unit_cost)}
                              {r.cost_estimated && <span className="text-amber-600">*</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-900">{formatCurrency(r.stock_value)}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                              {formatCurrency(r.total)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700">
                              {r.has_sale_price ? formatCurrency(r.sale_price) : '—'}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2.5 text-right font-semibold',
                                !r.has_sale_price
                                  ? 'text-gray-400'
                                  : r.profit >= 0
                                    ? 'text-emerald-700'
                                    : 'text-red-700',
                              )}
                            >
                              {r.has_sale_price ? formatCurrency(r.profit) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  totalItems={data?.total ?? 0}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </>
            )}

            <p className="mt-4 text-xs text-gray-500">
              Stock and stock value are the item&apos;s running position after each transaction, replayed from approved
              ledger entries at weighted average cost. Transaction cost is the purchase cost for inflows and the average
              cost for outflows. Total is the sale value for sales and returns, and the cost value otherwise. Sale price
              is the invoice unit price after item discount, excluding tax. Profit = (sale price − cost) × qty.
              <span className="text-amber-600"> *</span> Cost estimated from the product purchase price.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
