'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { isSuperAdmin } from '@/lib/roles'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  addMonths,
  adminApproveSubscriptionRequest,
  adminCancelSubscription,
  adminCreateSubscription,
  adminCreateSubscriptionPackage,
  adminDeleteSubscriptionPackage,
  adminListSubscriptionHistory,
  adminListSubscriptionRequests,
  adminListSubscriptions,
  adminRejectSubscriptionRequest,
  adminRenewSubscription,
  adminUpdateSubscription,
  adminUpdateSubscriptionPackage,
  createSubscriptionRequest,
  frequencyLabel,
  getCurrentSubscription,
  getSubscriptionHistory,
  listMySubscriptionRequests,
  listSubscriptionPackages,
  subscriptionEventLabel,
  subscriptionRequestTypeLabel,
  withdrawSubscriptionRequest,
  SUBSCRIPTION_FREQUENCIES,
  type StoreSubscription,
  type SubscriptionFrequency,
  type SubscriptionHistoryEvent,
  type SubscriptionPackage,
  type SubscriptionRequest,
} from '@/lib/subscriptions'
import {
  ArrowUpCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  EyeOff,
  History as HistoryIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'

const STATUS_TONE: Record<string, 'success' | 'brand' | 'danger' | 'neutral'> = {
  active: 'success',
  scheduled: 'brand',
  expired: 'danger',
  cancelled: 'neutral',
}

const EVENT_TONE: Record<string, 'success' | 'brand' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  created: 'success',
  renewed: 'brand',
  upgraded: 'success',
  downgraded: 'warning',
  changed: 'info',
  updated: 'info',
  cancelled: 'danger',
  superseded: 'neutral',
  reactivated: 'success',
  cancel_requested: 'warning',
  upgrade_requested: 'brand',
  downgrade_requested: 'brand',
  change_requested: 'brand',
  request_rejected: 'danger',
}

const REQUEST_STATUS_TONE: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
}

function todayInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function monthsForFrequency(frequency: SubscriptionFrequency, custom: number): number {
  if (frequency === 'custom') return Math.max(1, custom || 1)
  return SUBSCRIPTION_FREQUENCIES.find((f) => f.value === frequency)?.months || 1
}

