/** What the earn rate applies to: the bill total, profit on eligible items, or loyalty categories. */
export type LoyaltyEarnBasis = 'bill' | 'margin' | 'category'

/** One criterion of a loyalty category. `join` links it to the previous one (AND binds tighter than OR). */
export interface LoyaltyCondition {
  field: 'margin_percent' | 'profit_amount'
  op: 'gte' | 'gt' | 'lte' | 'lt' | 'eq'
  value: number
  join?: 'and' | 'or' | ''
}

/**
 * Reward slab for the category earn basis. The first active category (in list
 * order) whose conditions a sale meets gives the reward; no conditions = catch-all.
 * Cash mode: percent = % of base as ₹, fixed = ₹ per match.
 * Points mode: percent = points per ₹100 of base, fixed = points per match.
 */
export interface LoyaltyCategory {
  id?: string
  name: string
  is_active: boolean
  conditions: LoyaltyCondition[]
  reward_kind: 'percent' | 'fixed'
  reward_value: number
  reward_on: 'sale' | 'profit'
}

/** How customers are rewarded: points redeemable at point_value, or ₹ cashback credit. */
export type LoyaltyRewardType = 'points' | 'cash'

export interface LoyaltySettings {
  is_enabled: boolean
  spend_amount: number
  points_per_spend: number
  point_value: number
  min_redeem_points: number
  max_redeem_percent: number
  /** Missing on older cached settings — treat as 'points'. */
  reward_type?: LoyaltyRewardType
  /** Cash mode: % of the bill credited to the customer as ₹ cashback. */
  cashback_percent?: number
  /** Cash mode: minimum ₹ cashback per redemption. */
  min_redeem_amount?: number
  /** Missing on older cached settings — treat as 'bill'. */
  earn_basis?: LoyaltyEarnBasis
  /** Margin basis: only items with at least this margin % (on selling price) earn. */
  min_margin_percent?: number
  /** Category basis: match each item ('item') or the whole bill ('invoice'). */
  category_scope?: 'item' | 'invoice'
  categories?: LoyaltyCategory[]
}
