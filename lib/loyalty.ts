import type { LoyaltyCategory, LoyaltyCondition, LoyaltySettings } from './loyalty-types'

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
  if (isCategoryLoyalty(settings)) {
    return categoryLoyaltyEarn(settings, billAmount, lines, billDiscount).value
  }
  const base = isMarginLoyalty(settings)
    ? eligibleMarginProfit(lines, billDiscount, settings?.min_margin_percent ?? 0)
    : billAmount
  return estimateLoyaltyEarned(settings, base)
}

/** Reward earned on an amount (bill total or profit) in the active unit (points or ₹). */
export function estimateLoyaltyEarned(settings: LoyaltySettings | null, amount: number): number {
  return isCashLoyalty(settings) ? estimateCashEarned(settings, amount) : estimatePointsEarned(settings, amount)
}

/** True when rewards come from loyalty categories. */
export function isCategoryLoyalty(settings: LoyaltySettings | null | undefined): boolean {
  return settings?.earn_basis === 'category'
}

/** Figures a category's conditions are tested against; costKnown=false fails every condition. */
interface SaleFigures {
  sale: number
  profit: number
  costKnown: boolean
}

function conditionHolds(c: LoyaltyCondition, f: SaleFigures): boolean {
  if (!f.costKnown) return false
  const v = c.field === 'margin_percent' ? (f.sale > 0 ? (f.profit / f.sale) * 100 : 0) : f.profit
  const eps = 1e-9
  switch (c.op) {
    case 'gte':
      return v + eps >= c.value
    case 'gt':
      return v > c.value + eps
    case 'lte':
      return v <= c.value + eps
    case 'lt':
      return v + eps < c.value
    case 'eq':
      return Math.abs(v - c.value) <= 0.005
  }
  return false
}

/** AND binds tighter than OR; no conditions = always matches. Mirrors the backend. */
export function loyaltyCategoryMatches(cat: LoyaltyCategory, f: SaleFigures): boolean {
  const conds = cat.conditions ?? []
  if (conds.length === 0) return true
  let groupOK = true
  for (let i = 0; i < conds.length; i++) {
    if (i > 0 && conds[i].join === 'or') {
      if (groupOK) return true
      groupOK = true
    }
    if (groupOK && !conditionHolds(conds[i], f)) groupOK = false
  }
  return groupOK
}

function categoryReward(cat: LoyaltyCategory, f: SaleFigures): number {
  if (cat.reward_kind === 'fixed') return cat.reward_value
  const base = cat.reward_on === 'profit' ? f.profit : f.sale
  return base > 0 ? (base * cat.reward_value) / 100 : 0
}

/**
 * Reward from loyalty categories for a sale (₹ in cash mode, points otherwise)
 * and how many times each category matched. Mirrors computeCategoryLoyaltyEarn
 * on the backend.
 */
export function categoryLoyaltyEarn(
  settings: LoyaltySettings | null,
  billAmount: number,
  lines: LoyaltyEarnLine[],
  billDiscount: number
): { value: number; matches: Record<string, number> } {
  const matches: Record<string, number> = {}
  const cats = (settings?.categories ?? []).filter((c) => c.is_active)
  if (!settings?.is_enabled || cats.length === 0) return { value: 0, matches }
  const cash = isCashLoyalty(settings)
  const net = (l: LoyaltyEarnLine) => {
    const gross = l.quantity * l.unit_price
    return gross - gross * ((l.discount_percent ?? 0) / 100)
  }
  const gross = lines.reduce((sum, l) => sum + net(l), 0)
  const ratio = gross > 0 && billDiscount > 0 ? Math.max(0, 1 - billDiscount / gross) : 1
  const figures = (l: LoyaltyEarnLine): SaleFigures => {
    const f: SaleFigures = { sale: net(l) * ratio, profit: 0, costKnown: false }
    const cost = l.unit_cost ?? 0
    if (!l.has_product || l.quantity <= 0 || cost <= 0 || f.sale <= 0) return f
    return { ...f, profit: f.sale - l.quantity * cost, costKnown: true }
  }
  const firstMatch = (f: SaleFigures) => cats.find((c) => loyaltyCategoryMatches(c, f))

  let total = 0
  if (settings.category_scope === 'invoice') {
    const agg: SaleFigures = { sale: 0, profit: 0, costKnown: false }
    for (const l of lines) {
      const f = figures(l)
      if (f.costKnown) {
        agg.sale += f.sale
        agg.profit += f.profit
        agg.costKnown = true
      }
    }
    const cat = firstMatch(agg)
    if (cat) {
      const r = categoryReward(cat, { ...agg, sale: billAmount })
      if (r > 0) {
        total = r
        matches[cat.name] = 1
      }
    }
  } else {
    for (const l of lines) {
      if (l.quantity <= 0) continue
      const f = figures(l)
      const cat = firstMatch(f)
      if (!cat) continue
      const r = categoryReward(cat, f)
      if (r > 0) {
        total += r
        matches[cat.name] = (matches[cat.name] ?? 0) + 1
      }
    }
  }
  const value = cash ? roundMoney(total) : Math.floor(total + 1e-9)
  return value > 0 ? { value, matches } : { value: 0, matches: {} }
}
