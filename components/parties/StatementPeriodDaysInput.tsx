'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { MAX_PERIOD_DAYS, normalizePeriodDays } from '@/lib/partyStatement'

/** "Last [N] days" number field for the last_n_days statement period. */
export default function StatementPeriodDaysInput({
  value,
  onChange,
  id,
}: {
  value: number
  onChange: (days: number) => void
  id?: string
}) {
  // Keep the raw text so the field can be cleared while typing.
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  return (
    <div className="flex items-center gap-2 pt-1 text-sm">
      <span>Last</span>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_PERIOD_DAYS}
        aria-label="Number of days"
        className="h-8 w-20"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (e.target.value !== '') onChange(normalizePeriodDays(e.target.value))
        }}
        onBlur={() => setText(String(normalizePeriodDays(text)))}
      />
      <span>days (including today)</span>
    </div>
  )
}
