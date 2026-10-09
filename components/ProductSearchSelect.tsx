'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { cn, formatCurrency } from '@/lib/utils'

export interface ProductSearchResult {
  id: string
  name: string
  sku?: string
  item_code?: string
  plu?: string
  hsn_code?: string
  unit?: string
  stock_qty?: number
  sale_price?: number
  purchase_price?: number
  tax_rate?: number
  category?: string
  gst_enabled?: boolean
  sale_price_with_tax?: boolean
  purchase_price_with_tax?: boolean
}

interface ProductSearchSelectProps {
  value: string
  label?: string
  onSelect: (product: ProductSearchResult) => void
  onClear?: () => void
  priceField?: 'sale_price' | 'purchase_price'
  placeholder?: string
  className?: string
  disabled?: boolean
}

const RESULT_LIMIT = 15

export function ProductSearchSelect({
  value,
  label,
  onSelect,
  onClear,
  priceField = 'sale_price',
  placeholder = 'Search product...',
  className,
  disabled,
}: ProductSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    const seq = ++seqRef.current
    setLoading(true)
    const params = new URLSearchParams({ page: '1', per_page: String(RESULT_LIMIT) })
    if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim())
    apiFetch(`/products?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok || seq !== seqRef.current) return
        const data = await res.json()
        setResults(Array.isArray(data) ? data : data.products || [])
      })
      .catch(() => {})
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
  }, [open, debouncedQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const shown = editing ? query : value ? label || '' : query

  return (
    <div ref={containerRef} className={cn('relative flex-1', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={shown}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          setEditing(true)
          setQuery(label || '')
          setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onClear?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            setEditing(false)
          }
        }}
        className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg">
          {loading && results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">No products found</div>
          ) : (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(product)
                  setQuery(product.name)
                  setEditing(false)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="block text-xs text-gray-500">
                    {[product.item_code || product.sku, product.unit].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-gray-600">
                  {formatCurrency(Number(product[priceField]) || 0)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
