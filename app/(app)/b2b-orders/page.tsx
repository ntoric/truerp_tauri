'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import OrderDetailDialog from '@/components/b2b-shop/OrderDetailDialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { downloadBlob } from '@/lib/accountingExport'
import { notifyError } from '@/lib/notify'
import PaginationControls from '@/components/ui/pagination-controls'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { B2B_STATUS_META, formatQty, type B2BOrder, type B2BOrderStatus } from '@/lib/b2bShop'
import { AlertTriangle, ChevronRight, ClipboardList, Download, FileSpreadsheet, FileText, Sheet, FileCheck2, Loader2, Package, RefreshCw, Search, Store, UserPlus } from 'lucide-react'

const PAGE_SIZE = 25
const TABS: ('all' | B2BOrderStatus)[] = ['all', 'pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled']

interface PendingItem {
  product_id: string | null
  name: string
  unit: string
  quantity: number
  amount: number
  order_count: number
  stock_qty: number | null
  orders: PendingItemOrder[]
}

interface PendingItemOrder {
  order_id: string
  order_number: string
  buyer_name: string
  created_at: string
  quantity: number
  amount: number
}

interface OrdersResponse {
  orders: B2BOrder[]
  total: number
  counts: Record<string, number>
  amounts: Record<string, number>
}

