import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SummaryStat from '@/components/widgets/SummaryStat'
import { cn } from '@/lib/utils'

export function ReportStatGrid({
  stats,
  columns = 4,
}: {
  stats: { label: string; value: string; hint?: string; tone?: 'default' | 'success' | 'warning' | 'danger' }[]
  columns?: 2 | 3 | 4
}) {
  const colClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={cn('grid grid-cols-1 gap-3', colClass)}>
      {stats.map((s) => (
        <SummaryStat
          key={s.label}
          size="sm"
          label={s.label}
          value={s.value}
          hint={s.hint}
          tone={s.tone}
        />
      ))}
    </div>
  )
}

export function ReportPanel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] text-white"><Icon className="h-4 w-4" /></span>}
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function sumBy<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((acc, r) => acc + pick(r), 0)
}

export function pct(part: number, whole: number) {
  if (!whole) return '0%'
  return `${((part / whole) * 100).toFixed(1)}%`
}
