'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ScanLine, Wand2 } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type LoyaltyCardAssignMode = 'scan' | 'auto'

interface CardRef {
  id: string
  card_number: string
}

/**
 * Validates a scanned/typed card number before the customer is created: the
 * card must exist in this store's series and not be linked to anyone yet.
 */
export async function resolveScannedLoyaltyCard(
  raw: string
): Promise<{ card: CardRef } | { error: string }> {
  const num = raw.trim()
  if (!/^[0-9A-Za-z\s-]{3,}$/.test(num)) return { error: 'Enter a valid loyalty card number' }
  const res = await apiFetch(`/loyalty/cards/lookup?number=${encodeURIComponent(num)}`, {
    timeoutMs: 5000,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.card?.id) return { error: `Card ${num} not found` }
  if (data.party) return { error: `Card ${data.card.card_number} is already linked to ${data.party.name}` }
  return { card: { id: data.card.id, card_number: data.card.card_number } }
}

/** Links a validated card to a newly created customer. */
export async function linkLoyaltyCard(cardId: string, partyId: string): Promise<boolean> {
  const res = await apiFetch(`/loyalty/cards/${cardId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ party_id: partyId }),
  })
  return res.ok
}

/**
 * Atomically assigns the next unassigned card to the customer. The server
 * picks the card, so the number may differ from the preview if another
 * counter took it in the meantime — always use the returned number.
 */
export async function assignNextLoyaltyCard(
  partyId: string
): Promise<{ card_number: string } | { error: string }> {
  const res = await apiFetch('/loyalty/cards/assign-next', {
    method: 'POST',
    body: JSON.stringify({ party_id: partyId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.card) return { error: data.error || 'Failed to assign loyalty card' }
  return { card_number: data.card.card_number }
}

interface Props {
  mode: LoyaltyCardAssignMode
  onModeChange: (mode: LoyaltyCardAssignMode) => void
  value: string
  onChange: (value: string) => void
  /** Compact sizing for dialogs (POS). */
  compact?: boolean
  label?: React.ReactNode
  inputId?: string
  error?: string
}

/**
 * Loyalty card number input with a Scan / Auto-assign switch. "Scan" takes a
 * card number from a barcode scanner or keyboard; "Auto-assign" previews the
 * next unassigned card from the printed series, which is linked on save.
 */
export default function LoyaltyCardAssignField({
  mode,
  onModeChange,
  value,
  onChange,
  compact,
  label = 'Loyalty card number',
  inputId = 'loyalty-card-number',
  error,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [next, setNext] = useState<{ card: CardRef | null; remaining: number } | null>(null)
  const [loadingNext, setLoadingNext] = useState(false)

  useEffect(() => {
    if (mode !== 'auto') return
    let cancelled = false
    setLoadingNext(true)
    apiFetch('/loyalty/cards/next-available', { timeoutMs: 5000 })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setNext(d ? { card: d.card ?? null, remaining: d.remaining ?? 0 } : null)
      })
      .catch(() => !cancelled && setNext(null))
      .finally(() => !cancelled && setLoadingNext(false))
    return () => {
      cancelled = true
    }
  }, [mode])

  const switchMode = (m: LoyaltyCardAssignMode) => {
    if (m === mode) return
    onModeChange(m)
    // Scanners act as keyboards — focus the input so the next scan lands in it.
    if (m === 'scan') setTimeout(() => inputRef.current?.focus(), 0)
  }

  const tab = (m: LoyaltyCardAssignMode, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
        mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      )}
    >
      {icon}
      {text}
    </button>
  )

  let hint: React.ReactNode
  if (mode === 'scan') {
    hint = 'Scan the card barcode or type its number. Leave empty to skip.'
  } else if (loadingNext) {
    hint = (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Finding next available card…
      </span>
    )
  } else if (!next) {
    hint = <span className="text-red-600">Couldn&apos;t load the next available card.</span>
  } else if (!next.card) {
    hint = (
      <span className="text-amber-700">
        No unassigned cards left — generate a new batch from the Loyalty page.
      </span>
    )
  } else {
    hint = `Will be linked on save · ${next.remaining} unassigned card${next.remaining === 1 ? '' : 's'} left`
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className={compact ? 'text-xs font-medium text-gray-600' : 'text-sm font-medium leading-none'}
        >
          {label}
        </label>
        <div className="inline-flex rounded-md bg-gray-100 p-0.5" role="group" aria-label="Card assignment">
          {tab('scan', <ScanLine className="h-3 w-3" />, 'Scan card')}
          {tab('auto', <Wand2 className="h-3 w-3" />, 'Auto-assign')}
        </div>
      </div>
      <Input
        ref={inputRef}
        id={inputId}
        value={mode === 'auto' ? next?.card?.card_number ?? '' : value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={mode === 'auto'}
        placeholder={mode === 'auto' ? (loadingNext ? '' : 'No card available') : 'e.g. 000142'}
        className={cn(
          'font-mono',
          compact ? 'h-9 text-sm' : '',
          mode === 'auto' && 'bg-gray-50 text-gray-700',
          error && 'border-red-500'
        )}
      />
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
}
