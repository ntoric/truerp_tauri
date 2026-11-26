'use client'

import * as React from 'react'
import { Check, ChevronDown, Layers, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { ProductBatchStock } from '@/lib/productBatches'

interface BatchPickerProps {
  /** Batches for the line's product (FEFO-ordered). Rows with an empty batch_no are ignored. */
  batches: ProductBatchStock[]
  value: string
  /** `batch` is the picked stock row, or null when a new batch number was typed / cleared. */
  onChange: (batchNo: string, batch: ProductBatchStock | null) => void
  /** Called when the picker opens, so the caller can (re)load batches lazily. */
  onOpen?: () => void
  loading?: boolean
  /** Shown when no batch is chosen. */
  placeholder?: string
  className?: string
}

function formatExp(exp?: string | null) {
  if (!exp) return ''
  const d = new Date(exp)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN')
}

/**
 * Combobox for an invoice line's batch: pick an existing batch (shows expiry and
 * available qty) or type a batch number that isn't in stock yet and add it.
 */
export function BatchPicker({ batches, value, onChange, onOpen, loading, placeholder = 'Batch', className }: BatchPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [highlight, setHighlight] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const named = React.useMemo(() => batches.filter((b) => b.batch_no?.trim()), [batches])
  const selected = named.find((b) => b.batch_no === value) ?? null

  const q = query.trim()
  const filtered = q ? named.filter((b) => b.batch_no.toLowerCase().includes(q.toLowerCase())) : named
  const canAdd = q !== '' && !named.some((b) => b.batch_no.toLowerCase() === q.toLowerCase())
  const optionCount = filtered.length + (canAdd ? 1 : 0)

  const openPicker = () => {
    if (open) return
    setQuery('')
    setHighlight(0)
    setOpen(true)
    onOpen?.()
  }

  const commit = (batchNo: string, batch: ProductBatchStock | null) => {
    onChange(batchNo, batch)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const commitHighlighted = () => {
    if (highlight < filtered.length) commit(filtered[highlight].batch_no, filtered[highlight])
    else if (canAdd) commit(q, null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openPicker()
      else setHighlight((h) => Math.min(h + 1, Math.max(optionCount - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      if (optionCount > 0) commitHighlighted()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayValue = open ? query : value
  const exp = selected ? formatExp(selected.exp_date) : ''

  return (
    <Popover open={open} onOpenChange={(o) => (o ? openPicker() : setOpen(false))}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            'flex h-7 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs focus-within:ring-1 focus-within:ring-ring',
            className
          )}
        >
          <Layers className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          <input
            ref={inputRef}
            value={displayValue}
            placeholder={open ? 'Search or type new batch…' : placeholder}
            onFocus={openPicker}
            onClick={openPicker}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(0)
              if (!open) openPicker()
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400"
            aria-label="Batch number"
          />
          {!open && exp && <span className="shrink-0 text-[10px] text-gray-500">Exp {exp}</span>}
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-64 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (inputRef.current?.parentElement?.contains(e.target as Node)) e.preventDefault()
        }}
      >
        <div className="max-h-60 overflow-y-auto text-xs" role="listbox">
          {loading && named.length === 0 && <div className="px-2 py-2 text-gray-500">Loading batches…</div>}
          {!loading && named.length === 0 && !canAdd && (
            <div className="px-2 py-2 text-gray-500">No batches in stock. Type a batch number to add one.</div>
          )}
          {filtered.map((b, i) => {
            const bExp = formatExp(b.exp_date)
            const qty = Number(b.available_qty ?? b.quantity ?? 0)
            return (
              <button
                key={`${b.id}-${b.batch_no}`}
                type="button"
                role="option"
                aria-selected={b.batch_no === value}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(b.batch_no, b)}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left',
                  highlight === i && 'bg-gray-100'
                )}
              >
                <Check className={cn('h-3 w-3 shrink-0', b.batch_no === value ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0 flex-1 truncate font-medium">{b.batch_no}</span>
                {bExp && <span className="shrink-0 text-gray-500">Exp {bExp}</span>}
                <span className={cn('shrink-0 tabular-nums', qty > 0 ? 'text-emerald-600' : 'text-red-500')}>{qty}</span>
              </button>
            )
          })}
          {canAdd && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onMouseEnter={() => setHighlight(filtered.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(q, null)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-blue-600',
                highlight === filtered.length && 'bg-gray-100'
              )}
            >
              <Plus className="h-3 w-3 shrink-0" />
              <span className="truncate">Add new batch “{q}”</span>
            </button>
          )}
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit('', null)}
              className="mt-1 w-full border-t px-2 pt-1.5 pb-1 text-left text-gray-500 hover:text-gray-700"
            >
              Clear batch
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
