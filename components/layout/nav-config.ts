import { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BarChart3,
  Settings,
  Shield,
  Receipt,
  CreditCard,
  IndianRupee,
  Truck,
  ShoppingCart,
  Warehouse,
  Calculator,
  Building2,
  Tags,
  UserCircle,
  TrendingUp,
  RotateCcw,
  UserCheck,
  CalendarCheck,
  DollarSign,
  FileMinus,
  FileDigit,
  MessageSquare,
  Mail,
  Code,
  CalendarDays,
  Gift,
  Bell,
  Globe,
  Store,
  Clock,
} from 'lucide-react'
import { canManageUsers, isSuperAdmin } from '@/lib/roles'

export interface NavItem {
  name: string
  href?: string
  icon: LucideIcon
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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Parties', href: '/parties', icon: UserCircle },
  { name: 'Product Categories', href: '/categories', icon: Tags },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Warehouses', href: '/warehouses', icon: Building2 },
  {
    name: 'Purchases',
    icon: ShoppingCart,
    children: [
      { name: 'Purchase Invoices', href: '/purchase-invoices', icon: FileText },
      { name: 'Pending Sync', href: '/purchase-invoices/pending', icon: Clock },
      { name: 'Purchase Return', href: '/purchase-returns', icon: RotateCcw },
      { name: 'Debit Notes', href: '/debit-notes', icon: FileMinus },
      { name: 'Payment Out', href: '/payment-outs', icon: CreditCard },
    ],
  },
  {
    name: 'Sales',
    icon: TrendingUp,
    children: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Delivery Challans', href: '/delivery-challans', icon: Truck },
      { name: 'Sales Return', href: '/sales-returns', icon: RotateCcw },
      { name: 'Credit Notes', href: '/credit-notes', icon: FileMinus },
      { name: 'Payment In', href: '/payments', icon: CreditCard },
    ],
  },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Cash & Bank', href: '/cash-bank', icon: IndianRupee },
  { name: 'Accounting', href: '/accounting', icon: Building2 },
  {
    name: 'Reports',
    icon: BarChart3,
    children: [
      { name: 'Daily Report', href: '/reports/daily', icon: CalendarDays },
      { name: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    name: 'GST',
    icon: Calculator,
    children: [
      { name: 'GST Reports', href: '/gst', icon: Calculator },
      { name: 'E-Invoicing', href: '/e-invoicing', icon: FileDigit },
    ],
  },
  {
    name: 'HR & Payroll',
    icon: UserCheck,
    children: [
      { name: 'Staff', href: '/staff', icon: UserCheck },
      { name: 'Attendance', href: '/attendance', icon: CalendarCheck },
      { name: 'Payroll', href: '/payroll', icon: DollarSign },
    ],
  },
  {
    name: 'POS',
    icon: ShoppingCart,
    children: [
      { name: 'POS Terminal', href: '/pos', icon: ShoppingCart },
      { name: 'Session History', href: '/pos/sessions', icon: Clock },
    ],
  },
  {
    name: 'Marketing',
    icon: MessageSquare,
    children: [
      { name: 'SMS Marketing', href: '/sms-marketing', icon: MessageSquare },
      { name: 'Email Marketing', href: '/email-marketing', icon: Mail },
      { name: 'WhatsApp Marketing', href: '/whatsapp-marketing', icon: MessageSquare },
      { name: 'Loyalty Program', href: '/loyalty', icon: Gift },
    ],
  },
  {
    name: 'Security',
    icon: Shield,
    children: [
      { name: 'Stores', href: '/stores', icon: Store, superAdminOnly: true },
      { name: 'User Management', href: '/user-management', icon: Users, userManagementOnly: true },
      { name: 'Audit Trails', href: '/audit', icon: FileText, superAdminOnly: true },
    ],
  },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Customer Portal', href: '/customer-portal', icon: Globe, superAdminOnly: true },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Developer Settings', href: '/developer-settings', icon: Code, superAdminOnly: true },
]

/** Primary tabs shown in the mobile bottom menubar. */
export const bottomNavPrimary = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' || p.startsWith('/dashboard/') },
  { name: 'Parties', href: '/parties', icon: UserCircle, match: (p: string) => p.startsWith('/parties') },
  { name: 'Products', href: '/products', icon: Package, match: (p: string) => p.startsWith('/products') || p.startsWith('/categories') || p.startsWith('/inventory') },
  { name: 'Sales', href: '/invoices', icon: FileText, match: (p: string) => p.startsWith('/invoices') || p.startsWith('/sales-returns') || p.startsWith('/credit-notes') || p.startsWith('/delivery-challans') || p.startsWith('/payments') },
] as const

export function isNavChildActive(pathname: string, href?: string): boolean {
  if (!href) return false
  if (pathname === href) return true
  if (href === '/reports') return false
  return pathname.startsWith(`${href}/`)
}

export function navGroupHasActiveChild(pathname: string, children?: NavItem[]): boolean {
  return children?.some((child) => isNavChildActive(pathname, child.href)) ?? false
}
