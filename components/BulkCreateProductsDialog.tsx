'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { asArray } from '@/lib/utils'
import { DEFAULT_CATEGORY_NAME, pickDefaultCategoryName } from '@/lib/defaultCategories'
import { notifyError, notifySuccess } from '@/lib/notify'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import type { CreatedProduct } from '@/components/CreateProductDialog'
import ProductItemCodeField from '@/components/ProductItemCodeField'

const PRODUCT_IMPORT_HEADERS = [
  'Name',
  'SKU',
  'Item Code',
  'PLU',
  'Category',
  'Unit',
  'HSN Code',
  'Purchase Price',
  'Sale Price',
  'MRP',
  'Tax Rate %',
  'Discount',
  'Min Stock',
  'Item Type',
  'Low Stock Alert',
  'Enable Batching',
  'Sale Price With Tax',
  'Purchase Price With Tax',
]

const PRODUCT_IMPORT_SAMPLE_ROW: (string | number)[] = [
  'Sample Product',
  'SKU001',
  'ITEM001',
  '1',
  'General',
  'PCS',
  '8471',
  100,
  150,
  180,
  18,
  '5',
  10,
  'product',
  'TRUE',
  'FALSE',
  'TRUE',
  'TRUE',
]

const UNIT_OPTIONS = [
  'PCS',
  'KG',
  'LTR',
  'MTR',
  'BOX',
  'DOZ',
  'GM',
  'ML',
  'FT',
  'INCH',
  'SET',
  'PKT',
  'BTL',
  'CAN',
  'BAG',
  'ROLL',
] as const

type BulkRow = {
  key: string
  name: string
  sku: string
  item_code: string
  category: string
  unit: string
  hsn_code: string
  purchase_price: string
  sale_price: string
  mrp: string
  tax_rate: string
  enable_batching: boolean
}

interface Category {
  id: string
  name: string
}

export interface BulkCreateProductsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after products are created (quick entry and/or file import). */
  onCreated?: (products: CreatedProduct[]) => void
  /** When true, refresh callers typically reload lists; dialog still reports created products. */
  defaultTab?: 'quick' | 'import'
}

function newRow(category = DEFAULT_CATEGORY_NAME): BulkRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    sku: '',
    item_code: '',
    category,
    unit: 'PCS',
    hsn_code: '',
    purchase_price: '',
    sale_price: '',
    mrp: '',
    tax_rate: '',
    enable_batching: false,
  }
}

function toCreatedProduct(data: Record<string, unknown>, fallback: BulkRow): CreatedProduct {
  return {
    id: String(data.id ?? ''),
    name: String(data.name ?? fallback.name),
    sku: String(data.sku ?? fallback.sku),
    item_code: String(data.item_code ?? fallback.item_code),
    hsn_code: String(data.hsn_code ?? fallback.hsn_code),
    sale_price: Number(data.sale_price ?? fallback.sale_price) || 0,
    purchase_price: Number(data.purchase_price ?? fallback.purchase_price) || 0,
    tax_rate: Number(data.tax_rate ?? fallback.tax_rate) || 0,
    gst_enabled: Boolean(data.gst_enabled),
    unit: String(data.unit ?? fallback.unit ?? 'PCS'),
    stock_qty: Number(data.stock_qty ?? 0) || 0,
    category: String(data.category ?? fallback.category),
    sale_price_with_tax: data.sale_price_with_tax !== false,
    enable_batching: Boolean(data.enable_batching ?? fallback.enable_batching),
  }
}

