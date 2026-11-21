'use client'

import { Layers, Package, ShoppingCart, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { bulkQtySuggestions, formatQty, type PublicProduct } from '@/lib/b2bShop'
import QtyStepper from './QtyStepper'

interface ProductCardProps {
  product: PublicProduct
  showStock: boolean
  showPrice: boolean
  cartQty: number
  /** Opens the product's detail page. */
  onOpen?: () => void
  onAdd: () => void
  onChangeQty: (qty: number) => void
  onRemove: () => void
  /** Adds the product at `qty`, or updates it if already in the cart. Enables bulk chips. */
  onSetQty?: (qty: number) => void
}

export function ProductImage({ src, name, className }: { src?: string; name: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} loading="lazy" className={className ?? 'h-full w-full object-cover'} />
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300">
      <Package className="h-10 w-10" />
    </div>
  )
}

export default function ProductCard({ product, showStock, showPrice, cartQty, onOpen, onAdd, onChangeQty, onRemove, onSetQty }: ProductCardProps) {
  const price = product.price ?? 0
  const mrp = product.mrp ?? 0
  const saving = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0
  const orderable = product.in_stock && (product.max_qty === undefined || product.max_qty >= product.min_order_qty)
  const lowStock = showStock && product.stock_qty !== undefined && product.stock_qty > 0 && product.stock_qty <= product.min_order_qty * 3
  const bulkQtys = onSetQty && orderable ? bulkQtySuggestions(product) : []
  const unit = product.unit || 'unit'

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md">
      <div
        className={cn('relative aspect-[4/3] overflow-hidden bg-slate-50', onOpen && 'cursor-pointer')}
        onClick={onOpen}
        role={onOpen ? 'link' : undefined}
        aria-label={onOpen ? `View ${product.name}` : undefined}
      >
        <ProductImage
          src={product.image_url}
          name={product.name}
          className="h-full w-full object-cover transition group-hover:scale-[1.03]"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {product.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
              <Star className="h-3 w-3 fill-current" /> Featured
            </span>
          )}
          {showPrice && saving >= 1 && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">{saving}% below MRP</span>
          )}
        </div>
        {!orderable && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.category && <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{product.category}</p>}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
          {onOpen ? (
            <button type="button" onClick={onOpen} className="text-left hover:text-blue-700 hover:underline">
              {product.name}
            </button>
          ) : (
            product.name
          )}
        </h3>
        {product.description && <p className="line-clamp-2 text-xs text-slate-500">{product.description}</p>}

        <div className="mt-auto space-y-1 pt-1">
          {showPrice && (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">{formatCurrency(price)}</span>
              <span className="text-xs text-slate-500">/ {product.unit || 'unit'}</span>
              {saving >= 1 && <span className="text-xs text-slate-400 line-through">{formatCurrency(mrp)}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-500">
            {product.min_order_qty > 1 && (
              <span>
                Min. order {formatQty(product.min_order_qty)} {product.unit}
              </span>
            )}
            {showStock && product.stock_qty !== undefined && product.stock_qty > 0 && (
              <span className={lowStock ? 'font-medium text-amber-700' : ''}>
                {lowStock ? 'Only ' : ''}
                {formatQty(product.stock_qty)} {product.unit} available
              </span>
            )}
          </div>
        </div>

        {bulkQtys.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Bulk quantities in ${unit}`}>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Layers className="h-3 w-3" aria-hidden="true" />
              Bulk
            </span>
            {bulkQtys.map((q) => {
              const active = cartQty === q
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSetQty?.(q)}
                  aria-pressed={active}
                  title={showPrice ? `${formatQty(q)} ${unit} · ${formatCurrency(q * price)}` : `${formatQty(q)} ${unit}`}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
                    active
                      ? 'border-primary bg-tint text-primary'
                      : 'border-input text-slate-700 hover:border-primary hover:text-primary'
                  )}
                >
                  {formatQty(q)} {unit}
                </button>
              )
            })}
          </div>
        )}

        {cartQty > 0 ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <QtyStepper
              value={cartQty}
              min={product.min_order_qty}
              max={product.max_qty}
              onChange={onChangeQty}
              onBelowMin={onRemove}
              size="sm"
            />
            {showPrice && <span className="text-sm font-semibold text-slate-700">{formatCurrency(cartQty * price)}</span>}
          </div>
        ) : (
          <Button size="sm" className="mt-1 w-full" onClick={onAdd} disabled={!orderable}>
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            Add to cart
          </Button>
        )}
      </div>
    </div>
  )
}
