'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Crown,
  HandCoins,
  type LucideIcon,
  PieChart as PieChartIcon,
  ShoppingBag,
  Waves,
} from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { useColorTheme } from '@/hooks/useColorTheme'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'

export type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly'

const GRANULARITY_CAPTIONS: Record<Granularity, string> = {
  daily: 'last 30 days',
  weekly: 'last 12 weeks',
  monthly: 'last 12 months',
  yearly: 'last 5 years',
}

/** Map the dashboard period picker onto the report endpoints' trend windows. */
export function granularityForPeriod(period: string): Granularity {
  if (period === 'year') return 'monthly'
  if (period === 'all') return 'yearly'
  return 'daily'
}

interface SalesReport {
  summary: {
    total_sales: number
    total_invoices: number
    avg_invoice_value: number
    best_period: string
    best_period_sales: number
    growth_vs_prior: number | null
  }
  series: { period: string; sales: number; count: number; avg_invoice: number }[]
  status_breakdown: { status: string; count: number; amount: number }[] | null
}

interface PaymentsReport {
  summary: { total_in: number; total_out: number; net_flow: number }
  timeline: { period: string; amount_in: number; amount_out: number }[]
  by_mode: { mode: string; direction: 'in' | 'out'; total: number; count: number }[]
}

interface OutstandingReport {
  summary: { total_outstanding: number; invoice_count: number; overdue_count: number; avg_days_overdue: number }
  aging: { current: number; days_1_30: number; days_31_60: number; days_61_90: number; days_90_plus: number }
  by_party: { party_id: string; party_name: string; invoice_count: number; outstanding: number }[] | null
  invoices: { party_id: string; days_overdue: number }[] | null
}

interface ProductsReport {
  source: string
  products: { product_id: string; name: string; unit: string; quantity_sold: number; revenue: number; share_percent: number }[] | null
}

interface CustomersReport {
  customers: { party_id: string; name: string; total_sales: number; total_outstanding: number; invoice_count: number }[] | null
}

interface WidgetsReport {
  accounts_payable: number
  accounts_payable_count: number
  inventory_value: number
}

interface AnalyticsData {
  sales: SalesReport | null
  payments: PaymentsReport | null
  outstanding: OutstandingReport | null
  products: ProductsReport | null
  customers: CustomersReport | null
  widgets: WidgetsReport | null
}

const EMPTY: AnalyticsData = { sales: null, payments: null, outstanding: null, products: null, customers: null, widgets: null }

const compactCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})
export const fmtCompact = (value: number) => compactCurrency.format(value || 0)

const STATUS_COLORS: Record<string, string> = {
  paid: '#10b981',
  sent: '#0ea5e9',
  partial: '#f59e0b',
  draft: '#94a3b8',
  cancelled: '#cbd5e1',
}

const titleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'Other'

function formatPeriod(period: string, granularity: Granularity) {
  if (!period) return ''
  if (granularity === 'daily') {
    const d = new Date(period.slice(0, 10))
    return Number.isNaN(d.getTime()) ? period : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  if (granularity === 'monthly') {
    const d = new Date(`${period.slice(0, 7)}-01`)
    return Number.isNaN(d.getTime()) ? period : d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }
  if (granularity === 'weekly') return period.split('-').pop() ?? period
  return period
}

type Palette = Record<300 | 400 | 500 | 600 | 700 | 800, string>

/** Resolve theme CSS vars to concrete colours — SVG attributes can't reliably use var() in WebKit. */
function useThemePalette(): Palette {
  const { themeId, customHex } = useColorTheme()
  const [palette, setPalette] = useState<Palette>({
    300: '#fda4af',
    400: '#fb7185',
    500: '#e11d48',
    600: '#c81e3a',
    700: '#a1162f',
    800: '#80132a',
  })

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    const read = (shade: number, fallback: string) => {
      const value = styles.getPropertyValue(`--theme-${shade}`).trim()
      return value ? `hsl(${value})` : fallback
    }
    setPalette((prev) => ({
      300: read(300, prev[300]),
      400: read(400, prev[400]),
      500: read(500, prev[500]),
      600: read(600, prev[600]),
      700: read(700, prev[700]),
      800: read(800, prev[800]),
    }))
  }, [themeId, customHex])

  return palette
}

