'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BarChart3,
  Settings,
  Shield,
  LogOut,
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
  ChevronDown,
  ChevronRight,
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
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { cn } from '@/lib/utils'
import { canManageUsers, isSuperAdmin } from '@/lib/roles'

interface NavItem {
  name: string
  href?: string
  icon: LucideIcon
  children?: NavItem[]
  /** When true, only owner / super_admin see this item */
  superAdminOnly?: boolean
  /** When true, super admins and store admins see this item */
  userManagementOnly?: boolean
}

function filterNavForRole(items: NavItem[], role?: string | null): NavItem[] {
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

const navItems: NavItem[] = [
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
  { name: 'POS', href: '/pos', icon: ShoppingCart },
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

function isNavChildActive(pathname: string, href?: string): boolean {
  if (!href) return false
  if (pathname === href) return true
  if (href === '/reports') return false
  return pathname.startsWith(`${href}/`)
}

function navGroupHasActiveChild(pathname: string, children?: NavItem[]): boolean {
  return children?.some((child) => isNavChildActive(pathname, child.href)) ?? false
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuth()
  const { isPageEnabled } = usePageFeatures()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState(false)
  const visibleNavItems = useMemo(() => filterNavForRole(navItems, user?.role), [user?.role])

  // POS keeps the always-expanded sidebar; other pages collapse until hover.
  const isPosPage = pathname === '/pos' || pathname.startsWith('/pos/')
  const isExpanded = isPosPage || hovered

  // Warm the route ahead of click (Next disables automatic Link prefetch in dev).
  const prefetchHref = useCallback(
    (href?: string) => {
      if (!href || href === '#' || href === pathname) return
      router.prefetch(href)
    },
    [router, pathname]
  )

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // Auto-expand parent if any child is active
  useEffect(() => {
    visibleNavItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = navGroupHasActiveChild(pathname, item.children)
        if (hasActiveChild) {
          setExpandedItems((prev) => {
            const next = new Set(prev)
            next.add(item.name)
            return next
          })
        }
      }
    })
  }, [pathname, visibleNavItems])

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen overflow-hidden border-r bg-white transition-[width] duration-200 ease-out',
        isExpanded ? 'w-64 shadow-lg' : 'w-16'
      )}
      onMouseEnter={() => {
        if (!isPosPage) setHovered(true)
      }}
      onMouseLeave={() => {
        if (!isPosPage) setHovered(false)
      }}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex h-16 items-center border-b',
            isExpanded ? 'px-6' : 'justify-center px-2'
          )}
        >
          <Link
            href="/dashboard"
            className={cn('flex items-center', isExpanded ? 'gap-2.5' : 'justify-center')}
            title="TruERP"
          >
            <img
              src="/logo.png"
              alt="TruERP"
              className="h-8 w-8 object-contain"
              width={32}
              height={32}
            />
            {isExpanded && (
              <span className="whitespace-nowrap text-xl font-bold text-gray-900">TruERP</span>
            )}
          </Link>
        </div>

        <nav className={cn('flex-1 space-y-1 overflow-y-auto py-4', isExpanded ? 'px-3' : 'px-2')}>
          {visibleNavItems.map((item) => {
            if (item.children) {
              const Icon = item.icon
              const isGroupOpen = isExpanded && expandedItems.has(item.name)
              const hasActiveChild = navGroupHasActiveChild(pathname, item.children)

              return (
                <div key={item.name}>
                  <button
                    onClick={() => {
                      if (isExpanded) toggleExpanded(item.name)
                    }}
                    title={item.name}
                    className={cn(
                      'flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors',
                      isExpanded ? 'justify-between px-3' : 'justify-center px-2',
                      hasActiveChild
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn('flex items-center', isExpanded ? 'gap-3' : '')}>
                      <Icon className={cn('h-5 w-5 shrink-0', hasActiveChild ? 'text-blue-600' : 'text-gray-500')} />
                      {isExpanded && <span className="whitespace-nowrap">{item.name}</span>}
                    </div>
                    {isExpanded &&
                      (expandedItems.has(item.name) ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                      ))}
                  </button>
                  {isGroupOpen && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon
                        const isChildActive = isNavChildActive(pathname, child.href)
                        const childEnabled = !child.href || isPageEnabled(child.href)
                        return (
                          <Link
                            key={child.name}
                            href={child.href || '#'}
                            prefetch
                            onMouseEnter={() => prefetchHref(child.href)}
                            onFocus={() => prefetchHref(child.href)}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                              isChildActive
                                ? 'bg-blue-50 text-blue-700'
                                : childEnabled
                                  ? 'text-gray-600 hover:bg-gray-50'
                                  : 'text-gray-400 hover:bg-gray-50'
                            )}
                          >
                            <ChildIcon className={cn('h-4 w-4', isChildActive ? 'text-blue-600' : 'text-gray-400')} />
                            <span className="flex-1 whitespace-nowrap">{child.name}</span>
                            {!childEnabled && (
                              <span className="text-[10px] font-normal uppercase tracking-wide text-gray-400">Soon</span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const Icon = item.icon
            const isActive = pathname.startsWith(item.href || '')
            const itemEnabled = !item.href || isPageEnabled(item.href)
            return (
              <Link
                key={item.name}
                href={item.href || '#'}
                prefetch
                title={item.name}
                onMouseEnter={() => prefetchHref(item.href)}
                onFocus={() => prefetchHref(item.href)}
                className={cn(
                  'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors',
                  isExpanded ? 'gap-3 px-3' : 'justify-center px-2',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : itemEnabled
                      ? 'text-gray-700 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-gray-50'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-blue-600' : 'text-gray-500')} />
                {isExpanded && (
                  <>
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                    {!itemEnabled && (
                      <span className="text-[10px] font-normal uppercase tracking-wide text-gray-400">Soon</span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        <div className={cn('border-t', isExpanded ? 'p-3' : 'p-2')}>
          <button
            onClick={logout}
            title="Logout"
            className={cn(
              'flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50',
              isExpanded ? 'gap-3 px-3' : 'justify-center px-2'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isExpanded && <span className="whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
