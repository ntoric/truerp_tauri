'use client'

import { CalendarClock, Crown, RefreshCw, ShieldOff, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  cycleLabel,
  cyclePer,
  formatMoney,
  formatPlanDate,
  type StoreSubscription,
} from '@/lib/subscriptions'

/** Circular gauge of days left in the current period. */
export function RemainingRing({
  remaining,
  total,
  size = 132,
  muted = false,
}: {
  remaining: number
  total: number
  size?: number
  muted?: boolean
}) {
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const id = `ring-${size}-${muted ? 'm' : 'a'}`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={muted ? '#94a3b8' : '#fde68a'} />
            <stop offset="100%" stopColor={muted ? '#64748b' : '#f59e0b'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tabular-nums leading-none text-white">{remaining}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
          {remaining === 1 ? 'day left' : 'days left'}
        </span>
      </div>
    </div>
  )
}

/**
 * Premium card for a store subscription: deep gradient, gold accents,
 * remaining-days gauge and renewal facts.
 */
export default function SubscriptionCard({
  sub,
  className,
  compact = false,
}: {
  sub: StoreSubscription
  className?: string
  compact?: boolean
}) {
  const active = sub.status === 'active'
  const due = active && sub.amount_due > 0
  const endingSoon = active && !sub.auto_renew && !sub.next_cycle_paid

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-3xl p-6 text-white shadow-[0_30px_60px_-25px_rgba(30,27,75,0.65)] sm:p-8',
        active
          ? 'bg-[linear-gradient(135deg,#0b0a1f_0%,#1e1b4b_45%,#3b0764_100%)]'
          : 'bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_60%,#334155_100%)]',
        className
      )}
    >
      {/* Decorative glows, sheen and fine grid */}
      <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at top right, black 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top right, black 10%, transparent 70%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.07)_50%,transparent_65%)]" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1',
                active ? 'bg-amber-300/15 text-amber-200 ring-amber-200/30' : 'bg-white/10 text-white/70 ring-white/20'
              )}
            >
              {active ? <Crown className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
              {active ? 'Current plan' : 'Cancelled'}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80 ring-1 ring-white/15">
              {cycleLabel(sub.billing_cycle)}
            </span>
            {due && (
              <span className="rounded-full bg-rose-400/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-100 ring-1 ring-rose-300/30">
                Payment due
              </span>
            )}
          </div>

          <div>
            <h2 className="bg-[linear-gradient(90deg,#fff_0%,#fde68a_100%)] bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {sub.plan_name}
            </h2>
            {!compact && sub.plan_description && (
              <p className="mt-1.5 max-w-xl text-sm text-white/65">{sub.plan_description}</p>
            )}
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(sub.price, sub.currency)}</span>
            <span className="text-sm text-white/55">{cyclePer(sub.billing_cycle)}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:flex sm:flex-wrap">
            {active ? (
              <>
                <Fact
                  icon={<CalendarClock className="h-4 w-4" />}
                  label={sub.auto_renew || sub.next_cycle_paid ? 'Renews on' : 'Ends on'}
                  value={formatPlanDate(sub.current_period_end)}
                />
                <Fact
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Auto-renew"
                  value={sub.auto_renew ? 'On' : 'Off'}
                />
                <Fact
                  className="col-span-2"
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Current period"
                  value={`${formatPlanDate(sub.current_period_start)} – ${formatPlanDate(sub.current_period_end)}`}
                />
              </>
            ) : (
              <>
                <Fact
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Cancelled on"
                  value={sub.cancelled_at ? new Date(sub.cancelled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                />
                {sub.cancellation_reason && <Fact label="Reason" value={sub.cancellation_reason} />}
              </>
            )}
          </div>
        </div>

        {active && (
          <div className="flex flex-col items-center gap-2 self-center">
            <RemainingRing remaining={sub.remaining_days} total={sub.total_days} size={compact ? 112 : 140} />
            {endingSoon && (
              <span className="text-center text-xs text-amber-200/80">Won&apos;t renew automatically</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Fact({
  icon,
  label,
  value,
  className,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 break-words font-medium text-white/90">{value}</div>
    </div>
  )
}
