'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Barcode, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  generateUniqueItemCode,
  lookupProductsByItemCode,
  type ItemCodeDuplicateProduct,
} from '@/lib/itemCode'
import { ITEM_CODE_MAX_LEN, isWeightBasedUnit } from '@/lib/weighingScale'

export interface ItemCodeDuplicateInfo {
  isDuplicate: boolean
  products: ItemCodeDuplicateProduct[]
}

interface ProductItemCodeFieldProps {
  id?: string
  value: string
  unit: string
  onChange: (value: string) => void
  inputClassName?: string
  canUseCameraScanner?: boolean
  onOpenCameraScanner?: () => void
  onGenerateError?: (message: string) => void
  onClearError?: () => void
  onDuplicateChange?: (info: ItemCodeDuplicateInfo) => void
}

export default function ProductItemCodeField({
  id,
  value,
  unit,
  onChange,
  inputClassName,
  canUseCameraScanner = false,
  onOpenCameraScanner,
  onGenerateError,
  onClearError,
  onDuplicateChange,
}: ProductItemCodeFieldProps) {
  const [generating, setGenerating] = useState(false)
  const [checking, setChecking] = useState(false)
  const [duplicateProducts, setDuplicateProducts] = useState<ItemCodeDuplicateProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const onDuplicateChangeRef = useRef(onDuplicateChange)
  onDuplicateChangeRef.current = onDuplicateChange
  const weighing = isWeightBasedUnit(unit)

  useEffect(() => {
    const code = value.trim()
    if (!code) {
      setDuplicateProducts([])
      setSelectedProductId('')
      setChecking(false)
      onDuplicateChangeRef.current?.({ isDuplicate: false, products: [] })
      return
    }

    setChecking(true)
    let cancelled = false

    const timer = window.setTimeout(() => {
      void lookupProductsByItemCode(code)
        .then((result) => {
          if (cancelled) return
          setDuplicateProducts(result.products)
          setSelectedProductId(result.products[0]?.id ?? '')
          onDuplicateChangeRef.current?.({
            isDuplicate: result.exists,
            products: result.products,
          })
        })
        .catch(() => {
          if (cancelled) return
          setDuplicateProducts([])
          setSelectedProductId('')
          onDuplicateChangeRef.current?.({ isDuplicate: false, products: [] })
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [value])

  const handleGenerate = async () => {
    setGenerating(true)
    onClearError?.()
    try {
      const code = await generateUniqueItemCode(unit)
      onChange(code)
    } catch (err) {
      onGenerateError?.(
        err instanceof Error ? err.message : 'Failed to generate item code'
      )
    } finally {
      setGenerating(false)
    }
  }

  const hasDuplicate = duplicateProducts.length > 0

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          maxLength={ITEM_CODE_MAX_LEN}
          onChange={(e) => {
            onClearError?.()
            onChange(e.target.value)
          }}
          placeholder={
            weighing
              ? `Max ${ITEM_CODE_MAX_LEN} characters`
              : canUseCameraScanner
                ? `Enter item code or scan (max ${ITEM_CODE_MAX_LEN})`
                : `Enter item code (max ${ITEM_CODE_MAX_LEN})`
          }
          className={cn(inputClassName, hasDuplicate && 'border-red-500')}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void handleGenerate()}
          disabled={generating}
          title="Generate unique barcode"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        {canUseCameraScanner && onOpenCameraScanner && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenCameraScanner}
            title="Scan barcode with camera"
          >
            <Barcode className="h-4 w-4" />
          </Button>
        )}
      </div>

      {checking && value.trim() && (
        <p className="text-xs text-muted-foreground">Checking item code…</p>
      )}

      {!checking && hasDuplicate && (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">
            This item code is already assigned to another product.
          </p>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Existing product" />
            </SelectTrigger>
            <SelectContent>
              {duplicateProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                  {product.sku ? ` (${product.sku})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
