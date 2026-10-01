import { formatCurrency } from '@/lib/utils'
import { downloadBlob } from '@/lib/accountingExport'
import { apiFetch } from '@/hooks/useAuth'
import { buildPeriodicReportQuery, type PeriodicReportPeriod } from '@/lib/dailyReport'

export interface DailyProfitRow {
  date: string
  opening_stock: number
  sales: number
  cogs: number
  sales_return: number
  sales_profit: number
  purchase: number
  purchase_return: number
  closing_stock: number
  gross_profit: number
  expenses: number
  net_profit: number
}

export interface DailyProfitReport {
  business_name: string
  period: PeriodicReportPeriod
  start_date: string
  end_date: string
  label: string
  page: number
  per_page: number
  total_days: number
  rows: DailyProfitRow[]
  totals: DailyProfitRow
  /** True when rows come from the cron-maintained materialized table. */
  async_mode?: boolean
}

export type DailyProfitSort = 'asc' | 'desc'

export type DailyProfitParams = {
  period: PeriodicReportPeriod
  date: string
  startDate?: string
  endDate?: string
  page?: number
  perPage?: number
  sort?: DailyProfitSort
}

function buildDailyProfitQuery(params: DailyProfitParams) {
  const qs = new URLSearchParams(buildPeriodicReportQuery(params))
  if (params.page) qs.set('page', String(params.page))
  if (params.perPage) qs.set('per_page', String(params.perPage))
  if (params.sort) qs.set('sort', params.sort)
  return qs.toString()
}

export async function fetchDailyProfitReport(
  params: DailyProfitParams
): Promise<DailyProfitReport> {
  const qs = buildDailyProfitQuery(params)
  const res = await apiFetch(`/dashboard/daily-profit-report?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load daily profit report')
  }
  return res.json()
}

async function downloadDailyProfitFile(
  params: DailyProfitParams,
  kind: 'excel' | 'pdf'
) {
  // Exports cover the full period, not the current page.
  const { page: _page, perPage: _perPage, ...rest } = params
  const qs = buildDailyProfitQuery(rest)
  const res = await apiFetch(`/dashboard/daily-profit-report/${kind}?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error ||
        `Failed to export ${kind === 'excel' ? 'Excel' : 'PDF'}`
    )
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('Export was empty')
  }
  const ext = kind === 'excel' ? 'xlsx' : 'pdf'
  await downloadBlob(
    `daily_profit_${params.period}_${params.startDate ?? params.date}_${params.endDate ?? params.date}.${ext}`,
    blob,
    { label: `Exporting daily profit ${ext.toUpperCase()}` }
  )
}

export function downloadDailyProfitExcel(params: DailyProfitParams) {
  return downloadDailyProfitFile(params, 'excel')
}

export function downloadDailyProfitPdf(params: DailyProfitParams) {
  return downloadDailyProfitFile(params, 'pdf')
}

/**
 * Schedule a priority recompute of one day (or a range) in the materialized
 * daily-profit table. The worker runs it immediately inside one transaction.
 */
export async function refreshDailyProfit(params: {
  date?: string
  startDate?: string
  endDate?: string
}): Promise<DailyProfitRow[]> {
  const res = await apiFetch('/dashboard/daily-profit-report/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: params.date,
      start_date: params.startDate,
      end_date: params.endDate,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Failed to refresh daily profit')
  }
  return ((data as { rows?: DailyProfitRow[] }).rows ?? []) as DailyProfitRow[]
}

export function buildDailyProfitShareText(report: DailyProfitReport): string {
  const title = report.business_name
    ? `Daily Profit — ${report.business_name}`
    : 'Daily Profit Report'

  const lines = [
    title,
    report.label || `${report.start_date} to ${report.end_date}`,
    `Range: ${report.start_date} → ${report.end_date}`,
    '',
    `Days: ${report.total_days}`,
    `Sales: ${formatCurrency(report.totals.sales)}`,
    `Sales returns: ${formatCurrency(report.totals.sales_return)}`,
    `Purchases: ${formatCurrency(report.totals.purchase)}`,
    `Purchase returns: ${formatCurrency(report.totals.purchase_return)}`,
    `Gross profit: ${formatCurrency(report.totals.gross_profit)}`,
    `Expenses: ${formatCurrency(report.totals.expenses)}`,
    `Net profit: ${formatCurrency(report.totals.net_profit)}`,
    '',
    'Best days by net profit',
    '-----------------------',
  ]

  const top = [...report.rows].sort((a, b) => b.net_profit - a.net_profit).slice(0, 10)
  for (const row of top) {
    lines.push(`${row.date} · net ${formatCurrency(row.net_profit)} · sales ${formatCurrency(row.sales)}`)
  }
  lines.push('', 'Generated from TruERP')

  return lines.join('\n')
}
