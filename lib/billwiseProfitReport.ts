import { formatCurrency } from '@/lib/utils'
import { downloadBlob } from '@/lib/accountingExport'
import { apiFetch } from '@/hooks/useAuth'
import { buildPeriodicReportQuery, type PeriodicReportPeriod } from '@/lib/dailyReport'

export interface BillwiseProfitItem {
  description: string
  quantity: number
  unit_price: number
  discount_pct: number
  cost_price: number
  sale_amount: number
  cost_amount: number
  profit: number
}

export interface BillwiseProfitBill {
  invoice_id: string
  invoice_number: string
  date: string
  party_id: string
  party_name: string
  status: string
  invoice_total: number
  sale_amount: number
  discount: number
  cost_amount: number
  returns_amount: number
  profit: number
  margin_pct: number
  items?: BillwiseProfitItem[]
}

export interface BillwiseProfitReport {
  business_name: string
  period: PeriodicReportPeriod
  start_date: string
  end_date: string
  label: string
  bill_count: number
  sale_amount: number
  discount: number
  returns_amount: number
  cost_amount: number
  profit: number
  margin_pct: number
  bills: BillwiseProfitBill[]
}

export type BillwiseProfitSort = 'newest' | 'oldest' | 'profit_desc' | 'profit_asc' | 'sale_desc'

export type BillwiseProfitParams = {
  period: PeriodicReportPeriod
  date: string
  startDate?: string
  endDate?: string
  partyId?: string
  search?: string
  sort?: BillwiseProfitSort
}

function buildBillwiseProfitQuery(params: BillwiseProfitParams) {
  const qs = new URLSearchParams(buildPeriodicReportQuery(params))
  if (params.partyId) qs.set('party_id', params.partyId)
  if (params.search?.trim()) qs.set('search', params.search.trim())
  if (params.sort) qs.set('sort', params.sort)
  return qs.toString()
}

export async function fetchBillwiseProfitReport(
  params: BillwiseProfitParams
): Promise<BillwiseProfitReport> {
  const qs = buildBillwiseProfitQuery(params)
  const res = await apiFetch(`/dashboard/billwise-profit-report?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load billwise profit report')
  }
  return res.json()
}

async function downloadBillwiseProfitFile(
  params: BillwiseProfitParams,
  kind: 'excel' | 'pdf'
) {
  const qs = buildBillwiseProfitQuery(params)
  const res = await apiFetch(`/dashboard/billwise-profit-report/${kind}?${qs}`)
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
    `billwise_profit_${params.period}_${params.startDate ?? params.date}_${params.endDate ?? params.date}.${ext}`,
    blob,
    { label: `Exporting billwise profit ${ext.toUpperCase()}` }
  )
}

export function downloadBillwiseProfitExcel(params: BillwiseProfitParams) {
  return downloadBillwiseProfitFile(params, 'excel')
}

export function downloadBillwiseProfitPdf(params: BillwiseProfitParams) {
  return downloadBillwiseProfitFile(params, 'pdf')
}

export function buildBillwiseProfitShareText(report: BillwiseProfitReport): string {
  const title = report.business_name
    ? `Billwise Profit — ${report.business_name}`
    : 'Billwise Profit Report'

  const lines = [
    title,
    report.label || `${report.start_date} to ${report.end_date}`,
    `Range: ${report.start_date} → ${report.end_date}`,
    '',
    `Bills: ${report.bill_count}`,
    `Sale value: ${formatCurrency(report.sale_amount)}`,
    `Returns/Credit notes: ${formatCurrency(report.returns_amount)}`,
    `Purchase cost: ${formatCurrency(report.cost_amount)}`,
    `Profit: ${formatCurrency(report.profit)} (${report.margin_pct.toFixed(1)}% margin)`,
    '',
    'Top bills by profit',
    '--------------------',
  ]

  const top = [...report.bills].sort((a, b) => b.profit - a.profit).slice(0, 10)
  for (const bill of top) {
    lines.push(
      `${bill.invoice_number} · ${bill.date} · ${bill.party_name || '-'} · ${formatCurrency(bill.profit)}`
    )
  }
  lines.push('', 'Generated from TruERP')

  return lines.join('\n')
}