async function readJson<T>(request: Promise<Response>): Promise<T | null> {
  try {
    const res = await request
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** Fetches and derives everything the dashboard's analytic panels render. */
export function useDashboardAnalytics(granularity: Granularity, enabled = true) {
  const [data, setData] = useState<AnalyticsData>(EMPTY)
  const [loading, setLoading] = useState(enabled)
  const palette = useThemePalette()

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    const q = `period=${granularity}`
    const [sales, payments, outstanding, products, customers, widgets] = await Promise.all([
      readJson<SalesReport>(apiFetch(`/reports/sales?${q}`)),
      readJson<PaymentsReport>(apiFetch(`/reports/payments?${q}`)),
      readJson<OutstandingReport>(apiFetch('/reports/outstanding')),
      readJson<ProductsReport>(apiFetch(`/reports/products?limit=5&${q}`)),
      readJson<CustomersReport>(apiFetch(`/reports/customers?limit=5&${q}`)),
      readJson<WidgetsReport>(apiFetch(`/reports/widgets?${q}`)),
    ])
    setData({ sales, payments, outstanding, products, customers, widgets })
    setLoading(false)
  }, [granularity, enabled])

  useEffect(() => {
    void load()
  }, [load])

  const salesSeries = useMemo(
    () =>
      [...(data.sales?.series ?? [])]
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((row) => ({ ...row, label: formatPeriod(row.period, granularity) })),
    [data.sales, granularity]
  )

  const cashSeries = useMemo(
    () =>
      [...(data.payments?.timeline ?? [])]
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((row) => ({ ...row, label: formatPeriod(row.period, granularity), net: row.amount_in - row.amount_out })),
    [data.payments, granularity]
  )

  const statusData = useMemo(
    () =>
      (data.sales?.status_breakdown ?? [])
        .filter((r) => r.amount > 0)
        .map((r) => ({
          name: titleCase(r.status),
          value: r.amount,
          count: r.count,
          color: r.status === 'overdue' ? palette[600] : STATUS_COLORS[r.status] ?? palette[300],
        })),
    [data.sales, palette]
  )

  const modeData = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>()
    for (const row of data.payments?.by_mode ?? []) {
      if (row.direction !== 'in' || row.total <= 0) continue
      const key = titleCase(row.mode || 'other')
      const prev = totals.get(key) ?? { total: 0, count: 0 }
      totals.set(key, { total: prev.total + row.total, count: prev.count + row.count })
    }
    const colors = [palette[600], palette[400], '#10b981', '#f59e0b', '#0ea5e9', palette[800], '#94a3b8']
    return Array.from(totals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v], i) => ({ name, value: v.total, count: v.count, color: colors[i % colors.length] }))
  }, [data.payments, palette])

  const agingRows = useMemo(() => {
    const a = data.outstanding?.aging
    if (!a) return []
    return [
      { label: 'Current', value: a.current, color: '#10b981' },
      { label: '1–30d', value: a.days_1_30, color: '#f59e0b' },
      { label: '31–60d', value: a.days_31_60, color: '#f97316' },
      { label: '61–90d', value: a.days_61_90, color: palette[500] },
      { label: '90+d', value: a.days_90_plus, color: palette[800] },
    ]
  }, [data.outstanding, palette])

  const receivable = data.outstanding?.summary.total_outstanding ?? 0
  const payable = data.widgets?.accounts_payable ?? 0

  const topDebtors = useMemo(() => {
    const maxOverdue = new Map<string, number>()
    for (const inv of data.outstanding?.invoices ?? []) {
      maxOverdue.set(inv.party_id, Math.max(maxOverdue.get(inv.party_id) ?? 0, inv.days_overdue || 0))
    }
    return (data.outstanding?.by_party ?? []).slice(0, 5).map((p) => ({
      ...p,
      maxDaysOverdue: maxOverdue.get(p.party_id) ?? 0,
    }))
  }, [data.outstanding])

  return {
    enabled,
    loading,
    granularity,
    caption: GRANULARITY_CAPTIONS[granularity],
    palette,
    data,
    salesSeries,
    cashSeries,
    statusData,
    statusTotal: statusData.reduce((sum, r) => sum + r.value, 0),
    modeData,
    modeTotal: modeData.reduce((sum, r) => sum + r.value, 0),
    agingRows,
    agingTotal: agingRows.reduce((sum, r) => sum + r.value, 0),
    topProducts: data.products?.products ?? [],
    topCustomers: data.customers?.customers ?? [],
    topDebtors,
    receivable,
    payable,
    receivableShare: receivable + payable > 0 ? (receivable / (receivable + payable)) * 100 : 50,
  }
}

