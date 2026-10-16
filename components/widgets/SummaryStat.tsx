import type { ReactNode } from 'react'
import {
  BarChart3,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Landmark,
  type LucideIcon,
  MailOpen,
  MousePointerClick,
  Package,
  PiggyBank,
  Receipt,
  Scale,
  Send,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SummaryStatTone = 'default' | 'success' | 'warning' | 'danger' | 'brand'

const toneClasses: Record<Exclude<SummaryStatTone, 'brand'>, { tile: string; glow: string }> = {
  default: { tile: 'bg-blue-50 text-blue-600 ring-blue-100', glow: 'bg-[hsl(var(--theme-400)/0.16)]' },
  success: { tile: 'bg-emerald-50 text-emerald-600 ring-emerald-100', glow: 'bg-emerald-400/20' },
  warning: { tile: 'bg-amber-50 text-amber-600 ring-amber-100', glow: 'bg-amber-400/20' },
  danger: { tile: 'bg-blue-100 text-blue-700 ring-blue-200', glow: 'bg-[hsl(var(--theme-500)/0.2)]' },
}

/** Ordered keyword → icon map so stat cards get a meaningful icon without every caller passing one. */
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/inventory|stock value|stock change/, Package],
  [/absent/, UserX],
  [/present/, UserCheck],
  [/leave|weekly off|half day|holiday/, CalendarDays],
  [/profit|margin/, PiggyBank],
  [/tax|gst|cgst|sgst|igst|cess/, Landmark],
  [/liabilit/, Scale],
  [/expense|cost|purchase/, Receipt],
  [/collect|receiv|outstanding|due|pending|overdue|advance/, Clock],
  [/sale|revenue|income|turnover/, TrendingUp],
  [/payment|paid|payroll|salary/, CreditCard],
  [/cash|bank|balance|asset|wallet|to pay|payable|closing|opening/, Wallet],
  [/invoice|bill|voucher|entr|transaction|record/, FileText],
  [/opened|open rate/, MailOpen],
  [/click/, MousePointerClick],
  [/campaign|sent|message|sms|whatsapp|email|scheduled/, Send],
  [/point|loyal|reward|redeem/, Gift],
  [/customer|part|staff|user|member|employee|role/, Users],
  [/product|item|stock|unit|qty|quantity|categor|warehouse/, Package],
]

function iconForLabel(label: ReactNode): LucideIcon {
  if (typeof label !== 'string') return BarChart3
  const text = label.toLowerCase()
  return ICON_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? BarChart3
}

export default function SummaryStat({
  label, value, hint, icon, tone = 'default', size = 'md', className, id,
}: {
  label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon
  tone?: SummaryStatTone; size?: 'sm' | 'md'; className?: string; id?: string
}) {
  const brand = tone === 'brand'
  const Icon = icon ?? iconForLabel(label)
  const styles = brand ? null : toneClasses[tone]
  const small = size === 'sm'

  return (
    <div
      id={id}
      className={cn(
        'group relative overflow-hidden rounded-2xl transition-all duration-200 ease-out hover:-translate-y-0.5',
        small ? 'p-3.5' : 'p-4',
        brand
          ? 'bg-[linear-gradient(140deg,hsl(var(--theme-500))_0%,hsl(var(--theme-700))_55%,hsl(var(--theme-900))_100%)] text-white shadow-[0_12px_28px_-12px_hsl(var(--theme-700)/0.6),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : 'border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.18)] hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_32px_-16px_rgba(16,24,40,0.25)]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300',
          brand ? 'bg-white/20 opacity-80' : cn(styles?.glow, 'opacity-60 group-hover:opacity-100')
        )}
      />
      <div className="relative flex items-center gap-2.5">
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            small ? 'h-8 w-8' : 'h-9 w-9',
            brand ? 'bg-white/15 text-white ring-white/25 backdrop-blur-sm' : styles?.tile
          )}
        >
          <Icon className={small ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden="true" />
        </span>
        <p className={cn('min-w-0 truncate text-xs font-medium', brand ? 'text-white/80' : 'text-slate-500')}>{label}</p>
      </div>
      <p
        className={cn(
          'relative break-words font-semibold tracking-tight tabular-nums',
          small ? 'mt-2.5 text-xl' : 'mt-3 text-2xl',
          brand ? 'text-white' : 'text-slate-900'
        )}
      >
        {value}
      </p>
      {hint && (
        <p className={cn('relative mt-0.5 text-[11px]', brand ? 'text-white/70' : 'text-slate-500')}>{hint}</p>
      )}
    </div>
  )
}
