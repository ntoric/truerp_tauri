'use client'

import { ArrowUpRight, Inbox, LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
  className?: string
}

const statusTones: Record<NonNullable<ListWidgetItem['status']>['variant'], StatusBadgeTone> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  default: 'neutral',
}

export default function ListWidget({
  title,
  icon: Icon,
  items,
  viewAllLink,
  emptyMessage = 'No items found',
  emptyAction,
  className,
}: ListWidgetProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.18)]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
        </div>
        {viewAllLink && (
          <Link
            href={viewAllLink}
            className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
            <Inbox className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
          {emptyAction && (
            <Link
              href={emptyAction.href}
              className="mt-3 inline-flex items-center rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              {emptyAction.label}
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-slate-50/80"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--theme-50))_0%,hsl(var(--theme-100))_100%)] text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-[linear-gradient(135deg,hsl(var(--theme-500)/0.2)_0%,hsl(var(--theme-500)/0.3)_100%)] dark:ring-white/10">
                    {(item.subtitle || item.title).trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    {item.subtitle && <p className="truncate text-xs text-slate-500">{item.subtitle}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.value && (
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{item.value}</span>
                  )}
                  {item.status && (
                    <StatusBadge tone={statusTones[item.status.variant]}>
                      {item.status.text}
                    </StatusBadge>
                  )}
                  {item.action && (
                    <Link
                      href={item.action.href}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      {item.action.label}
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
