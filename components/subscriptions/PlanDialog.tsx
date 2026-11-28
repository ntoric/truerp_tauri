'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notifyError, notifySuccess } from '@/lib/notify'
import { createPlan, updatePlan, type BillingCycle, type SubscriptionPlan } from '@/lib/subscriptions'

interface Form {
  name: string
  description: string
  billing_cycle: BillingCycle
  price: string
  currency: string
  features: string
  highlight: boolean
  is_active: boolean
  sort_order: string
}

const empty: Form = {
  name: '',
  description: '',
  billing_cycle: 'monthly',
  price: '',
  currency: 'INR',
  features: '',
  highlight: false,
  is_active: true,
  sort_order: '0',
}

export default function PlanDialog({
  open,
  plan,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  plan: SubscriptionPlan | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Form>(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      plan
        ? {
            name: plan.name,
            description: plan.description,
            billing_cycle: plan.billing_cycle,
            price: String(plan.price),
            currency: plan.currency || 'INR',
            features: plan.feature_list.join('\n'),
            highlight: plan.highlight,
            is_active: plan.is_active,
            sort_order: String(plan.sort_order ?? 0),
          }
        : empty
    )
  }, [open, plan])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const price = Number(form.price)
    if (!form.name.trim()) return notifyError('Plan name is required')
    if (form.price === '' || Number.isNaN(price) || price < 0) return notifyError('Enter a valid price')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        billing_cycle: form.billing_cycle,
        price,
        currency: form.currency.trim().toUpperCase() || 'INR',
        features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
        highlight: form.highlight,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      }
      if (plan) {
        await updatePlan(plan.id, payload)
        notifySuccess('Plan updated.')
      } else {
        await createPlan(payload)
        notifySuccess('Plan created.')
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit plan' : 'New subscription plan'}</DialogTitle>
          <DialogDescription>
            {plan
              ? 'Changes apply to new subscriptions. Stores already on this plan keep the price and features they were assigned.'
              : 'Plans can be assigned to any store from the Subscriptions tab.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan name *</Label>
            <Input id="plan-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Growth" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-desc">Description</Label>
            <Textarea
              id="plan-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="One line on who this plan is for"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Renewal type *</Label>
              <Select value={form.billing_cycle} onValueChange={(v) => set('billing_cycle', v as BillingCycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Price *</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-currency">Currency</Label>
              <Input id="plan-currency" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-features">Features included (optional)</Label>
            <Textarea
              id="plan-features"
              rows={6}
              value={form.features}
              onChange={(e) => set('features', e.target.value)}
              placeholder={'One feature per line, e.g.\nUnlimited invoices\nPOS terminal\nGST reports'}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-sort">Display order</Label>
              <Input id="plan-sort" type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            </div>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 sm:mt-6">
              <span className="text-sm">Recommended</span>
              <Switch checked={form.highlight} onCheckedChange={(v) => set('highlight', v)} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 sm:mt-6">
              <span className="text-sm">Active</span>
              <Switch checked={form.is_active} onCheckedChange={(v) => set('is_active', v)} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {plan ? 'Save changes' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
