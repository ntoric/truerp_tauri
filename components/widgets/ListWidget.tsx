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
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  danger: 'bg-[#fff1f2] text-[#c81e3a] ring-1 ring-inset ring-[#fecdd3]',
  info: 'bg-[#111111] text-white',
  default: 'bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200',
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
    <Card className="rounded-xl border-[#e4e6ef] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111] text-white"><Icon className="h-4 w-4" /></span>}
          <CardTitle className="text-base font-semibold text-[#20212b]">{title}</CardTitle>
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
            <p className="text-sm text-[#5b5c6b]">{emptyMessage}</p>
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
                className="flex items-center justify-between rounded-lg border border-[#eef0f5] bg-[#f6f7fb] p-3 transition-colors hover:border-blue-200 hover:bg-white"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#20212b] truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-[#5b5c6b] truncate">{item.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {item.value && (
                    <span className="text-sm font-semibold text-[#20212b]">{item.value}</span>
                  )}
                  {item.status && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
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
