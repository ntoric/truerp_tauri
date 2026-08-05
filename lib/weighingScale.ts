export type WeighingScaleProtocol = 'generic' | 'cas' | 'toledo' | 'legacy_fixed'
export type WeighingScaleConnection = 'serial' | 'keyboard'
export type ScaleWeightUnit = 'kg' | 'g'
export type WeighingScaleCsvDelimiter = ',' | ';' | 'tab'
/** How POS matches scale PLU to products (CSV item_code always uses barcode). */
export type WeighingScaleCsvItemMatchField = 'auto' | 'sku' | 'item_code'
export type WeighingScaleCsvExtraField =
  | 'category'
  | 'mrp'
  | 'purchase_price'
  | 'hsn_code'
  | 'description'
  | 'tax_rate'
  | 'discount'
  | 'min_stock'
  | 'item_type'
  | 'id'

export interface WeighingScaleSettings {
  enabled: boolean
  connection: WeighingScaleConnection
  protocol: WeighingScaleProtocol
  baud_rate: number
  data_bits: 7 | 8
  stop_bits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  scale_weight_unit: ScaleWeightUnit
  decimal_places: number
  min_weight: number
  tare_weight: number
  stable_readings_required: number
  require_stable_weight: boolean
  auto_apply_on_pos: boolean
  auto_apply_on_invoice: boolean
  csv_import_enabled: boolean
  csv_has_header: boolean
  csv_delimiter: WeighingScaleCsvDelimiter
  csv_item_match_field: WeighingScaleCsvItemMatchField
  csv_item_code_column: string
  /** Header for slug column (product SKU). */
  csv_slug_column: string
  csv_name_column: string
  csv_unit_column: string
  csv_price_column: string
  csv_export_weight_items_only: boolean
  /** Optional product fields appended after core CSV columns. */
  csv_extra_fields: WeighingScaleCsvExtraField[]
  barcode_scan_enabled: boolean
  /** Leading character(s) on scale labels, e.g. "w" → w0000112500 */
  barcode_prefix: string
  /** Legacy EAN numeric prefix range (optional fallback when barcode has no letter prefix) */
  barcode_prefix_start: number
  barcode_prefix_end: number
  barcode_plu_digits: number
  barcode_payload_digits: number
  barcode_payload_type: 'weight_grams' | 'weight_kg_thousandths' | 'price_paise'
}

const VALID_CSV_EXTRA_FIELDS = new Set<WeighingScaleCsvExtraField>([
  'category',
  'mrp',
  'purchase_price',
  'hsn_code',
  'description',
  'tax_rate',
  'discount',
  'min_stock',
  'item_type',
  'id',
])

export function parseCsvExtraFields(
  value: unknown
): WeighingScaleCsvExtraField[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is WeighingScaleCsvExtraField =>
        typeof v === 'string' && VALID_CSV_EXTRA_FIELDS.has(v as WeighingScaleCsvExtraField)
    )
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) return parseCsvExtraFields(parsed)
    } catch {
      /* comma-separated fallback */
    }
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(
        (v): v is WeighingScaleCsvExtraField =>
          VALID_CSV_EXTRA_FIELDS.has(v as WeighingScaleCsvExtraField)
      )
  }
  return []
}

export const DEFAULT_WEIGHING_SCALE_SETTINGS: WeighingScaleSettings = {
  enabled: false,
  connection: 'serial',
  protocol: 'generic',
  baud_rate: 9600,
  data_bits: 8,
  stop_bits: 1,
  parity: 'none',
  scale_weight_unit: 'kg',
  decimal_places: 3,
  min_weight: 0.001,
  tare_weight: 0,
  stable_readings_required: 3,
  require_stable_weight: true,
  auto_apply_on_pos: true,
  auto_apply_on_invoice: true,
  csv_import_enabled: true,
  csv_has_header: true,
  csv_delimiter: ',',
  csv_item_match_field: 'item_code',
  csv_item_code_column: '',
  csv_slug_column: '',
  csv_name_column: '',
  csv_unit_column: '',
  csv_price_column: '',
  csv_export_weight_items_only: true,
  csv_extra_fields: [],
  barcode_scan_enabled: true,
  barcode_prefix: 'w',
  barcode_prefix_start: 20,
  barcode_prefix_end: 29,
  barcode_plu_digits: 5,
  barcode_payload_digits: 5,
  barcode_payload_type: 'weight_grams',
}

