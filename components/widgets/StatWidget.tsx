'use client'

import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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
}

const colorClasses = {
  primary: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    gradient: 'from-blue-500 to-blue-600',
  },
  success: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    gradient: 'from-green-500 to-green-600',
  },
  warning: {
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    gradient: 'from-orange-500 to-orange-600',
  },
  danger: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    gradient: 'from-red-500 to-red-600',
  },
  info: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    gradient: 'from-purple-500 to-purple-600',
  },
}

export default function StatWidget({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
  description,
}: StatWidgetProps) {
  const colors = colorClasses[color]

  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                <span
                  className={`text-sm font-medium ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.isPositive ? '+' : '-'}{trend.value}%
                </span>
                <span className="text-sm text-gray-400">vs last month</span>
              </div>
            )}
            {description && (
              <p className="mt-2 text-sm text-gray-500">{description}</p>
            )}
          </div>
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} shadow-sm`}
          >
            <Icon className={`h-7 w-7 ${colors.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
