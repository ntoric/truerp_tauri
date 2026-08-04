'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface ListWidgetItem {
  id: string
  title: string
  subtitle?: string
  value?: string
  status?: {
    text: string
    variant: 'success' | 'warning' | 'danger' | 'info' | 'default'
  }
  action?: {
    label: string
    href: string
  }
}

interface ListWidgetProps {
  title: string
  icon?: LucideIcon
  items: ListWidgetItem[]
  viewAllLink?: string
  emptyMessage?: string
  emptyAction?: {
    label: string
    href: string
  }
}

const statusVariants = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  default: 'bg-gray-100 text-gray-700',
}

export default function ListWidget({
  title,
  icon: Icon,
  items,
  viewAllLink,
  emptyMessage = 'No items found',
  emptyAction,
}: ListWidgetProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-gray-500" />}
          <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
        </div>
        {viewAllLink && (
          <Link
            href={viewAllLink}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">{emptyMessage}</p>
            {emptyAction && (
              <Link
                href={emptyAction.href}
                className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                {emptyAction.label}
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {item.value && (
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  )}
                  {item.status && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusVariants[item.status.variant]
                      }`}
                    >
                      {item.status.text}
                    </span>
                  )}
                  {item.action && (
                    <Link
                      href={item.action.href}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {item.action.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
