export type ShortcutKey = string | string[]

export type ShortcutSection = 'general' | 'navigate' | 'create' | 'pos' | 'purchase-invoice'

export const FORM_SAVE_KEYS: ShortcutKey = ['Alt', 'Enter']
export const FORM_SAVE_NEW_KEYS: ShortcutKey = ['Shift', 'Enter']
export const POS_CHECKOUT_KEYS = FORM_SAVE_KEYS
export const POS_CHECKOUT_PRINT_KEYS = FORM_SAVE_NEW_KEYS

export type ShortcutAction =
  | 'navigate'
  | 'toggle-panel'
  | 'form-save'
  | 'form-save-new'
  | 'form-cancel'
  | 'pi-add-item'
  | 'pi-add-row'
  | 'pi-scan-barcode'

export interface ShortcutDefinition {
  id: string
  label: string
  keys: ShortcutKey
  section: ShortcutSection
  action?: ShortcutAction
  href?: string
}

export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  // General
  {
    id: 'toggle-panel',
    label: 'Open / close shortcuts panel',
    keys: 'Alt',
    section: 'general',
    action: 'toggle-panel',
  },
  {
    id: 'save',
    label: 'Save',
    keys: FORM_SAVE_KEYS,
    section: 'general',
    action: 'form-save',
  },
  {
    id: 'save-new',
    label: 'Save & New',
    keys: FORM_SAVE_NEW_KEYS,
    section: 'general',
    action: 'form-save-new',
  },
  {
    id: 'cancel',
    label: 'Cancel',
    keys: 'Escape',
    section: 'general',
    action: 'form-cancel',
  },
  {
    id: 'next-field',
    label: 'Go to next field',
    keys: 'Tab',
    section: 'general',
  },
  {
    id: 'prev-field',
    label: 'Go to previous field',
    keys: ['Shift', 'Tab'],
    section: 'general',
  },

  // Navigate
  {
    id: 'dashboard',
    label: 'Dashboard',
    keys: ['Alt', 'D'],
    section: 'navigate',
    action: 'navigate',
    href: '/dashboard',
  },
  {
    id: 'invoices-list',
    label: 'Sales Invoices',
    keys: ['Alt', 'V'],
    section: 'navigate',
    action: 'navigate',
    href: '/invoices',
  },
  {
    id: 'purchase-invoices-list',
    label: 'Purchase Invoices',
    keys: ['Alt', 'U'],
    section: 'navigate',
    action: 'navigate',
    href: '/purchase-invoices',
  },
  {
    id: 'products-list',
    label: 'Products',
    keys: ['Alt', 'T'],
    section: 'navigate',
    action: 'navigate',
    href: '/products',
  },
  {
    id: 'parties-list',
    label: 'Parties',
    keys: ['Alt', 'A'],
    section: 'navigate',
    action: 'navigate',
    href: '/parties',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    keys: ['Alt', 'N'],
    section: 'navigate',
    action: 'navigate',
    href: '/inventory',
  },
  {
    id: 'reports',
    label: 'Reports',
    keys: ['Alt', 'G'],
    section: 'navigate',
    action: 'navigate',
    href: '/reports',
  },
  {
    id: 'cash-bank',
    label: 'Cash & Bank',
    keys: ['Alt', 'K'],
    section: 'navigate',
    action: 'navigate',
    href: '/cash-bank',
  },
  {
    id: 'expenses-list',
    label: 'Expenses',
    keys: ['Alt', 'X'],
    section: 'navigate',
    action: 'navigate',
    href: '/expenses',
  },
  {
    id: 'gst',
    label: 'GST Reports',
    keys: ['Alt', 'Z'],
    section: 'navigate',
    action: 'navigate',
    href: '/gst',
  },
  {
    id: 'settings',
    label: 'Settings',
    keys: ['Alt', 'H'],
    section: 'navigate',
    action: 'navigate',
    href: '/settings',
  },

  // Create
  {
    id: 'sales-invoice',
    label: 'Sales Invoice',
    keys: ['Alt', 'S'],
    section: 'create',
    action: 'navigate',
    href: '/invoices/create',
  },
  {
    id: 'pos-billing',
    label: 'POS Billing',
    keys: ['Alt', 'B'],
    section: 'create',
    action: 'navigate',
    href: '/pos',
  },
  {
    id: 'purchase-invoice',
    label: 'Purchase Invoice',
    keys: ['Alt', 'P'],
    section: 'create',
    action: 'navigate',
    href: '/purchase-invoices/create',
  },
  {
    id: 'payment-in',
    label: 'Payment In',
    keys: ['Alt', 'I'],
    section: 'create',
    action: 'navigate',
    href: '/payments',
  },
  {
    id: 'payment-out',
    label: 'Payment Out',
    keys: ['Alt', 'O'],
    section: 'create',
    action: 'navigate',
    href: '/payment-outs',
  },
  {
    id: 'sales-return',
    label: 'Sales Return',
    keys: ['Alt', 'C'],
    section: 'create',
    action: 'navigate',
    href: '/sales-returns/create',
  },
  {
    id: 'purchase-return',
    label: 'Purchase Return',
    keys: ['Alt', 'R'],
    section: 'create',
    action: 'navigate',
    href: '/purchase-returns/create',
  },
  {
    id: 'credit-note',
    label: 'Credit Note',
    keys: ['Alt', 'W'],
    section: 'create',
    action: 'navigate',
    href: '/credit-notes/create',
  },
  {
    id: 'debit-note',
    label: 'Debit Note',
    keys: ['Alt', 'J'],
    section: 'create',
    action: 'navigate',
    href: '/debit-notes/create',
  },
  {
    id: 'purchase-order',
    label: 'Purchase Order',
    keys: ['Alt', 'F'],
    section: 'create',
    action: 'navigate',
    href: '/purchase-orders/create',
  },
  {
    id: 'delivery-challan',
    label: 'Delivery Challan',
    keys: ['Alt', 'Q'],
    section: 'create',
    action: 'navigate',
    href: '/delivery-challans/create',
  },
  {
    id: 'expense',
    label: 'Expense',
    keys: ['Alt', 'E'],
    section: 'create',
    action: 'navigate',
    href: '/expenses/create',
  },
  {
    id: 'party',
    label: 'Party',
    keys: ['Alt', 'Y'],
    section: 'create',
    action: 'navigate',
    href: '/parties/create',
  },
  {
    id: 'item',
    label: 'Item',
    keys: ['Alt', 'M'],
    section: 'create',
    action: 'navigate',
    href: '/products/create',
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    keys: ['Alt', 'L'],
    section: 'create',
    action: 'navigate',
    href: '/warehouses/create',
  },

  // POS
  {
    id: 'pos-checkout',
    label: 'Checkout',
    keys: POS_CHECKOUT_KEYS,
    section: 'pos',
    action: 'form-save',
  },
  {
    id: 'pos-checkout-print',
    label: 'Checkout & Print',
    keys: POS_CHECKOUT_PRINT_KEYS,
    section: 'pos',
    action: 'form-save-new',
  },

  // Purchase Invoice (page-specific)
  {
    id: 'pi-add-item',
    label: 'Add Item to Bill',
    keys: ['Alt', '1'],
    section: 'purchase-invoice',
    action: 'pi-add-item',
  },
  {
    id: 'pi-add-row',
    label: 'Add New Row',
    keys: ['Alt', '2'],
    section: 'purchase-invoice',
    action: 'pi-add-row',
  },
  {
    id: 'pi-scan-barcode',
    label: 'Scan Barcode',
    keys: ['Alt', '3'],
    section: 'purchase-invoice',
    action: 'pi-scan-barcode',
  },
]

