'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Package, Barcode, Camera, ClipboardPaste, Loader2 } from 'lucide-react'

export interface PastedItemRow {
  description: string
  quantity: string
  unitPrice: string
  taxRate: string
  hsnCode: string
}

interface ItemsEmptyStateProps {
  onAddProduct: () => void
  onScanBarcode: () => void
  onScanInvoiceAI?: () => void
  onPasteFromExcel: (rows: PastedItemRow[]) => void
  /** Render as a standalone block instead of a table body (card / mobile layouts). */
  variant?: 'table' | 'block'
}

export default function ItemsEmptyState({
  onAddProduct,
  onScanBarcode,
  onScanInvoiceAI,
  onPasteFromExcel,
  variant = 'table',
}: ItemsEmptyStateProps) {
  const [pasting, setPasting] = useState(false)

  const handlePasteFromExcel = async () => {
    setPasting(true)
    try {
      const text = await navigator.clipboard.readText()
      if (!text || !text.trim()) {
        return
      }

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      if (lines.length === 0) return

      // Skip a header row if the first row doesn't start with a number in column 2
      const firstCols = lines[0].split('\t')
      if (firstCols.length >= 2 && isNaN(Number(firstCols[1]))) {
        lines.shift()
      }

      const rows: PastedItemRow[] = lines.map((line) => {
        const cols = line.split('\t')
        return {
          description: (cols[0] ?? '').trim(),
          quantity: (cols[1] ?? '1').trim(),
          unitPrice: (cols[2] ?? '0').trim(),
          taxRate: (cols[3] ?? '0').trim(),
          hsnCode: (cols[4] ?? '').trim(),
        }
      }).filter((r) => r.description)

      if (rows.length > 0) {
        onPasteFromExcel(rows)
      }
    } catch {
      // Clipboard API may not be available (permissions, non-secure context)
      // Silently ignore — the button still serves as a visual affordance.
    } finally {
      setPasting(false)
    }
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-4 px-2 text-center">
      <div className="rounded-full bg-muted p-4">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-slate-700">No items yet</p>
        <p className="text-sm text-muted-foreground">
          Add products to your invoice to get started
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={onAddProduct}>
          <Package className="mr-2 h-4 w-4" />
          Add Product
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onScanBarcode}>
          <Barcode className="mr-2 h-4 w-4" />
          Scan Barcode
        </Button>
        {onScanInvoiceAI && (
          <Button type="button" variant="outline" size="sm" onClick={onScanInvoiceAI}>
            <Camera className="mr-2 h-4 w-4" />
            Scan Invoice (AI)
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePasteFromExcel}
          disabled={pasting}
        >
          {pasting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardPaste className="mr-2 h-4 w-4" />
          )}
          Paste from Excel
        </Button>
      </div>
    </div>
  )

  if (variant === 'block') {
    return <div className="py-8">{content}</div>
  }

  return (
    <tbody>
      <tr>
        <td colSpan={100} className="py-12">
          {content}
        </td>
      </tr>
    </tbody>
  )
}
