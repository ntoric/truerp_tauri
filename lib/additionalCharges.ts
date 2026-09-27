// Labelled additional charge/expense rows shared by the sales invoice,
// estimate and purchase invoice forms. The backend stores them as a JSON
// array under `additional_charge_items` and keeps `additional_charges`
// as the aggregate total.

export interface AdditionalChargeItem {
  label: string
  amount: number
}

export function parseAdditionalChargeItems(raw: unknown): AdditionalChargeItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({ label: String(r.label ?? ''), amount: Number(r.amount) || 0 }))
}

// hydrateAdditionalCharges restores editable rows for a saved document.
// Falls back to a single "Additional Charges" row when only the legacy
// aggregate amount exists.
export function hydrateAdditionalCharges(raw: unknown, legacyAmount?: number): AdditionalChargeItem[] {
  const items = parseAdditionalChargeItems(raw).filter((i) => i.amount > 0)
  if (items.length > 0) return items
  const amount = Number(legacyAmount) || 0
  return amount > 0 ? [{ label: 'Additional Charges', amount }] : []
}

// sanitizeAdditionalChargeItems prepares rows for the API payload: drops
// zero/empty rows and fills blank labels.
export function sanitizeAdditionalChargeItems(items: AdditionalChargeItem[]): AdditionalChargeItem[] {
  return items
    .filter((i) => Number(i.amount) > 0)
    .map((i) => ({ label: (i.label || '').trim() || 'Additional Charge', amount: Number(i.amount) || 0 }))
}

export function sumAdditionalChargeItems(items: AdditionalChargeItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
}

// displayAdditionalChargeRows returns the rows to render in previews and
// documents, falling back to the aggregate for legacy records.
export function displayAdditionalChargeRows(raw: unknown, aggregate?: number): AdditionalChargeItem[] {
  return hydrateAdditionalCharges(raw, aggregate)
}
