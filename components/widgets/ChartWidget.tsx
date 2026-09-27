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
    <Card className={`rounded-xl border-[#e4e6ef] bg-white shadow-sm ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111] text-white"><Icon className="h-4 w-4" /></span>}
          <CardTitle className="text-base font-semibold text-[#20212b]">{title}</CardTitle>
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  )
}
