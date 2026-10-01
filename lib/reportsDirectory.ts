/** Catalog of report destinations for the Reports index page. */

export type ReportTag =
  | 'party'
  | 'category'
  | 'payment'
  | 'item'
  | 'invoice'
  | 'summary'
  | 'gst'
  | 'accounting'

export interface ReportEntry {
  key: string
  name: string
  href: string
  tags: ReportTag[]
}

export interface ReportGroup {
  key: string
  label: string
  icon: string
  entries: ReportEntry[]
}

export const REPORT_FILTER_OPTIONS: { value: ReportTag | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'party', label: 'Party' },
  { value: 'category', label: 'Category' },
  { value: 'payment', label: 'Payment Collection' },
  { value: 'item', label: 'Item' },
  { value: 'invoice', label: 'Invoice Details' },
  { value: 'summary', label: 'Summary' },
  { value: 'gst', label: 'GST' },
  { value: 'accounting', label: 'Accounting' },
]

export const REPORT_GROUPS: ReportGroup[] = [
  {
    key: 'sales',
    label: 'Sales',
    icon: 'sales',
    entries: [
      { key: 'sales-report', name: 'Sales Report', href: '/reports?tab=sales', tags: ['summary', 'invoice'] },
      { key: 'revenue-report', name: 'Revenue Report', href: '/reports?tab=revenue', tags: ['summary', 'invoice'] },
      { key: 'sales-summary', name: 'Sales Summary (Analytics)', href: '/reports', tags: ['summary'] },
      { key: 'custom-report', name: 'Custom Report', href: '/reports?tab=custom', tags: ['summary'] },
      { key: 'payment-in', name: 'Payment In', href: '/payments', tags: ['payment', 'party'] },
      { key: 'credit-notes', name: 'Credit Notes', href: '/credit-notes', tags: ['invoice', 'party'] },
      { key: 'sales-returns', name: 'Sales Return', href: '/sales-returns', tags: ['invoice', 'item'] },
    ],
  },
  {
    key: 'purchases',
    label: 'Purchases',
    icon: 'purchases',
    entries: [
      { key: 'purchase-summary', name: 'Purchase Summary', href: '/purchase-invoices', tags: ['summary', 'invoice'] },
      { key: 'purchase-orders', name: 'Purchase Orders', href: '/purchase-orders', tags: ['invoice', 'party'] },
      { key: 'purchase-returns', name: 'Purchase Return', href: '/purchase-returns', tags: ['invoice', 'item'] },
      { key: 'debit-notes', name: 'Debit Notes', href: '/debit-notes', tags: ['invoice', 'party'] },
      { key: 'payment-out', name: 'Payment Out', href: '/payment-outs', tags: ['payment', 'party'] },
    ],
  },
  {
    key: 'gst',
    label: 'GST',
    icon: 'gst',
    entries: [
      { key: 'gstr1', name: 'GSTR-1 (Sales)', href: '/gst?tab=gstr1', tags: ['gst', 'invoice'] },
      { key: 'gstr2', name: 'GSTR-2 (Purchase)', href: '/gst?tab=gstr2', tags: ['gst', 'invoice'] },
      { key: 'gstr3b', name: 'GSTR-3b', href: '/gst?tab=gstr3b', tags: ['gst', 'summary'] },
      { key: 'gst-summary', name: 'GST Summary', href: '/gst?tab=summary', tags: ['gst', 'summary'] },
      { key: 'tax-report', name: 'Tax Report', href: '/reports?tab=tax', tags: ['gst', 'summary'] },
      { key: 'einvoice-history', name: 'E-Invoice History', href: '/e-invoicing', tags: ['gst', 'invoice'] },
    ],
  },
  {
    key: 'transaction',
    label: 'Transaction',
    icon: 'transaction',
    entries: [
      { key: 'audit-trail', name: 'Audit Trail', href: '/audit', tags: ['summary'] },
      { key: 'billwise-profit', name: 'Bill Wise Profit', href: '/reports/billwise-profit', tags: ['invoice', 'summary'] },
      { key: 'cash-bank', name: 'Cash and Bank Report (All Payments)', href: '/cash-bank', tags: ['payment', 'summary'] },
      { key: 'daily-report', name: 'Daybook / Daily Report', href: '/reports/daily', tags: ['summary'] },
      { key: 'daily-profit', name: 'Daily Profit Report', href: '/reports/daily-profit', tags: ['summary', 'item'] },
      { key: 'payments-report', name: 'Payments Report', href: '/reports?tab=payments', tags: ['payment', 'summary'] },
      { key: 'expense-report', name: 'Expense Transaction Report', href: '/expenses', tags: ['summary', 'category'] },
      { key: 'expense-categories', name: 'Expense Category Report', href: '/expense-categories', tags: ['category', 'summary'] },
    ],
  },
  {
    key: 'item',
    label: 'Item',
    icon: 'item',
    entries: [
      { key: 'product-report', name: 'Item Report (Product Wise Sales)', href: '/reports?tab=products', tags: ['item', 'summary'] },
      { key: 'stock-report', name: 'Stock Report', href: '/reports/stock', tags: ['item', 'summary'] },
      { key: 'inventory-report', name: 'Inventory Valuation', href: '/reports?tab=inventory', tags: ['item', 'summary'] },
      { key: 'low-stock', name: 'Low Stock', href: '/inventory', tags: ['item'] },
      { key: 'item-categories', name: 'Item Categories', href: '/categories', tags: ['item', 'category'] },
    ],
  },
  {
    key: 'party',
    label: 'Party',
    icon: 'party',
    entries: [
      { key: 'customer-report', name: 'Party Report (Customer Wise)', href: '/reports?tab=customers', tags: ['party', 'summary'] },
      { key: 'receivable-ageing', name: 'Receivable Ageing Report', href: '/reports?tab=outstanding', tags: ['party', 'payment'] },
      { key: 'party-list', name: 'Party Ledger & Balances', href: '/parties', tags: ['party'] },
      { key: 'loyalty-report', name: 'Loyalty Program', href: '/loyalty', tags: ['party', 'summary'] },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    icon: 'accounting',
    entries: [
      { key: 'balance-sheet', name: 'Balance Sheet', href: '/accounting?tab=balance-sheet', tags: ['accounting', 'summary'] },
      { key: 'trial-balance', name: 'Trial Balance', href: '/accounting?tab=trial-balance', tags: ['accounting', 'summary'] },
      { key: 'pnl-ledger', name: 'Profit & Loss (Ledger)', href: '/accounting?tab=pnl', tags: ['accounting', 'summary'] },
      { key: 'pnl-report', name: 'Profit And Loss Report', href: '/reports/profit-loss', tags: ['accounting', 'summary'] },
      { key: 'general-ledger', name: 'General Ledger', href: '/accounting?tab=general-ledger', tags: ['accounting'] },
      { key: 'ledger', name: 'Ledger', href: '/accounting?tab=ledger', tags: ['accounting'] },
      { key: 'journal', name: 'Journal Entries', href: '/accounting?tab=journal', tags: ['accounting'] },
      { key: 'bank-recon', name: 'Bank Reconciliation', href: '/accounting?tab=bank-recon', tags: ['accounting', 'payment'] },
    ],
  },
]

const FAVOURITES_STORAGE_KEY = 'report-favourites-v1'

export function loadReportFavourites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function saveReportFavourites(keys: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // ignore persistence failures
  }
}
