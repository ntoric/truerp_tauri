'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportExportMenu } from '@/components/reports/report-export-menu'
import { ReportPanel, ReportStatGrid, pct } from '@/components/reports/report-ui'
import {
  customerReportCsvRows,
  customReportCsvRows,
  inventoryReportCsvRows,
  outstandingReportCsvRows,
  overviewReportCsvRows,
  paymentsReportCsvRows,
  productReportCsvRows,
  profitLossCsvRows,
  reportsExportDateStamp,
  revenueReportCsvRows,
  salesReportCsvRows,
  taxReportCsvRows,
} from '@/lib/reportsExport'
import { rowsToCsv } from '@/lib/accountingExport'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import JSZip from 'jszip'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  ComposedChart,
} from 'recharts'
import {
  TrendingUp,
  Users,
  Package,
  FileBarChart,
  SlidersHorizontal,
  Download,
} from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface ReportWidgets {
  total_sales: number
  month_revenue: number
  outstanding_amount: number
  outstanding_count: number
  inventory_value: number
  low_stock_count: number
  month_tax: number
  payments_in_month: number
  payments_out_month: number
  month_net_profit: number
}

interface SalesReportPayload {
  period: Period
  summary: {
    total_sales: number
    total_invoices: number
    avg_invoice_value: number
    best_period: string
    best_period_sales: number
    growth_vs_prior: number | null
  }
  series: { period: string; sales: number; count: number; avg_invoice: number }[]
  status_breakdown: { status: string; count: number; amount: number }[]
}

interface RevenueReportPayload {
  period: Period
  summary: {
    total_gross: number
    total_net: number
    total_tax: number
    total_invoices: number
    avg_invoice_value: number
    periods_in_report: number
  }
  periods: {
    period: string
    gross: number
    net: number
    tax: number
    invoice_count: number
    avg_invoice: number
  }[]
}

interface TaxReportPayload {
  summary: {
    total_cgst: number
    total_sgst: number
    total_igst: number
    total_tax: number
    taxable_turnover: number
    effective_tax_rate: number
    months_in_report: number
  }
  months: {
    month: string
    cgst: number
    sgst: number
    igst: number
    total_tax: number
    total_value: number
  }[]
}

interface PLAccountLine {
  account_code: string
  account_name: string
  amount: number
}

interface ProfitLossPayload {
  total_income: number
  total_expense: number
  net_profit: number
  income?: PLAccountLine[]
  expenses?: PLAccountLine[]
}

interface OutstandingPayload {
  summary: {
    total_outstanding: number
    invoice_count: number
    overdue_count: number
    avg_days_overdue: number
  }
  aging?: {
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_90_plus: number
  }
  by_party: { party_id: string; party_name: string; invoice_count: number; outstanding: number }[]
  invoices: {
    id: string
    invoice_number: string
    party_name: string
    date: string
    due_date?: string
    status: string
    total_amount: number
    amount_paid: number
    outstanding: number
    days_overdue: number
    aging_bucket: string
  }[]
}

const EMPTY_AGING: OutstandingPayload['aging'] = {
  current: 0,
  days_1_30: 0,
  days_31_60: 0,
  days_61_90: 0,
  days_90_plus: 0,
}

function agingFromInvoices(invoices: OutstandingPayload['invoices'] | undefined): OutstandingPayload['aging'] {
  const aging = { ...EMPTY_AGING }
  if (!invoices?.length) return aging
  for (const inv of invoices) {
    const amt = inv.outstanding ?? 0
    switch (inv.aging_bucket) {
      case 'current':
        aging.current += amt
        break
      case '1-30':
        aging.days_1_30 += amt
        break
      case '31-60':
        aging.days_31_60 += amt
        break
      case '61-90':
        aging.days_61_90 += amt
        break
      case '90+':
        aging.days_90_plus += amt
        break
      default: {
        const days = inv.days_overdue ?? 0
        if (days <= 0) aging.current += amt
        else if (days <= 30) aging.days_1_30 += amt
        else if (days <= 60) aging.days_31_60 += amt
        else if (days <= 90) aging.days_61_90 += amt
        else aging.days_90_plus += amt
      }
    }
  }
  return aging
}

function normalizeOutstanding(raw: unknown): OutstandingPayload | null {
  if (!raw || typeof raw !== 'object' || !('summary' in raw)) return null
  const data = raw as Partial<OutstandingPayload>
  if (!data.summary || typeof data.summary !== 'object') return null
  return {
    summary: data.summary,
    aging: data.aging ?? agingFromInvoices(data.invoices),
    by_party: data.by_party ?? [],
    invoices: data.invoices ?? [],
  }
}

interface CustomerReportPayload {
  summary: {
    customer_count: number
    total_paid_sales: number
    total_outstanding: number
    avg_sales_per_party: number
  }
  customers: {
    party_id: string
    name: string
    phone: string
    email: string
    gstin: string
    total_sales: number
    total_outstanding: number
    invoice_count: number
    paid_count: number
    avg_invoice_value: number
    last_invoice_date?: string
  }[]
}

interface ProductReportPayload {
  source: string
  summary: {
    product_count: number
    total_revenue: number
    total_qty_sold: number
    avg_unit_revenue: number
  }
  products: {
    product_id: string
    name: string
    sku: string
    category: string
    unit: string
    sale_price: number
    quantity_sold: number
    revenue: number
    share_percent: number
  }[]
}

