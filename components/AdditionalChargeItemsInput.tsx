'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import {
  type AdditionalChargeItem,
  sumAdditionalChargeItems,
} from '@/lib/additionalCharges'
import { Plus, Trash2 } from 'lucide-react'

interface AdditionalChargeItemsInputProps {
  items: AdditionalChargeItem[]
  onChange: (items: AdditionalChargeItem[]) => void
}

// Repeatable labelled charge rows used in the "Additional Charges &
// Discount" section of invoice/estimate/purchase bill forms.
export function AdditionalChargeItemsInput({ items, onChange }: AdditionalChargeItemsInputProps) {
  const update = (index: number, patch: Partial<AdditionalChargeItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const total = sumAdditionalChargeItems(items)

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
          <Input
            type="text"
            placeholder="Label (e.g. Freight)"
            value={item.label}
            onChange={(e) => update(index, { label: e.target.value })}
            className="min-w-0"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={item.amount || ''}
            onChange={(e) => update(index, { amount: Number(e.target.value) })}
            className="min-w-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            aria-label="Remove charge"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { label: '', amount: 0 }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add Charge
        </Button>
        {items.length > 0 && (
          <span className="text-sm text-gray-600">
            Total: <span className="font-medium">{formatCurrency(total)}</span>
          </span>
        )}
      </div>
    </div>
  )
}
