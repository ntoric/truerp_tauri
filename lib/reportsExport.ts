import { accountingExportDateStamp, downloadCsv, downloadJson, rowsToCsv } from '@/lib/accountingExport'

export const reportsExportDateStamp = accountingExportDateStamp

export function exportReportCsv(baseName: string, rows: (string | number | null | undefined)[][]) {
  downloadCsv(`${baseName}-${reportsExportDateStamp()}`, rows)
}

export function exportReportJson(baseName: string, data: unknown) {
  downloadJson(`${baseName}-${reportsExportDateStamp()}`, data)
}

export function salesReportCsvRows(data: {
  summary: Record<string, unknown>
  series?: { period: string; sales: number; count: number; avg_invoice: number }[] | null
  status_breakdown?: { status: string; count: number; amount: number }[] | null
}) {
  const series = data.series ?? []
  const statusBreakdown = data.status_breakdown ?? []
  const rows: (string | number)[][] = [
    ['Section', 'Metric', 'Value'],
    ['Summary', 'total_sales', data.summary.total_sales as number],
    ['Summary', 'total_invoices', data.summary.total_invoices as number],
    ['Summary', 'avg_invoice_value', data.summary.avg_invoice_value as number],
    ['Summary', 'best_period', String(data.summary.best_period ?? '')],
    ['Summary', 'best_period_sales', data.summary.best_period_sales as number],
    ['Summary', 'growth_vs_prior', String(data.summary.growth_vs_prior ?? '')],
    [],
    ['Period', 'Sales', 'Invoice count', 'Avg invoice'],
    ...series.map((r) => [r.period, r.sales, r.count, r.avg_invoice]),
    [],
    ['Status', 'Count', 'Amount'],
    ...statusBreakdown.map((s) => [s.status, s.count, s.amount]),
  ]
  return rows
}

export function revenueReportCsvRows(data: {
  summary: Record<string, unknown>
  periods?: {
    period: string
    gross: number
    net: number
    tax: number
    invoice_count: number
    avg_invoice: number
  }[] | null
}) {
  const periods = data.periods ?? []
  return [
    ['Metric', 'Value'],
    ['total_gross', data.summary.total_gross as number],
    ['total_net', data.summary.total_net as number],
    ['total_tax', data.summary.total_tax as number],
    ['total_invoices', data.summary.total_invoices as number],
    ['avg_invoice_value', data.summary.avg_invoice_value as number],
    [],
    ['Period', 'Gross', 'Net', 'Tax', 'Invoices', 'Avg invoice'],
    ...periods.map((p) => [
      p.period,
      p.gross,
      p.net,
      p.tax,
      p.invoice_count,
      p.avg_invoice,
    ]),
  ]
}

export function taxReportCsvRows(data: {
  summary: Record<string, unknown>
  months?: {
    month: string
    cgst: number
    sgst: number
    igst: number
    total_tax: number
    total_value: number
  }[] | null
}) {
  const months = data.months ?? []
  return [
    ['Metric', 'Value'],
    ['total_cgst', data.summary.total_cgst as number],
    ['total_sgst', data.summary.total_sgst as number],
    ['total_igst', data.summary.total_igst as number],
    ['total_tax', data.summary.total_tax as number],
    ['taxable_turnover', data.summary.taxable_turnover as number],
    ['effective_tax_rate', data.summary.effective_tax_rate as number],
    [],
    ['Month', 'Turnover', 'CGST', 'SGST', 'IGST', 'Total tax'],
    ...months.map((m) => [
      m.month,
      m.total_value,
      m.cgst,
      m.sgst,
      m.igst,
      m.total_tax,
    ]),
  ]
}

export function profitLossCsvRows(data: {
  total_income: number
  total_expense: number
  net_profit: number
  income?: { account_code: string; account_name: string; amount: number }[]
  expenses?: { account_code: string; account_name: string; amount: number }[]
}) {
  return [
    ['Section', 'Code', 'Account', 'Amount'],
    ['Summary', '', 'Total income', data.total_income],
    ['Summary', '', 'Total expense', data.total_expense],
    ['Summary', '', 'Net profit', data.net_profit],
    [],
    ...(data.income || []).map((a) => ['Income', a.account_code, a.account_name, a.amount]),
    [],
    ...(data.expenses || []).map((a) => ['Expense', a.account_code, a.account_name, a.amount]),
  ]
}

