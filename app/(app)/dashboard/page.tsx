'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import {
  type LucideIcon,
  ArrowRight,
  FileText,
  Users,
  Package,
  AlertTriangle,
  Clock,
  IndianRupee,
  CalendarRange,
  Plus,
  ShoppingCart,
  UserPlus,
  PackagePlus,
  ShoppingBag,
  Receipt,
  Wallet,
  Waves,
} from 'lucide-react'
import StatWidget from '@/components/widgets/StatWidget'
import AlertWidget from '@/components/widgets/AlertWidget'
import {
  AgingBar,
  CARD_CLASS,
  CashFlowPanel,
  InvoiceStatusPanel,
  KpiCard,
  PaymentModesPanel,
  SalesTrendPanel,
  TopCustomersPanel,
  TopDebtorsPanel,
  TopProductsPanel,
  fmtCompact,
  granularityForPeriod,
  useDashboardAnalytics,
} from '@/components/widgets/DashboardAnalytics'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all'

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
]

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
}

interface DashboardStats {
  total_sales: number
  total_invoices: number
  total_parties: number
  total_customers?: number
  total_products?: number
  pending_amount: number
  today_sales: number
  today_invoices: number
  low_stock_products?: number
  overdue_invoices: number
}

const QUICK_ACTIONS: { label: string; href: string; feature: string; icon: LucideIcon }[] = [
  { label: 'New Invoice', href: '/invoices/create', feature: '/invoices', icon: Plus },
  { label: 'Open POS', href: '/pos', feature: '/pos', icon: ShoppingCart },
  { label: 'Add Party', href: '/parties/create', feature: '/parties', icon: UserPlus },
  { label: 'Add Product', href: '/products/create', feature: '/products', icon: PackagePlus },
  { label: 'Purchase', href: '/purchase-invoices/create', feature: '/purchase-invoices', icon: ShoppingBag },
  { label: 'Expense', href: '/expenses/create', feature: '/expenses', icon: Receipt },
]

