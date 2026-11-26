'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, Check, Crown, IndianRupee, Layers, Pencil, Plus, Store, Trash2, TrendingUp, Wallet } from 'lucide-react'
import { useAuth, apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PremiumEmpty from '@/components/ui/premium-empty'
import PlanDialog from '@/components/subscriptions/PlanDialog'
import AssignSubscriptionDialog, { type StoreOption } from '@/components/subscriptions/AssignSubscriptionDialog'
import SubscriptionDetailDialog from '@/components/subscriptions/SubscriptionDetailDialog'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { isSuperAdmin } from '@/lib/roles'
import { notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  PAYMENT_BADGE,
  cycleLabel,
  cyclePer,
  deletePlan,
  formatMoney,
  formatPlanDate,
  getSubscriptionOverview,
  listPlans,
  listSubscriptions,
  updatePlan,
  type StoreSubscription,
  type SubscriptionOverview,
  type SubscriptionPlan,
} from '@/lib/subscriptions'

export default function SubscriptionsAdminPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = isSuperAdmin(user?.role)
  const { confirm, confirmDialog } = useConfirmDialog()

  const [tab, setTab] = useState<'subscriptions' | 'plans'>('subscriptions')
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subs, setSubs] = useState<StoreSubscription[]>([])
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('active')
  const [storeFilter, setStoreFilter] = useState('all')

  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: SubscriptionPlan | null }>({ open: false, plan: null })
  const [assignOpen, setAssignOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [ov, pl, sb, st] = await Promise.all([
        getSubscriptionOverview(),
        listPlans(),
        listSubscriptions(),
        apiFetch('/stores').then((r) => (r.ok ? r.json() : [])),
      ])
      setOverview(ov)
      setPlans(pl)
      setSubs(sb)
      setStores(st as StoreOption[])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isAdmin) loadAll()
    if (!authLoading && !isAdmin) setLoading(false)
  }, [authLoading, isAdmin, loadAll])

  const filtered = useMemo(
    () =>
      subs.filter(
        (s) => (statusFilter === 'all' || s.status === statusFilter) && (storeFilter === 'all' || s.store_id === storeFilter)
      ),
    [subs, statusFilter, storeFilter]
  )

  const togglePlanActive = async (p: SubscriptionPlan) => {
    try {
      await updatePlan(p.id, {
        name: p.name,
        description: p.description,
        billing_cycle: p.billing_cycle,
        price: p.price,
        currency: p.currency,
        features: p.feature_list,
        highlight: p.highlight,
        is_active: !p.is_active,
        sort_order: p.sort_order,
      })
      await loadAll()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update plan')
    }
  }

  const removePlan = async (p: SubscriptionPlan) => {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      description: 'Past subscriptions keep their history. Plans with active stores cannot be deleted — deactivate them instead.',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      await deletePlan(p.id)
      notifySuccess('Plan deleted.')
      await loadAll()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete plan')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only super admins can manage subscriptions.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          title="Subscriptions"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPlanDialog({ open: true, plan: null })}>
                <Layers className="mr-2 h-4 w-4" /> New plan
              </Button>
              <Button onClick={() => setAssignOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Assign subscription
              </Button>
            </div>
          }
        />

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<TrendingUp />} label="Monthly recurring" value={formatMoney(overview.mrr)} hint="Annual plans counted /12" tone="violet" />
            <Stat
              icon={<Crown />}
              label="Active subscriptions"
              value={String(overview.active_subscriptions)}
              hint={`${overview.stores_without_plan} of ${overview.stores} stores without a plan`}
              tone="amber"
            />
            <Stat
              icon={<AlertCircle />}
              label="Outstanding"
              value={formatMoney(overview.outstanding)}
              hint="Unpaid amounts on started cycles"
              tone={overview.outstanding > 0 ? 'rose' : 'emerald'}
            />
            <Stat
              icon={<Wallet />}
              label="Collected this month"
              value={formatMoney(overview.collected_this_month)}
              hint={`${overview.renewing_in_7_days} renewing in 7 days · ${overview.auto_renew_off} auto-renew off`}
              tone="emerald"
            />
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList variant="line">
            <TabsTrigger value="subscriptions">
              <Store /> Store subscriptions
            </TabsTrigger>
            <TabsTrigger value="plans">
              <Layers /> Plans ({plans.length})
            </TabsTrigger>
          </TabsList>

          {/* ---------------- Subscriptions ---------------- */}
          <TabsContent value="subscriptions" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                </SelectContent>
              </Select>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-4">
                  <PremiumEmpty
                    icon={Crown}
                    tone="amber"
                    title={subs.length === 0 ? 'No subscriptions yet' : 'Nothing matches these filters'}
                    hint={subs.length === 0 ? 'Assign a plan to a store to start tracking renewals and payments.' : 'Try another status or store.'}
                    action={
                      subs.length === 0 ? (
                        <Button size="sm" onClick={() => setAssignOpen(true)}>
                          <Plus className="mr-1.5 h-4 w-4" /> Assign subscription
                        </Button>
                      ) : undefined
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Store</th>
                        <th className="px-4 py-3 font-medium">Plan</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Renewal</th>
                        <th className="px-4 py-3 font-medium">Remaining</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 text-right font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const active = s.status === 'active'
                        const pay = s.current_payment_status || 'unpaid'
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setDetailId(s.id)}
                            className="cursor-pointer border-t border-border transition-colors hover:bg-surface-2/60"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-heading">{s.store_name}</div>
                              <div className="text-xs text-muted-foreground">{s.store_code}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{s.plan_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatMoney(s.price, s.currency)}
                                {cyclePer(s.billing_cycle)} · cycle #{s.current_cycle}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                                {active ? 'Active' : 'Cancelled'}
                              </Badge>
                              {active && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {s.next_cycle_paid ? 'Next cycle paid' : s.auto_renew ? 'Auto-renew on' : 'Ends at period end'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {active ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatPlanDate(s.current_period_end)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {active ? (
                                <RemainingBar remaining={s.remaining_days} total={s.total_days} />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {active ? (
                                <Badge className={PAYMENT_BADGE[pay].className}>{PAYMENT_BADGE[pay].label}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td
                              className={cn(
                                'px-4 py-3 text-right font-medium tabular-nums',
                                s.amount_due > 0 ? 'text-rose-600' : 'text-muted-foreground'
                              )}
                            >
                              {formatMoney(s.amount_due, s.currency)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------------- Plans ---------------- */}
          <TabsContent value="plans" className="mt-4">
            {plans.length === 0 ? (
              <Card>
                <CardContent className="p-4">
                  <PremiumEmpty
                    icon={Layers}
                    tone="violet"
                    title="No plans yet"
                    hint="Create monthly or annual plans with a price and the features they include."
                    action={
                      <Button size="sm" onClick={() => setPlanDialog({ open: true, plan: null })}>
                        <Plus className="mr-1.5 h-4 w-4" /> New plan
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((p) => (
                  <PlanTile
                    key={p.id}
                    plan={p}
                    onEdit={() => setPlanDialog({ open: true, plan: p })}
                    onDelete={() => removePlan(p)}
                    onToggle={() => togglePlanActive(p)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PlanDialog
        open={planDialog.open}
        plan={planDialog.plan}
        onOpenChange={(open) => setPlanDialog((d) => ({ ...d, open }))}
        onSaved={loadAll}
      />
      <AssignSubscriptionDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        plans={plans}
        stores={stores}
        defaultStoreId={storeFilter !== 'all' ? storeFilter : undefined}
        onSaved={(id) => {
          loadAll()
          setDetailId(id)
        }}
      />
      <SubscriptionDetailDialog
        subscriptionId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onChanged={loadAll}
      />
      {confirmDialog}
    </DashboardLayout>
  )
}

// ---------------------------------------------------------------------------

const STAT_TONES = {
  violet: 'from-violet-500/15 text-violet-600',
  amber: 'from-amber-500/20 text-amber-600',
  rose: 'from-rose-500/15 text-rose-600',
  emerald: 'from-emerald-500/15 text-emerald-600',
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: keyof typeof STAT_TONES
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60', STAT_TONES[tone])} />
      <CardContent className="relative p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={cn('[&_svg]:h-4 [&_svg]:w-4', STAT_TONES[tone])}>{icon}</span>
          {label}
        </div>
        <div className="mt-1.5 truncate text-2xl font-bold tabular-nums text-heading">{value}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  )
}

function RemainingBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0
  const tone = remaining <= 3 ? 'bg-rose-500' : remaining <= 7 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="w-28">
      <div className="text-xs font-medium tabular-nums">
        {remaining} day{remaining === 1 ? '' : 's'}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PlanTile({
  plan,
  onEdit,
  onDelete,
  onToggle,
}: {
  plan: SubscriptionPlan
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const featured = plan.highlight
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-3xl border p-6 transition-shadow',
        featured
          ? 'border-transparent bg-[linear-gradient(160deg,#0b0a1f_0%,#1e1b4b_55%,#3b0764_100%)] text-white shadow-[0_25px_50px_-20px_rgba(59,7,100,0.6)]'
          : 'border-border bg-card shadow-gr-xs hover:shadow-gr-md',
        !plan.is_active && 'opacity-60'
      )}
    >
      {featured && <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/25 blur-3xl" />}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn('text-lg font-bold', featured ? 'text-white' : 'text-heading')}>{plan.name}</h3>
            {featured && (
              <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200 ring-1 ring-amber-200/30">
                Recommended
              </span>
            )}
            {!plan.is_active && <Badge className="bg-slate-200 text-slate-700">Inactive</Badge>}
          </div>
          <p className={cn('mt-1 text-sm', featured ? 'text-white/65' : 'text-muted-foreground')}>
            {plan.description || `${cycleLabel(plan.billing_cycle)} plan`}
          </p>
        </div>
        <Switch checked={plan.is_active} onCheckedChange={onToggle} aria-label="Active" />
      </div>

      <div className="relative mt-5 flex items-baseline gap-1">
        {plan.currency === 'INR' && <IndianRupee className={cn('h-5 w-5 self-center', featured ? 'text-amber-200' : 'text-heading')} />}
        <span className={cn('text-4xl font-bold tabular-nums tracking-tight', featured ? 'text-white' : 'text-heading')}>
          {plan.currency === 'INR'
            ? plan.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            : formatMoney(plan.price, plan.currency)}
        </span>
        <span className={cn('text-sm', featured ? 'text-white/55' : 'text-muted-foreground')}>{cyclePer(plan.billing_cycle)}</span>
      </div>

      <ul className="relative mt-5 flex-1 space-y-2.5">
        {plan.feature_list.length === 0 ? (
          <li className={cn('text-sm italic', featured ? 'text-white/50' : 'text-muted-foreground')}>No features listed</li>
        ) : (
          plan.feature_list.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                  featured ? 'bg-amber-300 text-amber-950' : 'bg-emerald-100 text-emerald-700'
                )}
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span className={featured ? 'text-white/90' : ''}>{f}</span>
            </li>
          ))
        )}
      </ul>

      <div
        className={cn(
          'relative mt-6 flex items-center justify-between border-t pt-4',
          featured ? 'border-white/10' : 'border-border'
        )}
      >
        <span className={cn('text-xs', featured ? 'text-white/60' : 'text-muted-foreground')}>
          {plan.active_subscriptions} active store{plan.active_subscriptions === 1 ? '' : 's'}
        </span>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className={featured ? 'border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white' : ''}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            aria-label="Delete plan"
            className={featured ? 'border-white/20 bg-white/10 hover:bg-white/20' : ''}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
          </Button>
        </div>
      </div>
    </div>
  )
}
