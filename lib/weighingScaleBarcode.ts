import {
  convertScaleWeightToProductQuantity,
  normalizeScaleWeightKg,
  type WeighingScaleSettings,
} from '@/lib/weighingScale'
import { findProductByItemCode, type WeighingScaleProductRef } from '@/lib/weighingScaleCsv'

export type WeighingScaleBarcodePayloadType = 'weight_grams' | 'weight_kg_thousandths' | 'price_paise'

export interface ParsedWeighingScaleBarcode {
  raw: string
  prefix: string
  plu: string
  payload: string
  weightKg: number
}

function pluLookupCodes(plu: string, padDigits = 5): string[] {
  const codes = new Set<string>()
  codes.add(plu)
  const trimmed = plu.replace(/^0+/, '')
  if (trimmed) codes.add(trimmed)
  const width = Math.max(padDigits, plu.length)
  codes.add(plu.padStart(width, '0'))
  if (trimmed) codes.add(trimmed.padStart(width, '0'))
  return [...codes]
}

function weightKgFromPayload(
  payload: string,
  payloadType: WeighingScaleBarcodePayloadType | string,
  tareWeight: number,
  minWeight: number
): { weightKg: number; ok: boolean } {
  const payloadValue = parseInt(payload, 10)
  if (!Number.isFinite(payloadValue)) return { weightKg: 0, ok: false }

  let weightKg: number
  switch (payloadType) {
    case 'weight_kg_thousandths':
      weightKg = payloadValue / 1000
      break
    case 'price_paise':
      if (payloadValue <= 0) return { weightKg: 0, ok: false }
      return { weightKg: 0, ok: true }
    case 'weight_grams':
    default:
      weightKg = payloadValue / 1000
      break
  }

  weightKg = normalizeScaleWeightKg(weightKg, 'kg', tareWeight)
  if (weightKg < minWeight) return { weightKg: 0, ok: false }
  return { weightKg, ok: true }
}

/**
 * Scale label format: {prefix}{plu}{weight}
 * Default: w + 5-digit PLU + 5-digit weight → e.g. w0000112500
 */
function parsePrefixedScaleBarcode(
  rawBarcode: string,
  settings: Pick<
    WeighingScaleSettings,
    | 'barcode_prefix'
    | 'barcode_plu_digits'
    | 'barcode_payload_digits'
    | 'barcode_payload_type'
    | 'tare_weight'
    | 'min_weight'
  >
): ParsedWeighingScaleBarcode | null {
  const prefix = (settings.barcode_prefix || 'w').trim()
  if (!prefix) return null

  const trimmed = rawBarcode.trim()
  if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) return null

  const rest = trimmed.slice(prefix.length)
  const digits = rest.replace(/\D/g, '')
  const pluLen = settings.barcode_plu_digits
  const payloadLen = settings.barcode_payload_digits
  const expected = pluLen + payloadLen
  if (digits.length < expected) return null

  const body = digits.slice(0, expected)
  const plu = body.slice(0, pluLen)
  const payload = body.slice(pluLen, pluLen + payloadLen)
  if (!/^\d+$/.test(plu) || !/^\d+$/.test(payload)) return null

  const { weightKg, ok } = weightKgFromPayload(
    payload,
    settings.barcode_payload_type,
    settings.tare_weight,
    settings.min_weight
  )
  if (!ok) return null

  return {
    raw: trimmed,
    prefix,
    plu,
    payload,
    weightKg,
  }
}

/** Legacy EAN-13 style: 2-digit prefix (20–29) + PLU + weight (+ optional check digit) */
function parseEanScaleBarcode(
  rawBarcode: string,
  settings: Pick<
    WeighingScaleSettings,
    | 'barcode_prefix_start'
    | 'barcode_prefix_end'
    | 'barcode_plu_digits'
    | 'barcode_payload_digits'
    | 'barcode_payload_type'
    | 'tare_weight'
    | 'min_weight'
  >
): ParsedWeighingScaleBarcode | null {
  const digits = rawBarcode.replace(/\D/g, '')
  const pluLen = settings.barcode_plu_digits
  const payloadLen = settings.barcode_payload_digits
  const minLen = 2 + pluLen + payloadLen

  if (digits.length < minLen) return null

  const body = digits.length >= minLen + 1 ? digits.slice(0, -1) : digits.slice(0, minLen)
  if (body.length < minLen) return null

  const prefixNum = parseInt(body.slice(0, 2), 10)
  if (
    Number.isNaN(prefixNum) ||
    prefixNum < settings.barcode_prefix_start ||
    prefixNum > settings.barcode_prefix_end
  ) {
    return null
  }

  const plu = body.slice(2, 2 + pluLen)
  const payload = body.slice(2 + pluLen, 2 + pluLen + payloadLen)
  if (!/^\d+$/.test(payload)) return null

  const { weightKg, ok } = weightKgFromPayload(
    payload,
    settings.barcode_payload_type,
    settings.tare_weight,
    settings.min_weight
  )
  if (!ok) return null

  return {
    raw: rawBarcode.trim(),
    prefix: String(prefixNum).padStart(2, '0'),
    plu,
    payload,
    weightKg,
  }
}

