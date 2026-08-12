'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageActionBarProps = {
  children: ReactNode
  /** Optional left-side summary (totals, status, hints). */
  left?: ReactNode
  /** Alias for left — used by existing form pages. */
  meta?: ReactNode
  className?: string
}

/**
 * Sticky bottom action bar for Save / Cancel / Create — always reachable
 * without scrolling to the end of long forms.
 */
export default function PageActionBar({ children, left, meta, className }: PageActionBarProps) {
  const summary = left ?? meta

  return (
    <div
      className={cn(
        'page-action-bar sticky bottom-[var(--app-bottom-nav-offset)] z-20 -mx-3 mt-4 border-t border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur-sm sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5',
        'shadow-[0_-6px_16px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">{summary}</div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>
      </div>
    </div>
  )
}
