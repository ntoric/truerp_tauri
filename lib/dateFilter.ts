export type DatePeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

export const DATE_PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
]

export interface DateRange {
  from: Date | null
  to: Date | null
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  return next
}

export function getDateRangeForPeriod(
  period: DatePeriod,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date()

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    }
    case 'week':
      return { from: startOfWeek(now), to: endOfDay(now) }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: startOfDay(start), to: endOfDay(now) }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { from: startOfDay(start), to: endOfDay(now) }
    }
    case 'custom': {
      const from = customFrom ? startOfDay(new Date(customFrom)) : null
      const to = customTo ? endOfDay(new Date(customTo)) : null
      if (from && isNaN(from.getTime())) return { from: null, to: null }
      if (to && isNaN(to.getTime())) return { from, to: null }
      return { from, to }
    }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

export function isDateWithinRange(
  value: string | Date | null | undefined,
  from: Date | null,
  to: Date | null
): boolean {
  if (!from && !to) return true
  if (!value) return false

  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return false

  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function formatDateRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return 'All Time'

  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  if (range.from && range.to) {
    return `${formatter.format(range.from)} – ${formatter.format(range.to)}`
  }
  if (range.from) return `From ${formatter.format(range.from)}`
  return `Until ${formatter.format(range.to!)}`
}
