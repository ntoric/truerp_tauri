import type { Icon } from '@phosphor-icons/react'
import {
  Gauge,
  UsersThree,
  Tag,
  Package,
  Warehouse,
  Buildings,
  ShoppingBag,
  FileText,
  ArrowCounterClockwise,
  FileMinus,
  HandWithdraw,
  TrendUp,
  Invoice,
  ClipboardText,
  Truck,
  ReceiptX,
  Receipt,
  Wallet,
  HandCoins,
  BookOpenText,
  ChartBar,
  CalendarDots,
  ChartLineUp,
  Calculator,
  FileCode,
  IdentificationCard,
  Users,
  CalendarCheck,
  Money,
  CashRegister,
  ClockClockwise,
  Megaphone,
  ChatCircleText,
  EnvelopeSimple,
  WhatsappLogo,
  Gift,
  ShieldCheck,
  Storefront,
  Scroll,
  Bell,
  GlobeHemisphereWest,
  GearSix,
  BracketsCurly,
} from '@phosphor-icons/react'
import { canManageUsers, isSuperAdmin } from '@/lib/roles'

export interface NavItem {
  name: string
  href?: string
  icon: Icon
  /** Accent color (hex) used to tint the duotone icon and active state */
  accent?: string
  children?: NavItem[]
  /** When true, only owner / super_admin see this item */
  superAdminOnly?: boolean
  /** When true, super admins and store admins see this item */
  userManagementOnly?: boolean
}

export function filterNavForRole(items: NavItem[], role?: string | null): NavItem[] {
  const allowSuperAdmin = isSuperAdmin(role)
  const allowUserManagement = canManageUsers(role)
  return items
    .map((item) => {
      if (item.superAdminOnly && !allowSuperAdmin) return null
      if (item.userManagementOnly && !allowUserManagement) return null
      if (item.children) {
        const children = filterNavForRole(item.children, role)
        if (children.length === 0) return null
        return { ...item, children }
      }
      return item
    })
    .filter((item): item is NavItem => item !== null)
}

/** Hide pages disabled in Super Admin → Pages & Menus. */
export function filterNavForPageFeatures(
  items: NavItem[],
  isPageEnabled: (pathname: string) => boolean
): NavItem[] {
  return items
    .map((item) => {
      if (item.children) {
        const children = filterNavForPageFeatures(item.children, isPageEnabled)
        if (children.length === 0) return null
        return { ...item, children }
      }
      if (item.href && !isPageEnabled(item.href)) return null
      return item
    })
    .filter((item): item is NavItem => item !== null)
}

