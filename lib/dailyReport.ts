import { formatCurrency } from '@/lib/utils'
import { downloadBlob, downloadJson } from '@/lib/accountingExport'
import { apiFetch } from '@/hooks/useAuth'

export interface DailyReportMetric {
  total_amount: number
  count: number
}

export interface DailyReport {
  date: string
  business_name: string
  sales: DailyReportMetric
  purchases: DailyReportMetric
  credit_notes: DailyReportMetric
  debit_notes: DailyReportMetric
  expenses: DailyReportMetric
  payments_in: DailyReportMetric
  payments_out: DailyReportMetric
  sales_returns: DailyReportMetric
  purchase_returns: DailyReportMetric
  accounts_payable: DailyReportMetric
  accounts_payable_total: number
  gst_collected: number
  net_cash_flow: number
  daily_profit: number
  product_profit: number
}

export type PeriodicReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export interface PeriodReport extends DailyReport {
  period: PeriodicReportPeriod
  start_date: string
  end_date: string
  label: string
}

export const PERIODIC_REPORT_OPTIONS: { value: PeriodicReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom range' },
]

const metricRows: { key: keyof DailyReport; label: string }[] = [
  { key: 'sales', label: 'Sales (Invoices)' },
  { key: 'purchases', label: 'Purchase Expense' },
  { key: 'payments_out', label: 'Payment Out' },
  { key: 'accounts_payable', label: 'Accounts Payable (period)' },
  { key: 'credit_notes', label: 'Credit Notes' },
  { key: 'debit_notes', label: 'Debit Notes' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payments_in', label: 'Payments Received' },
  { key: 'sales_returns', label: 'Sales Returns' },
  { key: 'purchase_returns', label: 'Purchase Returns' },
]

function isMetric(value: unknown): value is DailyReportMetric {
  return (
    typeof value === 'object' &&
    value !== null &&
    'total_amount' in value &&
    'count' in value
  )
}

export function buildDailyReportShareText(report: DailyReport, heading = 'Daily Business Report'): string {
  const title = report.business_name
    ? `${heading} — ${report.business_name}`
    : heading

  const lines = [
    title,
    `Date: ${report.date}`,
    '',
    'Summary',
    '-------',
  ]

  for (const row of metricRows) {
    const metric = report[row.key]
    if (isMetric(metric)) {
      lines.push(
        `${row.label}: ${metric.count} txn · ${formatCurrency(metric.total_amount)}`
      )
    }
  }

  lines.push(
    '',
    `Accounts Payable (total outstanding): ${formatCurrency(report.accounts_payable_total || 0)}`,
    `GST Collected: ${formatCurrency(report.gst_collected)}`,
    `Period Profit: ${formatCurrency(report.daily_profit ?? 0)}`,
    `Product Profit: ${formatCurrency(report.product_profit ?? 0)}`,
    `Net Cash Flow: ${formatCurrency(report.net_cash_flow)}`,
    '',
    'Note: Purchase expense = full bill total; Payment out = amount paid; AP = unpaid balance.',
    '',
    'Generated from TruERP'
  )

  return lines.join('\n')
}

export function buildPeriodReportShareText(report: PeriodReport): string {
  const title = report.business_name
    ? `Periodic Report — ${report.business_name}`
    : 'Periodic Business Report'

  const lines = [
    title,
    report.label || `${report.start_date} to ${report.end_date}`,
    `Range: ${report.start_date} → ${report.end_date}`,
    '',
    'Summary',
    '-------',
  ]

  for (const row of metricRows) {
    const metric = report[row.key]
    if (isMetric(metric)) {
      lines.push(
        `${row.label}: ${metric.count} txn · ${formatCurrency(metric.total_amount)}`
      )
    }
  }

  lines.push(
    '',
    `Accounts Payable (total outstanding): ${formatCurrency(report.accounts_payable_total || 0)}`,
    `GST Collected: ${formatCurrency(report.gst_collected)}`,
    `Period Profit: ${formatCurrency(report.daily_profit ?? 0)}`,
    `Product Profit: ${formatCurrency(report.product_profit ?? 0)}`,
    `Net Cash Flow: ${formatCurrency(report.net_cash_flow)}`,
    '',
    'Generated from TruERP'
  )

  return lines.join('\n')
}

export async function downloadDailyReportJson(report: DailyReport) {
  await downloadJson(`daily_report_${report.date}.json`, report, {
    label: 'Exporting daily report',
  })
}

export async function downloadPeriodReportJson(report: PeriodReport) {
  await downloadJson(
    `periodic_report_${report.period}_${report.start_date}_${report.end_date}.json`,
    report,
    { label: 'Exporting periodic report' }
  )
}

export async function downloadDailyReportPdf(date: string) {
  const res = await apiFetch(`/dashboard/daily-report/pdf?date=${date}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to export PDF')
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('PDF was empty')
  }
  await downloadBlob(`daily_report_${date}.pdf`, blob, {
    label: 'Exporting daily report PDF',
  })
}

export function buildPeriodicReportQuery(params: {
  period: PeriodicReportPeriod
  date: string
  startDate?: string
  endDate?: string
}) {
  const qs = new URLSearchParams({
    period: params.period,
    date: params.date,
  })
  if (params.period === 'custom') {
    if (params.startDate) qs.set('start_date', params.startDate)
    if (params.endDate) qs.set('end_date', params.endDate)
  }
  return qs.toString()
}

export async function downloadPeriodReportPdf(params: {
  period: PeriodicReportPeriod
  date: string
  startDate?: string
  endDate?: string
}) {
  const qs = buildPeriodicReportQuery(params)
  const res = await apiFetch(`/dashboard/periodic-report/pdf?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to export PDF')
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('PDF was empty')
  }
  await downloadBlob(`periodic_report_${params.period}.pdf`, blob, {
    label: 'Exporting periodic report PDF',
  })
}

export const dailyReportSections = metricRows