export function parseWeighingScaleBarcode(
  rawBarcode: string,
  settings: Pick<
    WeighingScaleSettings,
    | 'barcode_scan_enabled'
    | 'barcode_prefix'
    | 'barcode_prefix_start'
    | 'barcode_prefix_end'
    | 'barcode_plu_digits'
    | 'barcode_payload_digits'
    | 'barcode_payload_type'
    | 'scale_weight_unit'
    | 'tare_weight'
    | 'min_weight'
  >
): ParsedWeighingScaleBarcode | null {
  if (!settings.barcode_scan_enabled) return null

  const prefixed = parsePrefixedScaleBarcode(rawBarcode, settings)
  if (prefixed) return prefixed

  return parseEanScaleBarcode(rawBarcode, settings)
}

/** True when the scan looks like a scale barcode (for mismatch error messages). */
export function looksLikeScaleBarcode(
  rawBarcode: string,
  settings: Pick<
    WeighingScaleSettings,
    | 'barcode_prefix'
    | 'barcode_prefix_start'
    | 'barcode_prefix_end'
    | 'barcode_plu_digits'
    | 'barcode_payload_digits'
  >
): boolean {
  const trimmed = rawBarcode.trim()
  const prefix = (settings.barcode_prefix || 'w').trim()
  const pluLen = settings.barcode_plu_digits
  const payloadLen = settings.barcode_payload_digits

  if (prefix && trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    const digits = trimmed.slice(prefix.length).replace(/\D/g, '')
    return digits.length >= pluLen + payloadLen
  }

  const digits = trimmed.replace(/\D/g, '')
  const minLen = 2 + pluLen + payloadLen
  if (digits.length < minLen) return false
  const prefixNum = parseInt(digits.slice(0, 2), 10)
  return (
    !Number.isNaN(prefixNum) &&
    prefixNum >= settings.barcode_prefix_start &&
    prefixNum <= settings.barcode_prefix_end
  )
}

export function findProductByScalePlu(
  plu: string,
  products: WeighingScaleProductRef[],
  padDigits = 5
): WeighingScaleProductRef | null {
  for (const code of pluLookupCodes(plu, padDigits)) {
    const product = findProductByItemCode(code, 'plu', products)
    if (product) return product
  }
  return null
}

export function quantityFromScaleBarcode(
  parsed: ParsedWeighingScaleBarcode,
  productUnit: string,
  decimalPlaces: number,
  salePricePerUnit?: number,
  payloadType?: WeighingScaleBarcodePayloadType
): number | null {
  if (payloadType === 'price_paise' && salePricePerUnit && salePricePerUnit > 0) {
    const priceRupees = parseInt(parsed.payload, 10) / 100
    return convertScaleWeightToProductQuantity(
      priceRupees / salePricePerUnit,
      productUnit,
      decimalPlaces
    )
  }
  return convertScaleWeightToProductQuantity(parsed.weightKg, productUnit, decimalPlaces)
}

export interface ScaleBarcodeCartResult {
  product: WeighingScaleProductRef & { sale_price: number; unit: string }
  quantity: number
}

export function resolveScaleBarcodeForPos(
  rawBarcode: string,
  settings: WeighingScaleSettings,
  products: Array<WeighingScaleProductRef & { sale_price: number; unit: string }>
): ScaleBarcodeCartResult | null {
  const parsed = parseWeighingScaleBarcode(rawBarcode, settings)
  if (!parsed) return null

  const product = findProductByScalePlu(parsed.plu, products, settings.barcode_plu_digits)
  if (!product) return null

  const full = products.find((p) => p.id === product.id)
  if (!full) return null

  let quantity: number | null
  if (settings.barcode_payload_type === 'price_paise') {
    quantity = quantityFromScaleBarcode(
      parsed,
      full.unit,
      settings.decimal_places,
      full.sale_price,
      'price_paise'
    )
  } else {
    quantity = quantityFromScaleBarcode(parsed, full.unit, settings.decimal_places)
  }

  if (quantity === null || quantity <= 0) return null

  return { product: full, quantity }
}

/** Alias used by POS and sales invoices. */
export const resolveScaleBarcode = resolveScaleBarcodeForPos