function greetingFor(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const HERO_CHIP =
  'inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20 backdrop-blur-sm'

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const { isPageEnabled } = usePageFeatures()
  const [period, setPeriod] = useState<DashboardPeriod>('today')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const analyticsEnabled = isPageEnabled('/reports')
  const analytics = useDashboardAnalytics(granularityForPeriod(period), analyticsEnabled && !!user)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const statsRes = await apiFetch(`/dashboard/stats?period=${period}`)
      if (statsRes.ok) {
        setStats(await statsRes.json())
      } else {
        console.error('Failed to fetch stats:', statsRes.status)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchDashboardData()
  }, [authLoading, user, fetchDashboardData])

  const periodLabel = PERIOD_LABELS[period]

  const statCards = useMemo(
    (): {
      title: string
      value: string | number
      icon: LucideIcon
      color: 'primary' | 'success' | 'warning' | 'danger' | 'info'
      description?: string
    }[] => [
      {
        title: `${periodLabel} Invoices`,
        value: stats?.total_invoices || 0,
        icon: FileText,
        color: 'primary' as const,
        description: 'Invoices raised in this period',
      },
      {
        title: 'Customers',
        value: stats?.total_customers ?? stats?.total_parties ?? 0,
        icon: Users,
        color: 'success' as const,
        description: 'Active customer accounts',
      },
      {
        title: 'Products',
        value: stats?.total_products || 0,
        icon: Package,
        color: 'info' as const,
        description: 'Items in your catalogue',
      },
      {
        title: 'Low Stock',
        value: stats?.low_stock_products || 0,
        icon: AlertTriangle,
        color: 'warning' as const,
        description: 'Products below reorder level',
      },
    ],
    [periodLabel, stats]
  )

  const quickActions = useMemo(
    () => QUICK_ACTIONS.filter((action) => isPageEnabled(action.feature)),
    [isPageEnabled]
  )

  if (authLoading || (loading && !stats)) {
    return (
      <DashboardLayout>
        <PageSkeleton variant="dashboard" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          actions={
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-gray-500" />
              <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* Alerts */}
        {(stats?.low_stock_products || 0) > 0 && (
          <AlertWidget
            icon={AlertTriangle}
            message={`${stats?.low_stock_products} products are running low on stock`}
            variant="warning"
            action={{ label: 'View Products', href: '/products?low_stock=true' }}
          />
        )}

        {/* Row 1 — hero with quick actions + receivables */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_50%,hsl(var(--theme-900))_100%)] p-6 text-white shadow-[0_20px_40px_-20px_hsl(var(--theme-700)/0.7),inset_0_1px_0_rgba(255,255,255,0.2)] lg:col-span-2">
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-[hsl(var(--theme-300)/0.35)] blur-3xl" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:18px_18px]"
            />
            <div className="relative flex h-full flex-col gap-6">
              <div>
                <p className="text-sm font-medium text-white/70">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
                  {greetingFor(new Date())}, {user?.name?.split(' ')[0] || 'there'}
                </h2>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">{periodLabel} Sales</p>
                  <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                    {formatCurrency(stats?.total_sales || 0)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={HERO_CHIP}>
                    <FileText className="h-3.5 w-3.5" />
                    {stats?.total_invoices || 0} invoices
                  </span>
                  <span className={HERO_CHIP}>
                    <Users className="h-3.5 w-3.5" />
                    {stats?.total_customers ?? stats?.total_parties ?? 0} customers
                  </span>
                  <span className={HERO_CHIP}>
                    <Package className="h-3.5 w-3.5" />
                    {stats?.total_products || 0} products
                  </span>
                </div>
              </div>

              {quickActions.length > 0 && (
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/15 pt-5 sm:grid-cols-6">
                  {quickActions.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-2 py-2.5 text-center ring-1 ring-inset ring-white/15 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 hover:ring-white/30"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-700 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-105">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="text-[11px] font-semibold leading-tight text-white/90">{label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={cn('flex flex-col rounded-3xl p-5', CARD_CLASS)}>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Receivables</h3>
              <StatusBadge tone="brand">Needs attention</StatusBadge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Pending', value: fmtCompact(stats?.pending_amount || 0), icon: Clock },
                { label: 'Overdue invoices', value: stats?.overdue_invoices || 0, icon: IndianRupee },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-[linear-gradient(135deg,hsl(var(--theme-50))_0%,rgba(255,255,255,0)_100%)] p-3 ring-1 ring-inset ring-blue-100/70 dark:bg-[linear-gradient(135deg,hsl(var(--theme-500)/0.18)_0%,rgba(255,255,255,0)_100%)] dark:ring-white/10"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-inset ring-blue-100 dark:bg-[hsl(var(--theme-500)/0.22)] dark:text-[hsl(var(--theme-300))] dark:shadow-none dark:ring-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {analyticsEnabled && (
              <div className="mt-4">
                <AgingBar a={analytics} />
              </div>
            )}
            <div className="mt-auto pt-4">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href="/invoices">
                  Review invoices
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </div>

        {/* Row 2 — KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {analyticsEnabled ? (
            <>
              <KpiCard
                loading={analytics.loading}
                label={`${periodLabel} invoices`}
                icon={FileText}
                value={String(stats?.total_invoices || 0)}
                caption={`Trend · ${analytics.caption}`}
                spark={analytics.salesSeries.map((r) => r.count)}
                color={analytics.palette[600]}
              />
              <KpiCard
                loading={analytics.loading}
                label="Avg invoice value"
                icon={Receipt}
                value={fmtCompact(analytics.data.sales?.summary.avg_invoice_value ?? 0)}
                caption={`${analytics.data.sales?.summary.total_invoices ?? 0} paid · ${analytics.caption}`}
                change={analytics.data.sales?.summary.growth_vs_prior}
                spark={analytics.salesSeries.map((r) => r.avg_invoice)}
                color={analytics.palette[400]}
              />
              <KpiCard
                loading={analytics.loading}
                label="Net cash flow"
                icon={Waves}
                value={fmtCompact(analytics.data.payments?.summary.net_flow ?? 0)}
                caption={`In ${fmtCompact(analytics.data.payments?.summary.total_in ?? 0)} · Out ${fmtCompact(analytics.data.payments?.summary.total_out ?? 0)}`}
                spark={analytics.cashSeries.map((r) => r.net)}
                color={(analytics.data.payments?.summary.net_flow ?? 0) >= 0 ? '#10b981' : analytics.palette[600]}
              />
              <KpiCard
                loading={analytics.loading}
                label="Receivables vs payables"
                icon={Wallet}
                value={fmtCompact(analytics.receivable - analytics.payable)}
                caption={`Net position · ${analytics.data.widgets?.accounts_payable_count ?? 0} unpaid bills`}
                color={analytics.palette[600]}
                footer={
                  <div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <span className="h-full" style={{ width: `${analytics.receivableShare}%`, backgroundColor: analytics.palette[600] }} />
                      <span className="h-full flex-1 bg-amber-400" />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                      <span>
                        <span className="font-semibold text-slate-700">{fmtCompact(analytics.receivable)}</span> to collect
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">{fmtCompact(analytics.payable)}</span> to pay
                      </span>
                    </div>
                  </div>
                }
              />
            </>
          ) : (
            statCards.map((card) => (
              <StatWidget
                key={card.title}
                compact
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                description={card.description}
              />
            ))
          )}
        </div>

        {analyticsEnabled && (
          <>
            {/* Row 3 — sales trend + invoice status */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SalesTrendPanel a={analytics} className="lg:col-span-2" />
              <InvoiceStatusPanel a={analytics} />
            </div>

            {/* Row 4 — cash flow + payment modes */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <CashFlowPanel a={analytics} className="lg:col-span-2" />
              <PaymentModesPanel a={analytics} />
            </div>
          </>
        )}

        {/* Row 5 — dues + leaders */}
        {analyticsEnabled && (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <TopDebtorsPanel a={analytics} />
            <TopProductsPanel a={analytics} />
            <TopCustomersPanel a={analytics} />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