export function outstandingReportCsvRows(data: {
  summary: Record<string, unknown>
  aging?: Record<string, number>
  by_party?: { party_name: string; invoice_count: number; outstanding: number }[] | null
  invoices?: {
    invoice_number: string
    party_name: string
    date: string
    due_date?: string
    status: string
    total_amount: number
    amount_paid: number
    outstanding: number
    days_overdue: number
    aging_bucket: string
  }[] | null
}) {
  const byParty = data.by_party ?? []
  const invoices = data.invoices ?? []
  return [
    ['Metric', 'Value'],
    ['total_outstanding', data.summary.total_outstanding as number],
    ['invoice_count', data.summary.invoice_count as number],
    ['overdue_count', data.summary.overdue_count as number],
    ['avg_days_overdue', data.summary.avg_days_overdue as number],
    [],
    ['Aging bucket', 'Amount'],
    ['current', data.aging?.current ?? 0],
    ['days_1_30', data.aging?.days_1_30 ?? 0],
    ['days_31_60', data.aging?.days_31_60 ?? 0],
    ['days_61_90', data.aging?.days_61_90 ?? 0],
    ['days_90_plus', data.aging?.days_90_plus ?? 0],
    [],
    ['Customer', 'Invoices', 'Outstanding'],
    ...byParty.map((p) => [p.party_name, p.invoice_count, p.outstanding]),
    [],
    [
      'Invoice',
      'Customer',
      'Date',
      'Due date',
      'Status',
      'Total',
      'Paid',
      'Outstanding',
      'Days overdue',
      'Bucket',
    ],
    ...invoices.map((i) => [
      i.invoice_number,
      i.party_name,
      i.date,
      i.due_date ?? '',
      i.status,
      i.total_amount,
      i.amount_paid,
      i.outstanding,
      i.days_overdue,
      i.aging_bucket,
    ]),
  ]
}

export function customerReportCsvRows(data: {
  summary: Record<string, unknown>
  customers?: {
    name: string
    phone: string
    email: string
    gstin: string
    total_sales: number
    total_outstanding: number
    invoice_count: number
    paid_count: number
    avg_invoice_value: number
    last_invoice_date?: string
  }[] | null
}) {
  const customers = data.customers ?? []
  return [
    ['Metric', 'Value'],
    ['customer_count', data.summary.customer_count as number],
    ['total_paid_sales', data.summary.total_paid_sales as number],
    ['total_outstanding', data.summary.total_outstanding as number],
    ['avg_sales_per_party', data.summary.avg_sales_per_party as number],
    [],
    [
      'Customer',
      'Phone',
      'Email',
      'GSTIN',
      'Paid sales',
      'Outstanding',
      'Invoices',
      'Paid count',
      'Avg invoice',
      'Last invoice',
    ],
    ...customers.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.gstin,
      c.total_sales,
      c.total_outstanding,
      c.invoice_count,
      c.paid_count,
      c.avg_invoice_value,
      c.last_invoice_date ?? '',
    ]),
  ]
}

export function productReportCsvRows(data: {
  source: string
  summary: Record<string, unknown>
  products?: {
    name: string
    sku: string
    category: string
    unit: string
    sale_price: number
    quantity_sold: number
    revenue: number
    share_percent: number
  }[] | null
}) {
  const products = data.products ?? []
  return [
    ['Metric', 'Value'],
    ['source', data.source],
    ['product_count', data.summary.product_count as number],
    ['total_revenue', data.summary.total_revenue as number],
    ['total_qty_sold', data.summary.total_qty_sold as number],
    ['avg_unit_revenue', data.summary.avg_unit_revenue as number],
    [],
    ['Product', 'SKU', 'Category', 'Unit', 'List price', 'Qty sold', 'Revenue', 'Share %'],
    ...products.map((p) => [
      p.name,
      p.sku,
      p.category,
      p.unit,
      p.sale_price,
      p.quantity_sold,
      p.revenue,
      p.share_percent,
    ]),
  ]
}

export function paymentsReportCsvRows(data: {
  summary: Record<string, unknown>
  timeline?: {
    period: string
    amount_in: number
    amount_out: number
    count_in: number
    count_out: number
  }[] | null
  by_mode?: { mode: string; direction: string; total: number; count: number }[] | null
}) {
  const timeline = data.timeline ?? []
  const byMode = data.by_mode ?? []
  return [
    ['Metric', 'Value'],
    ['total_in', data.summary.total_in as number],
    ['total_out', data.summary.total_out as number],
    ['net_flow', data.summary.net_flow as number],
    ['transaction_in', data.summary.transaction_in as number],
    ['transaction_out', data.summary.transaction_out as number],
    [],
    ['Period', 'Amount in', 'Amount out', 'Net', 'Count in', 'Count out'],
    ...timeline.map((t) => [
      t.period,
      t.amount_in,
      t.amount_out,
      t.amount_in - t.amount_out,
      t.count_in,
      t.count_out,
    ]),
    [],
    ['Mode', 'Direction', 'Total', 'Count'],
    ...byMode.map((m) => [m.mode, m.direction, m.total, m.count]),
  ]
}

