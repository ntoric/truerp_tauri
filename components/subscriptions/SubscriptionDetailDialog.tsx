'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Loader2, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  PAYMENT_BADGE,
  PAYMENT_METHODS,
  SOURCE_LABEL,
  cancelSubscription,
  deletePayment,
  formatMoney,
  formatPlanDate,
  getSubscription,
  methodLabel,
  recordPayment,
  todayYmd,
  updateSubscription,
  type PaymentMethod,
  type StoreSubscription,
} from '@/lib/subscriptions'

export default function SubscriptionDetailDialog({
  subscriptionId,
  onOpenChange,
  onChanged,
}: {
  subscriptionId: string | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [sub, setSub] = useState<StoreSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    if (!subscriptionId) return
    try {
      setSub(await getSubscription(subscriptionId))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load subscription')
    }
  }, [subscriptionId])

  useEffect(() => {
    setSub(null)
    load()
  }, [load])

  const applyUpdate = (s: StoreSubscription) => {
    setSub(s)
    onChanged()
  }

  const toggleAutoRenew = async (v: boolean) => {
    if (!sub) return
    setBusy(true)
    try {
      applyUpdate(await updateSubscription(sub.id, { auto_renew: v }))
      notifySuccess(v ? 'Auto-renew turned on.' : 'Auto-renew turned off — the plan ends at period end unless paid ahead.')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  const removePayment = async (paymentId: string, amount: number) => {
    if (!sub) return
    const ok = await confirm({
      title: 'Delete payment?',
      description: `${formatMoney(amount, sub.currency)} will be removed and the cycle's payment status recalculated.`,
      variant: 'destructive',
    })
    if (!ok) return
    try {
      applyUpdate(await deletePayment(sub.id, paymentId))
      notifySuccess('Payment deleted.')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete payment')
    }
  }

  const active = sub?.status === 'active'

  return (
    <>
      <Dialog open={!!subscriptionId} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{sub ? sub.store_name : 'Subscription'}</DialogTitle>
            <DialogDescription>{sub ? `Store code ${sub.store_code}` : 'Loading…'}</DialogDescription>
          </DialogHeader>

          {!sub ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <SubscriptionCard sub={sub} compact />

              <div className="flex flex-wrap items-center gap-3">
                {active && (
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    Auto-renew
                    <Switch checked={sub.auto_renew} disabled={busy} onCheckedChange={toggleAutoRenew} />
                  </label>
                )}
                <Button size="sm" onClick={() => setPayOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> {active ? 'Record payment' : 'Reactivate with payment'}
                </Button>
                {active && (
                  <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
                    <Ban className="mr-1.5 h-4 w-4 text-rose-500" /> Cancel now
                  </Button>
                )}
                <div className="ml-auto text-right text-sm">
                  <div className="text-muted-foreground">Outstanding</div>
                  <div className={sub.amount_due > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>
                    {formatMoney(sub.amount_due, sub.currency)}
                  </div>
                </div>
              </div>

              {sub.notes && <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">{sub.notes}</p>}

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing cycles</h4>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Period</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-right font-medium">Paid</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sub.cycles ?? []).map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="px-3 py-2 tabular-nums">{c.cycle_number}</td>
                          <td className="px-3 py-2">
                            {formatPlanDate(c.period_start)} – {formatPlanDate(c.period_end)}
                            {active && c.cycle_number === sub.current_cycle && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Current</span>
                            )}
                            {active && c.cycle_number > sub.current_cycle && (
                              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700">Upcoming</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{SOURCE_LABEL[c.source] ?? c.source}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(c.amount, sub.currency)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(c.amount_paid, sub.currency)}</td>
                          <td className="px-3 py-2">
                            <Badge className={PAYMENT_BADGE[c.payment_status].className}>{PAYMENT_BADGE[c.payment_status].label}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</h4>
                {(sub.payments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Cycle</th>
                          <th className="px-3 py-2 font-medium">Method</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {sub.payments!.map((p) => (
                          <tr key={p.id} className="border-t border-border">
                            <td className="px-3 py-2">{formatPlanDate(p.payment_date)}</td>
                            <td className="px-3 py-2 tabular-nums">
                              #{sub.cycles?.find((c) => c.id === p.cycle_id)?.cycle_number ?? '—'}
                            </td>
                            <td className="px-3 py-2">{methodLabel(p.method)}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {p.reference || '—'}
                              {p.notes && <span className="block text-xs">{p.notes}</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(p.amount, sub.currency)}</td>
                            <td className="px-3 py-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => removePayment(p.id, p.amount)} aria-label="Delete payment">
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {sub && (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          sub={sub}
          onSaved={(s) => {
            applyUpdate(s)
            setPayOpen(false)
          }}
        />
      )}
      {sub && (
        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          sub={sub}
          onSaved={(s) => {
            applyUpdate(s)
            setCancelOpen(false)
          }}
        />
      )}
      {confirmDialog}
    </>
  )
}

// ---------------------------------------------------------------------------

type Target = { key: string; label: string; apply_to: 'cycle' | 'next' | 'reactivate'; cycle_id?: string; due: number }

function PaymentDialog({
  open,
  onOpenChange,
  sub,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sub: StoreSubscription
  onSaved: (s: StoreSubscription) => void
}) {
  const targets = useMemo<Target[]>(() => {
    const list: Target[] = []
    if (sub.status !== 'active') {
      list.push({ key: 'reactivate', label: `Reactivate from today (new ${sub.billing_cycle} cycle)`, apply_to: 'reactivate', due: sub.price })
      return list
    }
    const cycles = [...(sub.cycles ?? [])].sort((a, b) => a.cycle_number - b.cycle_number)
    for (const c of cycles) {
      if (c.payment_status === 'paid') continue
      list.push({
        key: c.id,
        label: `Cycle #${c.cycle_number} · ${formatPlanDate(c.period_start)} – ${formatPlanDate(c.period_end)} · due ${formatMoney(c.amount - c.amount_paid, sub.currency)}`,
        apply_to: 'cycle',
        cycle_id: c.id,
        due: Math.round((c.amount - c.amount_paid) * 100) / 100,
      })
    }
    if (!cycles.some((c) => c.cycle_number === sub.current_cycle + 1)) {
      list.push({
        key: 'next',
        label: `Next cycle — renew in advance from ${formatPlanDate(sub.current_period_end)}`,
        apply_to: 'next',
        due: sub.price,
      })
    }
    return list
  }, [sub])

  const [targetKey, setTargetKey] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayYmd())
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const first = targets[0]
    setTargetKey(first?.key ?? '')
    setAmount(first ? String(first.due) : '')
    setDate(todayYmd())
    setMethod('bank_transfer')
    setReference('')
    setNotes('')
  }, [open, targets])

  const chooseTarget = (key: string) => {
    setTargetKey(key)
    const t = targets.find((x) => x.key === key)
    if (t) setAmount(String(t.due))
  }

  const save = async () => {
    const t = targets.find((x) => x.key === targetKey)
    const amt = Number(amount)
    if (!t) return notifyError('Choose what this payment is for')
    if (!amt || amt <= 0) return notifyError('Enter a valid amount')
    setSaving(true)
    try {
      const res = await recordPayment(sub.id, {
        apply_to: t.apply_to,
        cycle_id: t.cycle_id,
        amount: amt,
        payment_date: date,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      })
      notifySuccess(t.apply_to === 'reactivate' ? 'Subscription reactivated.' : 'Payment recorded.')
      onSaved(res.subscription)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{sub.status === 'active' ? 'Record payment' : 'Reactivate subscription'}</DialogTitle>
          <DialogDescription>
            Paying the next cycle in advance renews the plan at period end even when auto-renew is off.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Apply to</Label>
            <Select value={targetKey} onValueChange={chooseTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Select a cycle" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-amount">Amount ({sub.currency})</Label>
              <Input id="p-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-date">Payment date</Label>
              <Input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
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
              <Label htmlFor="p-ref">Reference</Label>
              <Input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / txn id" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || targets.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({
  open,
  onOpenChange,
  sub,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sub: StoreSubscription
  onSaved: (s: StoreSubscription) => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const save = async () => {
    setSaving(true)
    try {
      onSaved(await cancelSubscription(sub.id, reason.trim()))
      notifySuccess('Subscription cancelled.')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel subscription now?</DialogTitle>
          <DialogDescription>
            {sub.store_name}&apos;s {sub.plan_name} plan ends immediately. To let it run until{' '}
            {formatPlanDate(sub.current_period_end)} instead, turn off auto-renew.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason (shown to the store)</Label>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Keep subscription
          </Button>
          <Button variant="destructive" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
