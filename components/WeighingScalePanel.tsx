'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WeighingScaleConnectionStatus } from '@/hooks/useWeighingScale'
import { Scale, Plug, Unplug, RefreshCw } from 'lucide-react'

interface WeighingScalePanelProps {
  enabled: boolean
  connectionStatus: WeighingScaleConnectionStatus
  currentWeightKg: number | null
  isStable: boolean
  lastError: string | null
  compact?: boolean
  onConnect: () => void
  onDisconnect: () => void
  onApplyWeight?: () => void
  applyDisabled?: boolean
  className?: string
}

function statusLabel(status: WeighingScaleConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting…'
    case 'unsupported':
      return 'Unsupported browser'
    default:
      return 'Disconnected'
  }
}

function statusColor(status: WeighingScaleConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-amber-500 animate-pulse'
    case 'unsupported':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

export default function WeighingScalePanel({
  enabled,
  connectionStatus,
  currentWeightKg,
  isStable,
  lastError,
  compact = false,
  onConnect,
  onDisconnect,
  onApplyWeight,
  applyDisabled,
  className,
}: WeighingScalePanelProps) {
  if (!enabled) return null

  const weightDisplay =
    currentWeightKg !== null ? `${currentWeightKg.toFixed(3)} kg` : '—'

  return (
    <div
      className={cn(
        'rounded-md border bg-slate-50',
        compact ? 'p-2 space-y-2' : 'p-3 space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Scale className="h-4 w-4 text-blue-600 shrink-0" />
          <span className={cn('font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
            Weighing scale
          </span>
          <span className={cn('h-2 w-2 rounded-full shrink-0', statusColor(connectionStatus))} />
          <span className="text-xs text-gray-500 truncate">{statusLabel(connectionStatus)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {connectionStatus === 'connected' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={compact ? 'h-7 px-2 text-xs' : undefined}
              onClick={onDisconnect}
            >
              <Unplug className="h-3 w-3 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className={compact ? 'h-7 px-2 text-xs' : undefined}
              onClick={onConnect}
              disabled={connectionStatus === 'connecting'}
            >
              {connectionStatus === 'connecting' ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Plug className="h-3 w-3 mr-1" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">Live weight</p>
          <p className={cn('font-semibold tabular-nums text-gray-900', compact ? 'text-lg' : 'text-2xl')}>
            {weightDisplay}
          </p>
          <p className="text-xs text-gray-500">
            {isStable ? 'Stable reading' : 'Waiting for stable reading…'}
          </p>
        </div>
        {onApplyWeight && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={compact ? 'h-7 text-xs' : undefined}
            onClick={onApplyWeight}
            disabled={applyDisabled}
          >
            Use weight
          </Button>
        )}
      </div>

      {lastError && <p className="text-xs text-red-600">{lastError}</p>}
    </div>
  )
}
