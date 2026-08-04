import {
  isWeightBasedUnit,
  type WeighingScaleCsvDelimiter,
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
}

function delimiterChar(delimiter: WeighingScaleCsvDelimiter): string {
  return delimiter === 'tab' ? '\t' : delimiter
}

function escapeCsvCell(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes('\n') || value.includes(delimiter)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

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
  return product.sku?.trim() || product.item_code?.trim() || ''
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

  if (bySku.length === 1) return bySku[0]
  if (byItemCode.length === 1) return byItemCode[0]
  if (bySku.length > 1) return null
  if (byItemCode.length > 1) return null
  return bySku[0] ?? byItemCode[0] ?? null
}

export function buildScaleCatalogCsv(
  products: ScaleCatalogProduct[],
  settings: Pick<
    WeighingScaleSettings,
    | 'csv_delimiter'
    | 'csv_has_header'
    | 'csv_item_match_field'
    | 'csv_item_code_column'
    | 'csv_name_column'
    | 'csv_unit_column'
    | 'csv_price_column'
    | 'csv_export_weight_items_only'
  >
): { csv: string; rowCount: number; skippedNoCode: number } {
  const delimiter = delimiterChar(settings.csv_delimiter)
  const codeHeader = settings.csv_item_code_column.trim() || 'item_code'
  const nameHeader = settings.csv_name_column.trim() || 'item_name'
  const unitHeader = settings.csv_unit_column.trim() || 'unit'
  const priceHeader = settings.csv_price_column.trim() || 'price'

  const candidates = settings.csv_export_weight_items_only
    ? products.filter((p) => isWeightBasedUnit(p.unit))
    : products

  const lines: string[] = []
  if (settings.csv_has_header) {
    lines.push(
      [codeHeader, nameHeader, unitHeader, priceHeader]
        .map((c) => escapeCsvCell(c, delimiter))
        .join(delimiter)
    )
  }

  let rowCount = 0
  let skippedNoCode = 0

  for (const product of candidates) {
    const itemCode = getScaleItemCode(product, settings.csv_item_match_field)
    if (!itemCode) {
      skippedNoCode += 1
      continue
    }
    const row = [
      itemCode,
      product.name,
      product.unit || 'KG',
      product.sale_price.toFixed(2),
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
