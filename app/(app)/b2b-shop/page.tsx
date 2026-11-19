'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import CreateProductDialog from '@/components/CreateProductDialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import PaginationControls from '@/components/ui/pagination-controls'
import { cn, formatCurrency, publicSiteUrl } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatQty, type B2BCatalogRow, type B2BShopSettings } from '@/lib/b2bShop'
import { ProductImage } from '@/components/b2b-shop/ProductCard'
import ProductImagesDialog from '@/components/b2b-shop/ProductImagesDialog'
import {
  ClipboardList,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  PackageCheck,
  PackagePlus,
  Plus,
  Save,
  Search,
  Settings2,
  Star,
  Store,
} from 'lucide-react'
import BrandLoader from '@/components/BrandLoader'

const PAGE_SIZE = 25

interface CatalogResponse {
  items: B2BCatalogRow[]
  total: number
  summary: { total_products: number; listed: number; in_stock: number; in_stock_not_listed: number }
  categories: string[]
}

export default function B2BShopManagerPage() {
  const { user, loading: authLoading } = useAuth()
  const { activeStore } = useStore()

  const [settings, setSettings] = useState<B2BShopSettings | null>(null)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)
  const [slugError, setSlugError] = useState('')

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [savingRow, setSavingRow] = useState<string | null>(null)
  const [imagesFor, setImagesFor] = useState<{ product_id: string; name: string } | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const shopUrl =
    settings && typeof window !== 'undefined' ? `${publicSiteUrl()}/${encodeURIComponent(settings.slug)}/shop` : ''

  const loadSettings = useCallback(async () => {
    const res = await apiFetch('/b2b-shop/settings')
    if (!res.ok) return
    const data = await res.json()
    setSettings(data.settings)
    setPendingOrders(data.pending_orders || 0)
  }, [])

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE), filter })
      if (debouncedSearch) qs.set('search', debouncedSearch)
      if (category !== 'all') qs.set('category', category)
      const res = await apiFetch(`/b2b-shop/catalog?${qs}`)
      if (res.ok) setCatalog(await res.json())
    } finally {
      setLoadingCatalog(false)
    }
  }, [page, filter, debouncedSearch, category])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => setPage(1), [debouncedSearch, category, filter])

  useEffect(() => {
    if (authLoading || !user) return
    loadSettings()
  }, [authLoading, user, activeStore?.id, loadSettings])

  useEffect(() => {
    if (authLoading || !user) return
    loadCatalog()
    setSelected(new Set())
  }, [authLoading, user, activeStore?.id, loadCatalog])

  // ------------------------------------------------------------------ settings
  const saveSettings = async (patch?: Partial<B2BShopSettings>) => {
    if (!settings) return
    const body = patch ?? settings
    setSavingSettings(true)
    setSlugError('')
    try {
      const res = await apiFetch('/b2b-shop/settings', { method: 'PUT', body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) {
        if (data.fields?.slug) setSlugError(data.fields.slug)
        throw new Error(data.error || 'Failed to save')
      }
      setSettings(data)
      notifySuccess(patch && 'is_enabled' in patch ? (data.is_enabled ? 'Shop is now live' : 'Shop is now offline') : 'Shop settings saved')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shopUrl)
      notifySuccess('Shop link copied')
    } catch {
      notifyError('Could not copy — select the link and copy it manually')
    }
  }

  // ------------------------------------------------------------------ catalogue
  const updateRow = async (row: B2BCatalogRow, patch: Partial<Pick<B2BCatalogRow, 'is_listed' | 'b2b_price' | 'min_order_qty' | 'is_featured'>>) => {
    setSavingRow(row.product_id)
    // optimistic
    setCatalog((prev) =>
      prev ? { ...prev, items: prev.items.map((r) => (r.product_id === row.product_id ? { ...r, ...patch } : r)) } : prev
    )
    try {
      const res = await apiFetch(`/b2b-shop/catalog/${row.product_id}`, { method: 'PUT', body: JSON.stringify(patch) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      if ('is_listed' in patch) {
        setCatalog((prev) =>
          prev
            ? {
                ...prev,
                summary: {
                  ...prev.summary,
                  listed: prev.summary.listed + (patch.is_listed ? 1 : -1),
                  in_stock_not_listed:
                    prev.summary.in_stock_not_listed + (row.stock_qty > 0 ? (patch.is_listed ? -1 : 1) : 0),
                },
              }
            : prev
        )
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Update failed')
      setCatalog((prev) =>
        prev ? { ...prev, items: prev.items.map((r) => (r.product_id === row.product_id ? row : r)) } : prev
      )
    } finally {
      setSavingRow(null)
    }
  }

  const bulk = async (action: 'list' | 'unlist' | 'list_in_stock') => {
    setBulkBusy(true)
    try {
      const res = await apiFetch('/b2b-shop/catalog/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, product_ids: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk update failed')
      notifySuccess(
        action === 'unlist' ? `${data.updated} product(s) removed from shop` : `${data.updated} product(s) listed in shop`
      )
      setSelected(new Set())
      loadCatalog()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const items = catalog?.items ?? []
  const allOnPageSelected = items.length > 0 && items.every((r) => selected.has(r.product_id))
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) items.forEach((r) => next.delete(r.product_id))
      else items.forEach((r) => next.add(r.product_id))
      return next
    })
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (authLoading || !settings) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <BrandLoader />
        </div>
      </DashboardLayout>
    )
  }

  const summary = catalog?.summary

  return (
    <DashboardLayout>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            B2B Shop
            <StatusBadge tone={settings.is_enabled ? 'success' : 'neutral'}>{settings.is_enabled ? 'Live' : 'Offline'}</StatusBadge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/b2b-orders">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Orders
                {pendingOrders > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pendingOrders}</span>
                )}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={!settings.is_enabled}>
              <a href={shopUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> View shop
              </a>
            </Button>
          </>
        }
      />

      {/* Status + link */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('rounded-lg p-2', settings.is_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
              <Store className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{settings.is_enabled ? 'Your shop is accepting orders' : 'Your shop is offline'}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="truncate rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{shopUrl}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyLink} title="Copy link">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Stat label="Listed" value={summary?.listed ?? '—'} />
            <Stat label="In stock, not listed" value={summary?.in_stock_not_listed ?? '—'} tone={summary?.in_stock_not_listed ? 'amber' : undefined} />
            <Stat label="Pending orders" value={pendingOrders} tone={pendingOrders ? 'amber' : undefined} />
            <div className="flex items-center gap-2 border-l pl-6">
              <Switch
                id="shop-live"
                checked={settings.is_enabled}
                disabled={savingSettings}
                onCheckedChange={(v) => saveSettings({ is_enabled: v })}
              />
              <Label htmlFor="shop-live" className="text-sm">
                Live
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-1.5">
            <PackageCheck className="h-4 w-4" /> Catalogue
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Shop settings
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ Catalogue */}
        <TabsContent value="catalog" className="mt-4">
          <Card>
            <CardHeader className="gap-3 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Products in your shop</CardTitle>
                  <CardDescription>Choose which products buyers can see and order, and set wholesale prices.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!!summary?.in_stock_not_listed && (
                    <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => bulk('list_in_stock')}>
                      <PackagePlus className="mr-1.5 h-4 w-4" /> List all in-stock ({summary.in_stock_not_listed})
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add new product
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="Search name, code, category" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    <SelectItem value="listed">Listed in shop</SelectItem>
                    <SelectItem value="unlisted">Not listed</SelectItem>
                    <SelectItem value="in_stock">In stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                    <SelectItem value="featured">Featured</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {(catalog?.categories ?? []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm">
                  <span className="font-medium text-blue-900">{selected.size} selected</span>
                  <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulk('list')}>
                    List in shop
                  </Button>
                  <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulk('unlist')}>
                    Remove from shop
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="w-8 pb-2">
                        <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} aria-label="Select all on page" />
                      </th>
                      <th className="pb-2 pr-4">Product</th>
                      <th className="pb-2 pr-4 text-right">Stock</th>
                      <th className="pb-2 pr-4 text-right">Sale price</th>
                      <th className="pb-2 pr-4">Wholesale price</th>
                      <th className="pb-2 pr-4">Min. qty</th>
                      <th className="pb-2 pr-4 text-center">Featured</th>
                      <th className="pb-2 text-center">In shop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCatalog && items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          No products match these filters.
                        </td>
                      </tr>
                    ) : (
                      items.map((row) => (
                        <CatalogRow
                          key={row.product_id}
                          row={row}
                          selected={selected.has(row.product_id)}
                          saving={savingRow === row.product_id}
                          onToggleSelect={() => toggleOne(row.product_id)}
                          onUpdate={(patch) => updateRow(row, patch)}
                          onEditImages={() => setImagesFor({ product_id: row.product_id, name: row.name })}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={page}
                totalPages={Math.max(1, Math.ceil((catalog?.total ?? 0) / PAGE_SIZE))}
                totalItems={catalog?.total ?? 0}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------ Settings */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Storefront</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="slug">Shop URL</Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 text-muted-foreground">/</span>
                  <Input id="slug" value={settings.slug} onChange={(e) => setSettings({ ...settings, slug: e.target.value })} />
                  <span className="shrink-0 text-muted-foreground">/shop</span>
                </div>
                {slugError && <p className="text-xs text-rose-600">{slugError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="shop-name">Shop name</Label>
                <Input
                  id="shop-name"
                  placeholder="Defaults to your business name"
                  value={settings.shop_name}
                  onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="announcement">Announcement bar</Label>
                <Input
                  id="announcement"
                  placeholder="e.g. Free delivery on orders above ₹10,000 this week"
                  value={settings.announcement}
                  onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Contact phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="Defaults to business phone"
                  value={settings.contact_phone}
                  onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact email</Label>
                <Input
                  id="contact-email"
                  placeholder="Defaults to business email"
                  value={settings.contact_email}
                  onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                />
              </div>
            </CardContent>

            <CardHeader className="border-t pt-6">
              <CardTitle className="text-base">Ordering rules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-order">Minimum order value (₹)</Label>
                <Input
                  id="min-order"
                  type="number"
                  min={0}
                  value={settings.min_order_value || ''}
                  placeholder="0 = no minimum"
                  onChange={(e) => setSettings({ ...settings, min_order_value: Number(e.target.value) || 0 })}
                />
              </div>
              <div />
              <ToggleRow
                label="Show stock quantities"
                hint="Buyers see how many units are available."
                checked={settings.show_stock}
                onChange={(v) => setSettings({ ...settings, show_stock: v })}
              />
              <ToggleRow
                label="Allow backorders"
                hint="Accept orders beyond available stock."
                checked={settings.allow_backorders}
                onChange={(v) => setSettings({ ...settings, allow_backorders: v })}
              />
              <ToggleRow
                label="Hide out-of-stock products"
                hint="Products with no available stock are hidden from the shop until restocked. Services are always shown."
                checked={settings.hide_out_of_stock}
                onChange={(v) => setSettings({ ...settings, hide_out_of_stock: v })}
              />
              <ToggleRow
                label="Allow new buyers"
                hint="Unregistered businesses can sign up at checkout. They are added to Parties as customers."
                checked={settings.allow_new_buyers}
                onChange={(v) => setSettings({ ...settings, allow_new_buyers: v })}
              />
              <ToggleRow
                label="Require delivery address"
                hint="Buyers must give an address at checkout. Turn off if orders are picked up from your store."
                checked={settings.require_delivery_address}
                onChange={(v) => setSettings({ ...settings, require_delivery_address: v })}
              />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="terms">Terms of sale</Label>
                <Textarea
                  id="terms"
                  rows={4}
                  placeholder="Payment terms, delivery timelines, returns policy…"
                  value={settings.terms}
                  onChange={(e) => setSettings({ ...settings, terms: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => saveSettings()} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductImagesDialog product={imagesFor} onClose={() => setImagesFor(null)} onChanged={loadCatalog} />

      <CreateProductDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        showDraftButton={false}
        onCreated={async (product) => {
          const res = await apiFetch(`/b2b-shop/catalog/${product.id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_listed: true }),
          })
          if (res.ok) notifySuccess(`${product.name} added to your shop`)
          else notifyError('Product created, but it could not be listed in the shop')
          loadCatalog()
        }}
      />
    </DashboardLayout>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'amber' }) {
  return (
    <div className="text-right">
      <p className={cn('text-xl font-semibold tabular-nums', tone === 'amber' && 'text-amber-600')}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

type RowPatch = Partial<Pick<B2BCatalogRow, 'is_listed' | 'b2b_price' | 'min_order_qty' | 'is_featured'>>

function CatalogRow({
  row,
  selected,
  saving,
  onToggleSelect,
  onUpdate,
  onEditImages,
}: {
  row: B2BCatalogRow
  selected: boolean
  saving: boolean
  onToggleSelect: () => void
  onUpdate: (patch: RowPatch) => void
  onEditImages: () => void
}) {
  const [price, setPrice] = useState(row.b2b_price ? String(row.b2b_price) : '')
  const [moq, setMoq] = useState(formatQty(row.min_order_qty || 1))
  useEffect(() => setPrice(row.b2b_price ? String(row.b2b_price) : ''), [row.b2b_price])
  useEffect(() => setMoq(formatQty(row.min_order_qty || 1)), [row.min_order_qty])

  const commitPrice = () => {
    const v = price.trim() === '' ? 0 : Number(price)
    if (!Number.isFinite(v) || v < 0) {
      setPrice(row.b2b_price ? String(row.b2b_price) : '')
      return
    }
    if (v !== row.b2b_price) onUpdate({ b2b_price: v })
  }
  const commitMoq = () => {
    const v = Number(moq)
    if (!Number.isFinite(v) || v <= 0) {
      setMoq(formatQty(row.min_order_qty || 1))
      return
    }
    if (v !== row.min_order_qty) onUpdate({ min_order_qty: v })
  }
  const isService = row.item_type === 'service'

  return (
    <tr className={cn('border-b last:border-0', !row.is_active && 'opacity-60')}>
      <td className="py-2.5">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select ${row.name}`} />
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEditImages}
            title={row.image_url ? 'Manage images' : 'Add image'}
            aria-label={`Manage images for ${row.name}`}
            className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ProductImage src={row.image_url} name={row.name} />
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition',
                row.image_url ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <ImagePlus className="h-4 w-4" />
            </span>
          </button>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[row.item_code, row.category, row.unit].filter(Boolean).join(' · ')}
              {!row.is_active && ' · inactive'}
            </p>
          </div>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">
        {isService ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={row.stock_qty > 0 ? '' : 'text-rose-600'}>{formatQty(row.stock_qty)}</span>
        )}
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{formatCurrency(row.sale_price)}</td>
      <td className="py-2.5 pr-4">
        <Input
          type="number"
          min={0}
          value={price}
          placeholder={String(row.sale_price)}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="h-8 w-28"
          title="Leave empty to use the sale price"
        />
      </td>
      <td className="py-2.5 pr-4">
        <Input
          type="number"
          min={0}
          value={moq}
          onChange={(e) => setMoq(e.target.value)}
          onBlur={commitMoq}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="h-8 w-20"
        />
      </td>
      <td className="py-2.5 pr-4 text-center">
        <button
          type="button"
          onClick={() => onUpdate({ is_featured: !row.is_featured })}
          className={cn('rounded p-1', row.is_featured ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400')}
          title={row.is_featured ? 'Featured — shown first' : 'Feature this product'}
        >
          <Star className={cn('h-4 w-4', row.is_featured && 'fill-current')} />
        </button>
      </td>
      <td className="py-2.5 text-center">
        <div className="flex items-center justify-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <Switch checked={row.is_listed} onCheckedChange={(v) => onUpdate({ is_listed: v })} aria-label={`List ${row.name} in shop`} />
        </div>
      </td>
    </tr>
  )
}