const WEIGHT_UNITS = new Set(['KG', 'GM', 'G', 'GRAM', 'KGS', 'KILOGRAM', 'KILOGRAMS'])

export function isWeightBasedUnit(unit: string | undefined | null): boolean {
  if (!unit) return false
  const normalized = unit.trim().toUpperCase()
  return WEIGHT_UNITS.has(normalized)
}

export function roundWeight(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round(value * factor) / factor
}

export function parseWeightFromScaleLine(
  line: string,
  protocol: WeighingScaleProtocol
): number | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  switch (protocol) {
    case 'legacy_fixed': {
      const digits = trimmed.replace(/[^\d]/g, '')
      if (digits.length >= 4) {
        const slice = digits.slice(-7)
        const value = parseInt(slice, 10) / 1000
        return Number.isFinite(value) ? value : null
      }
      break
    }
    case 'cas': {
      const casMatch = trimmed.match(/([+-]?\d+\.?\d*)\s*(kg|g|gm)?/i)
      if (casMatch) {
        let value = parseFloat(casMatch[1])
        const unit = (casMatch[2] || 'kg').toLowerCase()
        if (unit === 'g' || unit === 'gm') value /= 1000
        return Number.isFinite(value) ? value : null
      }
      break
    }
    case 'toledo': {
      const toledoMatch = trimmed.match(/([+-]?\d+\.?\d*)/)
      if (toledoMatch) {
        const value = parseFloat(toledoMatch[1])
        return Number.isFinite(value) ? value : null
      }
      break
    }
    case 'generic':
    default: {
      const genericMatch = trimmed.match(/([+-]?\d+\.?\d*)/)
      if (genericMatch) {
        const value = parseFloat(genericMatch[1])
        return Number.isFinite(value) ? value : null
      }
    }
  }

  return null
}

export function normalizeScaleWeightKg(
  rawWeight: number,
  scaleUnit: ScaleWeightUnit,
  tareWeight: number
): number {
  const weightKg = scaleUnit === 'g' ? rawWeight / 1000 : rawWeight
  return Math.max(0, weightKg - tareWeight)
}

export function convertScaleWeightToProductQuantity(
  weightKg: number,
  productUnit: string,
  decimalPlaces: number
): number {
  const unit = productUnit.trim().toUpperCase()
  if (unit === 'GM' || unit === 'G' || unit === 'GRAM') {
    return roundWeight(weightKg * 1000, decimalPlaces)
  }
  return roundWeight(weightKg, decimalPlaces)
}

export function mergeWeighingScaleSettings(
  partial: Partial<WeighingScaleSettings> | null | undefined
): WeighingScaleSettings {
  const merged = { ...DEFAULT_WEIGHING_SCALE_SETTINGS, ...partial }
  if (partial && 'csv_weight_column' in partial && !partial.csv_price_column) {
    merged.csv_price_column = String((partial as { csv_weight_column?: string }).csv_weight_column ?? '')
  }
  if (!merged.barcode_prefix?.trim()) {
    merged.barcode_prefix = DEFAULT_WEIGHING_SCALE_SETTINGS.barcode_prefix
  }
  merged.csv_extra_fields = parseCsvExtraFields(
    (partial as { csv_extra_fields?: unknown } | null | undefined)?.csv_extra_fields ??
      merged.csv_extra_fields
  )
  return merged
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}