export default function BulkCreateProductsDialog({
  open,
  onOpenChange,
  onCreated,
  defaultTab = 'quick',
}: BulkCreateProductsDialogProps) {
  const [tab, setTab] = useState<'quick' | 'import'>(defaultTab)
  const [categories, setCategories] = useState<Category[]>([])
  const [defaultCategory, setDefaultCategory] = useState(DEFAULT_CATEGORY_NAME)
  const [rows, setRows] = useState<BulkRow[]>([newRow()])
  const [creating, setCreating] = useState(false)
  const [quickErrors, setQuickErrors] = useState<string[]>([])

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setTab(defaultTab)
    setRows([newRow(defaultCategory)])
    setQuickErrors([])
    setImportFile(null)
    setImportedCount(null)
    setImportErrors([])
    if (importFileRef.current) importFileRef.current.value = ''
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) resetState()
  }

  useEffect(() => {
    if (!open) return

    setTab(defaultTab)
    setQuickErrors([])
    setImportedCount(null)
    setImportErrors([])

    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/categories')
        if (!res.ok || cancelled) return
        const data = await res.json()
        const list = asArray<Category>(data)
        if (cancelled) return
        setCategories(list)
        const cat = pickDefaultCategoryName(list)
        setDefaultCategory(cat)
        setRows((prev) => {
          if (prev.length === 1 && !prev[0].name.trim()) {
            return [newRow(cat)]
          }
          return prev
        })
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, defaultTab])

  const updateRow = (key: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const addRow = () => setRows((prev) => [...prev, newRow(defaultCategory)])

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)))
  }

  const handleDownloadImportTemplate = () => {
    void downloadCsv(
      `products_import_template_${accountingExportDateStamp()}.csv`,
      [PRODUCT_IMPORT_HEADERS, PRODUCT_IMPORT_SAMPLE_ROW],
      { label: 'Exporting import template' }
    )
  }

  const handleQuickCreate = async () => {
    const filled = rows.filter((row) => row.name.trim())
    if (filled.length === 0) {
      notifyError('Enter at least one product name')
      return
    }

    setCreating(true)
    setQuickErrors([])
    const created: CreatedProduct[] = []
    const errors: string[] = []

    for (let i = 0; i < filled.length; i++) {
      const row = filled[i]
      const payload = {
        name: row.name.trim(),
        sku: row.sku.trim(),
        item_code: row.item_code.trim(),
        category: row.category.trim() || defaultCategory,
        unit: row.unit || 'PCS',
        hsn_code: row.hsn_code.trim(),
        purchase_price: Number(row.purchase_price) || 0,
        sale_price: Number(row.sale_price) || 0,
        mrp: Number(row.mrp) || 0,
        tax_rate: Number(row.tax_rate) || 0,
        gst_enabled: (Number(row.tax_rate) || 0) > 0 || Boolean(row.hsn_code.trim()),
        item_type: 'product',
        low_stock_alert: true,
        enable_batching: row.enable_batching,
        sale_price_with_tax: true,
        purchase_price_with_tax: true,
        discount: '',
        min_stock: 0,
      }

      try {
        const res = await apiFetch('/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          errors.push(`Row ${i + 1} (${row.name}): ${data.error || 'Failed to create'}`)
          continue
        }
        created.push(toCreatedProduct(data, row))
      } catch {
        errors.push(`Row ${i + 1} (${row.name}): Failed to create`)
      }
    }

    setQuickErrors(errors)
    setCreating(false)

    if (created.length > 0) {
      onCreated?.(created)
      notifySuccess(
        `Created ${created.length} product${created.length === 1 ? '' : 's'}${
          errors.length ? ` (${errors.length} failed)` : ''
        }`
      )
      if (errors.length === 0) {
        handleOpenChange(false)
      } else {
        // Keep failed rows for correction
        const failedNames = new Set(
          errors
            .map((e) => {
              const match = e.match(/^Row \d+ \((.+)\):/)
              return match?.[1]?.trim().toLowerCase()
            })
            .filter(Boolean) as string[]
        )
        const createdNames = new Set(created.map((p) => p.name.trim().toLowerCase()))
        setRows((prev) => {
          const remaining = prev.filter(
            (row) =>
              !row.name.trim() ||
              failedNames.has(row.name.trim().toLowerCase()) ||
              !createdNames.has(row.name.trim().toLowerCase())
          )
          return remaining.length ? remaining : [newRow(defaultCategory)]
        })
      }
    } else if (errors.length > 0) {
      notifyError('No products were created. Please review the errors below.')
    }
  }

  const handleImportProducts = async () => {
    if (!importFile) {
      notifyError('Please select a CSV or Excel file to import')
      return
    }

    setImporting(true)
    setImportedCount(null)
    setImportErrors([])

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const fileName = importFile.name.toLowerCase()
      const endpoint =
        fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
          ? '/products/import/excel'
          : '/products/import/csv'

      const res = await apiFetch(endpoint, { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        const count = data.imported ?? 0
        const errors: string[] = data.errors ?? []
        setImportedCount(count)
        setImportErrors(errors)

        if (count > 0) {
          // File import does not return created product bodies; notify parent to refresh.
          onCreated?.([])
          notifySuccess(`Successfully imported ${count} product${count === 1 ? '' : 's'}`)
        }

        if (count === 0 && errors.length > 0) {
          notifyError('No products were imported. Please review the errors below.')
        } else if (errors.length > 0) {
          notifyError(`${errors.length} row${errors.length === 1 ? '' : 's'} could not be imported`)
        } else if (count > 0) {
          handleOpenChange(false)
        }
      } else {
        notifyError(data.error || 'Import failed')
      }
    } catch (err) {
      console.error(err)
      notifyError('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Create Products</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'quick' | 'import')}
          className="flex-1 min-h-0 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Entry</TabsTrigger>
            <TabsTrigger value="import">File Import</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="flex-1 min-h-0 mt-4 space-y-3 overflow-hidden flex flex-col">
            <p className="text-sm text-muted-foreground">
              Add multiple products at once. Only Name is required; SKU and PLU are assigned automatically when left blank.
              Use the refresh icon on Item Code to generate a unique barcode. Check{' '}
              <span className="font-medium text-foreground">Batch</span> to track stock by batch number.
            </p>
            <div className="flex-1 min-h-0 overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b z-10">
                  <tr className="text-left">
                    <th className="p-2 font-medium min-w-[140px]">Name *</th>
                    <th className="p-2 font-medium min-w-[100px]">SKU</th>
                    <th className="p-2 font-medium min-w-[160px]">Item Code</th>
                    <th className="p-2 font-medium min-w-[120px]">Category</th>
                    <th className="p-2 font-medium min-w-[90px]">Unit</th>
                    <th className="p-2 font-medium min-w-[90px]">HSN</th>
                    <th className="p-2 font-medium min-w-[90px]">Purchase</th>
                    <th className="p-2 font-medium min-w-[90px]">Sale</th>
                    <th className="p-2 font-medium min-w-[80px]">MRP</th>
                    <th className="p-2 font-medium min-w-[70px]">Tax %</th>
                    <th className="p-2 font-medium min-w-[70px] text-center" title="Track stock by batch number">
                      Batch
                    </th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="p-1.5">
                        <Input
                          value={row.name}
                          onChange={(e) => updateRow(row.key, { name: e.target.value })}
                          placeholder="Product name"
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          value={row.sku}
                          onChange={(e) => updateRow(row.key, { sku: e.target.value })}
                          placeholder="Auto"
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <ProductItemCodeField
                          value={row.item_code}
                          unit={row.unit}
                          onChange={(item_code) => updateRow(row.key, { item_code })}
                          compact
                          reservedCodes={rows
                            .filter((r) => r.key !== row.key)
                            .map((r) => r.item_code)}
                          onGenerateError={(message) => notifyError(message)}
                        />
                      </td>
                      <td className="p-1.5">
                        <Select
                          value={row.category || defaultCategory}
                          onValueChange={(value) => updateRow(row.key, { category: value })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(categories.length
                              ? categories.map((c) => c.name)
                              : [defaultCategory]
                            ).map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1.5">
                        <Select
                          value={row.unit}
                          onValueChange={(value) => updateRow(row.key, { unit: value })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1.5">
                        <Input
                          value={row.hsn_code}
                          onChange={(e) => updateRow(row.key, { hsn_code: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          value={row.purchase_price}
                          onChange={(e) => updateRow(row.key, { purchase_price: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          value={row.sale_price}
                          onChange={(e) => updateRow(row.key, { sale_price: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          value={row.mrp}
                          onChange={(e) => updateRow(row.key, { mrp: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          value={row.tax_rate}
                          onChange={(e) => updateRow(row.key, { tax_rate: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={row.enable_batching}
                            onCheckedChange={(checked) =>
                              updateRow(row.key, { enable_batching: checked === true })
                            }
                            aria-label={`Enable batching for ${row.name || 'row'}`}
                          />
                        </div>
                      </td>
                      <td className="p-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeRow(row.key)}
                          disabled={rows.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
              <span className="text-xs text-muted-foreground">
                {rows.filter((r) => r.name.trim()).length} of {rows.length} rows filled
              </span>
            </div>
            {quickErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 max-h-28 overflow-y-auto space-y-1">
                {quickErrors.map((error, index) => (
                  <p key={`${error}-${index}`}>{error}</p>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file with your product data. Download the template first to see the required
              columns and format.
            </p>
            <Button variant="outline" onClick={handleDownloadImportTemplate} className="gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4" />
              Download Import Template
            </Button>
            <div className="space-y-2">
              <Label htmlFor="bulk_product_import_file">Import file</Label>
              <Input
                id="bulk_product_import_file"
                ref={importFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile && <p className="text-sm text-muted-foreground">Selected: {importFile.name}</p>}
            </div>
            {importedCount !== null && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Imported {importedCount} product{importedCount === 1 ? '' : 's'} successfully.
              </div>
            )}
            {importErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 max-h-40 overflow-y-auto space-y-1">
                {importErrors.map((error, index) => (
                  <p key={`${error}-${index}`}>{error}</p>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {tab === 'quick' ? (
            <Button type="button" onClick={handleQuickCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Products'}
            </Button>
          ) : (
            <Button type="button" onClick={handleImportProducts} disabled={importing || !importFile}>
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Importing...' : 'Import Products'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
