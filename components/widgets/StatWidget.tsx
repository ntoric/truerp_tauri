'use client'

import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatWidgetProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  description?: string
  highlight?: boolean
}

const colorClasses = {
  primary: 'bg-blue-50 text-blue-700',
  success: 'bg-[#111111] text-white',
  info: 'bg-[#111111] text-white',
  warning: 'bg-[#111111] text-white',
  danger: 'bg-[#fff1f2] text-[#c81e3a]',
}

export default function StatWidget({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
  description,
  highlight = false,
}: StatWidgetProps) {
  return (
    <Card
      className={cn(
        'rounded-xl shadow-sm transition-shadow duration-200 hover:shadow-md',
        highlight
          ? 'border-transparent bg-[linear-gradient(150deg,#dc2626_0%,#991b1b_55%,#450a0a_100%)] text-white'
          : 'border-[#e4e6ef] bg-white'
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className={cn('text-sm font-medium uppercase tracking-wide', highlight ? 'text-rose-100' : 'text-[#5b5c6b]')}>{title}</p>
            <p className={cn('mt-2 text-3xl font-bold', highlight ? 'text-white' : 'text-[#20212b]')}>{value}</p>
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                <span
                  className={cn(
                    'text-sm font-medium',
                    highlight ? 'text-white' : trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : '-'}{trend.value}%
                </span>
                <span className={cn('text-sm', highlight ? 'text-rose-100' : 'text-gray-400')}>vs last month</span>
              </div>
            )}
            {description && (
              <p className={cn('mt-2 text-sm', highlight ? 'text-rose-100' : 'text-[#5b5c6b]')}>{description}</p>
            )}
          </div>
          <div
            className={cn('flex h-14 w-14 items-center justify-center rounded-xl shadow-sm', highlight ? 'bg-white/15 text-white' : colorClasses[color])}
          >
            <Icon className="h-7 w-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
