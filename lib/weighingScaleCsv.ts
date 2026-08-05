import {
  isWeightBasedUnit,
  type WeighingScaleCsvDelimiter,
  type WeighingScaleCsvExtraField,
  type WeighingScaleCsvItemMatchField,
  type WeighingScaleSettings,
} from '@/lib/weighingScale'

export interface WeighingScaleProductRef {
  id: string
  name: string
  sku?: string
  item_code?: string
  unit: string
}

export interface ScaleCatalogProduct extends WeighingScaleProductRef {
  sale_price: number
  mrp?: number
  category?: string
  purchase_price?: number
  hsn_code?: string
  description?: string
  tax_rate?: number
  discount?: string
  min_stock?: number
  item_type?: string
}

/** Core columns always present in the scale catalog CSV. */
export const SCALE_CSV_CORE_HEADERS = {
  item_code: 'item_code',
  slug: 'slug',
  name: 'item_name',
  unit: 'unit',
  price: 'price',
} as const

export const SCALE_CSV_EXTRA_FIELD_OPTIONS: Array<{
  key: WeighingScaleCsvExtraField
  label: string
}> = [
  { key: 'category', label: 'Category' },
  { key: 'mrp', label: 'MRP' },
  { key: 'purchase_price', label: 'Purchase price' },
  { key: 'hsn_code', label: 'HSN code' },
  { key: 'description', label: 'Description' },
  { key: 'tax_rate', label: 'Tax rate %' },
  { key: 'discount', label: 'Discount' },
  { key: 'min_stock', label: 'Min stock' },
  { key: 'item_type', label: 'Item type' },
  { key: 'id', label: 'Product ID' },
]

function delimiterChar(delimiter: WeighingScaleCsvDelimiter): string {
  return delimiter === 'tab' ? '\t' : delimiter
}

function escapeCsvCell(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes('\n') || value.includes(delimiter)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatNumber(value: number | undefined | null, fallback = '0.00'): string {
  if (value == null || !Number.isFinite(Number(value))) return fallback
  return Number(value).toFixed(2)
}

/** Barcode / item code used as PLU in the scale catalog and when matching scans. */
export function getScaleItemCode(
  product: WeighingScaleProductRef,
  matchField: WeighingScaleCsvItemMatchField
): string {
  if (matchField === 'item_code') {
    return product.item_code?.trim() ?? ''
  }
  if (matchField === 'sku') {
    return product.sku?.trim() ?? ''
  }
  // Prefer barcode (item_code), then slug (SKU)
  return product.item_code?.trim() || product.sku?.trim() || ''
}

export function findProductByItemCode(
  itemCode: string,
  matchField: WeighingScaleCsvItemMatchField,
  products: WeighingScaleProductRef[]
): WeighingScaleProductRef | null {
  const code = itemCode.trim()
  if (!code) return null

  const bySku = products.filter((p) => p.sku?.trim() === code)
  const byItemCode = products.filter((p) => p.item_code?.trim() === code)

  if (matchField === 'sku') {
    return bySku[0] ?? null
  }
  if (matchField === 'item_code') {
    return byItemCode[0] ?? null
  }

  if (byItemCode.length === 1) return byItemCode[0]
  if (bySku.length === 1) return bySku[0]
  if (byItemCode.length > 1) return null
  if (bySku.length > 1) return null
  return byItemCode[0] ?? bySku[0] ?? null
}

function extraFieldValue(
  product: ScaleCatalogProduct,
  field: WeighingScaleCsvExtraField
): string {
  switch (field) {
    case 'category':
      return product.category?.trim() ?? ''
    case 'mrp':
      return formatNumber(product.mrp)
    case 'purchase_price':
      return formatNumber(product.purchase_price)
    case 'hsn_code':
      return product.hsn_code?.trim() ?? ''
    case 'description':
      return product.description?.trim() ?? ''
    case 'tax_rate':
      return formatNumber(product.tax_rate)
    case 'discount':
      return product.discount?.trim() ?? ''
    case 'min_stock':
      return formatNumber(product.min_stock)
    case 'item_type':
      return product.item_type?.trim() ?? ''
    case 'id':
      return product.id ?? ''
    default:
      return ''
  }
}

export function buildScaleCatalogCsv(
  products: ScaleCatalogProduct[],
  settings: Pick<
    WeighingScaleSettings,
    | 'csv_delimiter'
    | 'csv_has_header'
    | 'csv_item_code_column'
    | 'csv_slug_column'
    | 'csv_name_column'
    | 'csv_unit_column'
    | 'csv_price_column'
    | 'csv_export_weight_items_only'
    | 'csv_extra_fields'
  >
): { csv: string; rowCount: number; skippedNoCode: number } {
  const delimiter = delimiterChar(settings.csv_delimiter)
  const codeHeader = settings.csv_item_code_column.trim() || SCALE_CSV_CORE_HEADERS.item_code
  const slugHeader = settings.csv_slug_column.trim() || SCALE_CSV_CORE_HEADERS.slug
  const nameHeader = settings.csv_name_column.trim() || SCALE_CSV_CORE_HEADERS.name
  const unitHeader = settings.csv_unit_column.trim() || SCALE_CSV_CORE_HEADERS.unit
  const priceHeader = settings.csv_price_column.trim() || SCALE_CSV_CORE_HEADERS.price
  const extraFields = settings.csv_extra_fields ?? []

  const candidates = settings.csv_export_weight_items_only
    ? products.filter((p) => isWeightBasedUnit(p.unit))
    : products

  const headerCells = [codeHeader, slugHeader, nameHeader, unitHeader, priceHeader, ...extraFields]

  const lines: string[] = []
  if (settings.csv_has_header) {
    lines.push(headerCells.map((c) => escapeCsvCell(c, delimiter)).join(delimiter))
  }

  let rowCount = 0
  let skippedNoCode = 0

  for (const product of candidates) {
    // Item code column = barcode (item_code). Match-field only affects scan matching.
    const itemCode = product.item_code?.trim() || ''
    if (!itemCode) {
      skippedNoCode += 1
      continue
    }
    const slug = product.sku?.trim() || ''
    const row = [
      itemCode,
      slug,
      product.name,
      product.unit || 'KG',
      // Always sale price — never MRP
      formatNumber(product.sale_price),
      ...extraFields.map((field) => extraFieldValue(product, field)),
    ]
      .map((c) => escapeCsvCell(String(c), delimiter))
      .join(delimiter)
    lines.push(row)
    rowCount += 1
  }

  return { csv: lines.join('\n'), rowCount, skippedNoCode }
}

export function downloadScaleCatalogCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
