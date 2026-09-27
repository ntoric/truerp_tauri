import { formatCurrency } from '@/lib/utils'
import { downloadBlob } from '@/lib/accountingExport'
import { apiFetch } from '@/hooks/useAuth'
import {
  buildPeriodicReportQuery,
  type DailyReportMetric,
  type ExpenseLine,
  type PeriodicReportPeriod,
} from '@/lib/dailyReport'

export interface ProfitLossLine {
  name: string
  amount: number
  count: number
}

export interface ProfitLossReport {
  business_name: string
  period: PeriodicReportPeriod
  start_date: string
  end_date: string
  label: string
  sales: DailyReportMetric
  sales_returns: DailyReportMetric
  purchases: DailyReportMetric
  purchase_returns: DailyReportMetric
  opening_stock_qty: number
  opening_stock: number
  closing_stock_qty: number
  closing_stock: number
  gross_profit: number
  other_income: DailyReportMetric
  indirect_expenses: DailyReportMetric
  expenses: DailyReportMetric
  net_profit: number
  other_income_lines?: ProfitLossLine[]
  indirect_expense_lines?: ProfitLossLine[]
  expense_lines?: ExpenseLine[]
}

export type ProfitLossParams = {
  period: PeriodicReportPeriod
  date: string
  startDate?: string
  endDate?: string
}

export async function fetchProfitLossReport(
  params: ProfitLossParams
): Promise<ProfitLossReport> {
  const qs = buildPeriodicReportQuery(params)
  const res = await apiFetch(`/dashboard/profit-loss-report?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load profit & loss report')
  }
  return res.json()
}

async function downloadProfitLossFile(
  params: ProfitLossParams,
  kind: 'excel' | 'pdf'
) {
  const qs = buildPeriodicReportQuery(params)
  const res = await apiFetch(`/dashboard/profit-loss-report/${kind}?${qs}`)
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
    `profit_loss_${params.period}_${params.startDate ?? params.date}_${params.endDate ?? params.date}.${ext}`,
    blob,
    { label: `Exporting profit & loss ${ext.toUpperCase()}` }
  )
}

export function downloadProfitLossExcel(params: ProfitLossParams) {
  return downloadProfitLossFile(params, 'excel')
}

export function downloadProfitLossPdf(params: ProfitLossParams) {
  return downloadProfitLossFile(params, 'pdf')
}

export function buildProfitLossShareText(report: ProfitLossReport): string {
  const title = report.business_name
    ? `Profit & Loss — ${report.business_name}`
    : 'Profit & Loss Report'
  const netSales = report.sales.total_amount - report.sales_returns.total_amount
  const netPurchases = report.purchases.total_amount - report.purchase_returns.total_amount

  const lines = [
    title,
    report.label || `${report.start_date} to ${report.end_date}`,
    `Range: ${report.start_date} → ${report.end_date}`,
    '',
    'Trading Account',
    '---------------',
    `Sales: ${report.sales.count} txn · ${formatCurrency(report.sales.total_amount)}`,
    `Less: Sales Return / Credit Notes: ${report.sales_returns.count} txn · ${formatCurrency(report.sales_returns.total_amount)}`,
    `Net Sales: ${formatCurrency(netSales)}`,
    `Opening Stock: ${formatCurrency(report.opening_stock)}`,
    `Purchases: ${report.purchases.count} txn · ${formatCurrency(report.purchases.total_amount)}`,
    `Less: Purchase Return / Debit Notes: ${report.purchase_returns.count} txn · ${formatCurrency(report.purchase_returns.total_amount)}`,
    `Net Purchases: ${formatCurrency(netPurchases)}`,
    `Closing Stock: ${formatCurrency(report.closing_stock)}`,
    `Gross Profit: ${formatCurrency(report.gross_profit)}`,
    '',
    'Profit & Loss',
    '-------------',
    `Other Income: ${formatCurrency(report.other_income.total_amount)}`,
  ]

  for (const line of report.other_income_lines ?? []) {
    lines.push(`  ${line.name}: ${formatCurrency(line.amount)}`)
  }
  lines.push(
    `Indirect Expenses: ${formatCurrency(report.indirect_expenses.total_amount)}`
  )
  for (const line of report.indirect_expense_lines ?? []) {
    lines.push(`  ${line.name}: ${formatCurrency(line.amount)}`)
  }
  lines.push(
    `Expenses: ${report.expenses.count} txn · ${formatCurrency(report.expenses.total_amount)}`,
    `Net Profit: ${formatCurrency(report.net_profit)}`,
    '',
    'Generated from TruERP'
  )

  return lines.join('\n')
}
