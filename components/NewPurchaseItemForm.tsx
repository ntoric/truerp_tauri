'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import ProductItemCodeField from '@/components/ProductItemCodeField'
import { cn, formatCurrency } from '@/lib/utils'
import { DEFAULT_CATEGORY_NAME } from '@/lib/defaultCategories'
import { limitDecimalInput, parseMoney } from '@/lib/numbers'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'

export type NewProductDraft = {
  item_code: string
  category: string
}

export function emptyNewProductDraft(category = DEFAULT_CATEGORY_NAME): NewProductDraft {
  return {
    item_code: '',
    category,
  }
}

export type NewPurchaseLineItem = {
  description: string
  hsn_code: string
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  mrp: number
  sale_price: number
  unit: string
  total: number
  purchase_price_with_tax: boolean
  batch_no: string
  mfg_date: string
  exp_date: string
  enable_batching?: boolean
}

const UNIT_OPTIONS = [
  { value: 'PCS', label: 'PCS (Pieces)' },
  { value: 'KG', label: 'KG (Kilogram)' },
  { value: 'LTR', label: 'LTR (Liter)' },
  { value: 'MTR', label: 'MTR (Meter)' },
  { value: 'BOX', label: 'BOX' },
  { value: 'DOZ', label: 'DOZ (Dozen)' },
  { value: 'GM', label: 'GM (Gram)' },
  { value: 'ML', label: 'ML (Milliliter)' },
  { value: 'FT', label: 'FT (Feet)' },
  { value: 'INCH', label: 'INCH' },
  { value: 'SET', label: 'SET' },
  { value: 'PKT', label: 'PKT (Packet)' },
  { value: 'BTL', label: 'BTL (Bottle)' },
  { value: 'CAN', label: 'CAN' },
  { value: 'BAG', label: 'BAG' },
  { value: 'ROLL', label: 'ROLL' },
]

type NewPurchaseItemFormProps = {
  idPrefix: string
  item: NewPurchaseLineItem
  extras: NewProductDraft
  categories: string[]
  reservedItemCodes?: string[]
  selected: boolean
  expanded: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  onPatchItem: (patch: Partial<NewPurchaseLineItem>) => void
  onPatchExtras: (patch: Partial<NewProductDraft>) => void
  onCancel: () => void
  onRemove: () => void
}

export default function NewPurchaseItemForm({
  idPrefix,
  item,
  extras,
  categories,
  reservedItemCodes,
  selected,
  expanded,
  onToggleExpand,
  onToggleSelect,
  onPatchItem,
  onPatchExtras,
  onCancel,
  onRemove,
}: NewPurchaseItemFormProps) {
  const fieldId = (name: string) => `${idPrefix}-${name}`
  const categoryOptions = Array.from(
    new Set([extras.category, DEFAULT_CATEGORY_NAME, ...categories].filter(Boolean))
  ).map((name) => ({ value: name, label: name }))

  const handleBatchNoChange = (batch_no: string) => {
    onPatchItem({
      batch_no,
      enable_batching: Boolean(batch_no.trim()),
    })
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40">
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600"
          aria-label={expanded ? 'Collapse new item' : 'Expand new item'}
          aria-expanded={expanded}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
        </button>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label="Select new item row"
          className="mt-1 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              <Plus className="h-3 w-3" /> New Item
            </span>
            <span className="truncate text-sm font-medium text-gray-800">
              {item.description.trim() || 'Untitled item'}
            </span>
            <span className="ml-auto text-sm font-medium tabular-nums text-gray-700">
              {formatCurrency(item.total)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-0.5 shrink-0 text-red-500 hover:text-red-700"
          aria-label="Remove new item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-blue-100 px-3 pb-3 pt-3 sm:px-4">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-1 min-[420px]:col-span-2 lg:col-span-1">
              <Label htmlFor={fieldId('name')} className="text-xs text-gray-500">Product Name *</Label>
              <Input
                id={fieldId('name')}
                value={item.description}
                onChange={(e) => onPatchItem({ description: e.target.value })}
                placeholder="Enter product name"
                className="h-8 w-full min-w-0 bg-white"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-gray-500">Category</Label>
              <SearchableSelect
                value={extras.category}
                onValueChange={(value) => onPatchExtras({ category: value })}
                options={categoryOptions}
                placeholder="Select category"
                searchPlaceholder="Search categories..."
                emptyMessage="No categories found"
                className="h-8 bg-white px-2.5 py-1.5"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs text-gray-500">Unit</Label>
              <Select
                value={item.unit || 'PCS'}
                onValueChange={(value) => onPatchItem({ unit: value })}
              >
                <SelectTrigger className="h-8 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1 min-[420px]:col-span-2 lg:col-span-1">
              <Label htmlFor={fieldId('item_code')} className="text-xs text-gray-500">Item Code</Label>
              <ProductItemCodeField
                id={fieldId('item_code')}
                value={extras.item_code}
                unit={item.unit || 'PCS'}
                compact
                reservedCodes={reservedItemCodes}
                onChange={(item_code) => onPatchExtras({ item_code })}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={fieldId('sale')} className="text-xs text-gray-500">Sale Price</Label>
              <Input
                id={fieldId('sale')}
                type="number"
                min="0"
                step="0.01"
                value={item.sale_price}
                onChange={(e) => onPatchItem({ sale_price: Number(e.target.value) || 0 })}
                className="h-8 w-full min-w-0 bg-white"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={fieldId('mrp')} className="text-xs text-gray-500">MRP</Label>
              <Input
                id={fieldId('mrp')}
                type="number"
                min="0"
                step="0.01"
                value={item.mrp}
                onChange={(e) => onPatchItem({ mrp: Number(e.target.value) || 0 })}
                className="h-8 w-full min-w-0 bg-white"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={fieldId('qty')} className="text-xs text-gray-500">Quantity *</Label>
              <Input
                id={fieldId('qty')}
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(e) => onPatchItem({ quantity: Number(e.target.value) || 0 })}
                className="h-8 w-full min-w-0 bg-white text-right"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={fieldId('price')} className="text-xs text-gray-500">Unit Price (Purchase) *</Label>
              <Input
                id={fieldId('price')}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={item.unit_price}
                onChange={(e) => onPatchItem({ unit_price: Number(limitDecimalInput(e.target.value, 2)) || 0 })}
                onBlur={() => onPatchItem({ unit_price: parseMoney(item.unit_price) })}
                className="h-8 w-full min-w-0 bg-white text-right"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={fieldId('batch')} className="text-xs text-gray-500">Batch Number</Label>
              <Input
                id={fieldId('batch')}
                value={item.batch_no}
                onChange={(e) => handleBatchNoChange(e.target.value)}
                placeholder="Optional"
                className="h-8 w-full min-w-0 bg-white"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={fieldId('exp')} className="text-xs text-gray-500">Expiry Date</Label>
              <Input
                id={fieldId('exp')}
                type="date"
                value={item.exp_date}
                onChange={(e) => onPatchItem({ exp_date: e.target.value })}
                className="h-8 w-full min-w-0 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel New Item
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
