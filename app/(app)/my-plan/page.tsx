'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Crown, History, Headset, Receipt, Sparkles, Wallet } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard'
import { notifyError } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  ApiError,
  PAYMENT_BADGE,
  SOURCE_LABEL,
  cycleLabel,
  formatMoney,
  formatPlanDate,
  getMyPlan,
  getMyPlanHistory,
  methodLabel,
  type StoreSubscription,
} from '@/lib/subscriptions'

type Tab = 'overview' | 'history'

export default function MyPlanPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [plan, setPlan] = useState<StoreSubscription | null>(null)
  const [history, setHistory] = useState<StoreSubscription[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sync = () => setTab(window.location.hash === '#history' ? 'history' : 'overview')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    getMyPlan()
      .then((r) => setPlan(r.subscription))
      .catch((e) => {
        // 403 = page disabled in Pages & Menus; the layout shows its own notice.
        if (!(e instanceof ApiError && e.status === 403)) notifyError(e.message || 'Failed to load your plan')
      })
      .finally(() => setLoading(false))
  }, [])

  const loadHistory = useCallback(() => {
    getMyPlanHistory()
      .then(setHistory)
      .catch((e) => {
        setHistory([])
        if (!(e instanceof ApiError && e.status === 403)) notifyError(e.message || 'Failed to load history')
      })
  }, [])

  useEffect(() => {
    if (tab === 'history' && history === null) loadHistory()
  }, [tab, history, loadHistory])

  const changeTab = (v: string) => {
    setTab(v as Tab)
    window.history.replaceState(null, '', v === 'history' ? '#history' : window.location.pathname)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader title="My Plan" />

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList variant="line">
            <TabsTrigger value="overview">
              <Crown /> Overview
            </TabsTrigger>
            <TabsTrigger value="history">
              <History /> Subscription history
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            {plan ? <PlanOverview sub={plan} /> : <NoPlan />}
          </TabsContent>

          <TabsContent value="history" className="mt-5">
            {history === null ? <FormPageSkeleton /> : <HistoryList items={history} />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

// ---------------------------------------------------------------------------

function PlanOverview({ sub }: { sub: StoreSubscription }) {
  const active = sub.status === 'active'
  const current = sub.cycles?.find((c) => c.cycle_number === sub.current_cycle)
  const elapsed = sub.total_days > 0 ? Math.min(100, Math.max(0, ((sub.total_days - sub.remaining_days) / sub.total_days) * 100)) : 0

  return (
    <div className="space-y-5">
      <SubscriptionCard sub={sub} />

      {!active && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              This subscription is no longer active. Contact support to renew or choose a new plan.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/support">
                <Headset className="mr-1.5 h-4 w-4" /> Contact support
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Wallet className="h-5 w-5" />}
          label="Amount due"
          value={formatMoney(sub.amount_due, sub.currency)}
          tone={sub.amount_due > 0 ? 'rose' : 'emerald'}
          hint={sub.amount_due > 0 ? 'Outstanding for started cycles' : 'You are all settled'}
        />
        <StatTile
          icon={<Receipt className="h-5 w-5" />}
          label="Total paid"
          value={formatMoney(sub.total_paid, sub.currency)}
          tone="violet"
          hint={`Across ${sub.cycles?.length ?? 0} billing cycle${(sub.cycles?.length ?? 0) === 1 ? '' : 's'}`}
        />
        <StatTile
          icon={<Sparkles className="h-5 w-5" />}
          label="Member since"
          value={formatPlanDate(sub.cycles?.[sub.cycles.length - 1]?.period_start ?? sub.anchor_date)}
          tone="amber"
          hint={`${cycleLabel(sub.billing_cycle)} billing · cycle #${sub.current_cycle}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="border-b border-border bg-[linear-gradient(90deg,hsl(var(--theme-50)/0.8),transparent)] px-5 py-4">
            <h3 className="font-semibold text-heading">What&apos;s included</h3>
            <p className="text-xs text-muted-foreground">Everything that comes with {sub.plan_name}</p>
          </div>
          <CardContent className="p-5">
            {sub.feature_list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No features are listed for this plan.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {sub.feature_list.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#fde68a,#f59e0b)] text-amber-950 shadow-[0_4px_10px_-4px_rgba(245,158,11,0.7)]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-heading">Current billing period</h3>
              {current && (
                <Badge className={PAYMENT_BADGE[current.payment_status].className}>
                  {PAYMENT_BADGE[current.payment_status].label}
                </Badge>
              )}
            </div>
            {active ? (
              <>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{formatPlanDate(sub.current_period_start)}</span>
                    <span>{formatPlanDate(sub.current_period_end)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#6366f1,#a855f7,#f59e0b)] transition-[width] duration-1000"
                      style={{ width: `${elapsed}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {sub.remaining_days} of {sub.total_days} days remaining
                  </p>
                </div>
                {current && (
                  <dl className="space-y-2 text-sm">
                    <Row label="Cycle amount" value={formatMoney(current.amount, sub.currency)} />
                    <Row label="Paid" value={formatMoney(current.amount_paid, sub.currency)} />
                  </dl>
                )}
                <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted-foreground">
                  {sub.next_cycle_paid
                    ? `The next cycle is already paid — your plan continues on ${formatPlanDate(sub.current_period_end)}.`
                    : sub.auto_renew
                      ? `Your plan renews automatically on ${formatPlanDate(sub.current_period_end)}.`
                      : `Auto-renew is off. Your plan ends on ${formatPlanDate(sub.current_period_end)} unless it is renewed.`}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active billing period.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-heading">{value}</dd>
    </div>
  )
}

const TONES = {
  rose: 'from-rose-500/15 text-rose-600',
  emerald: 'from-emerald-500/15 text-emerald-600',
  violet: 'from-violet-500/15 text-violet-600',
  amber: 'from-amber-500/20 text-amber-600',
}

function StatTile({
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
  tone: keyof typeof TONES
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60', TONES[tone])} />
      <CardContent className="relative flex items-start gap-3 p-5">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br to-white shadow-gr-xs ring-1 ring-black/5', TONES[tone])}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-0.5 truncate text-xl font-bold tabular-nums text-heading">{value}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function NoPlan() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-[radial-gradient(120%_100%_at_50%_0%,hsl(var(--theme-50))_0%,transparent_70%)] px-6 py-16 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1e1b4b,#3b0764)] text-amber-300 shadow-[0_15px_30px_-12px_rgba(59,7,100,0.6)]">
        <Crown className="h-8 w-8" />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-heading">No active plan yet</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Your store isn&apos;t on a subscription plan. Reach out to our team to pick the plan that fits your business.
      </p>
      <Button asChild className="mt-6">
        <Link href="/support">
          <Headset className="mr-1.5 h-4 w-4" /> Contact support
        </Link>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------

function HistoryList({ items }: { items: StoreSubscription[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No subscriptions yet — your plan history will appear here.
        </CardContent>
      </Card>
    )
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {items.map((s, i) => (
        <HistoryItem key={s.id} sub={s} defaultOpen={i === 0} />
      ))}
    </ol>
  )
}

function HistoryItem({ sub, defaultOpen }: { sub: StoreSubscription; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const active = sub.status === 'active'
  const first = sub.cycles?.[sub.cycles.length - 1]
  const endLabel = active ? formatPlanDate(sub.current_period_end) : sub.cancelled_at ? new Date(sub.cancelled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[33px] top-5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background',
          active ? 'bg-[linear-gradient(135deg,#fde68a,#f59e0b)]' : 'bg-slate-300'
        )}
      />
      <Card className={cn('overflow-hidden', active && 'border-amber-200/70 shadow-[0_10px_30px_-18px_rgba(245,158,11,0.6)]')}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full flex-col gap-2 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-heading">{sub.plan_name}</span>
              <Badge variant="outline">{cycleLabel(sub.billing_cycle)}</Badge>
              <Badge className={active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                {active ? 'Active' : 'Cancelled'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPlanDate(first?.period_start ?? sub.anchor_date)} → {endLabel} ·{' '}
              {formatMoney(sub.price, sub.currency)}
              {sub.billing_cycle === 'annual' ? '/yr' : '/mo'} · {sub.cycles?.length ?? 0} cycle
              {(sub.cycles?.length ?? 0) === 1 ? '' : 's'} · paid {formatMoney(sub.total_paid, sub.currency)}
            </p>
            {!active && sub.cancellation_reason && (
              <p className="text-xs text-muted-foreground">Reason: {sub.cancellation_reason}</p>
            )}
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="space-y-4 border-t border-border bg-surface-2/40 p-5">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing cycles</h4>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[560px] text-sm">
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
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</h4>
              {(sub.payments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 font-medium">Reference</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sub.payments!.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2">{formatPlanDate(p.payment_date)}</td>
                          <td className="px-3 py-2">{methodLabel(p.method)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.reference || '—'}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(p.amount, sub.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </li>
  )
}
