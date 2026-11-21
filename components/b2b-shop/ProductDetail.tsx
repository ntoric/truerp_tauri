'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, PackageX, ShoppingCart, Star, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency } from '@/lib/utils'
import { formatQty, shopApi, type PublicProduct, type PublicProductDetail } from '@/lib/b2bShop'
import ProductCard, { ProductImage } from './ProductCard'
import QtyStepper from './QtyStepper'

interface ProductDetailProps {
  slug: string
  productId: string
  showStock: boolean
  showPrice: boolean
  qtyInCart: (id: string) => number
  onSetCartQty: (product: PublicProduct, qty: number) => void
  onRemove: (id: string) => void
  onOpenProduct: (id: string) => void
  onBack: () => void
  onBuyNow: () => void
}

export default function ProductDetail({
  slug,
  productId,
  showStock,
  showPrice,
  qtyInCart,
  onSetCartQty,
  onRemove,
  onOpenProduct,
  onBack,
  onBuyNow,
}: ProductDetailProps) {
  const [detail, setDetail] = useState<PublicProductDetail | null>(null)
  const [error, setError] = useState('')
  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setError('')
    setActiveImage(0)
    window.scrollTo({ top: 0 })
    shopApi
      .product(slug, productId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setQty(qtyInCart(d.product.id) || d.product.min_order_qty || 1)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, productId])

  useEffect(() => {
    if (!justAdded) return
    const t = setTimeout(() => setJustAdded(false), 1800)
    return () => clearTimeout(t)
  }, [justAdded])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-white py-16 text-center">
        <PackageX className="h-10 w-10 text-slate-300" />
        <p className="font-medium text-slate-700">{error}</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to all products
        </Button>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  const p = detail.product
  const images = detail.images.length ? detail.images : p.image_url ? [p.image_url] : []
  const inCart = qtyInCart(p.id)
  const orderable = p.in_stock && (p.max_qty === undefined || p.max_qty >= p.min_order_qty)
  const saving = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0

  const addOrUpdate = () => {
    onSetCartQty(p, qty)
    setJustAdded(true)
  }

  const specs: [string, string][] = [
    ['Unit', p.unit || '—'],
    ['Minimum order', `${formatQty(p.min_order_qty)} ${p.unit}`],
    ...(p.category ? ([['Category', p.category]] as [string, string][]) : []),
    ...(detail.item_code ? ([['Item code', detail.item_code]] as [string, string][]) : []),
    ...(p.hsn_code ? ([['HSN code', p.hsn_code]] as [string, string][]) : []),
    ...(p.mrp > 0 ? ([['MRP', formatCurrency(p.mrp)]] as [string, string][]) : []),
    [
      'Availability',
      !orderable ? 'Out of stock' : showStock && p.stock_qty !== undefined ? `${formatQty(p.stock_qty)} ${p.unit} in stock` : 'In stock',
    ],
  ]

  return (
    <div className="space-y-10">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500" aria-label="Breadcrumb">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> All products
        </button>
        {p.category && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{p.category}</span>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-slate-400">{p.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-xl border bg-white">
            <ProductImage src={images[activeImage]} name={p.name} className="h-full w-full object-contain" />
            {p.is_featured && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950">
                <Star className="h-3.5 w-3.5 fill-current" /> Featured
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white',
                    i === activeImage ? 'border-slate-900' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                  aria-label={`Show image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + buy box */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            {p.category && <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{p.category}</p>}
            <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{p.name}</h1>
            {detail.item_code && <p className="text-sm text-slate-500">Item code {detail.item_code}</p>}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{formatCurrency(p.price)}</span>
              <span className="text-slate-500">per {p.unit || 'unit'}</span>
              {saving >= 1 && (
                <>
                  <span className="text-slate-400 line-through">{formatCurrency(p.mrp)}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">{saving}% below MRP</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500">Wholesale price. The final amount is confirmed on your invoice.</p>
          </div>

          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
              orderable ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', orderable ? 'bg-emerald-500' : 'bg-rose-500')} />
            {!orderable
              ? 'Out of stock'
              : showStock && p.stock_qty !== undefined
                ? `${formatQty(p.stock_qty)} ${p.unit} available`
                : 'In stock'}
          </div>

          {orderable && (
            <div className="space-y-3 rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Quantity</p>
                  <p className="text-xs text-slate-500">
                    Min. {formatQty(p.min_order_qty)} {p.unit}
                    {p.max_qty !== undefined && ` · max ${formatQty(p.max_qty)}`}
                  </p>
                </div>
                <QtyStepper value={qty} min={p.min_order_qty} max={p.max_qty} onChange={setQty} />
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-slate-600">Line total</span>
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(qty * p.price)}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button size="lg" variant={inCart ? 'outline' : 'default'} onClick={addOrUpdate} disabled={inCart === qty}>
                  {justAdded ? <Check className="mr-1.5 h-4 w-4" /> : <ShoppingCart className="mr-1.5 h-4 w-4" />}
                  {justAdded ? 'Added' : inCart ? (inCart === qty ? 'In cart' : 'Update cart') : 'Add to cart'}
                </Button>
                <Button
                  size="lg"
                  variant={inCart ? 'default' : 'secondary'}
                  onClick={() => {
                    if (inCart !== qty) onSetCartQty(p, qty)
                    onBuyNow()
                  }}
                >
                  <Zap className="mr-1.5 h-4 w-4" /> Order now
                </Button>
              </div>
              {inCart > 0 && (
                <p className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {formatQty(inCart)} {p.unit} in your cart
                  </span>
                  <button type="button" className="font-medium text-rose-600 hover:underline" onClick={() => onRemove(p.id)}>
                    Remove
                  </button>
                </p>
              )}
            </div>
          )}

          {p.description && (
            <section className="space-y-1.5">
              <h2 className="text-sm font-semibold text-slate-900">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.description}</p>
            </section>
          )}

          <section className="space-y-1.5">
            <h2 className="text-sm font-semibold text-slate-900">Product details</h2>
            <dl className="divide-y rounded-lg border bg-white text-sm">
              {specs.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 px-3 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      {detail.related.length > 0 && (
        <section className="space-y-3 border-t pt-8">
          <h2 className="text-lg font-semibold text-slate-900">{p.category ? `More in ${p.category}` : 'You may also need'}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {detail.related.map((r) => (
              <ProductCard
                key={r.id}
                product={r}
                showStock={showStock}
                showPrice={showPrice}
                cartQty={qtyInCart(r.id)}
                onOpen={() => onOpenProduct(r.id)}
                onAdd={() => onSetCartQty(r, r.min_order_qty || 1)}
                onChangeQty={(q) => onSetCartQty(r, q)}
                onRemove={() => onRemove(r.id)}
                onSetQty={(q) => onSetCartQty(r, q)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
