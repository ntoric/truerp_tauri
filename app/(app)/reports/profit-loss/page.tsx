'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, cn } from '@/lib/utils'
import { PERIODIC_REPORT_OPTIONS, type PeriodicReportPeriod } from '@/lib/dailyReport'
import {
  buildProfitLossShareText,
  downloadProfitLossExcel,
  downloadProfitLossPdf,
  fetchProfitLossReport,
  type ProfitLossReport,
} from '@/lib/profitLossReport'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  CalendarRange,
  Download,
  RefreshCw,
  Share2,
  Copy,
  TrendingUp,
  CircleDollarSign,
  Package,
  Wallet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartISO(date = todayISO()) {
  return `${date.slice(0, 7)}-01`
}

type StatementRow = {
  key: string
  label: string
  kind: 'section' | 'item' | 'detail' | 'subtotal' | 'total'
  amount?: number
  negative?: boolean
  details?: string
}

function statementRows(r: ProfitLossReport): StatementRow[] {
  const netSales = r.sales.total_amount - r.sales_returns.total_amount
  const netPurchases = r.purchases.total_amount - r.purchase_returns.total_amount

  const rows: StatementRow[] = [
    { key: 'sec-trading', label: 'Trading Account', kind: 'section' },
    {
      key: 'sales',
      label: 'Sales',
      kind: 'item',
      amount: r.sales.total_amount,
      details: `${r.sales.count} invoices`,
    },
    {
      key: 'sales-returns',
      label: 'Sales Return / Credit Notes',
      kind: 'item',
      amount: r.sales_returns.total_amount,
      negative: true,
      details: `${r.sales_returns.count} returns/notes`,
    },
    { key: 'net-sales', label: 'Net Sales', kind: 'subtotal', amount: netSales },
    {
      key: 'opening-stock',
      label: 'Opening Stock',
      kind: 'item',
      amount: r.opening_stock,
      details: `${r.opening_stock_qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} units`,
    },
    {
      key: 'purchases',
      label: 'Purchases',
      kind: 'item',
      amount: r.purchases.total_amount,
      details: `${r.purchases.count} bills`,
    },
    {
      key: 'purchase-returns',
      label: 'Purchase Return / Debit Notes',
      kind: 'item',
      amount: r.purchase_returns.total_amount,
      negative: true,
      details: `${r.purchase_returns.count} returns/notes`,
    },
    { key: 'net-purchases', label: 'Net Purchases', kind: 'subtotal', amount: netPurchases },
    {
      key: 'closing-stock',
      label: 'Closing Stock',
      kind: 'item',
      amount: r.closing_stock,
      details: `${r.closing_stock_qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} units`,
    },
    { key: 'gross-profit', label: 'Gross Profit', kind: 'total', amount: r.gross_profit },
    { key: 'sec-pl', label: 'Profit & Loss', kind: 'section' },
    {
      key: 'other-income',
      label: 'Other Income',
      kind: 'item',
      amount: r.other_income.total_amount,
      details: `${r.other_income.count} postings`,
    },
    ...(r.other_income_lines ?? []).map((l) => ({
      key: `oi-${l.name}`,
      label: l.name,
      kind: 'detail' as const,
      amount: l.amount,
      details: `${l.count} postings`,
    })),
    {
      key: 'expenses',
      label: 'Expenses',
      kind: 'item',
      amount: r.expenses.total_amount,
      negative: true,
      details: `${r.expenses.count} expenses`,
    },
    { key: 'net-profit', label: 'Net Profit', kind: 'total', amount: r.net_profit },
  ]
  return rows
}

