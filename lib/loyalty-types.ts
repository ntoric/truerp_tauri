/** What the earn rate applies to: the bill total, or profit on eligible items. */
export type LoyaltyEarnBasis = 'bill' | 'margin'

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
}
