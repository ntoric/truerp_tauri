'use client'

import { useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { WeighingScaleSettings } from '@/lib/weighingScale'
import {
  buildScaleCatalogCsv,
  downloadScaleCatalogCsv,
  resolveScaleCatalogExportFilename,
  type ScaleCatalogProduct,
} from '@/lib/weighingScaleCsv'
import { desktopPickExportDirectory, isDesktopApp } from '@/lib/desktopBridge'
import { Download, FolderOpen, Loader2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

interface WeighingScaleCatalogExportProps {
  settings: WeighingScaleSettings
  onUpdate?: <K extends keyof WeighingScaleSettings>(
    key: K,
    value: WeighingScaleSettings[K]
  ) => void
  className?: string
  compact?: boolean
}

export default function WeighingScaleCatalogExport({
  settings,
  onUpdate,
  className,
  compact = false,
}: WeighingScaleCatalogExportProps) {
  const [loading, setLoading] = useState(false)
  const [lastExport, setLastExport] = useState<{
    rows: number
    skipped: number
    filename: string
    path?: string
  } | null>(null)

  if (!settings.csv_import_enabled) return null

  const resolvedFilename = resolveScaleCatalogExportFilename(settings)
  const exportPath = settings.csv_export_path.trim()
  const canEditOutput = !!onUpdate

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
          'No products to export. Add item codes or PLUs and KG/GM items, or turn off "weight items only".'
        )
        return
      }
      const filename = resolveScaleCatalogExportFilename(settings)
      await downloadScaleCatalogCsv(filename, csv, {
        directory: exportPath || undefined,
      })
      setLastExport({
        rows: rowCount,
        skipped: skippedNoCode,
        filename,
        path: exportPath || undefined,
      })
      const destination = exportPath ? ` to ${exportPath}` : ''
      notifySuccess(`Saved ${filename}${destination} (${rowCount} products)`)
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
            Download a file and import it on the weighing machine so PLU / barcodes match your products.
            Default columns: item_code, plu, name, price, weight_type (1 = weight, 2 = non-weight)
            {settings.csv_extra_fields.length > 0
              ? `, plus ${settings.csv_extra_fields.length} extra field(s)`
              : ''}
            .
            {canEditOutput
              ? ' Set the output folder and filename below, then save settings.'
              : exportPath
                ? ` Saves to ${exportPath}.`
                : ' Saves to Downloads on desktop, or your browser download folder on web.'}
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

      {canEditOutput && (
        <div className="grid grid-cols-1 gap-3 rounded-md border bg-background p-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="catalog_export_path">Output folder</Label>
            <div className="flex gap-2">
              <Input
                id="catalog_export_path"
                value={settings.csv_export_path}
                onChange={(e) => onUpdate('csv_export_path', e.target.value)}
                placeholder={
                  isDesktopApp()
                    ? 'Leave empty for Downloads, or choose a folder'
                    : 'Used in desktop app; web exports to browser downloads'
                }
              />
              {isDesktopApp() && (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    void (async () => {
                      const picked = await desktopPickExportDirectory('Choose catalog export folder')
                      if (picked) onUpdate('csv_export_path', picked)
                    })()
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Browse
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="catalog_export_filename">Output filename</Label>
            <Input
              id="catalog_export_filename"
              value={settings.csv_export_filename}
              onChange={(e) => onUpdate('csv_export_filename', e.target.value)}
              placeholder="Default: scale-product-catalog-{date}.csv"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{date}'} for today&apos;s date. Preview:{' '}
              <span className="font-medium text-gray-800">{resolvedFilename}</span>
              {exportPath ? ` in ${exportPath}` : ' in Downloads'}
            </p>
          </div>
        </div>
      )}

      {!canEditOutput && (
        <p className="text-xs text-muted-foreground">
          Output: <span className="font-medium text-gray-800">{resolvedFilename}</span>
          {exportPath ? ` · ${exportPath}` : ''}
        </p>
      )}

      {lastExport && (
        <p className="text-xs text-gray-600">
          Last export: {lastExport.filename}
          {lastExport.path ? ` · ${lastExport.path}` : ''}
          · {lastExport.rows} row(s)
          {lastExport.skipped > 0 ? ` · ${lastExport.skipped} skipped (no item code or PLU)` : ''}
        </p>
      )}
    </div>
  )
}
