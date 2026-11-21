'use client'

import { useEffect } from 'react'
import { ShoppingCart, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { formatQty, type CartLine } from '@/lib/b2bShop'
import QtyStepper from './QtyStepper'
import { ProductImage } from './ProductCard'

interface CartPanelProps {
  open: boolean
  onClose: () => void
  lines: CartLine[]
  minOrderValue: number
  showPrice: boolean
  onChangeQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onCheckout: () => void
}

export default function CartPanel({ open, onClose, lines, minOrderValue, showPrice, onChangeQty, onRemove, onClear, onCheckout }: CartPanelProps) {
  const total = showPrice ? lines.reduce((sum, l) => sum + l.quantity * (l.product.price ?? 0), 0) : 0
  const shortBy = showPrice && minOrderValue > 0 ? Math.max(0, minOrderValue - total) : 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Cart"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-semibold">Your order</h2>
            <span className="text-sm text-slate-500">({lines.length} item{lines.length === 1 ? '' : 's'})</span>
          </div>
          <div className="flex items-center gap-1">
            {lines.length > 0 && (
              <Button variant="ghost" size="sm" className="text-slate-500" onClick={onClear}>
                Clear
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close cart">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
            <ShoppingCart className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">Your cart is empty</p>
            <p className="text-sm">Add products from the catalogue to start an order.</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y overflow-y-auto">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex gap-3 px-4 py-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-slate-50">
                  <ProductImage src={product.image_url} name={product.name} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(product.id)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label={`Remove ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {showPrice && product.price !== undefined ? `${formatCurrency(product.price)} / ` : ''}
                    {product.unit}
                    {product.min_order_qty > 1 && ` · min ${formatQty(product.min_order_qty)}`}
                  </p>
                  <div className="flex items-center justify-between">
                    <QtyStepper
                      size="sm"
                      value={quantity}
                      min={product.min_order_qty}
                      max={product.max_qty}
                      onChange={(q) => onChangeQty(product.id, q)}
                      onBelowMin={() => onRemove(product.id)}
                    />
                    {showPrice && <span className="text-sm font-semibold tabular-nums">{formatCurrency(quantity * (product.price ?? 0))}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="space-y-3 border-t bg-slate-50 px-4 py-4">
          {showPrice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Order total</span>
              <span className="text-xl font-bold tabular-nums">{formatCurrency(total)}</span>
            </div>
          )}
          {shortBy > 0 && lines.length > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Minimum order value is {formatCurrency(minOrderValue)}. Add {formatCurrency(shortBy)} more to check out.
            </p>
          )}
          <Button className="w-full" size="lg" disabled={lines.length === 0 || shortBy > 0} onClick={onCheckout}>
            Continue to checkout
          </Button>
          <p className="text-center text-[11px] text-slate-500">
            Final prices are confirmed by the seller on the invoice.
          </p>
        </footer>
      </aside>
    </div>
  )
}
