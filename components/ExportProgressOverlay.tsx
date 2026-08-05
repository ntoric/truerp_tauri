'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, XCircle } from 'lucide-react'
import {
  getExportProgress,
  subscribeExportProgress,
  type ExportProgressState,
} from '@/lib/exportProgress'
import { cn } from '@/lib/utils'

export default function ExportProgressOverlay() {
  const [state, setState] = useState<ExportProgressState>(getExportProgress)

  useEffect(() => subscribeExportProgress(setState), [])

  if (!state.active) return null

  const failed = Boolean(state.error)

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[110] w-[min(100vw-2rem,22rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'rounded-xl border bg-white/95 p-3.5 shadow-lg backdrop-blur-md dark:bg-zinc-900/95',
          failed ? 'border-red-200' : 'border-gray-200 dark:border-zinc-700'
        )}
      >
        <div className="mb-2 flex items-start gap-2.5">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              failed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            )}
          >
            {failed ? (
              <XCircle className="h-4 w-4" />
            ) : state.percent >= 100 ? (
              <Download className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {state.label || 'Exporting'}
            </p>
            <p
              className={cn(
                'truncate text-xs',
                failed ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {state.message}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
            {state.percent}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300 ease-out',
              failed ? 'bg-red-500' : 'bg-blue-600'
            )}
            style={{ width: `${state.percent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
