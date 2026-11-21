import type { LoyaltySettings } from './loyalty-types'

/** True when the store rewards customers with ₹ cashback instead of points. */
export function isCashLoyalty(settings: LoyaltySettings | null | undefined): boolean {
  return settings?.reward_type === 'cash'
}

const roundMoney = (v: number) => Math.round(v * 100) / 100

/** The customer's redeemable balance in the active unit (points, or ₹ cashback). */
export function loyaltyAvailable(
  settings: LoyaltySettings | null | undefined,
  party: { loyalty_points?: number; loyalty_cash?: number } | null | undefined
): number {
  if (!party) return 0
  return isCashLoyalty(settings) ? party.loyalty_cash ?? 0 : party.loyalty_points ?? 0
}

/** Human label for a balance/redeem value in the active unit, e.g. "120 pts" or "₹45.50". */
export function formatLoyaltyValue(settings: LoyaltySettings | null | undefined, value: number): string {
  if (isCashLoyalty(settings)) {
    return `₹${roundMoney(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${Math.floor(value).toLocaleString()} pts`
}

/** Parse what the cashier typed into the redeem box for the active unit. */
export function parseLoyaltyRedeemInput(settings: LoyaltySettings | null | undefined, raw: string): number {
  if (isCashLoyalty(settings)) {
    const n = parseFloat(raw)
    return Number.isFinite(n) && n > 0 ? roundMoney(n) : 0
  }
  return parseInt(raw, 10) || 0
}

/** Invoice payload fields for a redemption of `value` in the active unit. */
export function loyaltyRedeemPayload(
  settings: LoyaltySettings | null | undefined,
  value: number
): { loyalty_points_redeemed: number } | { loyalty_cash_redeemed: number } | Record<string, never> {
  if (!value || value <= 0) return {}
  return isCashLoyalty(settings)
    ? { loyalty_cash_redeemed: roundMoney(value) }
    : { loyalty_points_redeemed: value }
}

/**
 * Discount for redeeming `toRedeem` against a bill. `toRedeem` and `available`
 * are points in points mode and ₹ in cash mode (cashback is redeemed 1:1).
 */
export function computeLoyaltyDiscount(
  settings: LoyaltySettings | null,
  available: number,
  billTotal: number,
  toRedeem: number
): { discount: number; error?: string } {
  if (!toRedeem || toRedeem <= 0) {
    return { discount: 0 }
  }
  if (!settings?.is_enabled) {
    return { discount: 0, error: 'Loyalty program is not enabled' }
  }
  const cash = isCashLoyalty(settings)
  if (cash) {
    const min = settings.min_redeem_amount ?? 0
    if (min > 0 && toRedeem < min) {
      return { discount: 0, error: `Minimum ₹${min} cashback required` }
    }
    if (toRedeem > available + 0.001) {
      return { discount: 0, error: 'Insufficient cashback balance' }
    }
  } else {
    if (toRedeem < settings.min_redeem_points) {
      return { discount: 0, error: `Minimum ${settings.min_redeem_points} points required` }
    }
    if (toRedeem > available) {
      return { discount: 0, error: 'Insufficient points' }
    }
  }
  const discount = cash ? roundMoney(toRedeem) : toRedeem * settings.point_value
  if (billTotal > 0 && settings.max_redeem_percent > 0) {
    const maxDiscount = billTotal * (settings.max_redeem_percent / 100)
    if (discount > maxDiscount + (cash ? 0.001 : 0)) {
      return {
        discount: 0,
        error: `Max ${settings.max_redeem_percent}% of bill can be paid with ${cash ? 'cashback' : 'points'}`,
      }
    }
  }
  if (discount > billTotal && billTotal > 0) {
    return { discount: 0, error: 'Redemption exceeds bill total' }
  }
  return { discount }
}

export function estimatePointsEarned(settings: LoyaltySettings | null, amount: number): number {
  if (!settings?.is_enabled || isCashLoyalty(settings) || amount <= 0 || settings.spend_amount <= 0) {
    return 0
  }
  return Math.floor((amount / settings.spend_amount) * settings.points_per_spend)
}

/** ₹ cashback credited for a bill of `amount` (cash mode only). */
export function estimateCashEarned(settings: LoyaltySettings | null, amount: number): number {
  const pct = settings?.cashback_percent ?? 0
  if (!settings?.is_enabled || !isCashLoyalty(settings) || amount <= 0 || pct <= 0) {
    return 0
  }
  return roundMoney((amount * pct) / 100)
}

/** True when rewards are earned on item profit margin instead of the bill total. */
export function isMarginLoyalty(settings: LoyaltySettings | null | undefined): boolean {
  return settings?.earn_basis === 'margin'
}

/** A sale line for margin-based earning. `discount_percent` is the line discount %. */
export interface LoyaltyEarnLine {
  has_product: boolean
  quantity: number
  unit_price: number
  discount_percent?: number
  /** Unit purchase price; 0/undefined = unknown cost (line is skipped). */
  unit_cost?: number
}

/**
 * Profit on lines whose margin on selling price is ≥ minMarginPct. Mirrors the
 * backend: bill-level discounts are spread proportionally over lines; lines
 * without a product or known purchase cost are skipped.
 */
export function eligibleMarginProfit(lines: LoyaltyEarnLine[], billDiscount: number, minMarginPct: number): number {
  const net = (l: LoyaltyEarnLine) => {
    const gross = l.quantity * l.unit_price
    return gross - gross * ((l.discount_percent ?? 0) / 100)
  }
  const gross = lines.reduce((sum, l) => sum + net(l), 0)
  if (gross <= 0) return 0
  const ratio = billDiscount > 0 ? Math.max(0, 1 - billDiscount / gross) : 1
  let profit = 0
  for (const l of lines) {
    const cost = l.unit_cost ?? 0
    if (!l.has_product || l.quantity <= 0 || cost <= 0) continue
    const sale = net(l) * ratio
    if (sale <= 0) continue
    const lineProfit = sale - l.quantity * cost
    if (lineProfit <= 0) continue
    if ((lineProfit / sale) * 100 + 1e-9 < minMarginPct) continue
    profit += lineProfit
  }
  return roundMoney(profit)
}

/**
 * Reward earned on a sale in the active unit, honouring the earn basis:
 * `billAmount` is used on the bill basis; `lines` + `billDiscount` on the margin basis.
 */
export function estimateLoyaltyEarnedOnSale(
  settings: LoyaltySettings | null,
  billAmount: number,
  lines: LoyaltyEarnLine[],
  billDiscount: number
): number {
  const base = isMarginLoyalty(settings)
    ? eligibleMarginProfit(lines, billDiscount, settings?.min_margin_percent ?? 0)
    : billAmount
  return estimateLoyaltyEarned(settings, base)
}

/** Reward earned on an amount (bill total or profit) in the active unit (points or ₹). */
export function estimateLoyaltyEarned(settings: LoyaltySettings | null, amount: number): number {
  return isCashLoyalty(settings) ? estimateCashEarned(settings, amount) : estimatePointsEarned(settings, amount)
}
