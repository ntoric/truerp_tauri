'use client'

import { useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WeighingScaleSettings } from '@/lib/weighingScale'
import {
  buildScaleCatalogCsv,
  downloadScaleCatalogCsv,
  type ScaleCatalogProduct,
} from '@/lib/weighingScaleCsv'
import { Download, Loader2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

interface WeighingScaleCatalogExportProps {
  settings: WeighingScaleSettings
  className?: string
  compact?: boolean
}

export default function WeighingScaleCatalogExport({
  settings,
  className,
  compact = false,
}: WeighingScaleCatalogExportProps) {
  const [loading, setLoading] = useState(false)
  const [lastExport, setLastExport] = useState<{ rows: number; skipped: number } | null>(null)

  if (!settings.csv_import_enabled) return null

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/products')
      if (!res.ok) {
        notifyError('Failed to load products for scale catalog')
        return
      }
      const data = (await res.json()) as ScaleCatalogProduct[]
      const { csv, rowCount, skippedNoCode } = buildScaleCatalogCsv(data, settings)
      if (rowCount === 0) {
        notifyError(
          'No products to export. Add SKU/item code and KG/GM items, or turn off "weight items only".'
        )
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadScaleCatalogCsv(`scale-product-catalog-${stamp}.csv`, csv)
      setLastExport({ rows: rowCount, skipped: skippedNoCode })
      notifySuccess(`Downloaded ${rowCount} product(s) for scale CSV import`)
    } catch {
      notifyError('Failed to generate scale catalog CSV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('rounded-md border bg-muted/30 p-3 space-y-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn('font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>
            Product catalog CSV (for scale import)
          </p>
          <p className="text-xs text-muted-foreground">
            Download a file and import it on the weighing machine so PLU / item codes match your
            products. Sales still use scale barcodes or live weight on POS.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={compact ? 'h-7 text-xs shrink-0' : 'shrink-0'}
          disabled={loading}
          onClick={() => void handleExport()}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          Download CSV
        </Button>
      </div>
      {lastExport && (
        <p className="text-xs text-gray-600">
          Last file: {lastExport.rows} row(s)
          {lastExport.skipped > 0 ? ` · ${lastExport.skipped} skipped (no item code)` : ''}
        </p>
      )}
    </div>
  )
}
