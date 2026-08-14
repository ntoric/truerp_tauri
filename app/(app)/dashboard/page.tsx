'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp,
  FileText,
  Users,
  Package,
  AlertTriangle,
  Clock,
  IndianRupee,
  CalendarRange,
} from 'lucide-react'
import StatWidget from '@/components/widgets/StatWidget'
import ListWidget from '@/components/widgets/ListWidget'
import AlertWidget from '@/components/widgets/AlertWidget'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DashboardPeriod = 'today' | 'week' | 'month' | 'year' | 'all'

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
]

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
}

interface DashboardStats {
  total_sales: number
  total_invoices: number
  total_parties: number
  total_customers?: number
  total_products?: number
  pending_amount: number
  today_sales: number
  today_invoices: number
  low_stock_products?: number
  overdue_invoices: number
}

interface Invoice {
  id: string
  invoice_number: string
  customer?: { name: string }
  party?: { name: string }
  total_amount: number
  status: string
  date: string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const query = `period=${period}`
      const [statsRes, invoicesRes] = await Promise.all([
        apiFetch(`/dashboard/stats?${query}`),
        apiFetch(`/dashboard/recent-invoices?${query}`),
      ])
      if (statsRes.ok) {
        setStats(await statsRes.json())
      } else {
        console.error('Failed to fetch stats:', statsRes.status)
      }
      if (invoicesRes.ok) {
        setRecentInvoices(await invoicesRes.json())
      } else {
        console.error('Failed to fetch invoices:', invoicesRes.status)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchDashboardData()
  }, [authLoading, user, fetchDashboardData])

  const periodLabel = PERIOD_LABELS[period]

  const statCards = useMemo(
    () => [
      {
        title: `${periodLabel} Sales`,
        value: formatCurrency(stats?.total_sales || 0),
        icon: TrendingUp,
        color: 'success' as const,
      },
      {
        title: `${periodLabel} Invoices`,
        value: stats?.total_invoices || 0,
        icon: FileText,
        color: 'info' as const,
      },
      {
        title: 'Customers',
        value: stats?.total_customers ?? stats?.total_parties ?? 0,
        icon: Users,
        color: 'warning' as const,
      },
      {
        title: 'Products',
        value: stats?.total_products || 0,
        icon: Package,
        color: 'info' as const,
      },
      {
        title: 'Pending Amount',
        value: formatCurrency(stats?.pending_amount || 0),
        icon: Clock,
        color: 'danger' as const,
      },
      {
        title: 'Overdue Invoices',
        value: stats?.overdue_invoices || 0,
        icon: IndianRupee,
        color: 'danger' as const,
      },
    ],
    [periodLabel, stats]
  )

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      paid: 'success',
      sent: 'info',
      draft: 'default',
      overdue: 'danger',
      cancelled: 'warning',
    }
    return variants[status] || 'default'
  }

  if (authLoading || (loading && !stats)) {
    return (
      <DashboardLayout>
        <PageSkeleton variant="dashboard" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          actions={
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-gray-500" />
              <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => (
            <StatWidget
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              color={card.color}
            />
          ))}
        </div>

        {/* Alerts */}
        {(stats?.low_stock_products || 0) > 0 && (
          <AlertWidget
            icon={AlertTriangle}
            message={`${stats?.low_stock_products} products are running low on stock`}
            variant="warning"
            action={{ label: 'View Products', href: '/products?low_stock=true' }}
          />
        )}

        {/* Recent Invoices */}
        <ListWidget
          title={`Recent Invoices (${periodLabel})`}
          icon={FileText}
          viewAllLink="/invoices"
          items={recentInvoices.map((inv) => ({
            id: inv.id,
            title: inv.invoice_number,
            subtitle: inv.customer?.name || inv.party?.name || 'N/A',
            value: formatCurrency(inv.total_amount),
            status: {
              text: inv.status,
              variant: getStatusVariant(inv.status),
            },
          }))}
          emptyMessage={`No invoices for ${periodLabel.toLowerCase()}`}
          emptyAction={{ label: 'Create one', href: '/invoices' }}
        />
      </div>
    </DashboardLayout>
  )
}
