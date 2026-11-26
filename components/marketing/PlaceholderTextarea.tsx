'use client'

import { useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { Placeholder } from '@/lib/marketing'

/** Inserts `{{key}}` at the cursor of an input/textarea and returns the new value. */
function insertAt(el: HTMLInputElement | HTMLTextAreaElement | null, value: string, token: string): [string, number] {
  if (!el) return [value + token, (value + token).length]
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = value.slice(0, start) + token + value.slice(end)
  return [next, start + token.length]
}

export function PlaceholderChips({ placeholders, onPick }: { placeholders: Placeholder[]; onPick: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {placeholders.map((p) => (
        <button
          key={p.key}
          type="button"
          title={p.label}
          onClick={() => onPick(p.key)}
          className="rounded-full border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
        >
          {`{{${p.key}}}`}
        </button>
      ))}
    </div>
  )
}

/** Textarea (or single-line input) with clickable placeholder chips. */
export default function PlaceholderTextarea({
  value,
  onChange,
  placeholders,
  rows = 5,
  singleLine = false,
  placeholder,
  id,
}: {
  value: string
  onChange: (v: string) => void
  placeholders: Placeholder[]
  rows?: number
  singleLine?: boolean
  placeholder?: string
  id?: string
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const pick = (key: string) => {
    const [next, caret] = insertAt(ref.current, value, `{{${key}}}`)
    onChange(next)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(caret, caret)
    })
  }
  return (
    <div className="space-y-1.5">
      {singleLine ? (
        <Input id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <Textarea id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
      )}
      <PlaceholderChips placeholders={placeholders} onPick={pick} />
    </div>
  )
}