export const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Gauge, accent: '#4f46e5' },
  { name: 'Parties', href: '/parties', icon: UsersThree, accent: '#7c3aed' },
  { name: 'Product Categories', href: '/categories', icon: Tag, accent: '#b45309' },
  { name: 'Products', href: '/products', icon: Package, accent: '#059669' },
  { name: 'Inventory', href: '/inventory', icon: Warehouse, accent: '#0891b2' },
  { name: 'Warehouses', href: '/warehouses', icon: Buildings, accent: '#64748b' },
  {
    name: 'Purchases',
    icon: ShoppingBag,
    accent: '#ea580c',
    children: [
      { name: 'Purchase Invoices', href: '/purchase-invoices', icon: FileText },
      { name: 'Purchase Return', href: '/purchase-returns', icon: ArrowCounterClockwise },
      { name: 'Debit Notes', href: '/debit-notes', icon: FileMinus },
      { name: 'Payment Out', href: '/payment-outs', icon: HandWithdraw },
    ],
  },
  {
    name: 'Sales',
    icon: TrendUp,
    accent: '#2563eb',
    children: [
      { name: 'Invoices', href: '/invoices', icon: Invoice },
      { name: 'Estimates', href: '/estimates', icon: ClipboardText },
      { name: 'Delivery Challans', href: '/delivery-challans', icon: Truck },
      { name: 'Sales Return', href: '/sales-returns', icon: ArrowCounterClockwise },
      { name: 'Credit Notes', href: '/credit-notes', icon: ReceiptX },
      { name: 'Payment In', href: '/payments', icon: HandCoins },
    ],
  },
  { name: 'Expenses', href: '/expenses', icon: Receipt, accent: '#e11d48' },
  { name: 'Cash & Bank', href: '/cash-bank', icon: Wallet, accent: '#16a34a' },
  { name: 'Profit Distribution', href: '/profit-distribution', icon: HandCoins, accent: '#65a30d' },
  { name: 'Accounting', href: '/accounting', icon: BookOpenText, accent: '#0d9488' },
  {
    name: 'Reports',
    icon: ChartBar,
    accent: '#9333ea',
    children: [
      { name: 'Daily Report', href: '/reports/daily', icon: CalendarDots },
      { name: 'Reports & Analytics', href: '/reports', icon: ChartLineUp },
    ],
  },
  {
    name: 'GST',
    icon: Calculator,
    accent: '#c026d3',
    children: [
      { name: 'GST Reports', href: '/gst', icon: Calculator },
      { name: 'E-Invoicing', href: '/e-invoicing', icon: FileCode },
    ],
  },
  {
    name: 'HR & Payroll',
    icon: IdentificationCard,
    accent: '#db2777',
    children: [
      { name: 'Staff', href: '/staff', icon: Users },
      { name: 'Attendance', href: '/attendance', icon: CalendarCheck },
      { name: 'Payroll', href: '/payroll', icon: Money },
    ],
  },
  {
    name: 'POS',
    icon: CashRegister,
    accent: '#0284c7',
    children: [
      { name: 'POS Terminal', href: '/pos', icon: CashRegister },
      { name: 'Session History', href: '/pos/sessions', icon: ClockClockwise },
    ],
  },
  {
    name: 'Marketing',
    icon: Megaphone,
    accent: '#ca8a04',
    children: [
      { name: 'SMS Marketing', href: '/sms-marketing', icon: ChatCircleText },
      { name: 'Email Marketing', href: '/email-marketing', icon: EnvelopeSimple },
      { name: 'WhatsApp Marketing', href: '/whatsapp-marketing', icon: WhatsappLogo },
      { name: 'Loyalty Program', href: '/loyalty', icon: Gift },
    ],
  },
  {
    name: 'Security',
    icon: ShieldCheck,
    accent: '#dc2626',
    children: [
      { name: 'Stores', href: '/stores', icon: Storefront, superAdminOnly: true },
      { name: 'User Management', href: '/user-management', icon: Users, userManagementOnly: true },
      { name: 'Audit Trails', href: '/audit', icon: Scroll, superAdminOnly: true },
    ],
  },
  { name: 'Notifications', href: '/notifications', icon: Bell, accent: '#d97706' },
  { name: 'Customer Portal', href: '/customer-portal', icon: GlobeHemisphereWest, accent: '#0e7490', superAdminOnly: true },
  { name: 'Settings', href: '/settings', icon: GearSix, accent: '#475569' },
  { name: 'Developer Settings', href: '/developer-settings', icon: BracketsCurly, accent: '#334155', superAdminOnly: true },
]

/** Primary tabs shown in the mobile bottom menubar. */
export const bottomNavPrimary: {
  name: string
  href: string
  icon: Icon
  accent: string
  match: (p: string) => boolean
}[] = [
  { name: 'Home', href: '/dashboard', icon: Gauge, accent: '#4f46e5', match: (p) => p === '/dashboard' || p.startsWith('/dashboard/') },
  { name: 'Parties', href: '/parties', icon: UsersThree, accent: '#7c3aed', match: (p) => p.startsWith('/parties') },
  { name: 'Products', href: '/products', icon: Package, accent: '#059669', match: (p) => p.startsWith('/products') || p.startsWith('/categories') || p.startsWith('/inventory') },
  { name: 'Sales', href: '/invoices', icon: Invoice, accent: '#2563eb', match: (p) => p.startsWith('/invoices') || p.startsWith('/sales-returns') || p.startsWith('/credit-notes') || p.startsWith('/delivery-challans') || p.startsWith('/payments') },
]

export function isNavChildActive(pathname: string, href?: string): boolean {
  if (!href) return false
  if (pathname === href) return true
  if (href === '/reports') return false
  return pathname.startsWith(`${href}/`)
}

export function navGroupHasActiveChild(pathname: string, children?: NavItem[]): boolean {
  return children?.some((child) => isNavChildActive(pathname, child.href)) ?? false
}