export type DashboardAnalyticsState = ReturnType<typeof useDashboardAnalytics>

const tooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid var(--chart-tooltip-border)',
    background: 'var(--chart-tooltip-bg)',
    boxShadow: '0 12px 28px -12px rgba(15,23,42,0.25)',
    fontSize: 12,
    padding: '8px 12px',
  },
  labelStyle: { color: 'var(--chart-axis)', fontWeight: 600, marginBottom: 4 },
} as const

const axisTick = { fill: 'var(--chart-axis)', fontSize: 11 }

export const CARD_CLASS =
  'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.18)]'

export function Panel({
  title,
  icon: Icon,
  subtitle,
  action,
  className,
  children,
}: {
  title: string
  icon: LucideIcon
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('flex flex-col', CARD_CLASS, className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 pb-5 pt-3">{children}</div>
    </section>
  )
}

function EmptyChart({ message = 'No data for this period yet' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-400">
      {message}
    </div>
  )
}

function PanelBodySkeleton({ className = 'h-56' }: { className?: string }) {
  return <Skeleton className={cn('w-full rounded-xl', className)} />
}

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  change,
  spark,
  color,
  footer,
  loading,
}: {
  label: string
  value: string
  caption: ReactNode
  icon: LucideIcon
  change?: number | null
  spark?: number[]
  color: string
  footer?: ReactNode
  loading?: boolean
}) {
  const id = `spark-${label.replace(/\W+/g, '')}`
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }))
  return (
    <div className={cn('relative overflow-hidden p-4', CARD_CLASS)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        </div>
        {!loading && change != null && Number.isFinite(change) && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
              change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            )}
          >
            {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{caption}</p>
            </div>
            {sparkData.length > 1 && (
              <div className="h-12 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {footer && <div className="mt-3">{footer}</div>}
        </>
      )}
    </div>
  )
}

