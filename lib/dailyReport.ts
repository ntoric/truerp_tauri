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
}

const metricRows: { key: keyof DailyReport; label: string }[] = [
  { key: 'sales', label: 'Sales (Invoices)' },
  { key: 'purchases', label: 'Purchase Expense' },
  { key: 'payments_out', label: 'Payment Out' },
  { key: 'accounts_payable', label: 'Accounts Payable (today)' },
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
    `Accounts Payable (total outstanding): ${formatCurrency(report.accounts_payable_total || 0)}`,
    `GST Collected: ${formatCurrency(report.gst_collected)}`,
    `Net Cash Flow: ${formatCurrency(report.net_cash_flow)}`,
    '',
    'Note: Purchase expense = full bill total; Payment out = amount paid; AP = unpaid balance.',
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

export const dailyReportSections = metricRows