export function inventoryReportCsvRows(data: {
  summary: Record<string, unknown>
  categories?: { category: string; value: number }[] | null
  items?: {
    product_name: string
    sku: string
    category: string
    outlet_name: string
    stock_qty: number
    reserved_qty: number
    available_qty: number
    min_stock: number
    cost_price: number
    sale_price: number
    total_value: number
    retail_value: number
    is_low_stock: boolean
    is_out_of_stock: boolean
  }[] | null
}) {
  const categories = data.categories ?? []
  const items = data.items ?? []
  return [
    ['Metric', 'Value'],
    ['total_value', data.summary.total_value as number],
    ['total_retail_value', data.summary.total_retail_value as number],
    ['total_quantity', data.summary.total_quantity as number],
    ['sku_locations', data.summary.sku_locations as number],
    ['low_stock_count', data.summary.low_stock_count as number],
    ['out_of_stock_count', data.summary.out_of_stock_count as number],
    [],
    ['Category', 'Stock value'],
    ...categories.map((c) => [c.category, c.value]),
    [],
    [
      'Product',
      'SKU',
      'Category',
      'Warehouse',
      'On hand',
      'Reserved',
      'Available',
      'Min',
      'Cost',
      'Sale price',
      'Cost value',
      'Retail value',
      'Low stock',
      'Out of stock',
    ],
    ...items.map((i) => [
      i.product_name,
      i.sku,
      i.category,
      i.outlet_name,
      i.stock_qty,
      i.reserved_qty,
      i.available_qty,
      i.min_stock,
      i.cost_price,
      i.sale_price,
      i.total_value,
      i.retail_value,
      i.is_low_stock ? 'yes' : 'no',
      i.is_out_of_stock ? 'yes' : 'no',
    ]),
  ]
}

type ReportWidgetsLike = {
  total_sales?: number
  month_revenue?: number
  outstanding_amount?: number
  outstanding_count?: number
  inventory_value?: number
  low_stock_count?: number
  month_tax?: number
  payments_in_month?: number
  payments_out_month?: number
  month_net_profit?: number
}

export function overviewReportCsvRows(payload: {
  widgets: ReportWidgetsLike | null
  period: string
}) {
  const w = payload.widgets || {}
  return [
    ['Metric', 'Value'],
    ['report_period_grouping', payload.period],
    ['total_sales', w.total_sales ?? ''],
    ['month_revenue', w.month_revenue ?? ''],
    ['outstanding_amount', w.outstanding_amount ?? ''],
    ['outstanding_count', w.outstanding_count ?? ''],
    ['inventory_value', w.inventory_value ?? ''],
    ['low_stock_count', w.low_stock_count ?? ''],
    ['month_tax', w.month_tax ?? ''],
    ['payments_in_month', w.payments_in_month ?? ''],
    ['payments_out_month', w.payments_out_month ?? ''],
    ['month_net_profit', w.month_net_profit ?? ''],
  ]
}

export function customReportCsvRows(data: {
  metric: string
  from_date: string
  to_date: string
  total_amount: number
  total_count: number
  avg_amount: number
  rows?: { label: string; amount: number; count: number }[] | null
}) {
  const rows = data.rows ?? []
  return [
    ['Metric', 'Value'],
    ['metric', data.metric],
    ['from_date', data.from_date],
    ['to_date', data.to_date],
    ['total_amount', data.total_amount],
    ['total_count', data.total_count],
    ['avg_amount', data.avg_amount],
    [],
    ['Label', 'Amount', 'Count', 'Avg'],
    ...rows.map((r) => [
      r.label,
      r.amount,
      r.count,
      r.count ? r.amount / r.count : 0,
    ]),
  ]
}

/** Build a single CSV with multiple named sections (for zip bundle index). */
export function sectionedCsvText(
  sections: { title: string; rows: (string | number | null | undefined)[][] }[]
): string {
  return sections
    .map((s) => `# ${s.title}\n${rowsToCsv(s.rows)}`)
    .join('\n\n')
}
