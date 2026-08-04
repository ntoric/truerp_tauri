import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        <div
          key={s.label}
          className={cn(
            'rounded-lg border p-3',
            s.tone === 'success' && 'border-green-200 bg-green-50/50',
            s.tone === 'warning' && 'border-amber-200 bg-amber-50/50',
            s.tone === 'danger' && 'border-red-200 bg-red-50/50',
            (!s.tone || s.tone === 'default') && 'bg-muted/30'
          )}
        >
          <p className="text-xs font-medium text-gray-500">{s.label}</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{s.value}</p>
          {s.hint && <p className="mt-0.5 text-xs text-gray-500">{s.hint}</p>}
        </div>
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
            {Icon && <Icon className="h-5 w-5 text-blue-600" />}
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
