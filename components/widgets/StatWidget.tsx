'use client'

import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
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
  /** Dense tile for 2-up grids: icon + trend row, value, then label. */
  compact?: boolean
}

const toneClasses = {
  primary: {
    tile: 'bg-blue-50 text-blue-600 ring-blue-100',
    glow: 'bg-[hsl(var(--theme-400)/0.18)]',
  },
  info: {
    tile: 'bg-blue-50 text-blue-600 ring-blue-100',
    glow: 'bg-[hsl(var(--theme-400)/0.18)]',
  },
  success: {
    tile: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    glow: 'bg-emerald-400/20',
  },
  warning: {
    tile: 'bg-amber-50 text-amber-600 ring-amber-100',
    glow: 'bg-amber-400/20',
  },
  danger: {
    tile: 'bg-blue-100 text-blue-700 ring-blue-200',
    glow: 'bg-[hsl(var(--theme-500)/0.2)]',
  },
}

export default function StatWidget({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
  description,
  highlight = false,
  compact = false,
}: StatWidgetProps) {
  const tone = toneClasses[color]
  const TrendIcon = trend?.isPositive ? TrendingUp : TrendingDown

  if (compact) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_32px_-16px_rgba(16,24,40,0.25)]">
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-100',
            tone.glow
          )}
        />
        <div className="relative flex items-center justify-between gap-2">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', tone.tile)}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {trend.value}%
            </span>
          )}
        </div>
        <p className="relative mt-3 truncate text-xl font-semibold tracking-tight tabular-nums text-slate-900 sm:text-2xl">
          {value}
        </p>
        <p className="relative mt-0.5 truncate text-xs font-medium text-slate-500" title={description}>
          {title}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 ease-out hover:-translate-y-0.5',
        highlight
          ? 'bg-[linear-gradient(140deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_55%,hsl(var(--theme-900))_100%)] text-white shadow-[0_12px_32px_-12px_hsl(var(--theme-700)/0.6),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : 'border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.18)] hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_32px_-16px_rgba(16,24,40,0.25)]'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300',
          highlight ? 'bg-white/20 opacity-80' : cn(tone.glow, 'opacity-60 group-hover:opacity-100')
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
              highlight ? 'bg-white/15 text-white ring-white/25 backdrop-blur-sm' : tone.tile
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <p className={cn('truncate text-[13px] font-medium', highlight ? 'text-white/80' : 'text-slate-500')}>{title}</p>
        </div>
        {trend && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              highlight
                ? 'bg-white/15 text-white'
                : trend.isPositive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trend.value}%
          </span>
        )}
      </div>
      <p
        className={cn(
          'relative mt-4 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px]',
          highlight ? 'text-white' : 'text-slate-900'
        )}
      >
        {value}
      </p>
      {(description || trend) && (
        <p className={cn('relative mt-1 truncate text-xs', highlight ? 'text-white/70' : 'text-slate-500')}>
          {description ?? 'vs last month'}
        </p>
      )}
    </div>
  )
}