/** Shared history table used by both the store view and the super admin view. */
function SubscriptionHistoryTable({
  events,
  showStore,
  showPrice,
  emptyText,
}: {
  events: SubscriptionHistoryEvent[]
  showStore?: boolean
  showPrice?: boolean
  emptyText: string
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showStore && <TableHead>Store</TableHead>}
            <TableHead>Event</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Period</TableHead>
            {showPrice && <TableHead className="text-right">Price</TableHead>}
            <TableHead>By</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
              {showStore && (
                <TableCell className="whitespace-nowrap">
                  {e.store?.name || '—'}
                  {e.store?.code ? <span className="ml-1 text-xs text-muted-foreground">({e.store.code})</span> : null}
                </TableCell>
              )}
              <TableCell>
                <StatusBadge tone={EVENT_TONE[e.event_type] || 'neutral'}>
                  {subscriptionEventLabel(e.event_type)}
                </StatusBadge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {e.from_package && e.to_package && e.from_package !== e.to_package
                  ? `${e.from_package} → ${e.to_package}`
                  : e.to_package || e.from_package || '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {e.start_date ? formatDate(e.start_date) : '—'}
                {e.end_date ? ` → ${formatDate(e.end_date)}` : ''}
              </TableCell>
              {showPrice && (
                <TableCell className="text-right whitespace-nowrap">
                  {e.price ? formatCurrency(e.price) : '—'}
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap text-xs">{e.actor_name || '—'}</TableCell>
              <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">{e.notes || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function PackageCard({ pkg, highlight }: { pkg: SubscriptionPackage; highlight?: boolean }) {
  const priceHidden = !pkg.show_price || pkg.price == null
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-1',
        highlight
          ? 'border-emerald-400/70 shadow-[0_16px_40px_-16px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/50'
          : 'border-slate-200/80 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.1)] hover:shadow-[0_20px_45px_-18px_rgba(15,23,42,0.28)]'
      )}
    >
      {/* Gradient header with decorative orbs */}
      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-5 pt-5 text-white',
          priceHidden ? 'pb-5' : 'pb-14'
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-indigo-500/25 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30">
              <Crown className="h-5 w-5 text-white" />
            </span>
            <div>
              <h3 className="text-base font-semibold leading-tight">{pkg.name}</h3>
              {pkg.description && (
                <p className="mt-0.5 text-xs text-slate-300/90">{pkg.description}</p>
              )}
            </div>
          </div>
          {highlight && (
            <span className="shrink-0 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/40">
              Current
            </span>
          )}
        </div>
      </div>

      {/* Floating price panel overlapping the header (hidden when the package hides its price) */}
      {!priceHidden && (
        <div className="relative -mt-9 px-5">
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-[0_10px_25px_-10px_rgba(15,23,42,0.25)]">
            <div className="flex items-baseline gap-1.5">
              <span className="bg-gradient-to-r from-slate-900 to-indigo-700 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                {formatCurrency(pkg.price!)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">/ billing period</span>
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <div className="flex-1 px-5 pb-5 pt-4">
        {pkg.show_features && pkg.features.length > 0 ? (
          <ul className="space-y-2.5">
            {pkg.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                <span className="leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Feature details shared on request
          </p>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className={cn(
          'h-1 w-full bg-gradient-to-r',
          highlight
            ? 'from-emerald-400 via-teal-400 to-emerald-500'
            : 'from-slate-200 via-indigo-200 to-slate-200 opacity-60 transition-opacity group-hover:opacity-100'
        )}
      />
    </div>
  )
}

// ------------------------------ Store view ------------------------------

function StoreSubscriptionView() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [current, setCurrent] = useState<StoreSubscription | null>(null)
  const [packages, setPackages] = useState<SubscriptionPackage[]>([])
  const [history, setHistory] = useState<SubscriptionHistoryEvent[]>([])
  const [requests, setRequests] = useState<SubscriptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [requestDialog, setRequestDialog] = useState<'change' | 'cancel' | null>(null)
  const [requestTarget, setRequestTarget] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [currentRes, pkgRes, historyRes, reqRes] = await Promise.all([
        getCurrentSubscription(),
        listSubscriptionPackages(),
        getSubscriptionHistory(),
        listMySubscriptionRequests(),
      ])
      setCurrent(currentRes.subscription)
      setPackages(pkgRes || [])
      setHistory(historyRes || [])
      setRequests(reqRes || [])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pendingRequest = requests.find((r) => r.status === 'pending')

  const openRequestDialog = (kind: 'change' | 'cancel') => {
    setRequestTarget('')
    setRequestReason('')
    setRequestDialog(kind)
  }

  const submitRequest = async () => {
    if (requestDialog === 'change' && !requestTarget) {
      notifyError('Select a plan to switch to')
      return
    }
    setRequestBusy(true)
    try {
      await createSubscriptionRequest({
        request_type: requestDialog === 'cancel' ? 'cancel' : 'change',
        target_package_id: requestDialog === 'cancel' ? undefined : requestTarget,
        reason: requestReason.trim(),
      })
      notifySuccess('Request submitted for review')
      setRequestDialog(null)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setRequestBusy(false)
    }
  }

  const withdrawRequest = async (req: SubscriptionRequest) => {
    if (
      !(await confirm({
        title: 'Withdraw this request?',
        description: `Your ${subscriptionRequestTypeLabel(req.request_type).toLowerCase()} request will be cancelled.`,
      }))
    )
      return
    try {
      await withdrawSubscriptionRequest(req.id)
      notifySuccess('Request withdrawn')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to withdraw request')
    }
  }

  const effectiveStatus = current?.effective_status
  const periodProgress = (() => {
    if (!current) return 0
    const start = new Date(current.start_date).getTime()
    const end = new Date(current.end_date).getTime()
    if (end <= start) return 0
    // Remaining time — the bar shrinks as the period runs out.
    return Math.min(100, Math.max(0, ((end - Date.now()) / (end - start)) * 100))
  })()

  if (loading) return <FormPageSkeleton />

  const canRequest = current && effectiveStatus !== 'cancelled'
  const changeTargets = packages.filter((p) => p.id !== current?.package_id)

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Plan"
        actions={
          canRequest && !pendingRequest ? (
            <div className="flex flex-wrap gap-2">
              {changeTargets.length > 0 && (
                <Button variant="outline" onClick={() => openRequestDialog('change')}>
                  <ArrowUpCircle className="mr-2 h-4 w-4" /> Request plan change
                </Button>
              )}
              <Button variant="outline" onClick={() => openRequestDialog('cancel')}>
                <Ban className="mr-2 h-4 w-4 text-rose-500" /> Request cancellation
              </Button>
            </div>
          ) : undefined
        }
      />
      {pendingRequest && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <span className="font-medium">
                  {subscriptionRequestTypeLabel(pendingRequest.request_type)} request pending review
                </span>
                {pendingRequest.request_type !== 'cancel' && pendingRequest.target_package_name && (
                  <span className="text-muted-foreground">
                    {' '}
                    — {pendingRequest.current_package_name} → {pendingRequest.target_package_name}
                  </span>
                )}
                <div className="text-xs text-muted-foreground">
                  Submitted {formatDateTime(pendingRequest.created_at)}
                  {pendingRequest.reason ? ` · "${pendingRequest.reason}"` : ''}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => withdrawRequest(pendingRequest)}>
              Withdraw
            </Button>
          </CardContent>
        </Card>
      )}
      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">My Plan</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {pendingRequest && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                1
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="mr-1.5 h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4 pt-2">
          {current ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <CardTitle>{current.package_name || 'Subscription'}</CardTitle>
                    <StatusBadge tone={STATUS_TONE[effectiveStatus || ''] || 'neutral'}>
                      {effectiveStatus}
                    </StatusBadge>
                  </div>
                  {current.auto_renew && <Badge variant="outline">Auto-renew on</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start date</div>
                    <div className="mt-1 text-sm font-medium">{formatDate(current.start_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry date</div>
                    <div className="mt-1 text-sm font-medium">{formatDate(current.end_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next renewal</div>
                    <div className="mt-1 text-sm font-medium">
                      {effectiveStatus === 'cancelled' ? '—' : formatDate(current.end_date)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing cycle</div>
                    <div className="mt-1 text-sm font-medium">
                      {frequencyLabel(current.frequency, current.period_months)}
                    </div>
                  </div>
                  {current.package?.is_complimentary ? (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Price / period
                      </div>
                      <div className="mt-1 text-sm font-medium text-emerald-600">Free — complimentary</div>
                    </div>
                  ) : (
                    current.price !== undefined && current.price !== null && (
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Price / period
                        </div>
                        <div className="mt-1 text-sm font-medium">{formatCurrency(current.price)}</div>
                      </div>
                    )
                  )}
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Days remaining
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {effectiveStatus === 'cancelled'
                        ? '—'
                        : effectiveStatus === 'expired'
                          ? 'Expired'
                          : effectiveStatus === 'scheduled'
                            ? `Starts ${formatDate(current.start_date)}`
                            : `${Math.max(0, current.days_remaining)} days`}
                    </div>
                  </div>
                </div>

                {effectiveStatus !== 'scheduled' && effectiveStatus !== 'cancelled' && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${effectiveStatus === 'expired' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${periodProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{formatDate(current.start_date)}</span>
                      <span>{formatDate(current.end_date)}</span>
                    </div>
                  </div>
                )}

                {current.notes && <p className="text-sm text-muted-foreground">{current.notes}</p>}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/50" />
                <div className="text-sm font-medium">No subscription yet</div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Your store does not have an active subscription. Choose a plan below or contact your
                  administrator.
                </p>
              </CardContent>
            </Card>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Available plans</h3>
            {packages.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No plans are published yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} highlight={current?.package_id === pkg.id} />
                ))}
              </div>
            )}
          </div>

        </TabsContent>

        <TabsContent value="requests" className="pt-2">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No requests yet. Use the actions above to request a plan change or cancellation.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.slice(0, 25).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subscriptionRequestTypeLabel(r.request_type)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.request_type !== 'cancel' && r.target_package_name
                          ? `${r.current_package_name || '—'} → ${r.target_package_name}`
                          : r.current_package_name || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={REQUEST_STATUS_TONE[r.status] || 'neutral'}>
                          {r.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {r.resolution_notes
                          ? `${r.resolved_by_name ? `${r.resolved_by_name}: ` : ''}${r.resolution_notes}`
                          : r.status === 'pending'
                            ? 'Awaiting review'
                            : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-2">
          <SubscriptionHistoryTable
            events={history}
            emptyText="No subscription history yet."
          />
        </TabsContent>
      </Tabs>

      {/* ------------------ Plan change request dialog ------------------ */}
      <Dialog open={requestDialog === 'change'} onOpenChange={(o) => !o && setRequestDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request plan change</DialogTitle>
            <DialogDescription>
              Choose the plan you want to move to. An upgrade or downgrade is applied once a super
              admin approves your request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New plan</Label>
              <Select value={requestTarget} onValueChange={setRequestTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {changeTargets.map((p) => {
                    const direction =
                      current && p.price != null && current.price != null
                        ? p.price > current.price
                          ? 'upgrade'
                          : p.price < current.price
                            ? 'downgrade'
                            : 'change'
                        : null
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.price != null ? ` — ${formatCurrency(p.price)}` : ''}
                        {direction ? ` (${direction})` : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-reason-change">Reason (optional)</Label>
              <Textarea
                id="req-reason-change"
                rows={3}
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Tell the admin why you want to switch plans"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={requestBusy}>
              {requestBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------ Cancellation request dialog ------------------ */}
      <Dialog open={requestDialog === 'cancel'} onOpenChange={(o) => !o && setRequestDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request cancellation</DialogTitle>
            <DialogDescription>
              Your subscription stays active until a super admin reviews and approves the
              cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="req-reason-cancel">Reason (optional)</Label>
            <Textarea
              id="req-reason-cancel"
              rows={3}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Tell the admin why you want to cancel"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(null)}>
              Keep my plan
            </Button>
            <Button variant="destructive" onClick={submitRequest} disabled={requestBusy}>
              {requestBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit cancellation request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  )
}

// ---------------------------- Super admin view ----------------------------

interface PackageForm {
  name: string
  description: string
  price: string
  featuresText: string
  show_price: boolean
  show_features: boolean
  is_complimentary: boolean
  is_active: boolean
  sort_order: string
}

const emptyPackageForm: PackageForm = {
  name: '',
  description: '',
  price: '0',
  featuresText: '',
  show_price: true,
  show_features: true,
  is_complimentary: false,
  is_active: true,
  sort_order: '0',
}

interface SubscriptionForm {
  store_id: string
  package_id: string
  start_date: string
  end_date: string
  frequency: SubscriptionFrequency
  period_months: string
  price: string
  auto_renew: boolean
  status: string
  notes: string
}

const emptySubscriptionForm: SubscriptionForm = {
  store_id: '',
  package_id: '',
  start_date: todayInput(),
  end_date: '',
  frequency: 'monthly',
  period_months: '1',
  price: '',
  auto_renew: false,
  status: 'active',
  notes: '',
}

function AdminSubscriptionView() {
  const { stores } = useStore()
  const { confirm, confirmDialog } = useConfirmDialog()

  const [subscriptions, setSubscriptions] = useState<StoreSubscription[]>([])
  const [packages, setPackages] = useState<SubscriptionPackage[]>([])
  const [history, setHistory] = useState<SubscriptionHistoryEvent[]>([])
  const [requests, setRequests] = useState<SubscriptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [subFilter, setSubFilter] = useState('all')
  const [requestStatusFilter, setRequestStatusFilter] = useState('pending')
  const [requestStoreFilter, setRequestStoreFilter] = useState('all')
  const [tab, setTab] = useState('subscriptions')

  // Request resolve dialog
  const [resolveReq, setResolveReq] = useState<SubscriptionRequest | null>(null)
  const [resolveMode, setResolveMode] = useState<'approve' | 'reject'>('approve')
  const [resolveNotes, setResolveNotes] = useState('')
  const [resolveBusy, setResolveBusy] = useState(false)

  // Package dialog
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false)
  const [editingPkg, setEditingPkg] = useState<SubscriptionPackage | null>(null)
  const [pkgForm, setPkgForm] = useState<PackageForm>(emptyPackageForm)
  const [pkgSaving, setPkgSaving] = useState(false)

  // Subscription dialog
  const [subDialogOpen, setSubDialogOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<StoreSubscription | null>(null)
  const [subForm, setSubForm] = useState<SubscriptionForm>(emptySubscriptionForm)
  const [subSaving, setSubSaving] = useState(false)
  const [endDateEdited, setEndDateEdited] = useState(false)

  const load = useCallback(async () => {
    try {
      const [subsRes, pkgRes, reqRes] = await Promise.all([
        adminListSubscriptions(),
        listSubscriptionPackages(),
        adminListSubscriptionRequests('pending'),
      ])
      setSubscriptions(subsRes || [])
      setPackages(pkgRes || [])
      setRequests(reqRes || [])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRequests = useCallback(async (status?: string, storeId?: string) => {
    try {
      const res = await adminListSubscriptionRequests(status, storeId)
      setRequests(res || [])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load requests')
    }
  }, [])

  const loadHistory = useCallback(async (storeId?: string) => {
    try {
      const res = await adminListSubscriptionHistory(storeId && storeId !== 'all' ? storeId : undefined)
      setHistory(res || [])
      setHistoryLoaded(true)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load history')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (tab === 'history') loadHistory(historyFilter)
    if (tab === 'requests') loadRequests(requestStatusFilter, requestStoreFilter)
  }, [tab, historyFilter, requestStatusFilter, requestStoreFilter, loadHistory, loadRequests])

  const openResolve = (req: SubscriptionRequest, mode: 'approve' | 'reject') => {
    setResolveReq(req)
    setResolveMode(mode)
    setResolveNotes('')
  }

  const submitResolve = async () => {
    if (!resolveReq) return
    setResolveBusy(true)
    try {
      if (resolveMode === 'approve') {
        await adminApproveSubscriptionRequest(resolveReq.id, resolveNotes.trim())
        notifySuccess('Request approved and applied')
      } else {
        await adminRejectSubscriptionRequest(resolveReq.id, resolveNotes.trim())
        notifySuccess('Request rejected')
      }
      setResolveReq(null)
      await load()
      loadRequests(requestStatusFilter, requestStoreFilter)
      if (historyLoaded) loadHistory(historyFilter)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to resolve request')
    } finally {
      setResolveBusy(false)
    }
  }

  const filteredSubs = useMemo(
    () => (subFilter === 'all' ? subscriptions : subscriptions.filter((s) => s.store_id === subFilter)),
    [subscriptions, subFilter]
  )

  // -------------------------- package actions --------------------------

  const openPackageDialog = (pkg?: SubscriptionPackage) => {
    if (pkg) {
      setEditingPkg(pkg)
      setPkgForm({
        name: pkg.name,
        description: pkg.description || '',
        price: String(pkg.price ?? 0),
        featuresText: (pkg.features || []).join('\n'),
        show_price: pkg.show_price,
        show_features: pkg.show_features,
        is_complimentary: pkg.is_complimentary,
        is_active: pkg.is_active,
        sort_order: String(pkg.sort_order ?? 0),
      })
    } else {
      setEditingPkg(null)
      setPkgForm(emptyPackageForm)
    }
    setPkgDialogOpen(true)
  }

  const savePackage = async () => {
    if (!pkgForm.name.trim()) {
      notifyError('Package name is required')
      return
    }
    const price = parseFloat(pkgForm.price)
    if (Number.isNaN(price) || price < 0) {
      notifyError('Enter a valid price')
      return
    }
    setPkgSaving(true)
    try {
      const payload = {
        name: pkgForm.name.trim(),
        description: pkgForm.description.trim(),
        price,
        features: pkgForm.featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
        show_price: pkgForm.show_price,
        show_features: pkgForm.show_features,
        is_complimentary: pkgForm.is_complimentary,
        is_active: pkgForm.is_active,
        sort_order: parseInt(pkgForm.sort_order, 10) || 0,
      }
      if (editingPkg) {
        await adminUpdateSubscriptionPackage(editingPkg.id, payload)
        notifySuccess('Package updated')
      } else {
        await adminCreateSubscriptionPackage(payload)
        notifySuccess('Package created')
      }
      setPkgDialogOpen(false)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save package')
    } finally {
      setPkgSaving(false)
    }
  }

  const deletePackage = async (pkg: SubscriptionPackage) => {
    if (
      !(await confirm({
        title: `Delete package "${pkg.name}"?`,
        description: 'Packages used by existing subscriptions cannot be deleted.',
        variant: 'destructive',
      }))
    )
      return
    try {
      await adminDeleteSubscriptionPackage(pkg.id)
      notifySuccess('Package deleted')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete package')
    }
  }

  const togglePackageActive = async (pkg: SubscriptionPackage) => {
    try {
      await adminUpdateSubscriptionPackage(pkg.id, {
        name: pkg.name,
        description: pkg.description || '',
        price: pkg.price ?? 0,
        features: pkg.features || [],
        show_price: pkg.show_price,
        show_features: pkg.show_features,
        is_complimentary: pkg.is_complimentary,
        is_active: !pkg.is_active,
        sort_order: pkg.sort_order ?? 0,
      })
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update package')
    }
  }

  // ------------------------ subscription actions ------------------------

  const computeEndDate = (form: SubscriptionForm): string => {
    const start = new Date(form.start_date)
    if (Number.isNaN(start.getTime())) return ''
    const months = monthsForFrequency(form.frequency, parseInt(form.period_months, 10) || 1)
    return toDateInput(addMonths(start, months).toISOString())
  }

  const openSubDialog = (sub?: StoreSubscription) => {
    if (sub) {
      setEditingSub(sub)
      setEndDateEdited(true)
      setSubForm({
        store_id: sub.store_id,
        package_id: sub.package_id || '',
        start_date: toDateInput(sub.start_date),
        end_date: toDateInput(sub.end_date),
        frequency: (sub.frequency as SubscriptionFrequency) || 'monthly',
        period_months: String(sub.period_months || 1),
        price: String(sub.price ?? ''),
        auto_renew: sub.auto_renew,
        status: sub.status || 'active',
        notes: sub.notes || '',
      })
    } else {
      setEditingSub(null)
      setEndDateEdited(false)
      const form = { ...emptySubscriptionForm, start_date: todayInput() }
      setSubForm({ ...form, end_date: computeEndDate(form) })
    }
    setSubDialogOpen(true)
  }

  const patchSubForm = (patch: Partial<SubscriptionForm>) => {
    setSubForm((f) => {
      const next = { ...f, ...patch }
      if (!editingSub && !endDateEdited && ('start_date' in patch || 'frequency' in patch || 'period_months' in patch)) {
        next.end_date = computeEndDate(next)
      }
      if ('package_id' in patch && !('price' in patch)) {
        const pkg = packages.find((p) => p.id === next.package_id)
        if (pkg) next.price = pkg.is_complimentary ? '0' : String(pkg.price ?? '')
      }
      return next
    })
  }

  const saveSubscription = async () => {
    if (!subForm.store_id) {
      notifyError('Select a store')
      return
    }
    if (!subForm.start_date) {
      notifyError('Start date is required')
      return
    }
    const price = subForm.price.trim() === '' ? undefined : parseFloat(subForm.price)
    if (price !== undefined && (Number.isNaN(price) || price < 0)) {
      notifyError('Enter a valid price')
      return
    }
    setSubSaving(true)
    try {
      const payload = {
        store_id: subForm.store_id,
        package_id: subForm.package_id || undefined,
        start_date: subForm.start_date,
        end_date: subForm.end_date || undefined,
        frequency: subForm.frequency,
        period_months:
          subForm.frequency === 'custom' ? parseInt(subForm.period_months, 10) || 1 : undefined,
        price,
        auto_renew: subForm.auto_renew,
        notes: subForm.notes.trim(),
        ...(editingSub ? { status: subForm.status } : {}),
      }
      if (editingSub) {
        await adminUpdateSubscription(editingSub.id, payload)
        notifySuccess('Subscription updated')
      } else {
        await adminCreateSubscription(payload)
        notifySuccess('Subscription created')
      }
      setSubDialogOpen(false)
      await load()
      if (historyLoaded) loadHistory(historyFilter)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save subscription')
    } finally {
      setSubSaving(false)
    }
  }

  const renewSubscription = async (sub: StoreSubscription) => {
    try {
      await adminRenewSubscription(sub.id)
      notifySuccess(`Subscription renewed for ${sub.store?.name || 'store'}`)
      await load()
      if (historyLoaded) loadHistory(historyFilter)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to renew subscription')
    }
  }

  const cancelSubscription = async (sub: StoreSubscription) => {
    if (
      !(await confirm({
        title: `Cancel subscription for ${sub.store?.name || 'this store'}?`,
        description: `The ${sub.package_name} plan will be marked cancelled. History is preserved.`,
        variant: 'destructive',
      }))
    )
      return
    try {
      await adminCancelSubscription(sub.id)
      notifySuccess('Subscription cancelled')
      await load()
      if (historyLoaded) loadHistory(historyFilter)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to cancel subscription')
    }
  }

  if (loading) return <FormPageSkeleton />

  const activeCount = subscriptions.filter((s) => s.effective_status === 'active').length
  const expiringSoon = subscriptions.filter(
    (s) => s.effective_status === 'active' && s.days_remaining <= 15
  ).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscriptions"
        actions={
          tab === 'packages' ? (
            <Button onClick={() => openPackageDialog()}>
              <Plus className="mr-2 h-4 w-4" /> New package
            </Button>
          ) : tab === 'subscriptions' ? (
            <Button onClick={() => openSubDialog()}>
              <Plus className="mr-2 h-4 w-4" /> New subscription
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total subscriptions
            </div>
            <div className="mt-1 text-2xl font-semibold">{subscriptions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expiring ≤ 15 days
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{expiringSoon}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="subscriptions">Store Subscriptions</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {requests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {requests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="mr-1.5 h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Store</Label>
            <Select value={subFilter} onValueChange={setSubFilter}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredSubs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No subscriptions yet. Create one to assign a plan to a store.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Renewal date</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Days left</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map((sub) => {
                    const eff = sub.effective_status
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {sub.store?.name || '—'}
                          {sub.store?.code && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({sub.store.code})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{sub.package_name}</TableCell>
                        <TableCell>
                          <StatusBadge tone={STATUS_TONE[eff] || 'neutral'}>{eff}</StatusBadge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(sub.start_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(sub.end_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {eff === 'cancelled' ? '—' : formatDate(sub.end_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {frequencyLabel(sub.frequency, sub.period_months)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(sub.price ?? 0)}
                        </TableCell>
                        <TableCell
                          className={`text-right whitespace-nowrap ${
                            eff === 'active' && sub.days_remaining <= 15 ? 'font-semibold text-amber-600' : ''
                          }`}
                        >
                          {eff === 'cancelled' ? '—' : eff === 'expired' ? 'Expired' : sub.days_remaining}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {eff !== 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Renew for one more period"
                                onClick={() => renewSubscription(sub)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" title="Edit" onClick={() => openSubDialog(sub)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {eff !== 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Cancel"
                                onClick={() => cancelSubscription(sub)}
                              >
                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="packages" className="space-y-3 pt-2">
          {packages.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No packages yet. Create a plan that stores can subscribe to.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={pkg.is_active ? '' : 'opacity-70'}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{pkg.name}</CardTitle>
                        {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
                      </div>
                      <Switch checked={pkg.is_active} onCheckedChange={() => togglePackageActive(pkg)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-lg font-semibold">{formatCurrency(pkg.price ?? 0)}</span>
                      <span className="text-xs text-muted-foreground">/ billing period</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!pkg.show_price && (
                        <Badge variant="outline" className="gap-1">
                          <EyeOff className="h-3 w-3" /> Price hidden
                        </Badge>
                      )}
                      {!pkg.show_features && (
                        <Badge variant="outline" className="gap-1">
                          <EyeOff className="h-3 w-3" /> Features hidden
                        </Badge>
                      )}
                      {pkg.is_complimentary && (
                        <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                          <Crown className="h-3 w-3" /> Complimentary
                        </Badge>
                      )}
                      {!pkg.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    {pkg.features?.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {pkg.features.slice(0, 5).map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span>{f}</span>
                          </li>
                        ))}
                        {pkg.features.length > 5 && (
                          <li className="text-xs text-muted-foreground">+{pkg.features.length - 5} more</li>
                        )}
                      </ul>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => openPackageDialog(pkg)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deletePackage(pkg)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5 text-rose-500" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Store</Label>
              <Select value={requestStoreFilter} onValueChange={setRequestStoreFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No {requestStatusFilter !== 'all' ? requestStatusFilter : ''} requests found.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.store?.name || '—'}
                        {r.store?.code && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({r.store.code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subscriptionRequestTypeLabel(r.request_type)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.request_type !== 'cancel' && r.target_package_name
                          ? `${r.current_package_name || '—'} → ${r.target_package_name}`
                          : r.current_package_name || '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {r.reason || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.requested_by_name || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={REQUEST_STATUS_TONE[r.status] || 'neutral'}>
                          {r.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Approve and apply"
                              onClick={() => openResolve(r, 'approve')}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reject"
                              onClick={() => openResolve(r, 'reject')}
                            >
                              <XCircle className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.resolved_by_name || '—'}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Store</Label>
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SubscriptionHistoryTable
            events={history}
            showStore
            showPrice
            emptyText="No subscription events yet."
          />
        </TabsContent>
      </Tabs>

      {/* ------------------------ Package dialog ------------------------ */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPkg ? 'Edit package' : 'New package'}</DialogTitle>
            <DialogDescription>
              Packages are plans that stores subscribe to. Control what customers see with the
              visibility switches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-name">Name *</Label>
                <Input
                  id="pkg-name"
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Growth Plan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-price">Price (₹ / period)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pkgForm.price}
                  onChange={(e) => setPkgForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-desc">Description</Label>
              <Input
                id="pkg-desc"
                value={pkgForm.description}
                onChange={(e) => setPkgForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown on the plan card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-features">Features (optional, one per line)</Label>
              <Textarea
                id="pkg-features"
                rows={5}
                value={pkgForm.featuresText}
                onChange={(e) => setPkgForm((f) => ({ ...f, featuresText: e.target.value }))}
                placeholder={'Unlimited invoices\nGST reports\nPriority support'}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="pkg-show-price"
                  checked={pkgForm.show_price}
                  onCheckedChange={(v) => setPkgForm((f) => ({ ...f, show_price: v }))}
                />
                <Label htmlFor="pkg-show-price" className="text-xs">Show price</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="pkg-show-features"
                  checked={pkgForm.show_features}
                  onCheckedChange={(v) => setPkgForm((f) => ({ ...f, show_features: v }))}
                />
                <Label htmlFor="pkg-show-features" className="text-xs">Show features</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="pkg-complimentary"
                  checked={pkgForm.is_complimentary}
                  onCheckedChange={(v) => setPkgForm((f) => ({ ...f, is_complimentary: v }))}
                />
                <Label htmlFor="pkg-complimentary" className="text-xs">Complimentary</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="pkg-active"
                  checked={pkgForm.is_active}
                  onCheckedChange={(v) => setPkgForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="pkg-active" className="text-xs">Active</Label>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Complimentary packages renew free of cost and are hidden from the store's plan list.
            </p>
            <div className="space-y-1.5 sm:w-40">
              <Label htmlFor="pkg-sort">Sort order</Label>
              <Input
                id="pkg-sort"
                type="number"
                value={pkgForm.sort_order}
                onChange={(e) => setPkgForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePackage} disabled={pkgSaving}>
              {pkgSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPkg ? 'Save changes' : 'Create package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------- Subscription dialog ---------------------- */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Edit subscription' : 'New subscription'}</DialogTitle>
            <DialogDescription>
              {editingSub
                ? 'Changing the package is recorded as an upgrade or downgrade in history.'
                : 'Assign a plan to a store. Any existing live subscription is superseded.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Store *</Label>
              <Select
                value={subForm.store_id}
                onValueChange={(v) => patchSubForm({ store_id: v })}
                disabled={!!editingSub}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Package</Label>
              <Select value={subForm.package_id || 'custom'} onValueChange={(v) => patchSubForm({ package_id: v === 'custom' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom plan (no package)</SelectItem>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_complimentary ? ' — Complimentary (free)' : p.price != null ? ` — ${formatCurrency(p.price)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sub-start">Start date *</Label>
                <Input
                  id="sub-start"
                  type="date"
                  value={subForm.start_date}
                  onChange={(e) => patchSubForm({ start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing frequency</Label>
                <Select
                  value={subForm.frequency}
                  onValueChange={(v) => patchSubForm({ frequency: v as SubscriptionFrequency })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTION_FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {subForm.frequency === 'custom' && (
              <div className="space-y-1.5 sm:w-48">
                <Label htmlFor="sub-months">Period (months)</Label>
                <Input
                  id="sub-months"
                  type="number"
                  min="1"
                  max="120"
                  value={subForm.period_months}
                  onChange={(e) => patchSubForm({ period_months: e.target.value })}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sub-end">Expiry / renewal date</Label>
                <Input
                  id="sub-end"
                  type="date"
                  value={subForm.end_date}
                  onChange={(e) => {
                    setEndDateEdited(true)
                    patchSubForm({ end_date: e.target.value })
                  }}
                />
                <p className="text-[11px] text-muted-foreground">Auto-computed from start + frequency; editable.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-price">Price (₹ / period)</Label>
                <Input
                  id="sub-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={subForm.price}
                  onChange={(e) => patchSubForm({ price: e.target.value })}
                  placeholder="Defaults to package price"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="sub-autorenew"
                  checked={subForm.auto_renew}
                  onCheckedChange={(v) => patchSubForm({ auto_renew: v })}
                />
                <Label htmlFor="sub-autorenew" className="text-xs">Auto-renew</Label>
              </div>
              {editingSub && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={subForm.status} onValueChange={(v) => patchSubForm({ status: v })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-notes">Notes</Label>
              <Textarea
                id="sub-notes"
                rows={3}
                value={subForm.notes}
                onChange={(e) => patchSubForm({ notes: e.target.value })}
                placeholder="Optional note recorded in history"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSubscription} disabled={subSaving}>
              {subSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSub ? 'Save changes' : 'Create subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------- Resolve request dialog ------------------- */}
      <Dialog open={!!resolveReq} onOpenChange={(o) => !o && setResolveReq(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolveMode === 'approve' ? 'Approve request' : 'Reject request'}
            </DialogTitle>
            <DialogDescription>
              {resolveReq && resolveMode === 'approve'
                ? resolveReq.request_type === 'cancel'
                  ? `The subscription for ${resolveReq.store?.name || 'this store'} will be cancelled.`
                  : `The plan for ${resolveReq.store?.name || 'this store'} will change to ${resolveReq.target_package_name}.`
                : 'The request will be marked rejected; no changes are applied.'}
            </DialogDescription>
          </DialogHeader>
          {resolveReq && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="font-medium">
                {subscriptionRequestTypeLabel(resolveReq.request_type)}
                {resolveReq.request_type !== 'cancel' && resolveReq.target_package_name
                  ? ` — ${resolveReq.current_package_name || '—'} → ${resolveReq.target_package_name}`
                  : ''}
              </div>
              {resolveReq.reason && (
                <div className="mt-1 text-xs text-muted-foreground">Reason: {resolveReq.reason}</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {resolveReq.store?.name} · {resolveReq.requested_by_name || 'store'} ·{' '}
                {formatDateTime(resolveReq.created_at)}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="resolve-notes">
              Resolution notes {resolveMode === 'reject' ? '(optional)' : '(optional)'}
            </Label>
            <Textarea
              id="resolve-notes"
              rows={3}
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder={
                resolveMode === 'approve'
                  ? 'e.g. Applied with effect from next billing cycle'
                  : 'e.g. Reason for rejection shared with the store'
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveReq(null)}>
              Back
            </Button>
            <Button
              variant={resolveMode === 'reject' ? 'destructive' : 'default'}
              onClick={submitResolve}
              disabled={resolveBusy}
            >
              {resolveBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resolveMode === 'approve' ? 'Approve & apply' : 'Reject request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  )
}

export default function SubscriptionPage() {
  const { user, loading } = useAuth()
  const admin = isSuperAdmin(user?.role)

  return (
    <DashboardLayout>
      {loading ? <FormPageSkeleton /> : admin ? <AdminSubscriptionView /> : <StoreSubscriptionView />}
    </DashboardLayout>
  )
}
