'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Loader2, Pencil, Plus, Search, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandAvatar } from '@/components/ui/brand-avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { StateSelect } from '@/components/b2b-shop/CheckoutDialog'
import { cn } from '@/lib/utils'
import {
  BUYER_BOOK_EVENT,
  activeBuyer,
  loadBuyerBook,
  removeBuyer,
  savedBuyerCity,
  savedBuyerName,
  setActiveBuyer,
  shopApi,
  upsertBuyer,
  type BuyerBook,
  type BuyerMatch,
  type NewBuyerProfile,
  type PublicShop,
  type SavedBuyer,
} from '@/lib/b2bShop'

/** Business book for this shop, kept in sync with storage writes from anywhere on the page. */
export function useBuyerBook(slug: string): BuyerBook {
  const [book, setBook] = useState<BuyerBook>({ activeKey: null, buyers: [] })
  useEffect(() => {
    const refresh = () => setBook(loadBuyerBook(slug))
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('b2b-buyer')) refresh()
    }
    window.addEventListener(BUYER_BOOK_EVENT, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(BUYER_BOOK_EVENT, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [slug])
  return book
}

type DialogState = { mode: 'find' } | { mode: 'add'; editing?: SavedBuyer & { kind: 'draft' } } | null

/**
 * Header control: "Ordering for <business>". Buyers switch between the
 * businesses saved on this device, find their existing account with the
 * seller, or add a new business themselves (created on its first order).
 */
export default function BuyerSwitcher({ shop }: { shop: PublicShop }) {
  const book = useBuyerBook(shop.slug)
  const active = activeBuyer(book)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)

  const openDialog = (state: DialogState) => {
    setMenuOpen(false)
    setDialog(state)
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 min-w-0 max-w-[15rem] items-center gap-2 rounded-full border border-input bg-card py-1 pl-1 pr-3 text-left transition-colors hover:border-primary"
            aria-label={active ? `Ordering for ${savedBuyerName(active)}. Change business` : 'Select your business'}
          >
            {active ? (
              <BrandAvatar name={savedBuyerName(active)} size="sm" tone="tint" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-primary">
                <Building2 className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                {active ? 'Ordering for' : 'Your business'}
              </span>
              <span className="truncate text-xs font-medium text-slate-900">
                {active ? savedBuyerName(active) : 'Select or add'}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-2">
          <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Ordering for</p>

          {book.buyers.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">
              No businesses saved on this device yet. Find your account or add your business to check out faster.
            </p>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-y-auto py-1">
              {book.buyers.map((b) => {
                const selected = b.key === book.activeKey
                const city = savedBuyerCity(b)
                return (
                  <li key={b.key} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBuyer(shop.slug, b.key)
                        setMenuOpen(false)
                      }}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                        selected ? 'bg-tint' : 'hover:bg-slate-50'
                      )}
                    >
                      <BrandAvatar name={savedBuyerName(b)} size="sm" tone={b.kind === 'draft' ? 'tint' : 'brand'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{savedBuyerName(b)}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {b.kind === 'draft' ? 'New · set up on first order' : city || 'Verified account'}
                          {b.kind === 'draft' && city ? ` · ${city}` : ''}
                        </span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Selected" />}
                    </button>
                    {b.kind === 'draft' && (
                      <button
                        type="button"
                        onClick={() => openDialog({ mode: 'add', editing: b })}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                        aria-label={`Edit ${savedBuyerName(b)}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeBuyer(shop.slug, b.key)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Remove ${savedBuyerName(b)} from this device`}
                      title="Remove from this device"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-1 space-y-0.5 border-t pt-2">
            <button
              type="button"
              onClick={() => openDialog({ mode: 'find' })}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Search className="h-4 w-4 text-slate-400" /> Find my business
            </button>
            {shop.allow_new_buyers && (
              <button
                type="button"
                onClick={() => openDialog({ mode: 'add' })}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4 text-slate-400" /> Add a new business
              </button>
            )}
            {active && (
              <button
                type="button"
                onClick={() => {
                  setActiveBuyer(shop.slug, null)
                  setMenuOpen(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4 text-slate-400" /> Don&apos;t use a saved business
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <BusinessDialog shop={shop} state={dialog} onClose={() => setDialog(null)} />
    </>
  )
}

/* ------------------------------------------------------------------ */

const emptyProfile: NewBuyerProfile = {
  buyer_type: 'business',
  name: '',
  phone: '',
  email: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
}

function BusinessDialog({ shop, state, onClose }: { shop: PublicShop; state: DialogState; onClose: () => void }) {
  const [mode, setMode] = useState<'find' | 'add'>('find')
  const [error, setError] = useState('')
  // find
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<BuyerMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<BuyerMatch | null>(null)
  const [phone, setPhone] = useState('')
  const seq = useRef(0)
  // add
  const [profile, setProfile] = useState<NewBuyerProfile>(emptyProfile)
  const editingKey = state?.mode === 'add' ? state.editing?.key : undefined

  useEffect(() => {
    if (!state) return
    setMode(state.mode)
    setError('')
    setQuery('')
    setMatches([])
    setPicked(null)
    setPhone('')
    setProfile(state.mode === 'add' && state.editing ? { ...emptyProfile, ...state.editing.profile } : emptyProfile)
  }, [state])

  useEffect(() => {
    if (mode !== 'find' || picked) return
    const q = query.trim()
    if (q.length < 3) {
      setMatches([])
      setSearching(false)
      return
    }
    const mine = ++seq.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await shopApi.searchBuyers(shop.slug, q)
        if (mine === seq.current) setMatches(res)
      } catch {
        if (mine === seq.current) setMatches([])
      } finally {
        if (mine === seq.current) setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, mode, picked, shop.slug])

  const isIndividual = profile.buyer_type === 'individual'

  const saveFound = () => {
    if (!picked) return
    if (picked.has_phone && phone.replace(/\D/g, '').length < 10) {
      setError('Enter the phone number registered with the seller. It is checked when you place an order.')
      return
    }
    upsertBuyer(shop.slug, { party_id: picked.id, name: picked.name, city: picked.city, phone: phone.trim() })
    onClose()
  }

  const saveNew = () => {
    if (profile.name.trim().length < 2) return setError(isIndividual ? 'Your name is required.' : 'Business name is required.')
    if (profile.phone.replace(/\D/g, '').length < 10) return setError('A valid 10-digit phone number is required.')
    if (!isIndividual && profile.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(profile.gstin.trim()))
      return setError('GSTIN must be 15 characters (e.g. 29ABCDE1234F1Z5).')
    upsertBuyer(
      shop.slug,
      {
        ...profile,
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        email: profile.email.trim(),
        gstin: isIndividual ? '' : profile.gstin.trim().toUpperCase(),
        address: profile.address.trim(),
        city: profile.city.trim(),
        pincode: profile.pincode.trim(),
      },
      editingKey
    )
    onClose()
  }

  const set = (patch: Partial<NewBuyerProfile>) => setProfile((p) => ({ ...p, ...patch }))

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingKey ? 'Edit business' : mode === 'find' ? 'Find your business' : 'Add your business'}</DialogTitle>
          <DialogDescription>
            {mode === 'find'
              ? `Already buy from ${shop.name}? Search for your account and save it on this device.`
              : `Saved on this device. ${shop.name} sets up your account when you place your first order.`}
          </DialogDescription>
        </DialogHeader>

        {!editingKey && shop.allow_new_buyers && (
          <div className="grid grid-cols-2 gap-1 rounded-full border bg-slate-50 p-1">
            {(
              [
                ['find', 'I have ordered before'],
                ['add', 'First time here'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition',
                  mode === m ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'find' ? (
          picked ? (
            <div className="space-y-3 rounded-xl border bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <BrandAvatar name={picked.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{picked.name}</p>
                  {picked.city && <p className="text-xs text-slate-500">{picked.city}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
              {picked.has_phone ? (
                <div className="space-y-1.5">
                  <Label htmlFor="buyer-phone" className="flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" /> Your registered phone
                    {picked.phone_hint && <span className="text-slate-500">({picked.phone_hint})</span>}
                  </Label>
                  <Input
                    id="buyer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-white"
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  No phone is registered for this business. The seller will verify your orders before confirming.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  autoFocus
                  placeholder="Business name, phone or GSTIN"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
              </div>
              {query.trim().length > 0 && query.trim().length < 3 && (
                <p className="text-xs text-slate-500">Type at least 3 characters.</p>
              )}
              {query.trim().length >= 3 && !searching && matches.length === 0 && (
                <p className="text-sm text-slate-500">
                  No matching business found.
                  {shop.allow_new_buyers && (
                    <>
                      {' '}
                      <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode('add')}>
                        Add it as a new business
                      </button>
                    </>
                  )}
                </p>
              )}
              {matches.length > 0 && (
                <ul className="divide-y overflow-hidden rounded-xl border">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(m)
                          setError('')
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                      >
                        <BrandAvatar name={m.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{m.name}</span>
                          {m.city && <span className="block text-xs text-slate-500">{m.city}</span>}
                        </span>
                        {m.phone_hint && <span className="text-xs tabular-nums text-slate-400">{m.phone_hint}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2" role="radiogroup" aria-label="Buying as">
              <span className="text-xs font-medium text-slate-600">Buying as</span>
              {(
                [
                  ['business', 'Business'],
                  ['individual', 'Individual customer'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={profile.buyer_type === value}
                  onClick={() => set({ buyer_type: value })}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    profile.buyer_type === value
                      ? 'border-primary bg-tint text-primary'
                      : 'bg-white text-slate-600 hover:border-slate-400'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <FormField label={isIndividual ? 'Full name *' : 'Business name *'} className="sm:col-span-2">
              <Input value={profile.name} onChange={(e) => set({ name: e.target.value })} />
            </FormField>
            <FormField label="Phone *">
              <Input type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => set({ phone: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <Input type="email" autoComplete="email" value={profile.email} onChange={(e) => set({ email: e.target.value })} />
            </FormField>
            {!isIndividual && (
              <FormField label="GSTIN" className="sm:col-span-2">
                <Input
                  value={profile.gstin}
                  maxLength={15}
                  placeholder="Optional"
                  onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
                />
              </FormField>
            )}
            <FormField label={isIndividual ? 'Address' : 'Business address'} className="sm:col-span-2">
              <Textarea rows={2} value={profile.address} onChange={(e) => set({ address: e.target.value })} />
            </FormField>
            <FormField label="City">
              <Input value={profile.city} onChange={(e) => set({ city: e.target.value })} />
            </FormField>
            <FormField label="Pincode">
              <Input inputMode="numeric" maxLength={6} value={profile.pincode} onChange={(e) => set({ pincode: e.target.value })} />
            </FormField>
            <FormField label="State" className="sm:col-span-2">
              <StateSelect value={profile.state} onChange={(state) => set({ state })} />
            </FormField>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Already buy from {shop.name} offline? Use the same phone or GSTIN and your first order links to your existing account.
            </p>
          </div>
        )}

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === 'find' ? (
            <Button onClick={saveFound} disabled={!picked}>
              Save and order as this business
            </Button>
          ) : (
            <Button onClick={saveNew}>{editingKey ? 'Save changes' : 'Save business'}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FormField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