interface PaymentReportPayload {
  period: Period
  summary: {
    total_in: number
    total_out: number
    net_flow: number
    transaction_in: number
    transaction_out: number
  }
  timeline: {
    period: string
    amount_in: number
    amount_out: number
    count_in: number
    count_out: number
  }[]
  by_mode: { mode: string; direction: string; total: number; count: number }[]
}

function normalizePayments(raw: unknown): PaymentReportPayload | null {
  if (!raw || typeof raw !== 'object' || !('summary' in raw)) return null
  const data = raw as Partial<PaymentReportPayload>
  if (!data.summary || typeof data.summary !== 'object') return null
  return {
    period: data.period ?? 'monthly',
    summary: data.summary,
    timeline: data.timeline ?? [],
    by_mode: data.by_mode ?? [],
  }
}

interface InventoryReportPayload {
  summary: {
    total_value: number
    total_retail_value: number
    total_quantity: number
    sku_locations: number
    low_stock_count: number
    out_of_stock_count: number
  }
  categories: { category: string; value: number }[]
  items: {
    product_name: string
    sku: string
    category: string
    stock_qty: number
    reserved_qty: number
    available_qty: number
    min_stock: number
    cost_price: number
    sale_price: number
    total_value: number
    retail_value: number
    outlet_name: string
    is_low_stock: boolean
    is_out_of_stock: boolean
  }[]
}

interface CustomReportResult {
  metric: string
  from_date: string
  to_date: string
  total_amount: number
  total_count: number
  avg_amount: number
  rows: { label: string; amount: number; count: number }[]
}

const REPORT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'profit-loss', label: 'P&L' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'tax', label: 'Tax' },
  { id: 'payments', label: 'Payments' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'custom', label: 'Custom' },
] as const

type ReportTabId = (typeof REPORT_TABS)[number]['id']

function monthStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function growthLabel(g: number | null | undefined) {
  if (g == null) return '—'
  const sign = g >= 0 ? '+' : ''
  return `${sign}${g.toFixed(1)}% vs prior period`
}

