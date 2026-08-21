import { formatCurrency } from '@/lib/utils'
import { downloadBlob, downloadJson } from '@/lib/accountingExport'
import { apiFetch } from '@/hooks/useAuth'

export interface DailyReportMetric {
  total_amount: number
  count: number
}

export interface PaymentMethodTotal {
  method: string
  label: string
  in: DailyReportMetric
  out: DailyReportMetric
}

export interface ExpenseLine {
  id: string
  item_id?: string
  expense_number: string
  category: string
  description: string
  item_description: string
  vendor: string
  quantity: number
  unit_price: number
  amount: number
  payment_mode: string
  date: string
  with_gst: boolean
  tax_total: number
  sub_total: number
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
  expense_lines?: ExpenseLine[]
  payments_by_method?: PaymentMethodTotal[]
  accounts_payable: DailyReportMetric
  accounts_payable_total: number
  gst_collected: number
  net_cash_flow: number
  daily_profit: number
  product_profit: number
  loyalty?: LoyaltyReportSummary
}

export interface LoyaltyReportSummary {
  enabled: boolean
  points_earned: number
  points_redeemed: number
  earn_transactions: number
  redeem_transactions: number
  redemption_value: number
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

const metricRows: { key: keyof DailyReport; label: string; help: string }[] = [
  {
    key: 'sales',
    label: 'Sales (Invoices)',
    help: 'Total of all non-cancelled sales invoices dated in this period, including unpaid amounts.',
  },
  {
    key: 'purchases',
    label: 'Purchase Expense',
    help: 'Full purchase bill totals dated in this period, whether paid or still outstanding.',
  },
  {
    key: 'payments_out',
    label: 'Payment Out',
    help: 'Cash actually paid to vendors in this period. This is money leaving the business, not the full bill amount.',
  },
  {
    key: 'accounts_payable',
    label: 'Accounts Payable (period)',
    help: 'Unpaid balance on purchase bills dated in this period (bill total minus amount already paid).',
  },
  {
    key: 'credit_notes',
    label: 'Credit Notes',
    help: 'Credit notes issued to customers in this period. These reduce net sales.',
  },
  {
    key: 'debit_notes',
    label: 'Debit Notes',
    help: 'Debit notes issued to vendors in this period. These reduce net purchases.',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    help: 'Operating expenses recorded in this period, such as rent or utilities. Purchase bills are counted separately.',
  },
  {
    key: 'payments_in',
    label: 'Payments Received',
    help: 'Cash actually received from customers in this period, including invoice and POS payments.',
  },
  {
    key: 'sales_returns',
    label: 'Sales Returns',
    help: 'Goods returned by customers in this period. These reduce net sales.',
  },
  {
    key: 'purchase_returns',
    label: 'Purchase Returns',
    help: 'Goods returned to vendors in this period. These reduce net purchases.',
  },
]

export const dailyReportSummaryHelp: Record<string, string> = {
  accounts_payable_total:
    'Unpaid vendor balance across all open purchase bills, not only bills from this period.',
  gst_collected: 'GST collected on sales invoices in this period.',
  daily_profit:
    'Accrual profit for this period: sales − purchases − expenses ± returns and notes. This is not cash in hand.',
  product_profit:
    'Gross margin on items sold: taxable sale value minus product purchase cost, net of sales returns and credit notes.',
  net_cash_flow:
    'Cash movement for this period: payments received − payment out − expenses.',
  loyalty_points_earned:
    'Loyalty points credited to customers from sales in this period (earn transactions).',
  loyalty_points_redeemed:
    'Loyalty points customers redeemed against bills in this period. Redemption value is the ₹ discount granted.',
}

function isMetric(value: unknown): value is DailyReportMetric {
  return (
    typeof value === 'object' &&
    value !== null &&
    'total_amount' in value &&
    'count' in value
  )
}

function methodHasActivity(row: PaymentMethodTotal) {
  return (
    row.in.count > 0 ||
    row.out.count > 0 ||
    row.in.total_amount !== 0 ||
    row.out.total_amount !== 0
  )
}

export function paymentMethodsForReport(report: DailyReport): PaymentMethodTotal[] {
  return report.payments_by_method ?? []
}

function appendPaymentMethodSection(lines: string[], report: DailyReport) {
  const methods = paymentMethodsForReport(report).filter(methodHasActivity)
  if (methods.length === 0) return
  lines.push('', 'Payments by method', '-------------------')
  for (const row of methods) {
    lines.push(
      `${row.label}: received ${row.in.count} txn · ${formatCurrency(row.in.total_amount)} · paid ${row.out.count} txn · ${formatCurrency(row.out.total_amount)}`
    )
  }
}

function appendExpenseLinesSection(lines: string[], report: DailyReport) {
  const expenses = report.expense_lines ?? []
  if (expenses.length === 0) return
  lines.push('', 'Expenses (per item)', '--------')
  for (const e of expenses) {
    const vendor = e.vendor || '-'
    const mode = e.payment_mode || '-'
    const item = e.item_description || e.description || '-'
    lines.push(
      `${e.expense_number} · ${e.date} · ${e.category || '-'} · ${item} · qty ${e.quantity} @ ${formatCurrency(e.unit_price)} · ${vendor} · ${mode} · ${formatCurrency(e.amount)}`
    )
  }
  lines.push(`Total expenses: ${formatCurrency(report.expenses.total_amount)}`)
}

function appendLoyaltySection(lines: string[], report: DailyReport) {
  const loyalty = report.loyalty
  if (!loyalty || !loyalty.enabled) return
  if (loyalty.points_earned === 0 && loyalty.points_redeemed === 0) return
  lines.push('', 'Loyalty points', '--------')
  lines.push(
    `Points earned: ${loyalty.earn_transactions} txn · ${loyalty.points_earned.toLocaleString()} pts`
  )
  lines.push(
    `Points redeemed: ${loyalty.redeem_transactions} txn · ${loyalty.points_redeemed.toLocaleString()} pts · ${formatCurrency(loyalty.redemption_value)} discount`
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

  appendPaymentMethodSection(lines, report)
  appendExpenseLinesSection(lines, report)
  appendLoyaltySection(lines, report)

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

  appendPaymentMethodSection(lines, report)
  appendExpenseLinesSection(lines, report)
  appendLoyaltySection(lines, report)

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
