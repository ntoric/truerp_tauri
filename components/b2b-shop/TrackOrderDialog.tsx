'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, PackageSearch, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/badge'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { B2B_STATUS_FLOW, B2B_STATUS_META, formatQty, shopApi } from '@/lib/b2bShop'

type Tracked = Awaited<ReturnType<typeof shopApi.track>>

interface TrackOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  showPrice: boolean
  initialOrderNumber?: string
  initialPhone?: string
}

export default function TrackOrderDialog({ open, onOpenChange, slug, showPrice, initialOrderNumber = '', initialPhone = '' }: TrackOrderDialogProps) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber)
  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<Tracked | null>(null)

  const lookup = async (num = orderNumber, ph = phone) => {
    if (!num.trim() || ph.replace(/\D/g, '').length < 10) {
      setError('Enter the order number and the phone number used to place it.')
      return
    }
    setLoading(true)
    setError('')
    try {
      setOrder(await shopApi.track(slug, num.trim(), ph.trim()))
    } catch (err) {
      setOrder(null)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setOrderNumber(initialOrderNumber)
    setPhone(initialPhone)
    setOrder(null)
    setError('')
    if (initialOrderNumber && initialPhone) lookup(initialOrderNumber, initialPhone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialOrderNumber, initialPhone])

  const reachedAt = (status: string) => {
    const hits = order?.timeline.filter((e) => e.status === status) ?? []
    return hits.length ? hits[hits.length - 1].at : undefined
  }
  const lastNote = order?.timeline.length ? order.timeline[order.timeline.length - 1].note : undefined
  const currentIdx = order ? B2B_STATUS_FLOW.indexOf(order.status) : -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" /> Track your order
          </DialogTitle>
          <DialogDescription>Use the order number from your confirmation and the phone number you ordered with.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            lookup()
          }}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Order number</Label>
            <Input value={orderNumber} placeholder="B2B-0001" onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
          </Button>
        </form>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {order && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{order.order_number}</p>
                <p className="text-xs text-slate-500">
                  {order.buyer_name} · placed {formatDateTime(order.created_at)}
                </p>
              </div>
              <StatusBadge tone={B2B_STATUS_META[order.status].tone}>{B2B_STATUS_META[order.status].label}</StatusBadge>
            </div>

            {order.status === 'cancelled' ? (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  This order was cancelled.
                  {lastNote && <p className="mt-1 text-rose-700">{lastNote}</p>}
                </div>
              </div>
            ) : (
              <ol className="space-y-0">
                {B2B_STATUS_FLOW.map((s, i) => {
                  const done = i <= currentIdx
                  const at = reachedAt(s)
                  return (
                    <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < B2B_STATUS_FLOW.length - 1 && (
                        <span className={cn('absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5', i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200')} />
                      )}
                      <span
                        className={cn(
                          'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
                        )}
                      >
                        {done && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <div className="pt-0.5">
                        <p className={cn('text-sm font-medium', done ? 'text-slate-900' : 'text-slate-400')}>{B2B_STATUS_META[s].label}</p>
                        {done && at && <p className="text-xs text-slate-500">{formatDateTime(at)}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            <div className="rounded-lg border">
              <ul className="divide-y text-sm">
                {order.items.map((it, idx) => (
                  <li key={idx} className="flex justify-between gap-3 px-3 py-2">
                    <span className="truncate">
                      {it.name} <span className="text-slate-400">× {formatQty(it.quantity)} {it.unit}</span>
                    </span>
                    {showPrice && <span className="tabular-nums">{formatCurrency(it.total ?? 0)}</span>}
                  </li>
                ))}
              </ul>
              {showPrice && order.total_amount !== undefined && (
                <div className="flex justify-between border-t bg-slate-50 px-3 py-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(order.total_amount)}</span>
                </div>
              )}
            </div>
            {order.invoiced && <p className="text-xs text-emerald-700">An invoice has been raised for this order.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
