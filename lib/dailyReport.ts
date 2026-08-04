import { formatCurrency } from '@/lib/utils'

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
  gst_collected: number
  net_cash_flow: number
}

const metricRows: { key: keyof DailyReport; label: string }[] = [
  { key: 'sales', label: 'Sales (Invoices)' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'credit_notes', label: 'Credit Notes' },
  { key: 'debit_notes', label: 'Debit Notes' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payments_in', label: 'Payments Received' },
  { key: 'payments_out', label: 'Payments Made' },
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

export function buildDailyReportShareText(report: DailyReport): string {
  const title = report.business_name
    ? `Daily Report — ${report.business_name}`
    : 'Daily Business Report'

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
    `GST Collected: ${formatCurrency(report.gst_collected)}`,
    `Net Cash Flow: ${formatCurrency(report.net_cash_flow)}`,
    '',
    'Generated from TruERP'
  )

  return lines.join('\n')
}

export function downloadDailyReportJson(report: DailyReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daily_report_${report.date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const dailyReportSections = metricRows
