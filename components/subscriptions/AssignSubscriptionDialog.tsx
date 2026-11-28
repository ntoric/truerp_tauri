'use client'

import { useEffect, useMemo, useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  ApiError,
  PAYMENT_METHODS,
  createSubscription,
  cyclePer,
  formatMoney,
  todayYmd,
  type PaymentMethod,
  type SubscriptionPlan,
} from '@/lib/subscriptions'

export interface StoreOption {
  id: string
  name: string
  code: string
  is_active: boolean
}

export default function AssignSubscriptionDialog({
  open,
  onOpenChange,
  plans,
  stores,
  defaultStoreId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plans: SubscriptionPlan[]
  stores: StoreOption[]
  defaultStoreId?: string
  onSaved: (subscriptionId: string) => void
}) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans])

  const [storeId, setStoreId] = useState('')
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(todayYmd())
  const [autoRenew, setAutoRenew] = useState(true)
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [withPayment, setWithPayment] = useState(true)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bank_transfer')
  const [payRef, setPayRef] = useState('')
  const [payDate, setPayDate] = useState(todayYmd())
  const [complimentary, setComplimentary] = useState(false)
  const [compForever, setCompForever] = useState(true)
  const [compCycles, setCompCycles] = useState('3')
  const [compReason, setCompReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStoreId(defaultStoreId ?? '')
    const first = activePlans.find((p) => p.highlight) ?? activePlans[0]
    setPlanId(first?.id ?? '')
    setPrice(first ? String(first.price) : '')
    setPayAmount(first ? String(first.price) : '')
    setStartDate(todayYmd())
    setPayDate(todayYmd())
    setAutoRenew(true)
    setNotes('')
    setWithPayment(true)
    setPayMethod('bank_transfer')
    setPayRef('')
    setComplimentary(false)
    setCompForever(true)
    setCompCycles('3')
    setCompReason('')
  }, [open, defaultStoreId, activePlans])

  const plan = activePlans.find((p) => p.id === planId)

  const choosePlan = (id: string) => {
    setPlanId(id)
    const p = activePlans.find((x) => x.id === id)
    if (p) {
      setPrice(String(p.price))
      setPayAmount(String(p.price))
    }
  }

  const submit = async (replace = false) => {
    if (!storeId) return notifyError('Select a store')
    if (!plan) return notifyError('Select a plan')
    const priceNum = Number(price)
    if (price === '' || Number.isNaN(priceNum) || priceNum < 0) return notifyError('Enter a valid price')
    const payNum = Number(payAmount)
    const collectPayment = withPayment && priceNum > 0 && !complimentary
    if (collectPayment && (!payNum || payNum <= 0)) return notifyError('Enter the payment amount')
    const cyclesNum = Math.floor(Number(compCycles))
    if (complimentary && !compForever && (!cyclesNum || cyclesNum < 1)) return notifyError('Enter how many cycles are free')

    setSaving(true)
    try {
      const sub = await createSubscription({
        store_id: storeId,
        plan_id: plan.id,
        start_date: startDate,
        auto_renew: autoRenew,
        price: priceNum,
        notes: notes.trim(),
        replace_existing: replace,
        initial_payment: collectPayment
          ? { amount: payNum, method: payMethod, reference: payRef.trim(), payment_date: payDate, notes: '' }
          : undefined,
        is_complimentary: complimentary,
        complimentary_cycles: complimentary && !compForever ? cyclesNum : 0,
        complimentary_reason: complimentary ? compReason.trim() : '',
      })
      notifySuccess(`${plan.name} assigned to ${sub.store_name}${complimentary ? ' as complimentary' : ''}.`)
      onOpenChange(false)
      onSaved(sub.id)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data.requires_replace && !replace) {
        setSaving(false)
        const ok = await confirm({
          title: 'Replace current subscription?',
          description: `${e.message}. It will be cancelled immediately and replaced with ${plan.name}.`,
          confirmLabel: 'Replace',
          variant: 'destructive',
        })
        if (ok) await submit(true)
        return
      }
      notifyError(e instanceof Error ? e.message : 'Failed to assign subscription')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign subscription</DialogTitle>
            <DialogDescription>
              The first cycle starts on the start date. Renewal dates follow the plan&apos;s monthly or annual cycle.
            </DialogDescription>
          </DialogHeader>

          {activePlans.length === 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Create an active plan first.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Store *</Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.code}){!s.is_active && ' · inactive'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plan *</Label>
                  <Select value={planId} onValueChange={choosePlan}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {formatMoney(p.price, p.currency)}
                          {cyclePer(p.billing_cycle)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sub-start">Start date</Label>
                  <Input id="sub-start" type="date" max={todayYmd()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub-price">
                    {complimentary ? 'Regular price' : 'Price per cycle'} ({plan?.currency ?? 'INR'})
                  </Label>
                  <Input id="sub-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  {complimentary ? (
                    <p className="text-xs text-muted-foreground">
                      {compForever ? 'Shown as the value given free.' : 'Billed once the free cycles end.'}
                    </p>
                  ) : (
                    plan &&
                    Number(price) !== plan.price && (
                      <p className="text-xs text-muted-foreground">Custom price — plan list price is {formatMoney(plan.price, plan.currency)}</p>
                    )
                  )}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Auto-renew</span>
                  <span className="block text-xs text-muted-foreground">
                    Open the next cycle automatically. When off, the subscription is cancelled at period end unless the next
                    cycle is paid.
                  </span>
                </span>
                <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
              </label>

              <div
                className={
                  complimentary
                    ? 'space-y-3 rounded-lg border border-amber-300/70 bg-[linear-gradient(135deg,#fffbeb,#fef3c7)] p-3'
                    : 'space-y-3 rounded-lg border border-border p-3'
                }
              >
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#fde68a,#f59e0b)] text-amber-950">
                      <Gift className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">Complimentary</span>
                      <span className="block text-xs text-muted-foreground">Give this plan to the store free of charge.</span>
                    </span>
                  </span>
                  <Switch checked={complimentary} onCheckedChange={setComplimentary} />
                </label>
                {complimentary && (
                  <div className="space-y-3 pl-9">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant={compForever ? 'default' : 'outline'} onClick={() => setCompForever(true)}>
                        No end date
                      </Button>
                      <Button type="button" size="sm" variant={!compForever ? 'default' : 'outline'} onClick={() => setCompForever(false)}>
                        Limited
                      </Button>
                      {!compForever && (
                        <span className="flex items-center gap-2 text-sm">
                          <Input
                            type="number"
                            min={1}
                            className="h-9 w-20"
                            value={compCycles}
                            onChange={(e) => setCompCycles(e.target.value)}
                            aria-label="Free cycles"
                          />
                          free {plan?.billing_cycle === 'annual' ? 'year' : 'month'}
                          {Number(compCycles) === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <Input value={compReason} onChange={(e) => setCompReason(e.target.value)} placeholder="Reason (optional), e.g. Launch partner" />
                  </div>
                )}
              </div>

              {Number(price) > 0 && !complimentary && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Record payment for the first cycle</span>
                    <Switch checked={withPayment} onCheckedChange={setWithPayment} />
                  </label>
                  {withPayment && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="pay-amt">Amount</Label>
                        <Input id="pay-amt" type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pay-date">Payment date</Label>
                        <Input id="pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Method</Label>
                        <Select value={payMethod} onValueChange={(v) => setPayMethod(v as PaymentMethod)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pay-ref">Reference</Label>
                        <Input id="pay-ref" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / txn id" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sub-notes">Internal notes</Label>
                <Textarea id="sub-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => submit(false)} disabled={saving || activePlans.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  )
}
