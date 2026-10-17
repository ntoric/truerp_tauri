'use client'

import { ArrowRight, LucideIcon, X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AlertWidgetProps {
  icon?: LucideIcon
  message: string
  variant?: 'warning' | 'danger' | 'info' | 'success'
  action?: {
    label: string
    href: string
  }
  onDismiss?: () => void
}

const variantClasses = {
  warning: {
    container: 'border-amber-200/70 bg-[linear-gradient(100deg,#fffbeb_0%,#ffffff_70%)] dark:bg-[linear-gradient(100deg,rgba(245,158,11,0.14)_0%,rgba(245,158,11,0.03)_70%)]',
    tile: 'bg-amber-100 text-amber-700 ring-amber-200',
    text: 'text-amber-950',
    action: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  danger: {
    container: 'border-blue-200/70 bg-[linear-gradient(100deg,hsl(var(--theme-50))_0%,#ffffff_70%)] dark:bg-[linear-gradient(100deg,hsl(var(--theme-500)/0.14)_0%,hsl(var(--theme-500)/0.03)_70%)]',
    tile: 'bg-blue-100 text-blue-700 ring-blue-200',
    text: 'text-blue-950',
    action: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  info: {
    container: 'border-slate-200/70 bg-white',
    tile: 'bg-blue-50 text-blue-600 ring-blue-100',
    text: 'text-slate-900',
    action: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  success: {
    container: 'border-emerald-200/70 bg-[linear-gradient(100deg,#ecfdf5_0%,#ffffff_70%)] dark:bg-[linear-gradient(100deg,rgba(16,185,129,0.14)_0%,rgba(16,185,129,0.03)_70%)]',
    tile: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    text: 'text-emerald-950',
    action: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
}

export default function AlertWidget({
  icon: Icon,
  message,
  variant = 'warning',
  action,
  onDismiss,
}: AlertWidgetProps) {
  const classes = variantClasses[variant]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-nowrap',
        classes.container
      )}
    >
      {Icon && (
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', classes.tile)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <p className={cn('min-w-0 flex-1 text-sm font-medium', classes.text)}>{message}</p>
      {action && (
        <Link
          href={action.href}
          className={cn(
            'group inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors',
            classes.action
          )}
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
