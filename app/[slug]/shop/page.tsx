'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Mail, Megaphone, PackageSearch, Phone, Search, ShoppingCart, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { loadCart, saveCart, shopApi, type CartLine, type PublicProduct, type PublicShop } from '@/lib/b2bShop'
import ProductCard from '@/components/b2b-shop/ProductCard'
import ProductDetail from '@/components/b2b-shop/ProductDetail'
import CartPanel from '@/components/b2b-shop/CartPanel'
import CheckoutDialog from '@/components/b2b-shop/CheckoutDialog'
import BuyerSwitcher from '@/components/b2b-shop/BuyerSwitcher'
import TrackOrderDialog from '@/components/b2b-shop/TrackOrderDialog'
import BrandLoader from '@/components/BrandLoader'

const PER_PAGE = 48

export default function ShopPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Storefront />
    </Suspense>
  )
}

/** Shop logo, falling back to a store icon when there's no logo or it fails to load. */
function ShopLogo({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-lg border object-contain"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
      <Store className="h-5 w-5" />
    </div>
  )
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <BrandLoader />
    </div>
  )
}

function Storefront() {
  const params = useSearchParams()
  const routeParams = useParams<{ slug: string }>()
  const slug = decodeURIComponent(routeParams?.slug ?? '').trim().toLowerCase()
  // Product detail lives on the same route (/<slug>/shop?product=<id>) so it
  // shares the cart and checkout.
  const productId = params.get('product')
  const router = useRouter()
  const listScrollY = useRef(0)

  const [shop, setShop] = useState<PublicShop | null>(null)
  const [shopError, setShopError] = useState('')
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('featured')

  const [cart, setCart] = useState<CartLine[]>([])
  const [cartReady, setCartReady] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [trackOpen, setTrackOpen] = useState(false)
  const [trackPrefill, setTrackPrefill] = useState({ order: '', phone: '' })
  const [placed, setPlaced] = useState<{
    order_number: string
    total_amount: number
    phone: string
  } | null>(null)
  const requestSeq = useRef(0)

  // Shop info
  useEffect(() => {
    if (!slug) {
      setShopError('This shop link is incomplete. Please check the URL you were given.')
      return
    }
    shopApi
      .info(slug)
      .then((s) => {
        setShop(s)
        document.title = `${s.name} · Wholesale orders`
      })
      .catch((e: Error) => setShopError(e.message))
  }, [slug])

  // Cart persistence
  useEffect(() => {
    if (!slug) return
    setCart(loadCart(slug))
    setCartReady(true)
  }, [slug])
  useEffect(() => {
    if (cartReady) saveCart(slug, cart)
  }, [cart, cartReady, slug])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchProducts = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!slug) return
      const seq = ++requestSeq.current
      setLoadingProducts(true)
      try {
        const res = await shopApi.products(slug, {
          page: pageToLoad,
          per_page: PER_PAGE,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(category !== 'all' ? { category } : {}),
          ...(sort !== 'featured' ? { sort } : {}),
        })
        if (seq !== requestSeq.current) return
        setProducts((prev) => (append ? [...prev, ...res.products] : res.products))
        setTotal(res.total)
        setPage(pageToLoad)
        // Keep cart prices/limits in sync with the latest catalogue data.
        const fresh = new Map(res.products.map((p) => [p.id, p]))
        setCart((prev) => prev.map((l) => (fresh.has(l.product.id) ? { ...l, product: fresh.get(l.product.id)! } : l)))
      } catch {
        // leave current list in place; the shop-level error covers hard failures
      } finally {
        if (seq === requestSeq.current) setLoadingProducts(false)
      }
    },
    [slug, debouncedSearch, category, sort]
  )

  useEffect(() => {
    if (shop) fetchProducts(1, false)
  }, [shop, fetchProducts])

  const qtyById = useMemo(() => new Map(cart.map((l) => [l.product.id, l.quantity])), [cart])
  const cartTotal = cart.reduce((s, l) => s + l.quantity * l.product.price, 0)
  const cartCount = cart.length

  const addToCart = (p: PublicProduct) =>
    setCart((prev) => (prev.some((l) => l.product.id === p.id) ? prev : [...prev, { product: p, quantity: p.min_order_qty || 1 }]))
  const setQty = (id: string, quantity: number) => setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, quantity } : l)))
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id))
  /** Adds the product or sets its quantity, refreshing the stored product data. */
  const setCartQty = (p: PublicProduct, quantity: number) =>
    setCart((prev) =>
      prev.some((l) => l.product.id === p.id)
        ? prev.map((l) => (l.product.id === p.id ? { product: p, quantity } : l))
        : [...prev, { product: p, quantity }]
    )

  const shopHref = `/${encodeURIComponent(slug)}/shop`
  const openProduct = (id: string) => {
    if (!productId) listScrollY.current = window.scrollY
    router.push(`${shopHref}?product=${encodeURIComponent(id)}`)
  }
  const backToList = () => {
    router.push(shopHref)
    const y = listScrollY.current
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })))
  }

  if (shopError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <Store className="h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-800">Shop unavailable</h1>
        <p className="max-w-sm text-sm text-slate-500">{shopError}</p>
      </div>
    )
  }
  if (!shop) return <FullPageSpinner />

  const categories = ['all', ...shop.categories]
  const hasMore = products.length < total

  return (
    <div className="min-h-screen bg-slate-50 pb-24 sm:pb-10">
      {shop.announcement && (
        <div className="bg-slate-900 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
          <Megaphone className="mr-1.5 inline h-4 w-4 -translate-y-px" />
          {shop.announcement}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ShopLogo src={shop.logo_url} />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{shop.name}</h1>
              {shop.tagline && <p className="truncate text-xs text-slate-500">{shop.tagline}</p>}
            </div>
          </div>
          <div className="order-last w-full sm:order-none sm:w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  if (productId) router.push(shopHref)
                }}
                placeholder="Search products"
                className="pl-9"
              />
            </div>
          </div>
          <BuyerSwitcher shop={shop} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTrackPrefill({ order: '', phone: '' })
              setTrackOpen(true)
            }}
          >
            <PackageSearch className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Track order</span>
          </Button>
          <Button size="sm" className="relative" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-5">
        {productId ? (
          <ProductDetail
            slug={slug}
            productId={productId}
            showStock={shop.show_stock}
            showPrice={shop.show_price}
            qtyInCart={(id) => qtyById.get(id) || 0}
            onSetCartQty={setCartQty}
            onRemove={removeFromCart}
            onOpenProduct={openProduct}
            onBack={backToList}
            onBuyNow={() => setCartOpen(true)}
          />
        ) : (
          <>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition',
                      category === c ? 'border-slate-900 bg-slate-900 text-white' : 'bg-white text-slate-600 hover:border-slate-400'
                    )}
                  >
                    {c === 'all' ? 'All products' : c}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {total} product{total === 1 ? '' : 's'}
                </span>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-9 w-40 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured first</SelectItem>
                    <SelectItem value="name">Name A–Z</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {shop.min_order_value > 0 && (
              <p className="mb-4 text-xs text-slate-500">Minimum order value: {formatCurrency(shop.min_order_value)}</p>
            )}

            {/* Grid */}
            {products.length === 0 && !loadingProducts ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-white py-16 text-center">
                <Search className="h-8 w-8 text-slate-300" />
                <p className="font-medium text-slate-700">No products found</p>
                <p className="text-sm text-slate-500">Try a different search or category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    showStock={shop.show_stock}
                    showPrice={shop.show_price}
                    cartQty={qtyById.get(p.id) || 0}
                    onOpen={() => openProduct(p.id)}
                    onAdd={() => addToCart(p)}
                    onChangeQty={(q) => setQty(p.id, q)}
                    onRemove={() => removeFromCart(p.id)}
                    onSetQty={(q) => setCartQty(p, q)}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-center py-6">
              {loadingProducts ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                hasMore && (
                  <Button variant="outline" onClick={() => fetchProducts(page + 1, true)}>
                    Load more products
                  </Button>
                )
              )}
            </div>
          </>
        )}

        {(shop.contact_phone || shop.contact_email) && (
          <footer className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t py-6 text-sm text-slate-500">
            <span>Questions about an order?</span>
            {shop.contact_phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> {shop.contact_phone}
              </span>
            )}
            {shop.contact_email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> {shop.contact_email}
              </span>
            )}
          </footer>
        )}
      </main>

      {/* Mobile cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:hidden">
          <Button className="w-full justify-between" size="lg" onClick={() => setCartOpen(true)}>
            <span>
              {cartCount} item{cartCount === 1 ? '' : 's'} in cart
            </span>
            <span className="font-bold">{formatCurrency(cartTotal)} →</span>
          </Button>
        </div>
      )}

      <CartPanel
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart}
        minOrderValue={shop.min_order_value}
        onChangeQty={setQty}
        onRemove={removeFromCart}
        onClear={() => setCart([])}
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutOpen(true)
        }}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        shop={shop}
        lines={cart}
        onCartStale={() => fetchProducts(1, false)}
        onPlaced={(res) => {
          setCheckoutOpen(false)
          setCart([])
          setPlaced(res)
        }}
      />

      <TrackOrderDialog
        open={trackOpen}
        onOpenChange={setTrackOpen}
        slug={slug}
        initialOrderNumber={trackPrefill.order}
        initialPhone={trackPrefill.phone}
      />

      <Dialog open={!!placed} onOpenChange={(o) => !o && setPlaced(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <CheckCircle2 className="mb-2 h-14 w-14 text-emerald-500" />
            <DialogTitle className="text-center">Order placed</DialogTitle>
            <DialogDescription className="text-center">{shop.name} has received your order and will confirm it shortly.</DialogDescription>
          </DialogHeader>
          {placed && (
            <div className="rounded-lg bg-slate-50 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Order number</p>
              <p className="text-2xl font-bold tracking-wide">{placed.order_number}</p>
              <p className="text-sm text-slate-600">{formatCurrency(placed.total_amount)}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!placed) return
                setTrackPrefill({
                  order: placed.order_number,
                  phone: placed.phone,
                })
                setPlaced(null)
                setTrackOpen(true)
              }}
            >
              Track this order
            </Button>
            <Button onClick={() => setPlaced(null)}>Continue shopping</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
