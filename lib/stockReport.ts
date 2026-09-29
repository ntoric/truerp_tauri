import { apiFetch } from '@/hooks/useAuth'
import { buildPeriodicReportQuery, type PeriodicReportPeriod } from '@/lib/dailyReport'

export interface StockReportLine {
  product_id: string
  product_name: string
  sku: string
  category: string
  unit: string
  opening_qty: number
  opening_value: number
  in_qty: number
  out_qty: number
  closing_qty: number
  closing_value: number
  change_qty: number
  change_value: number
}

export interface StockReport {
  business_name: string
  period: PeriodicReportPeriod
  start_date: string
  end_date: string
  label: string
  opening_stock_qty: number
  opening_stock: number
  in_qty: number
  out_qty: number
  closing_stock_qty: number
  closing_stock: number
  stock_change_qty: number
  stock_change: number
  lines: StockReportLine[]
}

export type StockReportParams = {
  period: PeriodicReportPeriod
  date: string
  startDate?: string
  endDate?: string
}

export async function fetchStockReport(params: StockReportParams): Promise<StockReport> {
  const qs = buildPeriodicReportQuery(params)
  const res = await apiFetch(`/dashboard/stock-report?${qs}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load stock report')
  }
  return res.json()
}