export default function B2BOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const { activeStore } = useStore()
  const searchParams = useSearchParams()

  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'all' | B2BOrderStatus>('pending')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [pendingItemsLoading, setPendingItemsLoading] = useState(true)
  // Totals across every consolidated item, not just the current page.
  const [pendingTotals, setPendingTotals] = useState({ total: 0, short: 0, amount: 0 })
  const [itemsPage, setItemsPage] = useState(1)
  const [view, setView] = useState<'orders' | 'items'>('orders')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set())
  const toggleItem = (key: string) =>
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const [openId, setOpenId] = useState<string | null>(searchParams.get('id'))
  // Notification deep links (?id=) can arrive while the page is already open.
  const linkedId = searchParams.get('id')
  useEffect(() => {
    if (linkedId) setOpenId(linkedId)
  }, [linkedId])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [status, debouncedSearch, from, to])
  useEffect(() => setItemsPage(1), [debouncedSearch, from, to])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        per_page: String(PAGE_SIZE),
        status,
      })
      if (debouncedSearch) qs.set('search', debouncedSearch)
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const res = await apiFetch(`/b2b-shop/orders?${qs}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [page, status, debouncedSearch, from, to])

  // Consolidated quantities across all pending orders (same search/date filters).
  const loadPendingItems = useCallback(async () => {
    setPendingItemsLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(itemsPage), per_page: String(PAGE_SIZE) })
      if (debouncedSearch) qs.set('search', debouncedSearch)
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const res = await apiFetch(`/b2b-shop/orders/pending-items?${qs}`)
      if (res.ok) {
        const body = await res.json()
        setPendingItems(body.items ?? [])
        setPendingTotals({ total: body.total ?? 0, short: body.short ?? 0, amount: body.amount ?? 0 })
      }
    } finally {
      setPendingItemsLoading(false)
    }
  }, [itemsPage, debouncedSearch, from, to])

  const reloadAll = useCallback(() => {
    load()
    loadPendingItems()
  }, [load, loadPendingItems])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, activeStore?.id, load])

  useEffect(() => {
    if (authLoading || !user) return
    loadPendingItems()
  }, [authLoading, user, activeStore?.id, loadPendingItems])


  const [exporting, setExporting] = useState(false)
  // Exports what the page shows: the current status tab (or Pending items)
  // with the search/date filters — every matching row, not just this page.
  const exportOrders = async (format: 'excel' | 'csv' | 'pdf') => {
    setExporting(true)
    try {
      const qs = new URLSearchParams({ format })
      if (view === 'items') qs.set('view', 'items')
      else qs.set('status', status)
      if (debouncedSearch) qs.set('search', debouncedSearch)
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const res = await apiFetch(`/b2b-shop/orders/export?${qs}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Export failed')
      }
      const blob = await res.blob()
      const ext = format === 'excel' ? 'xlsx' : format
      const name = view === 'items' ? 'b2b_pending_items' : `b2b_orders_${status}`
      const stamp = new Date().toISOString().slice(0, 10)
      await downloadBlob(`${name}_${stamp}.${ext}`, blob, { label: `Exporting ${ext.toUpperCase()}` })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }
  const exportLabel = view === 'items' ? 'Pending items' : status === 'all' ? 'All orders' : `${B2B_STATUS_META[status].label} orders`

  const orders = data?.orders ?? []
  const counts = data?.counts ?? {}
  const openValue = (['pending', 'confirmed', 'processing', 'dispatched'] as const).reduce((sum, s) => sum + (data?.amounts?.[s] ?? 0), 0)

  return (
    <DashboardLayout>
      <PageHeader
        title="B2B Orders"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reloadAll} disabled={loading}>
              <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} /> Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{exportLabel}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void exportOrders('excel')}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportOrders('csv')}>
                  <Sheet className="mr-2 h-4 w-4" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportOrders('pdf')}>
                  <FileText className="mr-2 h-4 w-4" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" asChild>
              <Link href="/b2b-shop">
                <Store className="mr-1.5 h-4 w-4" /> Shop manager
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Awaiting confirmation" value={counts.pending ?? 0} tone={counts.pending ? 'amber' : undefined} />
        <Kpi label="In fulfilment" value={(counts.confirmed ?? 0) + (counts.processing ?? 0) + (counts.dispatched ?? 0)} />
        <Kpi label="Open order value" value={formatCurrency(openValue)} />
        <Kpi label="Delivered" value={counts.delivered ?? 0} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          {/* Status tabs */}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setStatus(t)
                  setView('orders')
                }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  view === 'orders' && status === t ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {t === 'all' ? 'All' : B2B_STATUS_META[t].label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums',
                    view === 'orders' && status === t
                      ? 'bg-primary-foreground/20'
                      : t === 'pending' && counts.pending
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100'
                  )}
                >
                  {counts[t] ?? 0}
                </span>
              </button>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-slate-200" aria-hidden />
            <button
              type="button"
              onClick={() => setView('items')}
              title="Item quantities consolidated across all pending orders"
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                view === 'items' ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Package className="h-3.5 w-3.5" /> Consolidated items
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', view === 'items' ? 'bg-primary-foreground/20' : 'bg-slate-100')}>
                {pendingTotals.total}
              </span>
              {pendingTotals.short > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums',
                    view === 'items' ? 'bg-red-500/80' : 'bg-red-50 text-red-700'
                  )}
                  title="Items short on stock"
                >
                  {pendingTotals.short} short
                </span>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Order #, buyer, phone, city"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
            {(from || to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom('')
                  setTo('')
                }}
              >
                Clear dates
              </Button>
            )}
          </div>

          {view === 'items' ? (
            <>
              <p className="text-xs text-muted-foreground">
                Consolidated from {counts.pending ?? 0} pending order
                {(counts.pending ?? 0) === 1 ? '' : 's'}
              </p>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-4">Item</th>
                      <th className="pb-2 pr-4 text-right">Orders</th>
                      <th className="pb-2 pr-4 text-right">Total qty</th>
                      <th className="pb-2 pr-4 text-right">In stock</th>
                      <th className="pb-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItemsLoading && pendingItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                        </td>
                      </tr>
                    ) : pendingItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No items in pending orders.
                        </td>
                      </tr>
                    ) : (
                      pendingItems.map((it) => {
                        const short = it.stock_qty !== null && it.stock_qty < it.quantity
                        const key = `${it.product_id ?? it.name}|${it.unit}`
                        const expanded = expandedItems.has(key)
                        return (
                          <Fragment key={key}>
                          <tr
                            className={cn('cursor-pointer border-b hover:bg-slate-50', expanded && 'bg-slate-50')}
                            onClick={() => toggleItem(key)}
                            aria-expanded={expanded}
                          >
                            <td className="py-2 pr-4 font-medium">
                              <span className="flex items-center gap-1.5">
                                <ChevronRight
                                  className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')}
                                />
                                {it.name}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">{it.order_count}</td>
                            <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                              {formatQty(it.quantity)}{' '}
                              {it.unit && <span className="text-xs font-normal text-muted-foreground">{it.unit}</span>}
                            </td>
                            <td
                              className={cn(
                                'py-2 pr-4 text-right tabular-nums',
                                short ? 'font-medium text-red-600' : 'text-muted-foreground'
                              )}
                            >
                              {it.stock_qty === null ? '—' : formatQty(it.stock_qty)}
                            </td>
                            <td className="py-2 text-right tabular-nums">{formatCurrency(it.amount)}</td>
                          </tr>
                          {expanded &&
                            (it.orders ?? []).map((o) => (
                              <tr
                                key={o.order_id}
                                className="cursor-pointer border-b bg-slate-50/60 text-xs hover:bg-slate-100"
                                onClick={() => setOpenId(o.order_id)}
                                title="Open order"
                              >
                                <td className="py-1.5 pl-6 pr-4">
                                  <span className="font-medium text-blue-600">{o.order_number}</span>
                                  <span className="text-muted-foreground"> · {o.buyer_name}</span>
                                  <span className="hidden text-muted-foreground sm:inline"> · {formatDateTime(o.created_at)}</span>
                                </td>
                                <td className="py-1.5 pr-4" />
                                <td className="py-1.5 pr-4 text-right tabular-nums">
                                  {formatQty(o.quantity)}{' '}
                                  {it.unit && <span className="text-muted-foreground">{it.unit}</span>}
                                </td>
                                <td className="py-1.5 pr-4" />
                                <td className="py-1.5 text-right tabular-nums">{formatCurrency(o.amount)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                  {pendingItems.length > 0 && (
                    <tfoot>
                      <tr className="border-t text-sm font-semibold">
                        <td className="pt-2 pr-4" colSpan={4}>
                          Total{pendingTotals.total > pendingItems.length && ` (all ${pendingTotals.total} items)`}
                        </td>
                        <td className="pt-2 text-right tabular-nums">{formatCurrency(pendingTotals.amount)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <PaginationControls
                page={itemsPage}
                totalPages={Math.max(1, Math.ceil(pendingTotals.total / PAGE_SIZE))}
                totalItems={pendingTotals.total}
                pageSize={PAGE_SIZE}
                onPageChange={setItemsPage}
              />
            </>
          ) : (
            <>
              {/* Table */}
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-4">Order</th>
                      <th className="pb-2 pr-4">Buyer</th>
                      <th className="pb-2 pr-4 text-right">Items</th>
                      <th className="pb-2 pr-4 text-right">Amount</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-14 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-14 text-center">
                          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                          <p className="font-medium text-slate-700">No orders here</p>
                          <p className="text-sm text-muted-foreground">
                            {status === 'pending'
                              ? 'New orders from your shop will appear here.'
                              : 'Try another status or clear the filters.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer border-b last:border-0 hover:bg-slate-50">
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-blue-700">{o.order_number}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</p>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{o.buyer_name}</span>
                              {o.is_new_buyer && (
                                <span title="New buyer registered from the shop">
                                  <UserPlus className="h-3.5 w-3.5 text-violet-600" />
                                </span>
                              )}
                              {!o.is_new_buyer && !o.buyer_verified && (
                                <span title="Buyer could not be verified by phone">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{[o.city, o.buyer_phone].filter(Boolean).join(' · ')}</p>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {o.item_count}
                            <p className="text-xs text-muted-foreground">{formatQty(o.total_qty)} units</p>
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold tabular-nums">{formatCurrency(o.total_amount)}</td>
                          <td className="py-3 pr-4">
                            <StatusBadge tone={B2B_STATUS_META[o.status].tone}>{B2B_STATUS_META[o.status].label}</StatusBadge>
                          </td>
                          <td className="py-3">
                            {o.invoice_id ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <FileCheck2 className="h-3.5 w-3.5" /> Invoiced
                              </span>
                            ) : o.quotation_id ? (
                              <span className="text-xs text-blue-700">Estimate ready</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={page}
                totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))}
                totalItems={data?.total ?? 0}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog orderId={openId} onClose={() => setOpenId(null)} onChanged={reloadAll} />
    </DashboardLayout>
  )
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: 'amber' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone === 'amber' && 'text-amber-600')}>{value}</p>
      </CardContent>
    </Card>
  )
}
