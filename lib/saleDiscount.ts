import { apiFetch } from '@/hooks/useAuth'
import { parseMoney } from '@/lib/numbers'

// Store-scoped discount rule from GET /api/v1/sale-discount-settings.
// mode "manual" keeps the free-form invoice discount entry; mode "auto"
// replaces it with an Apply button that grants discount_value percent
// (discount_type "percent") or a flat amount (discount_type "amount") once the
// sale total reaches min_sale_amount.
export interface SaleDiscountSettings {
  mode: 'manual' | 'auto'
  discount_type: 'percent' | 'amount'
  discount_value: number
  min_sale_amount: number
}

export const DEFAULT_SALE_DISCOUNT_SETTINGS: SaleDiscountSettings = {
  mode: 'manual',
  discount_type: 'percent',
  discount_value: 0,
  min_sale_amount: 0,
}

export function normalizeSaleDiscountSettings(data: unknown): SaleDiscountSettings {
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    mode: raw.mode === 'auto' ? 'auto' : 'manual',
    discount_type: raw.discount_type === 'amount' ? 'amount' : 'percent',
    discount_value: Math.max(0, parseMoney(raw.discount_value ?? 0)),
    min_sale_amount: Math.max(0, parseMoney(raw.min_sale_amount ?? 0)),
  }
}

export async function fetchSaleDiscountSettings(timeoutMs = 5000): Promise<SaleDiscountSettings> {
  try {
    const res = await apiFetch('/sale-discount-settings', { timeoutMs })
    if (res.ok) {
      return normalizeSaleDiscountSettings(await res.json())
    }
  } catch {
    /* offline / unreachable — fall back to manual */
  }
  return { ...DEFAULT_SALE_DISCOUNT_SETTINGS }
}

// Whether a sale of `saleBase` qualifies for the auto discount, i.e. it
// reaches the configured threshold and the rule grants something.
export function autoDiscountEligible(settings: SaleDiscountSettings | null, saleBase: number): boolean {
  if (!settings || settings.mode !== 'auto') return false
  if (settings.discount_value <= 0) return false
  return saleBase >= settings.min_sale_amount
}

// The discount granted when the auto discount is applied. Always returns 0
// when the sale is not eligible.
export function computeAutoDiscount(settings: SaleDiscountSettings | null, saleBase: number): number {
  if (!autoDiscountEligible(settings, saleBase) || saleBase <= 0) return 0
  if (settings!.discount_type === 'percent') {
    return parseMoney(Math.min(saleBase, saleBase * (Math.min(settings!.discount_value, 100) / 100)))
  }
  return parseMoney(Math.min(saleBase, settings!.discount_value))
}

export function describeAutoDiscount(settings: SaleDiscountSettings | null): string {
  if (!settings || settings.mode !== 'auto' || settings.discount_value <= 0) return ''
  const grant =
    settings.discount_type === 'percent'
      ? `${settings.discount_value}% off`
      : `-${settings.discount_value}`
  return `${grant} on sales ≥ ${settings.min_sale_amount}`
}
