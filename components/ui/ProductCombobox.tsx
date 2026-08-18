'use client'

import * as React from 'react'
import { Search, X, Plus } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export interface ProductComboboxProduct {
  id: string
  name: string
  sku: string
  item_code: string
  unit: string
  stock_qty: number
  sale_price: number
  purchase_price: number
}

interface ProductComboboxProps {
  products: ProductComboboxProduct[]
  value: string
  onChange: (productId: string) => void
  onCreateNew?: (query: string) => void
  createNewLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function ProductCombobox({
  products,
  value,
  onChange,
  onCreateNew,
  createNewLabel = 'New Item',
  placeholder = 'Search item…',
  className,
  disabled = false,
}: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [highlightIndex, setHighlightIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({})

  const selected = React.useMemo(
    () => products.find((p) => p.id === value) ?? null,
    [products, value],
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 10)
    return products
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.item_code && p.item_code.toLowerCase().includes(q))
        )
      })
      .slice(0, 10)
  }, [products, query])

  const createNewIndex = onCreateNew ? filtered.length : -1
  const maxHighlight = onCreateNew ? filtered.length : Math.max(filtered.length - 1, 0)

  React.useEffect(() => {
    setHighlightIndex(0)
  }, [query])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const width = Math.min(Math.max(rect.width, 280), Math.max(window.innerWidth - 16, 0))
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left,
        width,
        zIndex: 9999,
      })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  const handleSelect = (productId: string) => {
    onChange(productId)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const handleCreateNew = () => {
    if (!onCreateNew) return
    onCreateNew(query.trim())
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onChange('')
    setQuery('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setHighlightIndex((prev) => Math.min(prev + 1, maxHighlight))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      if (onCreateNew && highlightIndex === createNewIndex) {
        handleCreateNew()
      } else if (filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex].id)
      } else if (onCreateNew && filtered.length === 0) {
        handleCreateNew()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayValue = open ? query : selected?.name ?? ''
  const typedName = query.trim()

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative flex h-8 w-full min-w-0 items-center rounded-md border border-input bg-background">
        <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={displayValue}
          placeholder={selected ? selected.name : placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            if (selected) setQuery(selected.name)
          }}
          onKeyDown={handleKeyDown}
          className="h-full w-full bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {selected && !open && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="mr-1 shrink-0 rounded-sm p-0.5 opacity-50 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div style={dropdownStyle} className="flex max-h-72 flex-col overflow-hidden rounded-md border bg-popover shadow-md">
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filtered.length === 0 && !onCreateNew ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No products found
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No matching items
              </p>
            ) : (
              filtered.map((product, i) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => handleSelect(product.id)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                    i === highlightIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{product.name}</div>
                    {(product.sku || product.item_code) && (
                      <div className="truncate text-xs text-muted-foreground">
                        {product.sku || product.item_code}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>{formatCurrency(product.purchase_price)}</div>
                    <div>{product.stock_qty} {product.unit}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          {onCreateNew && (
            <button
              type="button"
              onMouseEnter={() => setHighlightIndex(createNewIndex)}
              onClick={handleCreateNew}
              className={cn(
                'flex w-full shrink-0 items-center gap-2 border-t border-blue-200 px-3 py-2 text-left text-sm font-medium text-blue-700',
                highlightIndex === createNewIndex ? 'bg-blue-100' : 'bg-blue-50 hover:bg-blue-100',
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">
                {typedName ? `${createNewLabel}: “${typedName}”` : createNewLabel}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
