import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] ring-1 ring-inset transition-colors outline-none focus:outline-none focus-visible:ring-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_100%)] text-white ring-white/25 shadow-[0_2px_6px_-2px_hsl(var(--theme-600)/0.55),inset_0_1px_0_rgba(255,255,255,0.25)]",
        secondary:
          "bg-slate-100/80 text-slate-600 ring-slate-900/[0.08] shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
        destructive:
          "bg-blue-50 text-blue-700 ring-blue-600/20 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        outline:
          "bg-white text-slate-600 ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export type StatusBadgeTone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'violet'
  | 'pink'
  | 'teal'

const STATUS_BADGE_TONES: Record<StatusBadgeTone, { chip: string; dot: string }> = {
  neutral: { chip: 'bg-slate-100/80 text-slate-600 ring-slate-900/[0.08]', dot: 'bg-slate-400' },
  brand: { chip: 'bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500' },
  info: { chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  success: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  warning: { chip: 'bg-amber-50 text-amber-800 ring-amber-600/25', dot: 'bg-amber-500' },
  danger: { chip: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  violet: { chip: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500' },
  pink: { chip: 'bg-pink-50 text-pink-700 ring-pink-600/20', dot: 'bg-pink-500' },
  teal: { chip: 'bg-teal-50 text-teal-700 ring-teal-600/20', dot: 'bg-teal-500' },
}

/** Default tone for the status strings used across the app. */
const DEFAULT_STATUS_TONES: Record<string, StatusBadgeTone> = {
  active: 'success',
  accepted: 'success',
  approved: 'success',
  completed: 'success',
  delivered: 'success',
  issued: 'success',
  paid: 'success',
  processed: 'success',
  received: 'success',
  resolved: 'success',
  success: 'success',
  scheduled: 'brand',
  sent: 'brand',
  submitted: 'brand',
  converted: 'warning',
  partial: 'warning',
  pending: 'warning',
  unpaid: 'warning',
  cancelled: 'danger',
  canceled: 'danger',
  failed: 'danger',
  inactive: 'danger',
  overdue: 'danger',
  rejected: 'danger',
  read: 'violet',
}

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Colour family. When omitted, one is inferred from `status`. */
  tone?: StatusBadgeTone
  /** Raw status key (e.g. 'paid') — also rendered when no children are given. */
  status?: string
}

function StatusBadge({ tone, status, className, children, ...props }: StatusBadgeProps) {
  const resolved = tone || DEFAULT_STATUS_TONES[(status || '').toLowerCase()] || 'neutral'
  const styles = STATUS_BADGE_TONES[resolved]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-[0.04em] ring-1 ring-inset',
        styles.chip,
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} />
      {children ?? status}
    </span>
  )
}

export { Badge, badgeVariants, StatusBadge }
