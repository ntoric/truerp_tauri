'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  buildBillwiseProfitShareText,
  downloadBillwiseProfitExcel,
  downloadBillwiseProfitPdf,
  fetchBillwiseProfitReport,
  type BillwiseProfitReport,
  type BillwiseProfitSort,
} from '@/lib/billwiseProfitReport'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Receipt,
  RefreshCw,
  Search,
  Share2,
  TrendingUp,
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

const SORT_OPTIONS: { value: BillwiseProfitSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'profit_desc', label: 'Highest profit' },
  { value: 'profit_asc', label: 'Lowest profit' },
  { value: 'sale_desc', label: 'Highest bill value' },
]

export default function BillwiseProfitReportPage() {
  const [period, setPeriod] = useState<PeriodicReportPeriod>('monthly')
  const [periodAnchor, setPeriodAnchor] = useState(todayISO)
  const [customStart, setCustomStart] = useState(monthStartISO())
  const [customEnd, setCustomEnd] = useState(todayISO)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<BillwiseProfitSort>('newest')
  const [report, setReport] = useState<BillwiseProfitReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const generateReport = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBillwiseProfitReport({
        period,
        date: periodAnchor,
        startDate: customStart,
        endDate: customEnd,
        search,
        sort,
      })
      setReport(data)
    } catch (err) {
      setReport(null)
      notifyError(err instanceof Error ? err.message : 'Failed to generate billwise profit report')
    } finally {
      setLoading(false)
      setGenerated(true)
    }
  }, [period, periodAnchor, customStart, customEnd, search, sort])

  useEffect(() => {
    void generateReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shareText = report ? buildBillwiseProfitShareText(report) : ''

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
    search,
    sort,
  }

  const billsPagination = usePagination(report?.bills ?? [])
  const bills = billsPagination.paginatedItems

  const toggleExpanded = (invoiceId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(invoiceId)) next.delete(invoiceId)
      else next.add(invoiceId)
      return next
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Billwise Profit Report</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reports/profit-loss"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Profit &amp; loss
            </Link>
            <Link
              href="/reports/daily"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Business reports
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report period</CardTitle>
            <p className="text-sm text-muted-foreground">
              Profit earned on each sales bill for a day, week, month, year, or custom date range.
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="billwise-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="billwise-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void generateReport()
                    }}
                    placeholder="Invoice number or party name"
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Sort by</Label>
                <Select value={sort} onValueChange={(value) => setSort(value as BillwiseProfitSort)}>
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
                        ? `Billwise Profit — ${report.business_name}`
                        : 'Billwise Profit Report'
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
                        void downloadBillwiseProfitExcel(exportParams)
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
                        void downloadBillwiseProfitPdf(exportParams)
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
                    label="Bills"
                    value={report.bill_count.toLocaleString()}
                    hint={`${report.start_date} → ${report.end_date}`}
                  />
                  <SummaryStat
                    tone="default"
                    icon={TrendingUp}
                    label="Sale value"
                    value={formatCurrency(report.sale_amount)}
                    hint={`${formatCurrency(report.returns_amount)} returned · ${formatCurrency(report.discount)} bill discount`}
                  />
                  <SummaryStat
                    tone="warning"
                    icon={Wallet}
                    label="Purchase cost"
                    value={formatCurrency(report.cost_amount)}
                    hint="Cost of items billed at purchase price"
                  />
                  <SummaryStat
                    tone={(report.profit ?? 0) >= 0 ? 'success' : 'danger'}
                    icon={TrendingUp}
                    label="Profit"
                    value={formatCurrency(report.profit)}
                    hint={`${report.margin_pct.toFixed(1)}% margin`}
                  />
                </div>

                <div className="table-scroll rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr>
                        <th className="w-8 px-2 py-3" />
                        <th className="px-4 py-3 font-medium">Invoice</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Party</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Bill total</th>
                        <th className="px-4 py-3 font-medium text-right">Sale value</th>
                        <th className="px-4 py-3 font-medium text-right">Returns</th>
                        <th className="px-4 py-3 font-medium text-right">Cost</th>
                        <th className="px-4 py-3 font-medium text-right">Profit</th>
                        <th className="px-4 py-3 font-medium text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((bill) => {
                        const isOpen = expanded.has(bill.invoice_id)
                        const items = bill.items ?? []
                        return (
                          <Fragment key={bill.invoice_id}>
                            <tr
                              className={cn('border-t', items.length > 0 && 'cursor-pointer hover:bg-gray-50')}
                              onClick={() => items.length > 0 && toggleExpanded(bill.invoice_id)}
                            >
                              <td className="px-2 py-2.5 text-gray-400">
                                {items.length > 0 &&
                                  (isOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  ))}
                              </td>
                              <td className="px-4 py-2.5 font-medium text-gray-900">
                                {bill.invoice_number}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600">
                                {formatDate(bill.date + 'T00:00:00')}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600">{bill.party_name || '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">
                                  {bill.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-600">
                                {formatCurrency(bill.invoice_total)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-900">
                                {formatCurrency(bill.sale_amount)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-600">
                                {bill.returns_amount ? formatCurrency(bill.returns_amount) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-600">
                                {formatCurrency(bill.cost_amount)}
                              </td>
                              <td
                                className={cn(
                                  'px-4 py-2.5 text-right font-semibold',
                                  bill.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                                )}
                              >
                                {formatCurrency(bill.profit)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-600">
                                {bill.margin_pct.toFixed(1)}%
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-t bg-gray-50/60">
                                <td />
                                <td colSpan={10} className="px-4 py-3">
                                  <table className="w-full text-xs">
                                    <thead className="text-left text-gray-500">
                                      <tr>
                                        <th className="py-1.5 pr-4 font-medium">Item</th>
                                        <th className="py-1.5 pr-4 font-medium text-right">Qty</th>
                                        <th className="py-1.5 pr-4 font-medium text-right">Rate</th>
                                        <th className="py-1.5 pr-4 font-medium text-right">Disc %</th>
                                        <th className="py-1.5 pr-4 font-medium text-right">Cost price</th>
                                        <th className="py-1.5 pr-4 font-medium text-right">Sale value</th>
                                        <th className="py-1.5 font-medium text-right">Profit</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item, idx) => (
                                        <tr key={idx} className="border-t border-gray-200/70">
                                          <td className="py-1.5 pr-4 text-gray-800">
                                            {item.description || '—'}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-600">
                                            {item.quantity.toLocaleString(undefined, {
                                              maximumFractionDigits: 2,
                                            })}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-600">
                                            {formatCurrency(item.unit_price)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-600">
                                            {item.discount_pct ? `${item.discount_pct}%` : '—'}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-600">
                                            {formatCurrency(item.cost_price)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-800">
                                            {formatCurrency(item.sale_amount)}
                                          </td>
                                          <td
                                            className={cn(
                                              'py-1.5 text-right font-medium',
                                              item.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                                            )}
                                          >
                                            {formatCurrency(item.profit)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                      {bills.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">
                            No bills found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {bills.length > 0 && (
                      <tfoot>
                        <tr className="border-t bg-gray-50 font-semibold text-gray-900">
                          <td />
                          <td className="px-4 py-3" colSpan={4}>
                            Total ({report.bill_count} bills)
                          </td>
                          <td className="px-4 py-3 text-right">—</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(report.sale_amount)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(report.returns_amount)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(report.cost_amount)}</td>
                          <td
                            className={cn(
                              'px-4 py-3 text-right',
                              report.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            )}
                          >
                            {formatCurrency(report.profit)}
                          </td>
                          <td className="px-4 py-3 text-right">{report.margin_pct.toFixed(1)}%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <PaginationControls
                  page={billsPagination.page}
                  totalPages={billsPagination.totalPages}
                  totalItems={billsPagination.totalItems}
                  pageSize={billsPagination.pageSize}
                  onPageChange={billsPagination.setPage}
                  className="mt-2"
                />

                <p className="mt-4 text-xs text-gray-500">
                  Profit = taxable sale value − invoice-level discount − purchase cost of items
                  billed, net of sales returns and credit notes raised against the bill. Item cost
                  uses the product&apos;s current purchase price. Cancelled bills are excluded.
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
