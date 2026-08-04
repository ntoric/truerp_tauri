'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface ChartWidgetProps {
  title: string
  icon?: LucideIcon
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function ChartWidget({
  title,
  icon: Icon,
  children,
  action,
  className = '',
}: ChartWidgetProps) {
  return (
    <Card className={`border-gray-200 shadow-sm ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-gray-500" />}
          <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  )
}