export default function ReportsPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<ReportTabId>(
    (searchParams.get('tab') as ReportTabId) || 'overview'
  )
  const [period, setPeriod] = useState<Period>('monthly')
  const [loading, setLoading] = useState(true)

  const [widgets, setWidgets] = useState<ReportWidgets | null>(null)
  const [salesReport, setSalesReport] = useState<SalesReportPayload | null>(null)
  const [revenueReport, setRevenueReport] = useState<RevenueReportPayload | null>(null)
  const [taxReport, setTaxReport] = useState<TaxReportPayload | null>(null)
  const [profitLoss, setProfitLoss] = useState<ProfitLossPayload | null>(null)
  const [outstanding, setOutstanding] = useState<OutstandingPayload | null>(null)
  const [customerReport, setCustomerReport] = useState<CustomerReportPayload | null>(null)
  const [productReport, setProductReport] = useState<ProductReportPayload | null>(null)
  const [payments, setPayments] = useState<PaymentReportPayload | null>(null)
  const [inventory, setInventory] = useState<InventoryReportPayload | null>(null)

  const [customMetric, setCustomMetric] = useState('sales')
  const [customFrom, setCustomFrom] = useState(monthStartISO())
  const [customTo, setCustomTo] = useState(todayISO())
  const [customResult, setCustomResult] = useState<CustomReportResult | null>(null)
  const [customLoading, setCustomLoading] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const { toast } = useToast()

  const salesSeriesPagination = usePagination(salesReport?.series ?? [])
  const salesStatusPagination = usePagination(salesReport?.status_breakdown ?? [])
  const revenuePeriodsPagination = usePagination(revenueReport?.periods ?? [])
  const plIncomePagination = usePagination(profitLoss?.income ?? [])
  const plExpensesPagination = usePagination(profitLoss?.expenses ?? [])
  const outstandingByPartyPagination = usePagination(outstanding?.by_party ?? [])
  const outstandingInvoicesPagination = usePagination(outstanding?.invoices ?? [])
  const customersPagination = usePagination(customerReport?.customers ?? [])
  const productsPagination = usePagination(productReport?.products ?? [])
  const taxMonthsPagination = usePagination(taxReport?.months ?? [])
  const paymentsTimelinePagination = usePagination(payments?.timeline ?? [])
  const paymentsByModePagination = usePagination(payments?.by_mode ?? [])
  const inventoryCategoriesPagination = usePagination(inventory?.categories ?? [])
  const inventoryItemsPagination = usePagination(inventory?.items ?? [])
  const customRowsPagination = usePagination(customResult?.rows ?? [])

  const notifyExported = (label: string) => toast({ title: `${label} exported` })

  const fetchCore = useCallback(async () => {
    setLoading(true)
    try {
      const [
        widgetsRes,
        salesRes,
        revenueRes,
        taxRes,
        plRes,
        outstandingRes,
        customersRes,
        productsRes,
        paymentsRes,
        inventoryRes,
      ] = await Promise.all([
        apiFetch('/reports/widgets'),
        apiFetch(`/reports/sales?period=${period}`),
        apiFetch(`/reports/revenue?period=${period}`),
        apiFetch('/reports/tax'),
        apiFetch('/accounting/profit-loss'),
        apiFetch('/reports/outstanding'),
        apiFetch('/reports/customers?limit=50'),
        apiFetch('/reports/products?limit=50'),
        apiFetch(`/reports/payments?period=${period}`),
        apiFetch('/reports/inventory'),
      ])

      if (widgetsRes.ok) setWidgets(await widgetsRes.json())
      if (salesRes.ok) setSalesReport(await salesRes.json())
      if (revenueRes.ok) setRevenueReport(await revenueRes.json())
      if (taxRes.ok) setTaxReport(await taxRes.json())
      if (plRes.ok) setProfitLoss(await plRes.json())
      if (outstandingRes.ok) {
        const normalized = normalizeOutstanding(await outstandingRes.json())
        if (normalized) setOutstanding(normalized)
      }
      if (customersRes.ok) setCustomerReport(await customersRes.json())
      if (productsRes.ok) setProductReport(await productsRes.json())
      if (paymentsRes.ok) {
        const normalized = normalizePayments(await paymentsRes.json())
        if (normalized) setPayments(normalized)
      }
      if (inventoryRes.ok) setInventory(await inventoryRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchCore()
  }, [fetchCore])

  const runCustomReport = async () => {
    setCustomLoading(true)
    try {
      const res = await apiFetch(
        `/reports/custom?metric=${customMetric}&from_date=${customFrom}&to_date=${customTo}`
      )
      if (res.ok) setCustomResult(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setCustomLoading(false)
    }
  }

  const periodSelect = (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value as Period)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
      <option value="yearly">Yearly</option>
    </select>
  )

  const spinner = (
    <div className="flex h-48 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )

  const salesSeries = useMemo(() => [...(salesReport?.series || [])].reverse(), [salesReport])
  const revenuePeriods = useMemo(() => [...(revenueReport?.periods || [])].reverse(), [revenueReport])
  const gstChartData = useMemo(
    () =>
      [...(taxReport?.months || [])].reverse().map((g) => ({
        month: g.month,
        CGST: g.cgst,
        SGST: g.sgst,
        IGST: g.igst,
        tax: g.total_tax,
        turnover: g.total_value,
      })),
    [taxReport]
  )
  const paymentChartData = useMemo(() => [...(payments?.timeline || [])].reverse(), [payments])

  const overviewExportJson = useMemo(
    () => ({
      exported_at: new Date().toISOString(),
      period,
      widgets,
      sales: salesReport,
      revenue: revenueReport,
      tax: taxReport,
      profit_loss: profitLoss,
      outstanding,
      customers: customerReport,
      products: productReport,
      payments,
      inventory,
    }),
    [
      period,
      widgets,
      salesReport,
      revenueReport,
      taxReport,
      profitLoss,
      outstanding,
      customerReport,
      productReport,
      payments,
      inventory,
    ]
  )

  const exportAllReportsZip = async () => {
    setExportingAll(true)
    try {
      const zip = new JSZip()
      const stamp = reportsExportDateStamp()
      const folder = zip.folder('reports-analytics')!

      const add = (name: string, rows: (string | number | null | undefined)[][], json: unknown) => {
        folder.file(`${name}.csv`, rowsToCsv(rows))
        folder.file(`${name}.json`, JSON.stringify(json, null, 2))
      }

      add('overview', overviewReportCsvRows({ widgets, period }), overviewExportJson)
      if (salesReport) add('sales', salesReportCsvRows(salesReport), salesReport)
      if (revenueReport) add('revenue', revenueReportCsvRows(revenueReport), revenueReport)
      if (taxReport) add('tax', taxReportCsvRows(taxReport), taxReport)
      if (profitLoss) add('profit-loss', profitLossCsvRows(profitLoss), profitLoss)
      if (outstanding) add('outstanding', outstandingReportCsvRows(outstanding), outstanding)
      if (customerReport) add('customers', customerReportCsvRows(customerReport), customerReport)
      if (productReport) add('products', productReportCsvRows(productReport), productReport)
      if (payments) add('payments', paymentsReportCsvRows(payments), payments)
      if (inventory) add('inventory', inventoryReportCsvRows(inventory), inventory)
      if (customResult) add('custom', customReportCsvRows(customResult), customResult)

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reports-analytics-${stamp}.zip`
      a.click()
      URL.revokeObjectURL(url)
      notifyExported('All reports')
    } catch (err) {
      console.error(err)
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExportingAll(false)
    }
  }

  const tabExportBar = (menu: ReactNode) => (
    <div className="flex flex-wrap items-center justify-end gap-2">{menu}</div>
  )

  const agingChartData = useMemo(() => {
    if (!outstanding) return []
    const aging = outstanding.aging ?? EMPTY_AGING
    return [
      { bucket: 'Current', amount: aging.current ?? 0 },
      { bucket: '1–30d', amount: aging.days_1_30 ?? 0 },
      { bucket: '31–60d', amount: aging.days_31_60 ?? 0 },
      { bucket: '61–90d', amount: aging.days_61_90 ?? 0 },
      { bucket: '90+d', amount: aging.days_90_plus ?? 0 },
    ]
  }, [outstanding])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-sm text-gray-500">
              Detailed breakdowns by period — sales, collections, receivables, customers, stock, and tax
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || exportingAll}
              onClick={() => void exportAllReportsZip()}
            >
              <Download className="mr-2 h-4 w-4" />
              {exportingAll ? 'Exporting…' : 'Export all (ZIP)'}
            </Button>
            <Link href="/reports/daily" className="text-sm font-medium text-blue-600 hover:underline">
              Daily partner report →
            </Link>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTabId)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
            {REPORT_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6 pt-4">
            {!loading &&
              tabExportBar(
                <ReportExportMenu
                  baseName={`reports-overview-${period}`}
                  csvRows={overviewReportCsvRows({ widgets, period })}
                  jsonData={overviewExportJson}
                  onExported={() => notifyExported('Overview report')}
                />
              )}
            {loading ? (
              spinner
            ) : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Lifetime paid sales', value: formatCurrency(widgets?.total_sales || 0) },
                    { label: 'This month revenue', value: formatCurrency(widgets?.month_revenue || 0), tone: 'success' },
                    { label: 'Receivables', value: formatCurrency(widgets?.outstanding_amount || 0), hint: `${widgets?.outstanding_count ?? 0} open`, tone: 'danger' },
                    { label: 'Inventory (cost)', value: formatCurrency(widgets?.inventory_value || 0) },
                    { label: 'Net profit (ledger)', value: formatCurrency(widgets?.month_net_profit || 0) },
                    { label: 'GST this month', value: formatCurrency(widgets?.month_tax || 0) },
                    { label: 'Cash in (month)', value: formatCurrency(widgets?.payments_in_month || 0), tone: 'success' },
                    { label: 'Cash out (month)', value: formatCurrency(widgets?.payments_out_month || 0), tone: 'warning' },
                  ]}
                />
                <div className="grid gap-6 lg:grid-cols-2">
                  <ReportPanel
                    title="Sales trend"
                    description="Paid invoice totals for the selected period grouping."
                    actions={periodSelect}
                  >
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={salesSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel title="Receivables aging" description="Outstanding balance by overdue bucket.">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={agingChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <ReportPanel title="Top customers (by paid sales)" description="Quick view — open Customers tab for full list.">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(customerReport?.customers || []).slice(0, 5).map((c) => (
                          <TableRow key={c.party_id}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(c.total_sales)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(c.total_outstanding)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ReportPanel>
                  <ReportPanel title="Top products" description={`Source: ${productReport?.source?.replace(/_/g, ' ') || '—'}`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(productReport?.products || []).slice(0, 5).map((p, i) => (
                          <TableRow key={p.product_id || i}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell className="text-right">{p.quantity_sold}</TableCell>
                            <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ReportPanel>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="sales" className="space-y-4 pt-4">
            {!loading &&
              salesReport &&
              tabExportBar(
                <ReportExportMenu
                  baseName={`reports-sales-${period}`}
                  csvRows={salesReportCsvRows(salesReport)}
                  jsonData={salesReport}
                  onExported={() => notifyExported('Sales report')}
                />
              )}
            {loading ? (
              spinner
            ) : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Total sales (periods shown)', value: formatCurrency(salesReport?.summary.total_sales || 0) },
                    { label: 'Invoices', value: String(salesReport?.summary.total_invoices ?? 0) },
                    { label: 'Avg invoice', value: formatCurrency(salesReport?.summary.avg_invoice_value || 0) },
                    {
                      label: 'Best period',
                      value: salesReport?.summary.best_period || '—',
                      hint: formatCurrency(salesReport?.summary.best_period_sales || 0),
                    },
                    {
                      label: 'Growth',
                      value: growthLabel(salesReport?.summary.growth_vs_prior),
                      tone:
                        (salesReport?.summary.growth_vs_prior ?? 0) >= 0 ? 'success' : 'danger',
                    },
                  ]}
                  columns={3}
                />
                <ReportPanel
                  title="Sales by period"
                  description="Only paid invoices are included in sales totals."
                  icon={TrendingUp}
                  actions={periodSelect}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={salesSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip formatter={(v: number, name: string) => (name === 'count' ? v : formatCurrency(v))} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="count" name="Invoices" stroke="#f59e0b" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Avg invoice</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesSeriesPagination.paginatedItems.map((row) => (
                        <TableRow key={row.period}>
                          <TableCell>{row.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.sales)}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.avg_invoice)}</TableCell>
                          <TableCell className="text-right">
                            {pct(row.sales, salesReport?.summary.total_sales || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={salesSeriesPagination.page}
                    totalPages={salesSeriesPagination.totalPages}
                    totalItems={salesSeriesPagination.totalItems}
                    pageSize={salesSeriesPagination.pageSize}
                    onPageChange={salesSeriesPagination.setPage}
                  />
                </ReportPanel>
                <ReportPanel title="Invoice status mix" description="All invoices regardless of payment status.">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesStatusPagination.paginatedItems.map((s) => (
                        <TableRow key={s.status}>
                          <TableCell className="capitalize">{s.status}</TableCell>
                          <TableCell className="text-right">{s.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={salesStatusPagination.page}
                    totalPages={salesStatusPagination.totalPages}
                    totalItems={salesStatusPagination.totalItems}
                    pageSize={salesStatusPagination.pageSize}
                    onPageChange={salesStatusPagination.setPage}
                  />
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4 pt-4">
            {!loading &&
              revenueReport &&
              tabExportBar(
                <ReportExportMenu
                  baseName={`reports-revenue-${period}`}
                  csvRows={revenueReportCsvRows(revenueReport)}
                  jsonData={revenueReport}
                  onExported={() => notifyExported('Revenue report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Gross revenue', value: formatCurrency(revenueReport?.summary.total_gross || 0) },
                    { label: 'Net (pre-tax)', value: formatCurrency(revenueReport?.summary.total_net || 0), tone: 'success' },
                    { label: 'Tax component', value: formatCurrency(revenueReport?.summary.total_tax || 0) },
                    { label: 'Invoices', value: String(revenueReport?.summary.total_invoices ?? 0) },
                    { label: 'Avg invoice', value: formatCurrency(revenueReport?.summary.avg_invoice_value || 0) },
                  ]}
                  columns={3}
                />
                <ReportPanel title="Revenue breakdown" actions={periodSelect}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenuePeriods}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="gross" name="Gross" fill="#3b82f6" />
                      <Bar dataKey="net" name="Net" fill="#10b981" />
                      <Bar dataKey="tax" name="Tax" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Avg</TableHead>
                        <TableHead className="text-right">Tax % of gross</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenuePeriodsPagination.paginatedItems.map((r) => (
                        <TableRow key={r.period}>
                          <TableCell>{r.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.net)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.tax)}</TableCell>
                          <TableCell className="text-right">{r.invoice_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.avg_invoice)}</TableCell>
                          <TableCell className="text-right">{pct(r.tax, r.gross)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={revenuePeriodsPagination.page}
                    totalPages={revenuePeriodsPagination.totalPages}
                    totalItems={revenuePeriodsPagination.totalItems}
                    pageSize={revenuePeriodsPagination.pageSize}
                    onPageChange={revenuePeriodsPagination.setPage}
                  />
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="profit-loss" className="space-y-4 pt-4">
            {!loading &&
              profitLoss &&
              tabExportBar(
                <ReportExportMenu
                  baseName="reports-profit-loss"
                  csvRows={profitLossCsvRows(profitLoss)}
                  jsonData={profitLoss}
                  onExported={() => notifyExported('P&L report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Total income', value: formatCurrency(profitLoss?.total_income || 0), tone: 'success' },
                    { label: 'Total expenses', value: formatCurrency(profitLoss?.total_expense || 0), tone: 'warning' },
                    {
                      label: 'Net profit',
                      value: formatCurrency(profitLoss?.net_profit || 0),
                      tone: (profitLoss?.net_profit || 0) >= 0 ? 'success' : 'danger',
                    },
                    {
                      label: 'Profit margin',
                      value: pct(profitLoss?.net_profit || 0, profitLoss?.total_income || 0),
                      hint: 'Net profit ÷ income',
                    },
                  ]}
                  columns={4}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <ReportPanel title="Income accounts">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plIncomePagination.paginatedItems.map((a) => (
                          <TableRow key={a.account_code}>
                            <TableCell>{a.account_code}</TableCell>
                            <TableCell>{a.account_name}</TableCell>
                            <TableCell className="text-right text-green-700">{formatCurrency(a.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {!profitLoss?.income?.length && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-500">No income balances</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={plIncomePagination.page}
                      totalPages={plIncomePagination.totalPages}
                      totalItems={plIncomePagination.totalItems}
                      pageSize={plIncomePagination.pageSize}
                      onPageChange={plIncomePagination.setPage}
                    />
                  </ReportPanel>
                  <ReportPanel title="Expense accounts">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plExpensesPagination.paginatedItems.map((a) => (
                          <TableRow key={a.account_code}>
                            <TableCell>{a.account_code}</TableCell>
                            <TableCell>{a.account_name}</TableCell>
                            <TableCell className="text-right text-orange-700">{formatCurrency(a.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {!profitLoss?.expenses?.length && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-500">No expense balances</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={plExpensesPagination.page}
                      totalPages={plExpensesPagination.totalPages}
                      totalItems={plExpensesPagination.totalItems}
                      pageSize={plExpensesPagination.pageSize}
                      onPageChange={plExpensesPagination.setPage}
                    />
                  </ReportPanel>
                </div>
                <p className="text-sm text-gray-500">
                  Figures reflect current ledger balances. Journal detail:{' '}
                  <Link href="/accounting" className="text-blue-600 hover:underline">Accounting</Link>.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="outstanding" className="space-y-4 pt-4">
            {!loading &&
              outstanding &&
              tabExportBar(
                <ReportExportMenu
                  baseName="reports-outstanding"
                  csvRows={outstandingReportCsvRows(outstanding)}
                  jsonData={outstanding}
                  onExported={() => notifyExported('Outstanding report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Total outstanding', value: formatCurrency(outstanding?.summary.total_outstanding || 0), tone: 'danger' },
                    { label: 'Open invoices', value: String(outstanding?.summary.invoice_count ?? 0) },
                    { label: 'Overdue invoices', value: String(outstanding?.summary.overdue_count ?? 0), tone: 'warning' },
                    { label: 'Avg days overdue', value: (outstanding?.summary.avg_days_overdue ?? 0).toFixed(1) },
                  ]}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <ReportPanel title="Aging buckets">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={agingChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" />
                        <YAxis />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="amount" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ReportPanel>
                  <ReportPanel title="Top debtors">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstandingByPartyPagination.paginatedItems.map((p) => (
                          <TableRow key={p.party_id}>
                            <TableCell>{p.party_name}</TableCell>
                            <TableCell className="text-right">{p.invoice_count}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(p.outstanding)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={outstandingByPartyPagination.page}
                      totalPages={outstandingByPartyPagination.totalPages}
                      totalItems={outstandingByPartyPagination.totalItems}
                      pageSize={outstandingByPartyPagination.pageSize}
                      onPageChange={outstandingByPartyPagination.setPage}
                    />
                  </ReportPanel>
                </div>
                <ReportPanel title="Invoice detail" description="Sent and overdue invoices with partial payments.">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Invoice date</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingInvoicesPagination.paginatedItems.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Link href={`/invoices/view?id=${inv.id}`} className="font-medium text-blue-600 hover:underline">
                              {inv.invoice_number}
                            </Link>
                          </TableCell>
                          <TableCell>{inv.party_name}</TableCell>
                          <TableCell>{formatDate(inv.date)}</TableCell>
                          <TableCell>
                            {inv.due_date ? formatDate(inv.due_date) : '—'}
                            {inv.days_overdue > 0 && (
                              <span className="ml-1 block text-xs text-red-600">{inv.days_overdue}d overdue</span>
                            )}
                          </TableCell>
                          <TableCell>{inv.aging_bucket}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.amount_paid)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(inv.outstanding)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={outstandingInvoicesPagination.page}
                    totalPages={outstandingInvoicesPagination.totalPages}
                    totalItems={outstandingInvoicesPagination.totalItems}
                    pageSize={outstandingInvoicesPagination.pageSize}
                    onPageChange={outstandingInvoicesPagination.setPage}
                  />
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="customers" className="space-y-4 pt-4">
            {!loading &&
              customerReport &&
              tabExportBar(
                <ReportExportMenu
                  baseName="reports-customers"
                  csvRows={customerReportCsvRows(customerReport)}
                  jsonData={customerReport}
                  onExported={() => notifyExported('Customer report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Customers with activity', value: String(customerReport?.summary.customer_count ?? 0) },
                    { label: 'Total paid sales', value: formatCurrency(customerReport?.summary.total_paid_sales || 0), tone: 'success' },
                    { label: 'Total outstanding', value: formatCurrency(customerReport?.summary.total_outstanding || 0), tone: 'danger' },
                    { label: 'Avg sales / customer', value: formatCurrency(customerReport?.summary.avg_sales_per_party || 0) },
                  ]}
                />
                <ReportPanel title="Customer-wise detail" icon={Users}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>GSTIN</TableHead>
                        <TableHead className="text-right">Paid sales</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Avg invoice</TableHead>
                        <TableHead>Last invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersPagination.paginatedItems.map((c) => (
                        <TableRow key={c.party_id}>
                          <TableCell className="font-medium">
                            <Link href={`/parties`} className="hover:underline">{c.name}</Link>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {c.phone || '—'}
                            {c.email ? <span className="block">{c.email}</span> : null}
                          </TableCell>
                          <TableCell className="text-xs">{c.gstin || '—'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.total_sales)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.total_outstanding)}</TableCell>
                          <TableCell className="text-right">{c.paid_count}/{c.invoice_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.avg_invoice_value)}</TableCell>
                          <TableCell>{c.last_invoice_date ? formatDate(c.last_invoice_date) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={customersPagination.page}
                    totalPages={customersPagination.totalPages}
                    totalItems={customersPagination.totalItems}
                    pageSize={customersPagination.pageSize}
                    onPageChange={customersPagination.setPage}
                  />
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-4 pt-4">
            {!loading &&
              productReport &&
              tabExportBar(
                <ReportExportMenu
                  baseName="reports-products"
                  csvRows={productReportCsvRows(productReport)}
                  jsonData={productReport}
                  onExported={() => notifyExported('Product report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Products ranked', value: String(productReport?.summary.product_count ?? 0) },
                    { label: 'Total revenue', value: formatCurrency(productReport?.summary.total_revenue || 0), tone: 'success' },
                    { label: 'Units sold', value: String(productReport?.summary.total_qty_sold ?? 0) },
                    { label: 'Avg revenue / unit', value: formatCurrency(productReport?.summary.avg_unit_revenue || 0) },
                  ]}
                />
                <ReportPanel
                  title="Product-wise performance"
                  icon={Package}
                  description={`Data source: ${productReport?.source?.replace(/_/g, ' ') || 'sales'}`}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty sold</TableHead>
                        <TableHead className="text-right">List price</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsPagination.paginatedItems.map((p, i) => (
                        <TableRow key={p.product_id || `${p.name}-${i}`}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.sku || '—'}</TableCell>
                          <TableCell>{p.category || '—'}</TableCell>
                          <TableCell className="text-right">{p.quantity_sold} {p.unit}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.sale_price)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                          <TableCell className="text-right">{p.share_percent.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={productsPagination.page}
                    totalPages={productsPagination.totalPages}
                    totalItems={productsPagination.totalItems}
                    pageSize={productsPagination.pageSize}
                    onPageChange={productsPagination.setPage}
                  />
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="tax" className="space-y-4 pt-4">
            {!loading &&
              taxReport &&
              tabExportBar(
                <ReportExportMenu
                  baseName="reports-tax"
                  csvRows={taxReportCsvRows(taxReport)}
                  jsonData={taxReport}
                  onExported={() => notifyExported('Tax report')}
                />
              )}
            {loading ? spinner : taxReport?.months?.length ? (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Total GST', value: formatCurrency(taxReport.summary.total_tax) },
                    { label: 'CGST', value: formatCurrency(taxReport.summary.total_cgst) },
                    { label: 'SGST', value: formatCurrency(taxReport.summary.total_sgst) },
                    { label: 'IGST', value: formatCurrency(taxReport.summary.total_igst) },
                    { label: 'Taxable turnover', value: formatCurrency(taxReport.summary.taxable_turnover) },
                    { label: 'Effective rate', value: `${taxReport.summary.effective_tax_rate.toFixed(2)}%` },
                  ]}
                  columns={3}
                />
                <ReportPanel title="Monthly GST" icon={FileBarChart}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={gstChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="CGST" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="SGST" stackId="a" fill="#10b981" />
                      <Bar dataKey="IGST" stackId="a" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Turnover</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">Total tax</TableHead>
                        <TableHead className="text-right">Eff. rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxMonthsPagination.paginatedItems.map((m) => (
                        <TableRow key={m.month}>
                          <TableCell>{m.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.total_value)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.cgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.sgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.igst)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(m.total_tax)}</TableCell>
                          <TableCell className="text-right">{pct(m.total_tax, m.total_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={taxMonthsPagination.page}
                    totalPages={taxMonthsPagination.totalPages}
                    totalItems={taxMonthsPagination.totalItems}
                    pageSize={taxMonthsPagination.pageSize}
                    onPageChange={taxMonthsPagination.setPage}
                  />
                  <p className="mt-3 text-sm text-gray-500">
                    GSTR views: <Link href="/gst" className="text-blue-600 hover:underline">GST module</Link>
                  </p>
                </ReportPanel>
              </>
            ) : (
              <p className="py-8 text-center text-gray-500">No tax data available</p>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 pt-4">
            {!loading &&
              payments &&
              tabExportBar(
                <ReportExportMenu
                  baseName={`reports-payments-${period}`}
                  csvRows={paymentsReportCsvRows(payments)}
                  jsonData={payments}
                  onExported={() => notifyExported('Payment report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Total payment in', value: formatCurrency(payments?.summary.total_in || 0), tone: 'success' },
                    { label: 'Total payment out', value: formatCurrency(payments?.summary.total_out || 0), tone: 'warning' },
                    { label: 'Net cash flow', value: formatCurrency(payments?.summary.net_flow || 0), tone: (payments?.summary.net_flow || 0) >= 0 ? 'success' : 'danger' },
                    { label: 'Transactions in', value: String(payments?.summary.transaction_in ?? 0) },
                    { label: 'Transactions out', value: String(payments?.summary.transaction_out ?? 0) },
                  ]}
                  columns={3}
                />
                <ReportPanel title="Payment in vs out" actions={periodSelect}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={paymentChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="amount_in" name="In" fill="#10b981" />
                      <Bar dataKey="amount_out" name="Out" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-6">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">In</TableHead>
                        <TableHead className="text-right">Out</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Txn in</TableHead>
                        <TableHead className="text-right">Txn out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsTimelinePagination.paginatedItems.map((t) => (
                        <TableRow key={t.period}>
                          <TableCell>{t.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.amount_in)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.amount_out)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.amount_in - t.amount_out)}</TableCell>
                          <TableCell className="text-right">{t.count_in}</TableCell>
                          <TableCell className="text-right">{t.count_out}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={paymentsTimelinePagination.page}
                    totalPages={paymentsTimelinePagination.totalPages}
                    totalItems={paymentsTimelinePagination.totalItems}
                    pageSize={paymentsTimelinePagination.pageSize}
                    onPageChange={paymentsTimelinePagination.setPage}
                  />
                </ReportPanel>
                <ReportPanel title="By payment mode">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mode</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Avg txn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsByModePagination.paginatedItems.map((m, i) => (
                        <TableRow key={`${m.mode}-${m.direction}-${i}`}>
                          <TableCell className="capitalize">{m.mode || 'other'}</TableCell>
                          <TableCell>{m.direction === 'in' ? 'Payment in' : 'Payment out'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.total)}</TableCell>
                          <TableCell className="text-right">{m.count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(m.count ? m.total / m.count : 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={paymentsByModePagination.page}
                    totalPages={paymentsByModePagination.totalPages}
                    totalItems={paymentsByModePagination.totalItems}
                    pageSize={paymentsByModePagination.pageSize}
                    onPageChange={paymentsByModePagination.setPage}
                  />
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 pt-4">
            {!loading &&
              inventory &&
              tabExportBar(
                <ReportExportMenu
                  baseName="reports-inventory"
                  csvRows={inventoryReportCsvRows(inventory)}
                  jsonData={inventory}
                  onExported={() => notifyExported('Inventory report')}
                />
              )}
            {loading ? spinner : (
              <>
                <ReportStatGrid
                  stats={[
                    { label: 'Stock value (cost)', value: formatCurrency(inventory?.summary.total_value || 0) },
                    { label: 'Retail value', value: formatCurrency(inventory?.summary.total_retail_value || 0), tone: 'success' },
                    { label: 'Total units on hand', value: String(inventory?.summary.total_quantity ?? 0) },
                    { label: 'SKU × location rows', value: String(inventory?.summary.sku_locations ?? 0) },
                    { label: 'Low stock', value: String(inventory?.summary.low_stock_count ?? 0), tone: 'warning' },
                    { label: 'Out of stock', value: String(inventory?.summary.out_of_stock_count ?? 0), tone: 'danger' },
                  ]}
                  columns={3}
                />
                <ReportPanel title="Value by category">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock value</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryCategoriesPagination.paginatedItems.map((c) => (
                        <TableRow key={c.category}>
                          <TableCell>{c.category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.value)}</TableCell>
                          <TableCell className="text-right">
                            {pct(c.value, inventory?.summary.total_value || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={inventoryCategoriesPagination.page}
                    totalPages={inventoryCategoriesPagination.totalPages}
                    totalItems={inventoryCategoriesPagination.totalItems}
                    pageSize={inventoryCategoriesPagination.pageSize}
                    onPageChange={inventoryCategoriesPagination.setPage}
                  />
                </ReportPanel>
                <ReportPanel title="Stock detail">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">On hand</TableHead>
                        <TableHead className="text-right">Reserved</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Min</TableHead>
                        <TableHead className="text-right">Cost value</TableHead>
                        <TableHead className="text-right">Retail value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryItemsPagination.paginatedItems.map((item, i) => (
                        <TableRow
                          key={`${item.sku}-${i}`}
                          className={item.is_out_of_stock ? 'bg-red-50/40' : item.is_low_stock ? 'bg-amber-50/40' : ''}
                        >
                          <TableCell>
                            {item.product_name}
                            {item.is_out_of_stock && <span className="ml-2 text-xs text-red-600">Out</span>}
                            {item.is_low_stock && !item.is_out_of_stock && (
                              <span className="ml-2 text-xs text-amber-600">Low</span>
                            )}
                          </TableCell>
                          <TableCell>{item.outlet_name || '—'}</TableCell>
                          <TableCell className="text-right">{item.stock_qty}</TableCell>
                          <TableCell className="text-right">{item.reserved_qty}</TableCell>
                          <TableCell className="text-right">{item.available_qty}</TableCell>
                          <TableCell className="text-right">{item.min_stock}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.total_value)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.retail_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={inventoryItemsPagination.page}
                    totalPages={inventoryItemsPagination.totalPages}
                    totalItems={inventoryItemsPagination.totalItems}
                    pageSize={inventoryItemsPagination.pageSize}
                    onPageChange={inventoryItemsPagination.setPage}
                  />
                  <p className="mt-3 text-sm text-gray-500">
                    Manage stock: <Link href="/inventory" className="text-blue-600 hover:underline">Inventory</Link>
                  </p>
                </ReportPanel>
              </>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 pt-4">
            {customResult &&
              tabExportBar(
                <ReportExportMenu
                  baseName={`reports-custom-${customMetric}`}
                  csvRows={customReportCsvRows(customResult)}
                  jsonData={customResult}
                  onExported={() => notifyExported('Custom report')}
                />
              )}
            <ReportPanel title="Custom report builder" icon={SlidersHorizontal} description="Pick a metric and date range to aggregate results.">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label>Metric</Label>
                  <select
                    value={customMetric}
                    onChange={(e) => setCustomMetric(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="sales">Paid sales (daily)</option>
                    <option value="payments_in">Payments in (daily)</option>
                    <option value="payments_out">Payments out (daily)</option>
                    <option value="expenses">Expenses by category</option>
                    <option value="purchases">Purchases (daily)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
                <Button onClick={runCustomReport} disabled={customLoading}>
                  {customLoading ? 'Running…' : 'Run report'}
                </Button>
              </div>
              {customResult && (
                <div className="mt-6 space-y-4">
                  <ReportStatGrid
                    stats={[
                      { label: 'Total amount', value: formatCurrency(customResult.total_amount), tone: 'success' },
                      { label: 'Record count', value: String(customResult.total_count) },
                      { label: 'Average per record', value: formatCurrency(customResult.avg_amount) },
                      { label: 'Date range', value: `${customResult.from_date} → ${customResult.to_date}` },
                    ]}
                    columns={4}
                  />
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[...customResult.rows].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="amount" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{customMetric === 'expenses' ? 'Category' : 'Label'}</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Avg</TableHead>
                        <TableHead className="text-right">% of total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customRowsPagination.paginatedItems.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.count ? row.amount / row.count : 0)}
                          </TableCell>
                          <TableCell className="text-right">{pct(row.amount, customResult.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={customRowsPagination.page}
                    totalPages={customRowsPagination.totalPages}
                    totalItems={customRowsPagination.totalItems}
                    pageSize={customRowsPagination.pageSize}
                    onPageChange={customRowsPagination.setPage}
                  />
                </div>
              )}
            </ReportPanel>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
