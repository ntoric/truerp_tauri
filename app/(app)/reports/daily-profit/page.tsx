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
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PERIODIC_REPORT_OPTIONS, type PeriodicReportPeriod } from '@/lib/dailyReport'
import {
  buildDailyProfitShareText,
  downloadDailyProfitExcel,
  downloadDailyProfitPdf,
  fetchDailyProfitReport,
  refreshDailyProfit,
  type DailyProfitReport,
  type DailyProfitSort,
} from '@/lib/dailyProfitReport'
import { notifyError, notifySuccess } from '@/lib/notify'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  CalendarRange,
  Copy,
  Download,
  RefreshCw,
  Share2,
  TrendingUp,
  Wallet,
  Receipt,
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

const PAGE_SIZE = 25

const SORT_OPTIONS: { value: DailyProfitSort; label: string }[] = [
  { value: 'desc', label: 'Newest first' },
  { value: 'asc', label: 'Oldest first' },
]

export default function DailyProfitReportPage() {
  const [period, setPeriod] = useState<PeriodicReportPeriod>('monthly')
  const [periodAnchor, setPeriodAnchor] = useState(todayISO)
  const [customStart, setCustomStart] = useState(monthStartISO())
  const [customEnd, setCustomEnd] = useState(todayISO)
  const [sort, setSort] = useState<DailyProfitSort>('desc')
  const [page, setPage] = useState(1)
  const [report, setReport] = useState<DailyProfitReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [refreshing, setRefreshing] = useState<string | null>(null)

  const generateReport = useCallback(
    async (pageToLoad = page) => {
      setLoading(true)
      try {
        const data = await fetchDailyProfitReport({
          period,
          date: periodAnchor,
          startDate: customStart,
          endDate: customEnd,
          sort,
          page: pageToLoad,
          perPage: PAGE_SIZE,
        })
        setReport(data)
      } catch (err) {
        setReport(null)
        notifyError(err instanceof Error ? err.message : 'Failed to generate daily profit report')
      } finally {
        setLoading(false)
        setGenerated(true)
      }
    },
    [period, periodAnchor, customStart, customEnd, sort, page]
  )

  useEffect(() => {
    void generateReport(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPageChange = (next: number) => {
    setPage(next)
    void generateReport(next)
  }

  const regenerate = () => {
    setPage(1)
    void generateReport(1)
  }

  const shareText = report ? buildDailyProfitShareText(report) : ''

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
    sort,
  }

  const refreshRows = async (target?: { date?: string; startDate?: string; endDate?: string }) => {
    const key = target?.date ?? 'range'
    setRefreshing(key)
    try {
      await refreshDailyProfit(target ?? {})
      await generateReport(page)
      notifySuccess(target?.date ? `Recalculated ${target.date}` : 'Daily profit recalculated')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to refresh daily profit')
    } finally {
      setRefreshing(null)
    }
  }

  const rows = report?.rows ?? []
  const totals = report?.totals
  const asyncMode = report?.async_mode === true
  const totalDays = report?.total_days ?? 0
  const totalPages = Math.max(1, Math.ceil(totalDays / PAGE_SIZE))

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Daily Profit Report</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reports/profit-loss"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Profit &amp; loss
            </Link>
            <Link
              href="/reports/billwise-profit"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Billwise profit
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report period</CardTitle>
            <p className="text-sm text-muted-foreground">
              Per-day sales, purchases, stock movement and profit for a day, week, month, year, or
              custom date range.
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

              <div className="space-y-1.5">
                <Label>Sort by</Label>
                <Select value={sort} onValueChange={(value) => setSort(value as DailyProfitSort)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={regenerate}
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
                    {report.async_mode && ' · auto-updates every ~2 min'}
                  </p>
                )}
              </div>
            </div>
            {report && (
              <div className="flex flex-wrap items-center gap-2">
                {asyncMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshing !== null}
                    title="Recalculate all days in this range now"
                    onClick={() =>
                      void refreshRows({
                        startDate: report.start_date,
                        endDate: report.end_date,
                      })
                    }
                  >
                    <RefreshCw
                      className={cn('mr-2 h-4 w-4', refreshing === 'range' && 'animate-spin')}
                    />
                    Refresh
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void shareTextContent(
                      shareText,
                      report.business_name
                        ? `Daily Profit — ${report.business_name}`
                        : 'Daily Profit Report'
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
                        void downloadDailyProfitExcel(exportParams)
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
                        void downloadDailyProfitPdf(exportParams)
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
                    icon={Receipt}
                    label="Net sales"
                    value={formatCurrency(totals ? totals.sales - totals.sales_return : 0)}
                    hint={`${formatCurrency(totals?.sales_return ?? 0)} returned · ${totalDays} days`}
                  />
                  <SummaryStat
                    tone="default"
                    icon={Wallet}
                    label="Net purchases"
                    value={formatCurrency(totals ? totals.purchase - totals.purchase_return : 0)}
                    hint={`${formatCurrency(totals?.purchase_return ?? 0)} returned`}
                  />
                  <SummaryStat
                    tone={(totals?.gross_profit ?? 0) >= 0 ? 'success' : 'danger'}
                    icon={TrendingUp}
                    label="Gross profit"
                    value={formatCurrency(totals?.gross_profit ?? 0)}
                    hint={`Closing stock ${formatCurrency(totals?.closing_stock ?? 0)}`}
                  />
                  <SummaryStat
                    tone={(totals?.net_profit ?? 0) >= 0 ? 'success' : 'danger'}
                    icon={TrendingUp}
                    label="Net profit"
                    value={formatCurrency(totals?.net_profit ?? 0)}
                    hint={`${formatCurrency(totals?.expenses ?? 0)} expenses`}
                  />
                </div>

                <div className="table-scroll rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr>
                        <th className="px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium text-right">Opening stock</th>
                        <th className="px-3 py-3 font-medium text-right">Sales</th>
                        <th className="px-3 py-3 font-medium text-right">COGS</th>
                        <th className="px-3 py-3 font-medium text-right">Sales return</th>
                        <th className="px-3 py-3 font-medium text-right">Sales profit</th>
                        <th className="px-3 py-3 font-medium text-right">Purchase</th>
                        <th className="px-3 py-3 font-medium text-right">Purchase return</th>
                        <th className="px-3 py-3 font-medium text-right">Closing stock</th>
                        <th className="px-3 py-3 font-medium text-right">Gross profit</th>
                        <th className="px-3 py-3 font-medium text-right">Expenses</th>
                        <th className="px-3 py-3 font-medium text-right">Net profit</th>
                        {asyncMode && <th className="px-3 py-3 font-medium text-right">Refresh</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.date} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {formatDate(row.date + 'T00:00:00')}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {formatCurrency(row.opening_stock)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-900">
                            {formatCurrency(row.sales)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {formatCurrency(row.cogs)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {row.sales_return ? formatCurrency(row.sales_return) : '—'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 text-right',
                              row.sales_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            )}
                          >
                            {formatCurrency(row.sales_profit)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {formatCurrency(row.purchase)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {row.purchase_return ? formatCurrency(row.purchase_return) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {formatCurrency(row.closing_stock)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 text-right font-semibold',
                              row.gross_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            )}
                          >
                            {formatCurrency(row.gross_profit)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {row.expenses ? formatCurrency(row.expenses) : '—'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 text-right font-semibold',
                              row.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            )}
                          >
                            {formatCurrency(row.net_profit)}
                          </td>
                          {asyncMode && (
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                title={`Recalculate ${row.date}`}
                                disabled={refreshing !== null}
                                onClick={() => void refreshRows({ date: row.date })}
                                className="text-gray-400 transition-colors hover:text-blue-600 disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={cn(
                                    'inline h-3.5 w-3.5',
                                    refreshing === row.date && 'animate-spin'
                                  )}
                                />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {totals && (
                      <tfoot className="border-t-2 bg-gray-50 font-semibold text-gray-900">
                        <tr>
                          <td className="px-3 py-2.5">Total</td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.opening_stock)}
                          </td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(totals.sales)}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(totals.cogs)}</td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.sales_return)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.sales_profit)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.purchase)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.purchase_return)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.closing_stock)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.gross_profit)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.expenses)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {formatCurrency(totals.net_profit)}
                          </td>
                          {asyncMode && <td className="px-3 py-2.5" />}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <PaginationControls
                  page={report.page}
                  totalPages={totalPages}
                  totalItems={totalDays}
                  pageSize={PAGE_SIZE}
                  onPageChange={onPageChange}
                />
              </>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-gray-500">
                <CalendarRange className="h-8 w-8 text-gray-300" />
                {generated ? 'No report data' : 'Choose a period and generate the report'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
