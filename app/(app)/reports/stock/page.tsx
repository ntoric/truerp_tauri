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
import { fetchStockReport, type StockReport } from '@/lib/stockReport'
import type { PeriodicReportPeriod } from '@/lib/dailyReport'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  CalendarRange,
  RefreshCw,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Warehouse,
  TrendingUp,
} from 'lucide-react'

type StockPreset =
  | 'today'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom'

const STOCK_PRESET_OPTIONS: { value: StockPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom range' },
]

function localISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayISO() {
  return localISO(new Date())
}

function monthStartISO(date = todayISO()) {
  return `${date.slice(0, 7)}-01`
}

/** Maps a preset to the shared period + anchor params the backend resolves. */
function presetToParams(
  preset: StockPreset,
  customStart: string,
  customEnd: string
): { period: PeriodicReportPeriod; date: string; startDate?: string; endDate?: string } {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { period: 'daily', date: localISO(now) }
    case 'this_week':
      return { period: 'weekly', date: localISO(now) }
    case 'last_week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { period: 'weekly', date: localISO(d) }
    }
    case 'this_month':
      return { period: 'monthly', date: localISO(now) }
    case 'last_month':
      return { period: 'monthly', date: localISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)) }
    case 'this_year':
      return { period: 'yearly', date: localISO(now) }
    case 'last_year':
      return { period: 'yearly', date: localISO(new Date(now.getFullYear() - 1, 0, 1)) }
    case 'custom':
      return {
        period: 'custom',
        date: customStart || localISO(now),
        startDate: customStart,
        endDate: customEnd,
      }
  }
}

function formatQty(qty: number, unit?: string) {
  const formatted = qty.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return unit ? `${formatted} ${unit}` : formatted
}

export default function StockReportPage() {
  const [preset, setPreset] = useState<StockPreset>('this_month')
  const [customStart, setCustomStart] = useState(monthStartISO())
  const [customEnd, setCustomEnd] = useState(todayISO)
  const [report, setReport] = useState<StockReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generateReport = useCallback(
    async (p: StockPreset, start: string, end: string) => {
      setLoading(true)
      try {
        const data = await fetchStockReport(presetToParams(p, start, end))
        setReport(data)
      } catch (err) {
        setReport(null)
        notifyError(err instanceof Error ? err.message : 'Failed to generate stock report')
      } finally {
        setLoading(false)
        setGenerated(true)
      }
    },
    []
  )

  useEffect(() => {
    void generateReport('this_month', monthStartISO(), todayISO())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPresetChange = (value: StockPreset) => {
    setPreset(value)
    if (value !== 'custom') {
      void generateReport(value, customStart, customEnd)
    }
  }

  const linesPagination = usePagination(report?.lines ?? [])
  const lines = linesPagination.paginatedItems

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Stock Report</h1>
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
              Opening and closing stock for a day, week, month, year, or custom date range.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={preset} onValueChange={(value) => onPresetChange(value as StockPreset)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_PRESET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {preset === 'custom' && (
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
                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full gap-2"
                      onClick={() => void generateReport(preset, customStart, customEnd)}
                      disabled={loading}
                    >
                      <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                      {loading ? 'Generating…' : 'Generate report'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
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
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : report ? (
              <>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <SummaryStat
                    tone="brand"
                    icon={Package}
                    label="Opening stock"
                    value={formatCurrency(report.opening_stock)}
                    hint={`${formatQty(report.opening_stock_qty)} units`}
                  />
                  <SummaryStat
                    tone="success"
                    icon={ArrowDownToLine}
                    label="Stock in"
                    value={formatQty(report.in_qty)}
                    hint="units added in period"
                  />
                  <SummaryStat
                    tone="warning"
                    icon={ArrowUpFromLine}
                    label="Stock out"
                    value={formatQty(report.out_qty)}
                    hint="units removed in period"
                  />
                  <SummaryStat
                    tone="brand"
                    icon={Warehouse}
                    label="Closing stock"
                    value={formatCurrency(report.closing_stock)}
                    hint={`${formatQty(report.closing_stock_qty)} units`}
                  />
                  <SummaryStat
                    tone={(report.stock_change ?? 0) >= 0 ? 'success' : 'danger'}
                    icon={TrendingUp}
                    label="Net change"
                    value={formatCurrency(report.stock_change)}
                    hint={`${report.stock_change_qty >= 0 ? '+' : ''}${formatQty(report.stock_change_qty)} units`}
                  />
                </div>

                {lines.length > 0 ? (
                  <>
                    <div className="table-scroll rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                          <tr>
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 font-medium text-right">Opening Qty</th>
                            <th className="px-4 py-3 font-medium text-right">Opening Value</th>
                            <th className="px-4 py-3 font-medium text-right">In</th>
                            <th className="px-4 py-3 font-medium text-right">Out</th>
                            <th className="px-4 py-3 font-medium text-right">Closing Qty</th>
                            <th className="px-4 py-3 font-medium text-right">Closing Value</th>
                            <th className="px-4 py-3 font-medium text-right">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.product_id} className="border-t">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{line.product_name}</div>
                                <div className="text-xs text-gray-500">
                                  {[line.sku, line.category].filter(Boolean).join(' · ')}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {formatQty(line.opening_qty, line.unit)}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {formatCurrency(line.opening_value)}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700">
                                {line.in_qty > 0 ? `+${formatQty(line.in_qty)}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right text-red-700">
                                {line.out_qty > 0 ? `−${formatQty(line.out_qty)}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">
                                {formatQty(line.closing_qty, line.unit)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">
                                {formatCurrency(line.closing_value)}
                              </td>
                              <td
                                className={cn(
                                  'px-4 py-3 text-right font-semibold',
                                  line.change_value >= 0 ? 'text-emerald-700' : 'text-red-700'
                                )}
                              >
                                {formatCurrency(line.change_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControls
                      page={linesPagination.page}
                      totalPages={linesPagination.totalPages}
                      totalItems={linesPagination.totalItems}
                      pageSize={linesPagination.pageSize}
                      onPageChange={linesPagination.setPage}
                    />
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-gray-500">
                    No stock movement or holdings found for this period.
                  </p>
                )}

                <p className="mt-4 text-xs text-gray-500">
                  Opening stock is valued at the close of the day before the period starts;
                  closing stock at the period end. Quantities and values are replayed from
                  approved stock ledger entries at weighted average cost (purchase, opening
                  and adjustment entries); products without costed inflows fall back to the
                  product purchase price.
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