function DonutLegend({ items, total }: { items: { name: string; value: number; color: string; meta?: string }[]; total: number }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{item.name}</span>
          {item.meta && <span className="shrink-0 text-slate-400">{item.meta}</span>}
          <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-slate-900">
            {total > 0 ? `${Math.round((item.value / total) * 100)}%` : '0%'}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Donut({ data, centerLabel, centerValue }: { data: { name: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  return (
    <div className="relative h-40 w-40 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip {...tooltipProps} formatter={(v: number) => formatCurrency(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-semibold tabular-nums text-slate-900">{centerValue}</span>
        <span className="text-[11px] text-slate-500">{centerLabel}</span>
      </div>
    </div>
  )
}

/** Stacked aging bar + compact legend, used inside the receivables card. */
export function AgingBar({ a }: { a: DashboardAnalyticsState }) {
  if (a.loading) return <Skeleton className="h-14 w-full rounded-xl" />
  if (a.agingTotal <= 0) {
    return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Nothing outstanding — all caught up</p>
  }
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-semibold uppercase tracking-wide">Aging</span>
        {a.data.outstanding && (
          <span>
            avg <span className="font-semibold text-slate-700">{Math.round(a.data.outstanding.summary.avg_days_overdue)}d</span> late
          </span>
        )}
      </div>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {a.agingRows.map((row) =>
          row.value > 0 ? (
            <span
              key={row.label}
              className="h-full"
              style={{ width: `${(row.value / a.agingTotal) * 100}%`, backgroundColor: row.color }}
              title={`${row.label}: ${formatCurrency(row.value)}`}
            />
          ) : null
        )}
      </div>
      <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
        {a.agingRows.map((row) => (
          <li key={row.label} className="flex min-w-0 items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
            <span className="truncate text-slate-500">{row.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-800">{fmtCompact(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SalesTrendPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  const best = a.data.sales?.summary
  return (
    <Panel
      className={className}
      title="Sales trend"
      icon={BarChart3}
      subtitle={
        best?.best_period
          ? `Best ${formatPeriod(best.best_period, a.granularity)} · ${fmtCompact(best.best_period_sales)} · ${a.caption}`
          : `Paid sales and invoice count · ${a.caption}`
      }
      action={
        <Link href="/reports" className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
          Full report
        </Link>
      }
    >
      <div className="h-64">
        {a.loading ? (
          <PanelBodySkeleton className="h-full" />
        ) : a.salesSeries.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={a.salesSeries} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dash-sales-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={a.palette[500]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={a.palette[500]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis yAxisId="sales" tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={fmtCompact} />
              <YAxis yAxisId="count" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip
                {...tooltipProps}
                formatter={(v: number, name: string) => (name === 'Invoices' ? [v, name] : [formatCurrency(v), name])}
              />
              <Area
                yAxisId="sales"
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke={a.palette[600]}
                strokeWidth={2.5}
                fill="url(#dash-sales-fill)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              />
              <Line yAxisId="count" type="monotone" dataKey="count" name="Invoices" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  )
}

function DonutPanel({
  a,
  title,
  icon,
  subtitle,
  data,
  total,
  centerLabel,
  emptyMessage,
  metaFor,
  className,
}: {
  a: DashboardAnalyticsState
  title: string
  icon: LucideIcon
  subtitle: string
  data: { name: string; value: number; color: string; count: number }[]
  total: number
  centerLabel: string
  emptyMessage?: string
  metaFor: (count: number) => string
  className?: string
}) {
  return (
    <Panel className={className} title={title} icon={icon} subtitle={subtitle}>
      {a.loading ? (
        <PanelBodySkeleton className="h-40" />
      ) : data.length === 0 ? (
        <EmptyChart message={emptyMessage} />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
          <Donut data={data} centerValue={fmtCompact(total)} centerLabel={centerLabel} />
          <div className="w-full min-w-0 flex-1">
            <DonutLegend total={total} items={data.map((d) => ({ name: d.name, value: d.value, color: d.color, meta: metaFor(d.count) }))} />
          </div>
        </div>
      )}
    </Panel>
  )
}

export function InvoiceStatusPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  return (
    <DonutPanel
      a={a}
      className={className}
      title="Invoice status"
      icon={PieChartIcon}
      subtitle={`By invoiced value · ${a.caption}`}
      data={a.statusData}
      total={a.statusTotal}
      centerLabel="invoiced"
      metaFor={(count) => `${count}`}
    />
  )
}

export function PaymentModesPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  return (
    <DonutPanel
      a={a}
      className={className}
      title="Payment modes"
      icon={CreditCard}
      subtitle={`Collections by mode · ${a.caption}`}
      data={a.modeData}
      total={a.modeTotal}
      centerLabel="collected"
      emptyMessage="No payments received yet"
      metaFor={(count) => `${count}×`}
    />
  )
}

export function CashFlowPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  return (
    <Panel
      className={className}
      title="Cash flow"
      icon={Waves}
      subtitle={`Money in vs money out · ${a.caption}`}
      action={
        <div className="hidden shrink-0 items-center gap-3 text-[11px] font-medium text-slate-500 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.palette[600] }} /> In
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> Out
          </span>
        </div>
      }
    >
      <div className="h-56">
        {a.loading ? (
          <PanelBodySkeleton className="h-full" />
        ) : a.cashSeries.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.cashSeries} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={fmtCompact} />
              <Tooltip {...tooltipProps} cursor={{ fill: 'rgba(148,163,184,0.12)' }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount_in" name="Money in" fill={a.palette[600]} radius={[6, 6, 0, 0]} maxBarSize={22} />
              <Bar dataKey="amount_out" name="Money out" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function TopProductsPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  return (
    <Panel
      className={className}
      title="Top products"
      icon={ShoppingBag}
      subtitle={`By ${a.data.products?.source === 'invoice_line_items' ? 'revenue' : 'units sold'} · ${a.caption}`}
    >
      {a.loading ? (
        <ListSkeleton />
      ) : a.topProducts.length === 0 ? (
        <EmptyChart message="No product sales yet" />
      ) : (
        <ol className="space-y-3">
          {a.topProducts.map((p, i) => (
            <li key={`${p.product_id}-${p.name}`}>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{p.name}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{fmtCompact(p.revenue)}</span>
              </div>
              <div className="ml-[34px] mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(4, p.share_percent)}%`, backgroundColor: a.palette[500] }} />
                </div>
                <span className="w-20 shrink-0 truncate text-right text-[11px] text-slate-400">
                  {Number(p.quantity_sold.toFixed(2))} {p.unit || 'units'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function overdueTone(days: number) {
  if (days <= 0) return 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
  if (days <= 30) return 'bg-amber-50 text-amber-700 ring-amber-200/70'
  return 'bg-blue-50 text-blue-700 ring-blue-200/70'
}

export function TopDebtorsPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  const max = Math.max(1, ...a.topDebtors.map((d) => d.outstanding))
  return (
    <Panel
      className={className}
      title="Outstanding dues"
      icon={HandCoins}
      subtitle={a.receivable > 0 ? `${fmtCompact(a.receivable)} to collect · top customers` : 'Customers with unpaid invoices'}
      action={
        <Link href="/invoices" className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
          Collect
        </Link>
      }
    >
      {a.loading ? (
        <ListSkeleton />
      ) : a.topDebtors.length === 0 ? (
        <EmptyChart message="No dues — every invoice is settled" />
      ) : (
        <ol className="space-y-3">
          {a.topDebtors.map((d) => (
            <li key={d.party_id} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {d.party_name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-slate-800">{d.party_name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{fmtCompact(d.outstanding)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.max(4, (d.outstanding / max) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-slate-400">
                    {d.invoice_count} unpaid invoice{d.invoice_count === 1 ? '' : 's'}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset',
                      overdueTone(d.maxDaysOverdue)
                    )}
                  >
                    {d.maxDaysOverdue > 0 ? `${d.maxDaysOverdue}d overdue` : 'Not due yet'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function TopCustomersPanel({ a, className }: { a: DashboardAnalyticsState; className?: string }) {
  const max = Math.max(1, ...a.topCustomers.map((c) => c.total_sales))
  return (
    <Panel className={className} title="Top customers" icon={Crown} subtitle={`By paid sales · ${a.caption}`}>
      {a.loading ? (
        <ListSkeleton />
      ) : a.topCustomers.length === 0 ? (
        <EmptyChart message="No customer sales yet" />
      ) : (
        <ol className="space-y-3">
          {a.topCustomers.map((c, i) => (
            <li key={c.party_id} className="flex items-center gap-3">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--theme-50))_0%,hsl(var(--theme-100))_100%)] text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-[linear-gradient(135deg,hsl(var(--theme-500)/0.2)_0%,hsl(var(--theme-500)/0.3)_100%)] dark:ring-white/10">
                {c.name.trim().charAt(0).toUpperCase()}
                {i === 0 && <Crown className="absolute -right-1 -top-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-slate-800">{c.name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{fmtCompact(c.total_sales)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(4, (c.total_sales / max) * 100)}%`, backgroundColor: a.palette[600] }}
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-400">
                  {c.invoice_count} invoices
                  {c.total_outstanding > 0 && ` · ${fmtCompact(c.total_outstanding)} due`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
