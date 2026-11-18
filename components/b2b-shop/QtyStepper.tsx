'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatQty } from '@/lib/b2bShop'

interface QtyStepperProps {
  value: number
  min: number
  max?: number
  onChange: (value: number) => void
  /** Called when the user steps below `min` (e.g. to remove from cart). */
  onBelowMin?: () => void
  size?: 'sm' | 'md'
  className?: string
}

/** Quantity input with −/+ buttons, clamped to [min, max]. */
export default function QtyStepper({ value, min, max, onChange, onBelowMin, size = 'md', className }: QtyStepperProps) {
  const [draft, setDraft] = useState(formatQty(value))
  useEffect(() => setDraft(formatQty(value)), [value])

  const clamp = (n: number) => {
    let v = Math.max(min, n)
    if (max !== undefined) v = Math.min(max, v)
    return v
  }

  const commit = () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || n <= 0) {
      setDraft(formatQty(value))
      return
    }
    const next = clamp(n)
    setDraft(formatQty(next))
    if (next !== value) onChange(next)
  }

  const dec = () => {
    if (value - 1 < min) {
      onBelowMin?.()
      return
    }
    onChange(clamp(value - 1))
  }

  const atMax = max !== undefined && value >= max
  const h = size === 'sm' ? 'h-8' : 'h-9'

  return (
    <div className={cn('inline-flex items-stretch overflow-hidden rounded-lg border bg-white', h, className)}>
      <button
        type="button"
        onClick={dec}
        className="flex w-8 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        disabled={!onBelowMin && value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={draft}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className="w-12 border-x text-center text-sm font-medium tabular-nums outline-none focus:bg-slate-50"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="flex w-8 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        disabled={atMax}
        aria-label="Increase quantity"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
