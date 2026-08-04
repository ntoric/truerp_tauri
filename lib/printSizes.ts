/** Thermal receipt / label paper widths supported by TruERP. */
export type ThermalPrintSize = '1inch' | '1.5inch' | '2inch' | '3inch'

export type BarcodeLabelSize = ThermalPrintSize

export const THERMAL_PRINT_SIZE_OPTIONS: {
  value: ThermalPrintSize
  label: string
  description: string
  widthMM: number
}[] = [
  { value: '1inch', label: '1 Inch (25mm)', description: '25.4 mm compact receipt / label', widthMM: 25 },
  { value: '1.5inch', label: '1.5 Inch (38mm)', description: '38.1 mm narrow thermal roll', widthMM: 38 },
  { value: '2inch', label: '2 Inch (58mm)', description: '58 mm standard receipt printer', widthMM: 58 },
  { value: '3inch', label: '3 Inch (80mm)', description: '80 mm wide receipt printer', widthMM: 80 },
]

/** Thermal sticker / label roll sizes (distinct from receipt widths). */
export const BARCODE_LABEL_SIZE_OPTIONS: {
  value: BarcodeLabelSize
  label: string
  description: string
}[] = [
  { value: '1inch', label: '1 Inch (25mm)', description: '25.4 × 15 mm compact sticker' },
  { value: '1.5inch', label: '1.5 Inch (38mm)', description: '38.1 × 25 mm shelf tag' },
  { value: '2inch', label: '2 Inch (51mm)', description: '50.8 × 30 mm standard label' },
  { value: '3inch', label: '3 Inch (76mm)', description: '76.2 × 50 mm large label' },
]

export function normalizeThermalPrintSize(value: unknown): ThermalPrintSize {
  if (value === '1inch' || value === '1.5inch' || value === '2inch' || value === '3inch') {
    return value
  }
  return '2inch'
}

export function thermalWidthMM(size: ThermalPrintSize): number {
  return THERMAL_PRINT_SIZE_OPTIONS.find((o) => o.value === size)?.widthMM ?? 58
}

export function thermalPreviewWidthPx(size: ThermalPrintSize): number {
  switch (size) {
    case '1inch':
      return 120
    case '1.5inch':
      return 168
    case '3inch':
      return 302
    default:
      return 219
  }
}
