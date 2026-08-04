import type { LoyaltySettings } from './loyalty-types'

export function computeLoyaltyDiscount(
  settings: LoyaltySettings | null,
  availablePoints: number,
  billTotal: number,
  pointsToRedeem: number
): { discount: number; error?: string } {
  if (!pointsToRedeem || pointsToRedeem <= 0) {
    return { discount: 0 }
  }
  if (!settings?.is_enabled) {
    return { discount: 0, error: 'Loyalty program is not enabled' }
  }
  if (pointsToRedeem < settings.min_redeem_points) {
    return { discount: 0, error: `Minimum ${settings.min_redeem_points} points required` }
  }
  if (pointsToRedeem > availablePoints) {
    return { discount: 0, error: 'Insufficient points' }
  }
  const discount = pointsToRedeem * settings.point_value
  if (billTotal > 0 && settings.max_redeem_percent > 0) {
    const maxDiscount = billTotal * (settings.max_redeem_percent / 100)
    if (discount > maxDiscount) {
      return {
        discount: 0,
        error: `Max ${settings.max_redeem_percent}% of bill can be paid with points`,
      }
    }
  }
  if (discount > billTotal && billTotal > 0) {
    return { discount: 0, error: 'Redemption exceeds bill total' }
  }
  return { discount }
}

export function estimatePointsEarned(settings: LoyaltySettings | null, amount: number): number {
  if (!settings?.is_enabled || amount <= 0 || settings.spend_amount <= 0) {
    return 0
  }
  return Math.floor((amount / settings.spend_amount) * settings.points_per_spend)
}
