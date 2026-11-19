'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, CheckCircle2, Loader2, Search, ShieldCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatCurrency } from '@/lib/utils'
import { INDIAN_STATES } from '@/lib/indianStates'
import {
  activeBuyer,
  formatQty,
  loadBuyerBook,
  saveBuyer,
  setActiveBuyer,
  shopApi,
  type BuyerMatch,
  type CartLine,
  type PublicShop,
} from '@/lib/b2bShop'

type Mode = 'existing' | 'new'

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shop: PublicShop
  lines: CartLine[]
  onPlaced: (result: { order_number: string; total_amount: number; phone: string }) => void
  /** Called when the server rejects the cart (stock/listing changed). */
  onCartStale: () => void
}

const emptyBusiness = {
  buyer_type: 'business' as 'business' | 'individual',
  name: '',
  phone: '',
  email: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
}
const emptyShipping = { address: '', city: '', state: '', pincode: '' }

export default function CheckoutDialog({ open, onOpenChange, shop, lines, onPlaced, onCartStale }: CheckoutDialogProps) {
  const [mode, setMode] = useState<Mode>('existing')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<BuyerMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<BuyerMatch | null>(null)
  const [verifyPhone, setVerifyPhone] = useState('')
  const [business, setBusiness] = useState(emptyBusiness)
  const [useFileAddress, setUseFileAddress] = useState(true)
  const [shipping, setShipping] = useState(emptyShipping)
  const [contactPerson, setContactPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const searchSeq = useRef(0)

  const isIndividual = business.buyer_type === 'individual'
  // Older servers don't send the flag; treat it as required.
  const addressRequired = shop.require_delivery_address !== false
  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.product.price, 0), [lines])

  // Start from the business picked in the shop header each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setError('')
    const active = activeBuyer(loadBuyerBook(shop.slug))
    if (active?.kind === 'existing') {
      setMode('existing')
      setSelected({ id: active.party_id, name: active.name, city: active.city, phone_hint: '', has_phone: true })
      setVerifyPhone(active.phone)
    } else if (active?.kind === 'draft' && shop.allow_new_buyers) {
      setMode('new')
      setSelected(null)
      setBusiness({ ...emptyBusiness, ...active.profile })
    } else if (!selected && !shop.allow_new_buyers) {
      setMode('existing')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shop.slug])

  // Debounced business lookup.
  useEffect(() => {
    if (mode !== 'existing' || selected) return
    const q = query.trim()
    if (q.length < 3) {
      setMatches([])
      return
    }
    const seq = ++searchSeq.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await shopApi.searchBuyers(shop.slug, q)
        if (seq === searchSeq.current) setMatches(res)
      } catch {
        if (seq === searchSeq.current) setMatches([])
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, mode, selected, shop.slug])

  const validate = (): string => {
    if (mode === 'existing') {
      if (!selected) return 'Search and select your business, or register as a new buyer.'
      if (selected.has_phone && verifyPhone.replace(/\D/g, '').length < 10)
        return 'Enter the phone number registered with the seller to confirm it is you.'
    } else {
      if (business.name.trim().length < 2) return isIndividual ? 'Your name is required.' : 'Business name is required.'
      if (business.phone.replace(/\D/g, '').length < 10) return 'A valid 10-digit phone number is required.'
      if (business.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(business.gstin.trim()))
        return 'GSTIN must be 15 characters (e.g. 29ABCDE1234F1Z5).'
      if (addressRequired && !business.address.trim()) return isIndividual ? 'Address is required.' : 'Business address is required.'
    }
    if (addressRequired && !useFileAddress && !shipping.address.trim()) return 'Enter the delivery address.'
    return ''
  }

  const submit = async () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setSubmitting(true)
    const deliver = useFileAddress ? emptyShipping : shipping
    const body = {
      ...(mode === 'existing'
        ? { party_id: selected!.id, phone: verifyPhone.trim() }
        : { business: { ...business, gstin: isIndividual ? '' : business.gstin.trim().toUpperCase() } }),
      contact_person: contactPerson.trim(),
      shipping_address: deliver.address.trim(),
      city: deliver.city.trim(),
      state: deliver.state,
      pincode: deliver.pincode.trim(),
      notes: notes.trim(),
      items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
    }
    try {
      const res = await shopApi.placeOrder(shop.slug, body)
      const phone = mode === 'existing' ? verifyPhone.trim() : business.phone.trim()
      // Remember the buyer only when the phone they used is the one on file,
      // otherwise the next checkout would fail phone verification.
      if (res.verified || res.buyer_match === 'created') {
        saveBuyer(shop.slug, {
          party_id: res.party_id,
          name: mode === 'existing' ? selected!.name : business.name.trim(),
          city: mode === 'existing' ? selected!.city : business.city.trim(),
          phone,
        })
      } else {
        saveBuyer(shop.slug, null)
      }
      onPlaced({ order_number: res.order_number, total_amount: res.total_amount, phone })
    } catch (err) {
      const e = err as Error & { status?: number }
      setError(e.message)
      if (e.status === 409) onCartStale()
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setUseFileAddress(true)
  }

  // Deselect only; the business stays saved in the header's list.
  const forgetSelection = () => {
    setSelected(null)
    setVerifyPhone('')
    setQuery('')
    setActiveBuyer(shop.slug, null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Place your order</DialogTitle>
          <DialogDescription>
            {lines.length} product{lines.length === 1 ? '' : 's'} · {formatCurrency(total)}. {shop.name} will confirm availability and send
            the invoice.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Business */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">1. Your business</h3>
          {shop.allow_new_buyers && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['existing', 'I have ordered before', Building2],
                  ['new', 'First time here', UserPlus],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                    mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          )}

          {mode === 'existing' &&
            (selected ? (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-slate-900">{selected.name}</p>
                      {selected.city && <p className="text-xs text-slate-600">{selected.city}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={forgetSelection}>
                    Change
                  </Button>
                </div>
                {selected.has_phone ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="verify-phone" className="flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5" /> Confirm your registered phone
                      {selected.phone_hint && <span className="text-slate-500">({selected.phone_hint})</span>}
                    </Label>
                    <Input
                      id="verify-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="10-digit mobile number"
                      value={verifyPhone}
                      onChange={(e) => setVerifyPhone(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    No phone is registered for this business. The seller will verify the order before confirming.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoFocus
                    placeholder="Search by business name, phone or GSTIN"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                </div>
                {query.trim().length >= 3 && !searching && matches.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No matching business found.
                    {shop.allow_new_buyers && (
                      <>
                        {' '}
                        <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => switchMode('new')}>
                          Register as a new business
                        </button>
                      </>
                    )}
                  </p>
                )}
                {matches.length > 0 && (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(m)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span>
                            <span className="block text-sm font-medium">{m.name}</span>
                            {m.city && <span className="block text-xs text-slate-500">{m.city}</span>}
                          </span>
                          {m.phone_hint && <span className="text-xs tabular-nums text-slate-400">{m.phone_hint}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {mode === 'new' && (
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
                    aria-checked={business.buyer_type === value}
                    onClick={() => setBusiness({ ...business, buyer_type: value })}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      business.buyer_type === value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:border-slate-400'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="-mt-1 text-xs text-slate-500 sm:col-span-2">
                Already buy from us offline? Use the same phone number or GSTIN and we&apos;ll link this order to your existing account.
              </p>
              <Field label={isIndividual ? 'Full name *' : 'Business name *'} className="sm:col-span-2">
                <Input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
              </Field>
              <Field label="Phone *">
                <Input
                  type="tel"
                  autoComplete="tel"
                  value={business.phone}
                  onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={business.email}
                  onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                />
              </Field>
              {!isIndividual && (
                <Field label="GSTIN" className="sm:col-span-2">
                  <Input
                    value={business.gstin}
                    maxLength={15}
                    placeholder="Optional"
                    onChange={(e) => setBusiness({ ...business, gstin: e.target.value.toUpperCase() })}
                  />
                </Field>
              )}
              <Field label={`${isIndividual ? 'Address' : 'Business address'}${addressRequired ? ' *' : ''}`} className="sm:col-span-2">
                <Textarea rows={2} value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={business.city} onChange={(e) => setBusiness({ ...business, city: e.target.value })} />
              </Field>
              <Field label="Pincode">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={business.pincode}
                  onChange={(e) => setBusiness({ ...business, pincode: e.target.value })}
                />
              </Field>
              <Field label="State" className="sm:col-span-2">
                <StateSelect value={business.state} onChange={(state) => setBusiness({ ...business, state })} />
              </Field>
            </div>
          )}
        </section>

        {/* 2. Delivery */}
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-slate-900">2. Delivery</h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={useFileAddress} onCheckedChange={(v) => setUseFileAddress(v === true)} />
            {mode === 'new' ? 'Deliver to the address above' : 'Deliver to the address the seller has on file'}
          </label>
          {!useFileAddress && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={addressRequired ? 'Delivery address *' : 'Delivery address'} className="sm:col-span-2">
                <Textarea rows={2} value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} />
              </Field>
              <Field label="Pincode">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={shipping.pincode}
                  onChange={(e) => setShipping({ ...shipping, pincode: e.target.value })}
                />
              </Field>
              <Field label="State" className="sm:col-span-2">
                <StateSelect value={shipping.state} onChange={(state) => setShipping({ ...shipping, state })} />
              </Field>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact person">
              <Input value={contactPerson} placeholder="Who should we call?" onChange={(e) => setContactPerson(e.target.value)} />
            </Field>
            <Field label="Notes for the seller" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={notes}
                placeholder="Delivery timing, packing instructions…"
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* Summary */}
        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold text-slate-900">3. Review</h3>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {lines.map((l) => (
              <li key={l.product.id} className="flex justify-between gap-3">
                <span className="truncate text-slate-600">
                  {l.product.name}{' '}
                  <span className="text-slate-400">
                    × {formatQty(l.quantity)} {l.product.unit}
                  </span>
                </span>
                <span className="tabular-nums">{formatCurrency(l.quantity * l.product.price)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
          {shop.terms && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Terms of sale</summary>
              <p className="mt-1 whitespace-pre-line">{shop.terms}</p>
            </details>
          )}
        </section>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Back to cart
          </Button>
          <Button onClick={submit} disabled={submitting || lines.length === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Place order · {formatCurrency(total)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

export function StateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select state" />
      </SelectTrigger>
      <SelectContent>
        {INDIAN_STATES.map((s) => (
          <SelectItem key={s.code} value={s.name}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
