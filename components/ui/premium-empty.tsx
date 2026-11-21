import { type ReactNode } from 'react'
import { Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PremiumEmptyTone = 'blue' | 'emerald' | 'amber' | 'violet' | 'lime'

const TONE_STYLES: Record<
  PremiumEmptyTone,
  { ring: string; wash: string; chip: string; sparkA: string; sparkB: string }
> = {
  // Default tone follows the Appearance-configured theme colour: Tailwind's
  // blue-* palette is remapped to the --theme-* vars (see tailwind.config.ts),
  // and the gradient + medallion shadow read the vars directly.
  blue: {
    ring: 'ring-[hsl(var(--theme-200)/0.7)]',
    wash: 'bg-[radial-gradient(130%_120%_at_50%_0%,hsl(var(--theme-100)/0.75)_0%,hsl(var(--theme-50)/0.7)_45%,hsl(0_0%_100%)_100%)]',
    chip: 'text-[hsl(var(--theme-600))] shadow-[0_8px_20px_-8px_hsl(var(--theme-500)/0.4)] ring-[hsl(var(--theme-100))]',
    sparkA: 'text-[hsl(var(--theme-200))]',
    sparkB: 'text-[hsl(var(--theme-100))]',
  },
  emerald: {
    ring: 'ring-emerald-100/80',
    wash: 'bg-[radial-gradient(130%_120%_at_50%_0%,hsl(152_81%_94%)_0%,hsl(152_60%_97%)_45%,hsl(0_0%_100%)_100%)]',
    chip: 'text-emerald-600 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.45)] ring-emerald-100',
    sparkA: 'text-emerald-300',
    sparkB: 'text-emerald-200',
  },
  amber: {
    ring: 'ring-amber-100/80',
    wash: 'bg-[radial-gradient(130%_120%_at_50%_0%,hsl(45_93%_94%)_0%,hsl(45_70%_98%)_45%,hsl(0_0%_100%)_100%)]',
    chip: 'text-amber-500 shadow-[0_8px_20px_-8px_rgba(217,119,6,0.4)] ring-amber-100',
    sparkA: 'text-amber-300',
    sparkB: 'text-amber-200',
  },
  violet: {
    ring: 'ring-violet-100/80',
    wash: 'bg-[radial-gradient(130%_120%_at_50%_0%,hsl(270_90%_96%)_0%,hsl(270_60%_98%)_45%,hsl(0_0%_100%)_100%)]',
    chip: 'text-violet-600 shadow-[0_8px_20px_-8px_rgba(124,58,237,0.4)] ring-violet-100',
    sparkA: 'text-violet-200',
    sparkB: 'text-violet-100',
  },
  lime: {
    ring: 'ring-lime-100/80',
    wash: 'bg-[radial-gradient(130%_120%_at_50%_0%,hsl(84_81%_94%)_0%,hsl(84_60%_98%)_45%,hsl(0_0%_100%)_100%)]',
    chip: 'text-lime-600 shadow-[0_8px_20px_-8px_rgba(101,163,13,0.45)] ring-lime-100',
    sparkA: 'text-lime-300',
    sparkB: 'text-lime-200',
  },
}

/** Polished empty state: soft radial wash, sparkles, icon medallion, title + hint + optional CTA. */
export default function PremiumEmpty({
  icon: Icon,
  title,
  hint,
  action,
  tone = 'blue',
  compact = false,
  className,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
  tone?: PremiumEmptyTone
  compact?: boolean
  className?: string
}) {
  const t = TONE_STYLES[tone]
  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden text-center ring-1 ring-inset',
        compact ? 'rounded-xl px-4 py-8' : 'rounded-2xl px-6 py-14',
        t.ring,
        className
      )}
    >
      <div className={cn('absolute inset-0', t.wash)} />
      <Sparkles className={cn('absolute left-[16%] top-8 h-3.5 w-3.5', t.sparkA)} />
      <Sparkles className={cn('absolute right-[14%] top-16 h-4 w-4', t.sparkB)} />
      <span
        className={cn(
          'relative flex items-center justify-center rounded-2xl bg-white ring-1 ring-inset',
          compact ? 'h-10 w-10' : 'h-12 w-12',
          t.chip
        )}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
      </span>
      <p className="relative mt-4 text-sm font-semibold tracking-tight text-gray-900">{title}</p>
      {hint && (
        <p className="relative mt-1 max-w-[340px] text-xs leading-relaxed text-gray-500">{hint}</p>
      )}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  )
}
