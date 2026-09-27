import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SummaryStatTone = 'default' | 'success' | 'warning' | 'danger' | 'brand'

const toneBar: Record<Exclude<SummaryStatTone, 'brand'>, string> = {
  default: 'bg-[#111111]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-[#c81e3a]',
}

export default function SummaryStat({
  label, value, hint, icon: Icon, tone = 'default', size = 'md', className, id,
}: {
  label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: LucideIcon
  tone?: SummaryStatTone; size?: 'sm' | 'md'; className?: string; id?: string
}) {
  const brand = tone === 'brand'
  return (
    <div id={id} className={cn(
      'relative overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
      size === 'sm' ? 'p-3' : 'p-4',
      brand ? 'border-transparent bg-[linear-gradient(150deg,#dc2626_0%,#991b1b_55%,#450a0a_100%)] text-white' : 'border-[#e4e6ef] bg-white',
      className
    )}>
      {!brand && <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-[3px]', toneBar[tone])} />}
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-xs font-semibold uppercase tracking-[0.06em]', brand ? 'text-rose-100' : 'text-[#5b5c6b]')}>{label}</p>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', brand ? 'text-white/80' : 'text-[#9a9ba6]')} aria-hidden="true" />}
      </div>
      <p className={cn('font-bold tracking-tight', size === 'sm' ? 'mt-1 text-lg' : 'mt-2 text-2xl', brand ? 'text-white' : 'text-[#20212b]')}>{value}</p>
      {hint && <p className={cn('mt-0.5 text-xs', brand ? 'text-rose-100' : 'text-[#5b5c6b]')}>{hint}</p>}
    </div>
  )
}