export default function ProfitLossReportPage() {
  const [period, setPeriod] = useState<PeriodicReportPeriod>('monthly')
  const [periodAnchor, setPeriodAnchor] = useState(todayISO)
  const [customStart, setCustomStart] = useState(monthStartISO())
  const [customEnd, setCustomEnd] = useState(todayISO)
  const [report, setReport] = useState<ProfitLossReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generateReport = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProfitLossReport({
        period,
        date: periodAnchor,
        startDate: customStart,
        endDate: customEnd,
      })
      setReport(data)
    } catch (err) {
      setReport(null)
      notifyError(err instanceof Error ? err.message : 'Failed to generate profit & loss report')
    } finally {
      setLoading(false)
      setGenerated(true)
    }
  }, [period, periodAnchor, customStart, customEnd])

  useEffect(() => {
    void generateReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shareText = report ? buildProfitLossShareText(report) : ''

  const copyText = async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      notifySuccess('Report copied to clipboard')
    } catch {
      notifyError('Could not copy report')
    }
  }

  const shareTextContent = async (text: string, title: string) => {
    if (!text) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    await copyText(text)
  }

  const exportParams = {
    period,
    date: periodAnchor,
    startDate: customStart,
    endDate: customEnd,
  }

  const rows = report ? statementRows(report) : []
  const netSales = report ? report.sales.total_amount - report.sales_returns.total_amount : 0

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Profit &amp; Loss Report</h1>
          </div>
          <Link
            href="/reports/daily"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Business reports
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report period</CardTitle>
            <p className="text-sm text-muted-foreground">
              Profit &amp; loss statement for a day, week, month, year, or custom date range.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select
                  value={period}
                  onValueChange={(value) => setPeriod(value as PeriodicReportPeriod)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODIC_REPORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {period !== 'custom' ? (
                <div className="space-y-1.5">
                  <Label>
                    {period === 'daily'
                      ? 'Date'
                      : period === 'weekly'
                        ? 'Any day in week'
                        : period === 'monthly'
                          ? 'Any day in month'
                          : 'Any day in year'}
                  </Label>
                  <input
                    type="date"
                    value={periodAnchor}
                    onChange={(e) => setPeriodAnchor(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Start date</Label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End date</Label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={() => void generateReport()}
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  {loading ? 'Generating…' : 'Generate report'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-lg">
                  {report?.business_name || 'Business'}
                  {report?.label ? ` · ${report.label}` : ''}
                </CardTitle>
                {report && (
                  <p className="text-xs text-muted-foreground">
                    {report.start_date} → {report.end_date}
                  </p>
                )}
              </div>
            </div>
            {report && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void shareTextContent(
                      shareText,
                      report.business_name
                        ? `Profit & Loss — ${report.business_name}`
                        : 'Profit & Loss Report'
                    )
                  }
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(shareText)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        void downloadProfitLossExcel(exportParams)
                          .then(() => notifySuccess('Excel exported'))
                          .catch((err) =>
                            notifyError(err instanceof Error ? err.message : 'Excel export failed')
                          )
                      }
                    >
                      Download Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        void downloadProfitLossPdf(exportParams)
                          .then(() => notifySuccess('PDF exported'))
                          .catch((err) =>
                            notifyError(err instanceof Error ? err.message : 'PDF export failed')
                          )
                      }
                    >
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : report ? (
              <>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryStat
                    tone="brand"
                    icon={TrendingUp}
                    label="Net sales"
                    value={formatCurrency(netSales)}
                    hint={`${report.sales.count} invoices − ${report.sales_returns.count} returns/notes`}
                  />
                  <SummaryStat
                    tone={(report.gross_profit ?? 0) >= 0 ? 'success' : 'danger'}
                    icon={Package}
                    label="Gross profit"
                    value={formatCurrency(report.gross_profit)}
                    hint="Net sales + closing stock − opening stock"
                  />
                  <SummaryStat
                    tone="warning"
                    icon={Wallet}
                    label="Total expenses"
                    value={formatCurrency(report.expenses.total_amount)}
                    hint={`${report.expenses.count} expenses`}
                  />
                  <SummaryStat
                    tone={(report.net_profit ?? 0) >= 0 ? 'success' : 'danger'}
                    icon={CircleDollarSign}
                    label="Net profit"
                    value={formatCurrency(report.net_profit)}
                    hint="Gross profit + other income − expenses"
                  />
                </div>

                <div className="table-scroll rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Particulars</th>
                        <th className="px-4 py-3 font-medium text-right">Details</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        if (row.kind === 'section') {
                          return (
                            <tr key={row.key} className="border-t bg-blue-50">
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-900"
                              >
                                {row.label}
                              </td>
                            </tr>
                          )
                        }
                        const amount = row.negative ? -(row.amount ?? 0) : (row.amount ?? 0)
                        return (
                          <tr
                            key={row.key}
                            className={cn(
                              'border-t',
                              (row.kind === 'subtotal' || row.kind === 'total') && 'bg-gray-50'
                            )}
                          >
                            <td
                              className={cn(
                                'px-4 py-3 text-gray-900',
                                row.kind === 'detail' && 'pl-8 text-xs text-gray-600',
                                row.kind === 'item' && 'font-medium',
                                (row.kind === 'subtotal' || row.kind === 'total') && 'font-semibold'
                              )}
                            >
                              {row.negative && row.kind !== 'detail' ? `(−) ${row.label}` : row.label}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-500">
                              {row.details ?? ''}
                            </td>
                            <td
                              className={cn(
                                'px-4 py-3 text-right',
                                row.kind === 'detail' && 'text-xs text-gray-600',
                                (row.kind === 'subtotal' || row.kind === 'item') &&
                                  'font-semibold text-gray-900',
                                row.kind === 'total' &&
                                  (amount >= 0
                                    ? 'font-bold text-emerald-700'
                                    : 'font-bold text-red-700')
                              )}
                            >
                              {formatCurrency(amount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-gray-500">
                  Gross profit = net sales + closing stock − opening stock. Net
                  profit = gross profit + other income − expenses. Opening and
                  closing stock are valued at weighted average cost replayed from the stock ledger.
                  Other income comes from non-sales ledger postings (e.g. manual
                  journal entries); cancelled documents are excluded from counts.
                </p>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-gray-500">
                {generated
                  ? 'No report data for this period.'
                  : 'Choose a period and click Generate report to view results.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
