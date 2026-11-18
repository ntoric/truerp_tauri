'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  RotateCcw,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import EstimateConvertDialog, { type ConvertibleEstimate } from '@/components/EstimateConvertDialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  B2B_STATUS_META,
  formatQty,
  nextB2BStatuses,
  type B2BOrder,
  type B2BOrderStatus,
} from '@/lib/b2bShop'

interface OrderDetail {
  order: B2BOrder
  party: { id: string; name: string; phone: string; balance: number; gstin: string } | null
  quotation: { id: string; quotation_number: string; status: string; total_amount: number } | null
  invoice: { id: string; invoice_number: string; status: string; total_amount: number } | null
  stock: Record<string, number>
}

interface OrderDetailDialogProps {
  orderId: string | null
  onClose: () => void
  /** Called whenever the order changes so the list can refresh. */
  onChanged: () => void
}

export default function OrderDetailDialog({ orderId, onClose, onChanged }: OrderDetailDialogProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftItems, setDraftItems] = useState<Record<string, { quantity: string; unit_price: string }>>({})
  const [convertEstimate, setConvertEstimate] = useState<ConvertibleEstimate | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()

  const apply = (d: OrderDetail) => {
    setDetail(d)
    setInternalNotes(d.order.internal_notes || '')
  }

  useEffect(() => {
    if (!orderId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setEditing(false)
    setStatusNote('')
    apiFetch(`/b2b-shop/orders/${orderId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load order')
        apply(await res.json())
      })
      .catch((err) => {
        notifyError(err.message)
        onClose()
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const order = detail?.order
  const items = order?.items ?? []
  const canEditItems = !!order && !order.quotation_id && (order.status === 'pending' || order.status === 'confirmed')
  const canDelete = !!order && !order.invoice_id && (order.status === 'cancelled' || (order.status === 'pending' && !order.quotation_id))

  const draftTotal = useMemo(() => {
    if (!editing) return 0
    return items.reduce((sum, it) => {
      const d = draftItems[it.id]
      return sum + (Number(d?.quantity) || 0) * (Number(d?.unit_price) || 0)
    }, 0)
  }, [editing, items, draftItems])

  const call = async (key: string, path: string, init: RequestInit, success?: string): Promise<boolean> => {
    setBusy(key)
    try {
      const res = await apiFetch(path, init)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      if (data.order) apply(data)
      if (success) notifySuccess(success)
      onChanged()
      return true
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Request failed')
      return false
    } finally {
      setBusy(null)
    }
  }

  const changeStatus = async (status: B2BOrderStatus) => {
    if (!order) return
    if (status === 'cancelled') {
      const ok = await confirm({
        title: `Cancel order ${order.order_number}?`,
        description: 'The buyer will see this order as cancelled when they track it. You can reopen it later.',
        confirmLabel: 'Cancel order',
        variant: 'destructive',
      })
      if (!ok) return
    }
    const ok = await call(
      `status:${status}`,
      `/b2b-shop/orders/${order.id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status, note: statusNote.trim() }) },
      `Order marked ${B2B_STATUS_META[status].label.toLowerCase()}`
    )
    if (ok) setStatusNote('')
  }

  const startEditing = () => {
    const d: Record<string, { quantity: string; unit_price: string }> = {}
    items.forEach((it) => (d[it.id] = { quantity: formatQty(it.quantity), unit_price: String(it.unit_price) }))
    setDraftItems(d)
    setEditing(true)
  }

  const saveItems = async () => {
    if (!order) return
    const payload = items.map((it) => ({
      id: it.id,
      quantity: Number(draftItems[it.id]?.quantity) || 0,
      unit_price: Number(draftItems[it.id]?.unit_price) || 0,
    }))
    if (payload.every((p) => p.quantity <= 0)) {
      notifyError('An order needs at least one item. Cancel the order instead.')
      return
    }
    const ok = await call('items', `/b2b-shop/orders/${order.id}`, { method: 'PUT', body: JSON.stringify({ items: payload }) }, 'Order items updated')
    if (ok) setEditing(false)
  }

  const saveNotes = () =>
    order &&
    call('notes', `/b2b-shop/orders/${order.id}`, { method: 'PUT', body: JSON.stringify({ internal_notes: internalNotes }) }, 'Notes saved')

  // 'estimate' only creates (or reuses) the order's estimate; 'sale' goes on
  // to convert that estimate into a sale invoice.
  const createBilling = async (mode: 'estimate' | 'sale') => {
    if (!order) return
    setBusy(mode)
    try {
      const res = await apiFetch(`/b2b-shop/orders/${order.id}/estimate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (mode === 'sale' ? 'Failed to prepare sale' : 'Failed to create estimate'))
      const q = data.quotation
      if (mode === 'estimate') {
        notifySuccess(data.created ? `Estimate ${q.quotation_number} created` : `Estimate ${q.quotation_number} already exists`)
      } else if (q.status === 'converted') {
        notifyError('This estimate has already been converted to an invoice')
      } else {
        setConvertEstimate({ id: q.id, quotation_number: q.quotation_number, total_amount: q.total_amount })
      }
      const refreshed = await apiFetch(`/b2b-shop/orders/${order.id}`)
      if (refreshed.ok) apply(await refreshed.json())
      onChanged()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : mode === 'sale' ? 'Failed to prepare sale' : 'Failed to create estimate')
    } finally {
      setBusy(null)
    }
  }

  const deleteOrder = async () => {
    if (!order) return
    const ok = await confirm({
      title: `Delete order ${order.order_number}?`,
      description: 'This removes the order permanently. Use this for spam or test orders.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    if (await call('delete', `/b2b-shop/orders/${order.id}`, { method: 'DELETE' }, 'Order deleted')) onClose()
  }

  const nextSteps = order ? nextB2BStatuses(order.status) : []
  const primaryNext = nextSteps[0]
  const canCancel = !!order && order.status !== 'cancelled' && order.status !== 'delivered' && !order.invoice_id

  return (
    <>
      <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          {loading || !order || !detail ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-3 pr-6">
                  <DialogTitle className="text-xl">{order.order_number}</DialogTitle>
                  <StatusBadge tone={B2B_STATUS_META[order.status].tone}>{B2B_STATUS_META[order.status].label}</StatusBadge>
                  <span className="text-sm text-muted-foreground">Placed {formatDateTime(order.created_at)}</span>
                </div>
              </DialogHeader>

              {/* Buyer + delivery */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{order.buyer_name}</p>
                    {order.is_new_buyer && (
                      <StatusBadge tone="violet">
                        <UserPlus className="h-3 w-3" /> New buyer
                      </StatusBadge>
                    )}
                    {!order.is_new_buyer &&
                      (order.buyer_verified ? (
                        <StatusBadge tone="success">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">
                          <AlertTriangle className="h-3 w-3" /> Unverified
                        </StatusBadge>
                      ))}
                  </div>
                  {order.contact_person && <p className="text-sm text-slate-600">Contact: {order.contact_person}</p>}
                  {order.buyer_phone && (
                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="h-3.5 w-3.5" /> {order.buyer_phone}
                    </p>
                  )}
                  {order.buyer_gstin && <p className="text-xs text-slate-500">GSTIN {order.buyer_gstin}</p>}
                  {detail.party && (
                    <p className="text-xs text-slate-500">
                      Party balance:{' '}
                      <span className={cn('font-medium', detail.party.balance > 0 ? 'text-amber-700' : 'text-slate-700')}>
                        {formatCurrency(detail.party.balance)}
                      </span>
                      {' · '}
                      <Link href={`/parties/ledger?party_id=${detail.party.id}`} className="text-blue-600 hover:underline">
                        Ledger
                      </Link>
                    </p>
                  )}
                  <BuyerMatchNote order={order} partyName={detail.party?.name} />
                </div>
                <div className="space-y-1.5 rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <MapPin className="h-4 w-4" /> Deliver to
                  </p>
                  <p className="whitespace-pre-line text-sm text-slate-700">{order.shipping_address}</p>
                  <p className="text-sm text-slate-600">{[order.city, order.state, order.pincode].filter(Boolean).join(', ')}</p>
                  {order.notes && (
                    <div className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                      <span className="font-medium">Buyer note:</span> {order.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <p className="text-sm font-semibold">
                    {order.item_count} item{order.item_count === 1 ? '' : 's'}
                  </p>
                  {canEditItems && !editing && (
                    <Button variant="ghost" size="sm" onClick={startEditing}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit quantities
                    </Button>
                  )}
                </div>
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">In stock</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const stock = it.product_id ? detail.stock[it.product_id] ?? 0 : undefined
                        const short = stock !== undefined && stock < it.quantity && order.status !== 'delivered' && !order.invoice_id
                        return (
                          <tr key={it.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <p className="font-medium">{it.name}</p>
                              {it.hsn_code && <p className="text-xs text-muted-foreground">HSN {it.hsn_code}</p>}
                            </td>
                            <td className={cn('px-3 py-2 text-right tabular-nums', short && 'font-medium text-rose-600')}>
                              {stock === undefined ? '—' : formatQty(stock)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {editing ? (
                                <Input
                                  type="number"
                                  min={0}
                                  className="ml-auto h-8 w-24 text-right"
                                  value={draftItems[it.id]?.quantity ?? ''}
                                  onChange={(e) =>
                                    setDraftItems((p) => ({ ...p, [it.id]: { ...p[it.id], quantity: e.target.value } }))
                                  }
                                />
                              ) : (
                                <>
                                  {formatQty(it.quantity)} <span className="text-xs text-muted-foreground">{it.unit}</span>
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {editing ? (
                                <Input
                                  type="number"
                                  min={0}
                                  className="ml-auto h-8 w-28 text-right"
                                  value={draftItems[it.id]?.unit_price ?? ''}
                                  onChange={(e) =>
                                    setDraftItems((p) => ({ ...p, [it.id]: { ...p[it.id], unit_price: e.target.value } }))
                                  }
                                />
                              ) : (
                                formatCurrency(it.unit_price)
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {editing
                                ? formatCurrency((Number(draftItems[it.id]?.quantity) || 0) * (Number(draftItems[it.id]?.unit_price) || 0))
                                : formatCurrency(it.total)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-3 py-2">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveItems} disabled={busy === 'items'}>
                        {busy === 'items' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Save changes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        Discard
                      </Button>
                      <span className="text-xs text-muted-foreground">Set quantity to 0 to remove a line.</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{formatQty(order.total_qty)} units total</span>
                  )}
                  <span className="text-base font-bold tabular-nums">{formatCurrency(editing ? draftTotal : order.total_amount)}</span>
                </div>
              </div>

              {/* Billing */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <ReceiptText className="h-4 w-4 text-slate-500" />
                  {detail.invoice ? (
                    <span>
                      Invoiced as{' '}
                      <Link href={`/invoices/view?id=${detail.invoice.id}`} className="font-medium text-blue-600 hover:underline">
                        {detail.invoice.invoice_number}
                      </Link>
                    </span>
                  ) : detail.quotation ? (
                    <span>
                      Estimate{' '}
                      <Link href={`/estimates/view?id=${detail.quotation.id}`} className="font-medium text-blue-600 hover:underline">
                        {detail.quotation.quotation_number}
                      </Link>{' '}
                      created — not yet invoiced
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not billed yet. An estimate is a quote only; creating the sale deducts stock and posts to the buyer&apos;s ledger.</span>
                  )}
                </div>
                {!detail.invoice && order.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-2">
                    {!detail.quotation && (
                      <Button size="sm" variant="outline" onClick={() => createBilling('estimate')} disabled={!!busy || editing}>
                        {busy === 'estimate' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                        Create estimate
                      </Button>
                    )}
                    <Button size="sm" onClick={() => createBilling('sale')} disabled={!!busy || editing}>
                      {busy === 'sale' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-1.5 h-4 w-4" />}
                      Create sale
                    </Button>
                  </div>
                )}
              </div>

              {/* Status actions + timeline */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Update status</Label>
                  <Textarea
                    rows={2}
                    placeholder="Optional note (shown to the buyer when tracking), e.g. vehicle number"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                  {/* Next step full width; other steps and Cancel in an even two-column grid. */}
                  <div className="space-y-2">
                    {primaryNext && (
                      <Button size="sm" className="w-full" onClick={() => changeStatus(primaryNext)} disabled={!!busy}>
                        {busy === `status:${primaryNext}` && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        {primaryNext === 'pending' && <RotateCcw className="mr-1.5 h-4 w-4" />}
                        {B2B_STATUS_META[primaryNext].action}
                      </Button>
                    )}
                    {(nextSteps.length > 1 || canCancel) && (
                      <div className="grid grid-cols-2 gap-2">
                        {nextSteps.slice(1).map((s) => (
                          <Button key={s} size="sm" variant="outline" className="w-full" onClick={() => changeStatus(s)} disabled={!!busy}>
                            {busy === `status:${s}` && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            {B2B_STATUS_META[s].action}
                          </Button>
                        ))}
                        {canCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => changeStatus('cancelled')}
                            disabled={!!busy}
                          >
                            {busy === 'status:cancelled' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                            Cancel order
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-semibold">Internal notes</Label>
                    <Textarea
                      rows={3}
                      placeholder="Only visible to your team"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                    />
                    <Button size="sm" variant="secondary" onClick={saveNotes} disabled={busy === 'notes' || internalNotes === (order.internal_notes || '')}>
                      Save notes
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Activity</Label>
                  <ol className="space-y-3 border-l pl-4">
                    {[...(order.timeline ?? [])].reverse().map((ev, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-300" />
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={B2B_STATUS_META[ev.status]?.tone ?? 'neutral'}>
                            {B2B_STATUS_META[ev.status]?.label ?? ev.status}
                          </StatusBadge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(ev.at)}</span>
                        </div>
                        {ev.note && <p className="mt-0.5 text-sm">{ev.note}</p>}
                        {ev.by && <p className="text-xs text-muted-foreground">by {ev.by}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {canDelete && (
                <div className="flex justify-end border-t pt-3">
                  <Button variant="ghost" size="sm" className="text-rose-600" onClick={deleteOrder} disabled={!!busy}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete order
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <EstimateConvertDialog
        estimate={convertEstimate}
        open={!!convertEstimate}
        onClose={() => setConvertEstimate(null)}
        onConverted={async () => {
          setConvertEstimate(null)
          if (order) {
            const res = await apiFetch(`/b2b-shop/orders/${order.id}`)
            if (res.ok) apply(await res.json())
          }
          onChanged()
        }}
      />
      {confirmDialog}
    </>
  )
}

/** Explains how the order was tied to its party in Parties. */
function BuyerMatchNote({ order, partyName }: { order: B2BOrder; partyName?: string }) {
  const party = partyName ? <span className="font-medium">{partyName}</span> : 'an existing party'
  switch (order.buyer_match) {
    case 'created':
      return <p className="text-xs text-violet-700">New buyer — added to Parties when this order was placed.</p>
    case 'phone':
      return <p className="text-xs text-emerald-700">Signed up with a phone number already in Parties — linked to {party}.</p>
    case 'gstin':
    case 'name':
      return (
        <p className="text-xs text-amber-700">
          Signed up with a {order.buyer_match === 'gstin' ? 'GSTIN' : 'business name'} matching {party} in Parties, but a different
          phone ({order.buyer_phone}). The order is linked to that party and its record was not changed. Confirm with the business
          before dispatch — if this is someone else, cancel and ask them to contact you.
        </p>
      )
    default:
      return !order.buyer_verified ? (
        <p className="text-xs text-amber-700">
          No phone was on file for this party, so the buyer could not be verified. Confirm by phone before dispatch.
        </p>
      ) : null
  }
}