const MODIFIER_KEYS = new Set(['alt', 'shift', 'ctrl', 'meta'])

function normalizeEventKey(key: string): string {
  return key.toLowerCase()
}

function normalizeShortcutKey(key: string): string {
  const lower = key.toLowerCase()
  if (lower === 'esc') return 'escape'
  return lower
}

/** Returns true when a keyboard event matches a shortcut definition. */
export function matchesShortcut(event: KeyboardEvent, keys: ShortcutKey): boolean {
  const parts = (Array.isArray(keys) ? keys : [keys]).map(normalizeShortcutKey)

  const needsAlt = parts.includes('alt')
  const needsShift = parts.includes('shift')
  const needsCtrl = parts.includes('ctrl')
  const needsMeta = parts.includes('meta')

  if (event.altKey !== needsAlt) return false
  if (event.shiftKey !== needsShift) return false
  if (event.ctrlKey !== needsCtrl) return false
  if (event.metaKey !== needsMeta) return false

  const mainKeys = parts.filter((part) => !MODIFIER_KEYS.has(part))
  if (mainKeys.length === 0) return false

  const eventKey = normalizeEventKey(event.key)
  return mainKeys.every((key) => eventKey === key)
}

export function normalizeKey(key: string): string {
  if (key === ' ') return 'Space'
  if (key === 'Esc') return 'Escape'
  if (key.length === 1) return key.toUpperCase()
  return key
}

export function formatShortcutKeys(keys: ShortcutKey): string[] {
  return Array.isArray(keys) ? keys.map(normalizeKey) : [normalizeKey(keys)]
}

export function shortcutsBySection(section: ShortcutSection): ShortcutDefinition[] {
  return KEYBOARD_SHORTCUTS.filter((shortcut) => shortcut.section === section)
}
