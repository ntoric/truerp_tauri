export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value']

export interface PaymentSplit {
  mode: string
  amount: number
}

export function formatPaymentMethod(mode?: string | null): string {
  const key = (mode || '').trim().toLowerCase()
  const match = PAYMENT_METHODS.find((item) => item.value === key)
  if (match) return match.label
  if (!key) return 'Cash'
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function numericSplitAmount(amount?: number | string | null): number {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0
  const parsed = parseFloat(String(amount ?? '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatPaymentSplitsLabel(
  splits?: PaymentSplit[] | null,
  fallbackMode?: string | null
): string {
  const cleaned = (splits || []).filter((split) => numericSplitAmount(split.amount) > 0.009)
  if (cleaned.length === 0) return formatPaymentMethod(fallbackMode)
  if (cleaned.length === 1) return formatPaymentMethod(cleaned[0].mode)
  return cleaned.map((split) => formatPaymentMethod(split.mode)).join(' + ')
}

export function sumPaymentSplits(splits: Array<{ amount?: number | string }>): number {
  return splits.reduce((total, split) => total + numericSplitAmount(split.amount), 0)
}

export function clampPaymentSplitsToTotal(
  splits: PaymentSplit[],
  total: number
): PaymentSplit[] {
  let remaining = total
  const out: PaymentSplit[] = []
  for (const split of splits) {
    if (remaining <= 0.009) break
    const amount = Math.min(numericSplitAmount(split.amount), remaining)
    if (amount > 0.009) {
      out.push({ mode: split.mode || 'cash', amount })
      remaining -= amount
    }
  }
  return out
}

export function materializePaymentSplits(
  splits: Array<{ mode: string; amount?: number | string }>,
  options?: { implicitFullAmount?: number; edited?: boolean }
): PaymentSplit[] {
  const implicit =
    splits.length === 1 &&
    !options?.edited &&
    numericSplitAmount(options?.implicitFullAmount) > 0.009
  return splits
    .map((split, index) => ({
      mode: split.mode || 'cash',
      amount: implicit && index === 0
        ? numericSplitAmount(options?.implicitFullAmount)
        : numericSplitAmount(split.amount),
    }))
    .filter((split) => split.amount > 0.009)
}

export function splitsFromInvoice(invoice: {
  payment_splits?: PaymentSplit[] | null
  payment_mode?: string | null
  amount_paid?: number | null
}): PaymentSplit[] {
  const fromApi = (invoice.payment_splits || []).filter((split) => Number(split.amount) > 0.009)
  if (fromApi.length > 0) {
    return fromApi.map((split) => ({
      mode: split.mode || 'cash',
      amount: Number(split.amount) || 0,
    }))
  }
  return [
    {
      mode: invoice.payment_mode || 'cash',
      amount: Number(invoice.amount_paid) || 0,
    },
  ]
}

export function unusedPaymentMethods(usedModes: string[]): string[] {
  const used = new Set(usedModes.map((mode) => mode.toLowerCase()))
  return PAYMENT_METHODS.map((item) => item.value).filter((value) => !used.has(value))
}

export function nextPaymentMethod(usedModes: string[], fallback = 'cash'): string {
  return unusedPaymentMethods(usedModes)[0] || fallback
}

export function appendPaymentSplit<T extends { mode: string; amount: number }>(
  splits: T[],
  totalAmount: number,
  makeRow: (mode: string, amount: number) => T
): T[] {
  const remaining = Math.max(0, totalAmount - sumPaymentSplits(splits))
  const nextMode = nextPaymentMethod(splits.map((row) => row.mode))
  if (remaining > 0.009) {
    return [...splits, makeRow(nextMode, remaining)]
  }
  const last = splits[splits.length - 1]
  if (!last) {
    return [makeRow(nextMode, remaining)]
  }
  const lastAmount = numericSplitAmount(last.amount)
  const half = Math.round((lastAmount / 2) * 100) / 100
  const rest = Math.round((lastAmount - half) * 100) / 100
  return [
    ...splits.slice(0, -1),
    { ...last, amount: rest },
    makeRow(nextMode, half),
  ]
}
