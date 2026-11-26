/** Catalog of pages/menus that Super Admin can enable or disable. */

export interface ToggleablePage {
  key: string
  label: string
  group: string
}

export const TOGGLEABLE_PAGES: ToggleablePage[] = [
  { key: '/parties', label: 'Parties', group: 'Core' },
  { key: '/categories', label: 'Product Categories', group: 'Inventory' },
  { key: '/products', label: 'Products', group: 'Inventory' },
  { key: '/inventory', label: 'Stock', group: 'Inventory' },
  { key: '/inventory/movements', label: 'Stock Movement', group: 'Inventory' },
  { key: '/warehouses', label: 'Warehouses', group: 'Core' },
  { key: '/purchase-invoices', label: 'Purchase Invoices', group: 'Purchases' },
  { key: '/purchase-returns', label: 'Purchase Return', group: 'Purchases' },
  { key: '/debit-notes', label: 'Debit Notes', group: 'Credit/Debit' },
  { key: '/invoices', label: 'Invoices', group: 'Sales' },
  { key: '/estimates', label: 'Estimates', group: 'Sales' },
  { key: '/delivery-challans', label: 'Delivery Challans', group: 'Sales' },
  { key: '/sales-returns', label: 'Sales Return', group: 'Sales' },
  { key: '/credit-notes', label: 'Credit Notes', group: 'Credit/Debit' },
  { key: '/payments', label: 'Payment In', group: 'Payments' },
  { key: '/payment-outs', label: 'Payment Out', group: 'Payments' },
  { key: '/expenses', label: 'Expenses', group: 'Finance' },
  { key: '/discount', label: 'Discount', group: 'Sales' },
  { key: '/expense-categories', label: 'Expense Categories', group: 'Finance' },
  { key: '/cash-bank', label: 'Cash & Bank', group: 'Finance' },
  { key: '/profit-distribution', label: 'Profit Distribution', group: 'Finance' },
  { key: '/accounting', label: 'Accounting', group: 'Finance' },
  { key: '/reports/index', label: 'All Reports', group: 'Reports' },
  { key: '/reports/daily', label: 'Daily Report', group: 'Reports' },
  { key: '/reports/daily-profit', label: 'Daily Profit Report', group: 'Reports' },
  { key: '/reports/profit-loss', label: 'Profit & Loss Report', group: 'Reports' },
  { key: '/reports/billwise-profit', label: 'Billwise Profit Report', group: 'Reports' },
  { key: '/reports/stock', label: 'Stock Report', group: 'Reports' },
  { key: '/reports/party-balance', label: 'Party Balance Report', group: 'Reports' },
  { key: '/reports', label: 'Reports & Analytics', group: 'Reports' },
  { key: '/gst', label: 'GST Reports', group: 'GST' },
  { key: '/e-invoicing', label: 'E-Invoicing', group: 'GST' },
  { key: '/staff', label: 'Staff', group: 'HR & Payroll' },
  { key: '/attendance', label: 'Attendance', group: 'HR & Payroll' },
  { key: '/attendance-reminder', label: 'Attendance Reminder', group: 'HR & Payroll' },
  { key: '/payroll', label: 'Payroll', group: 'HR & Payroll' },
  { key: '/pos', label: 'POS Terminal', group: 'POS' },
  { key: '/pos/sessions', label: 'POS Session History', group: 'POS' },
  { key: '/marketing', label: 'Campaigns', group: 'Marketing' },
  { key: '/marketing/whatsapp-templates', label: 'Campaigns > WhatsApp Templates', group: 'Marketing' },
  { key: '/marketing/channels', label: 'Campaigns > Channels', group: 'Marketing' },
  { key: '/sms-marketing', label: 'SMS Marketing', group: 'Marketing' },
  { key: '/email-marketing', label: 'Email Marketing', group: 'Marketing' },
  { key: '/whatsapp-marketing', label: 'WhatsApp Marketing', group: 'Marketing' },
  { key: '/loyalty', label: 'Loyalty Program', group: 'Marketing' },
  { key: '/stores', label: 'Stores', group: 'Security' },
  { key: '/user-management', label: 'User Management', group: 'Security' },
  { key: '/audit', label: 'Audit Trails', group: 'Security' },
  { key: '/notifications', label: 'Notifications', group: 'Other' },
  { key: '/support', label: 'Support', group: 'Other' },
  { key: '/my-plan', label: 'My Plan', group: 'Other' },
  { key: '/support-requests', label: 'Support Requests', group: 'Security' },
  { key: '/customer-portal', label: 'Customer Portal', group: 'Other' },
  { key: '/b2b-shop', label: 'B2B Shop Manager', group: 'B2B Shop' },
  { key: '/b2b-orders', label: 'B2B Orders', group: 'B2B Shop' },
  { key: '/settings/reminders', label: 'Settings > Reminders', group: 'Settings' },
  { key: '/settings/ca-share', label: 'Settings > CA Share', group: 'Settings' },
]

export type PageFeaturesMap = Record<string, boolean>

export function defaultPageFeatures(): PageFeaturesMap {
  return Object.fromEntries(TOGGLEABLE_PAGES.map((p) => [p.key, true]))
}

export function mergePageFeatures(stored?: PageFeaturesMap | null): PageFeaturesMap {
  const pages = defaultPageFeatures()
  if (!stored) return pages
  for (const page of TOGGLEABLE_PAGES) {
    if (typeof stored[page.key] === 'boolean') {
      pages[page.key] = stored[page.key]
    }
  }
  return pages
}

/** Longest matching toggleable route for a pathname, or null if not gated. */
export function resolvePageKey(pathname: string): string | null {
  const keys = TOGGLEABLE_PAGES.map((p) => p.key).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(`${key}/`)) return key
  }
  return null
}

export function isPageEnabled(pathname: string, pages: PageFeaturesMap): boolean {
  const key = resolvePageKey(pathname)
  if (!key) return true
  return pages[key] !== false
}

export function pageLabelForPath(pathname: string): string {
  const key = resolvePageKey(pathname)
  if (!key) return 'This page'
  return TOGGLEABLE_PAGES.find((p) => p.key === key)?.label || 'This page'
}

export function groupToggleablePages(): { group: string; pages: ToggleablePage[] }[] {
  const order: string[] = []
  const map = new Map<string, ToggleablePage[]>()
  for (const page of TOGGLEABLE_PAGES) {
    if (!map.has(page.group)) {
      order.push(page.group)
      map.set(page.group, [])
    }
    map.get(page.group)!.push(page)
  }
  return order.map((group) => ({ group, pages: map.get(group)! }))
}
