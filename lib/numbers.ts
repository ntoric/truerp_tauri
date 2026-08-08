/** Coerce form/API values to a finite number (HTML inputs often yield strings). */
export function parseItemNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value == null) return fallback

  let raw = String(value).trim()
  if (!raw) return fallback

  raw = raw
    .replace(/₹/g, '')
    .replace(/rs\.?/gi, '')
    .replace(/,/g, '')
    .trim()

  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Round money amounts to 2 decimal places. */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

/** Parse and clamp a money input to max 2 decimal places. */
export function parseMoney(value: unknown, fallback = 0): number {
  return roundMoney(parseItemNumber(value, fallback))
}

/**
 * Limit a typed numeric string to `places` decimal digits without blocking
 * intermediate input like "12." while editing.
 */
export function limitDecimalInput(raw: string, places = 2): string {
  const cleaned = String(raw ?? '').replace(/[^\d.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return cleaned

  const negative = cleaned.startsWith('-')
  const unsigned = negative ? cleaned.slice(1) : cleaned
  const [whole = '', frac = ''] = unsigned.split('.')
  const limited =
    unsigned.includes('.')
      ? `${whole}.${frac.slice(0, places)}`
      : whole

  return negative ? `-${limited}` : limited
}

/** Tax-exclusive unit price from a product price that may include tax. */
export function exclusiveUnitPrice(
  price: unknown,
  taxRate: unknown,
  priceIncludesTax: boolean | undefined | null
): number {
  const amount = parseItemNumber(price)
  const rate = parseItemNumber(taxRate)
  if (!priceIncludesTax || rate <= 0) return roundMoney(amount)
  return roundMoney(amount / (1 + rate / 100))
}

export type ProductGstFields = {
  gst_enabled?: boolean | null
  tax_rate?: unknown
}

/** Whether GST applies to a product (defaults from tax_rate for older records). */
export function isProductGstEnabled(product: ProductGstFields): boolean {
  if (typeof product.gst_enabled === 'boolean') return product.gst_enabled
  return parseItemNumber(product.tax_rate) > 0
}

/** Effective GST rate for invoice/POS lines (0 when GST is disabled). */
export function productTaxRate(product: ProductGstFields): number {
  if (!isProductGstEnabled(product)) return 0
  const rate = parseItemNumber(product.tax_rate, 18)
  return rate > 0 ? rate : 18
}

/** Tax-exclusive sale unit price respecting product GST settings. */
export function productSaleUnitPrice(product: {
  sale_price?: unknown
  tax_rate?: unknown
  sale_price_with_tax?: boolean | null
  gst_enabled?: boolean | null
}): number {
  const gstEnabled = isProductGstEnabled(product)
  return exclusiveUnitPrice(
    product.sale_price,
    productTaxRate(product),
    gstEnabled ? product.sale_price_with_tax : false
  )
}

/** Tax-exclusive purchase unit price respecting product GST settings. */
export function productPurchaseUnitPrice(product: {
  purchase_price?: unknown
  tax_rate?: unknown
  purchase_price_with_tax?: boolean | null
  gst_enabled?: boolean | null
}): number {
  const gstEnabled = isProductGstEnabled(product)
  return exclusiveUnitPrice(
    product.purchase_price,
    productTaxRate(product),
    gstEnabled ? product.purchase_price_with_tax : false
  )
}

/** Payable line total (qty × price, adding tax only when price is exclusive). */
export function linePayableTotal(
  price: unknown,
  quantity: unknown,
  taxRate: unknown,
  priceIncludesTax: boolean | undefined | null
): number {
  const qty = parseItemNumber(quantity)
  const rate = parseItemNumber(taxRate)
  const exclusive = exclusiveUnitPrice(price, rate, priceIncludesTax)
  const taxable = exclusive * qty
  const tax = rate > 0 ? taxable * (rate / 100) : 0
  return roundMoney(taxable + tax)
}

/** Tax portion of a line (extracted if inclusive, added if exclusive). */
export function lineTaxAmount(
  price: unknown,
  quantity: unknown,
  taxRate: unknown,
  priceIncludesTax: boolean | undefined | null
): number {
  const qty = parseItemNumber(quantity)
  const rate = parseItemNumber(taxRate)
  if (rate <= 0) return 0
  const exclusive = exclusiveUnitPrice(price, rate, priceIncludesTax)
  return roundMoney(exclusive * qty * (rate / 100))
}
