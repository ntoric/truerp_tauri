import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const CARD =
  'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

/** Content-area skeleton shown while a route segment loads (sidebar/header stay put). */
export default function PageSkeleton({
  variant = 'page',
  className,
}: {
  variant?: 'page' | 'form' | 'table' | 'dashboard'
  className?: string
}) {
  if (variant === 'form') {
    return (
      <div className={cn('mx-auto max-w-3xl space-y-4', className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <div className={cn('space-y-3 p-4', CARD)}>
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} delayMs={i * 70} className="h-9 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton delayMs={300} className="h-24 w-full rounded-lg" />
        </div>
        <div className={cn('space-y-3 p-4', CARD)}>
          <Skeleton delayMs={360} className="h-4 w-40" />
          <Skeleton delayMs={420} className="h-9 w-full rounded-lg" />
          <Skeleton delayMs={480} className="h-9 w-full max-w-md rounded-lg" />
        </div>
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton delayMs={60} className="h-8 w-32 rounded-lg" />
          <Skeleton delayMs={120} className="h-8 w-24 rounded-lg" />
        </div>
        <div className={cn('overflow-hidden', CARD)}>
          <div className="border-b border-slate-200/70 bg-slate-50/60 px-3 py-2.5">
            <div className="flex gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-slate-100 px-3 py-3 last:border-0"
            >
              <Skeleton delayMs={i * 60} className="h-3.5 w-28" />
              <Skeleton delayMs={i * 60 + 20} className="h-3.5 w-36" />
              <Skeleton delayMs={i * 60 + 40} className="h-3.5 w-20" />
              <Skeleton delayMs={i * 60 + 60} className="h-3.5 w-24" />
              <Skeleton delayMs={i * 60 + 80} className="ml-auto h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        {/* Hero + receivables */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-[linear-gradient(135deg,hsl(var(--theme-200)/0.45),hsl(var(--theme-50)))] p-6 lg:col-span-2 dark:border-white/10 dark:bg-[linear-gradient(135deg,hsl(var(--theme-500)/0.14),hsl(var(--theme-500)/0.05))]">
            <div className="space-y-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton delayMs={60} className="h-3.5 w-28" />
              <Skeleton delayMs={140} className="mt-6 h-3 w-24" />
              <Skeleton delayMs={200} className="h-10 w-56" />
              <div className="mt-3 flex gap-2">
                <Skeleton delayMs={280} className="h-7 w-24 rounded-full" />
                <Skeleton delayMs={340} className="h-7 w-28 rounded-full" />
                <Skeleton delayMs={400} className="h-7 w-24 rounded-full" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-200/60 pt-4 sm:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} delayMs={460 + i * 50} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
          <div className={cn('flex flex-col gap-3 p-5', CARD)}>
            <Skeleton className="h-4 w-32" />
            <Skeleton delayMs={60} className="h-9 w-28" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton delayMs={140} className="h-16 w-full rounded-xl" />
              <Skeleton delayMs={200} className="h-16 w-full rounded-xl" />
            </div>
            <Skeleton delayMs={260} className="h-2.5 w-full rounded-full" />
            <Skeleton delayMs={320} className="mt-auto h-9 w-full rounded-lg" />
          </div>
        </div>
        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn('flex flex-col gap-3 p-4', CARD)}>
              <div className="flex items-center justify-between">
                <Skeleton delayMs={i * 80} className="h-8 w-8 rounded-lg" />
                <Skeleton delayMs={i * 80 + 30} className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton delayMs={i * 80 + 60} className="h-3.5 w-24" />
              <Skeleton delayMs={i * 80 + 90} className="h-7 w-32" />
              <Skeleton delayMs={i * 80 + 120} className="mt-auto h-8 w-full" />
            </div>
          ))}
        </div>
        {/* Trend + donut */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn('flex flex-col gap-4 p-5 lg:col-span-2', CARD)}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton delayMs={60} className="h-3 w-24" />
            </div>
            <div className="flex h-56 items-end gap-2">
              {[42, 65, 38, 78, 55, 90, 62, 70, 48, 84, 58, 74].map((h, i) => (
                <Skeleton
                  key={i}
                  delayMs={i * 45}
                  className="w-full rounded-t-lg"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className={cn('flex flex-col items-center gap-4 p-5', CARD)}>
            <Skeleton className="h-4 w-28 self-start" />
            <div className="relative my-auto">
              <Skeleton delayMs={120} className="h-40 w-40 rounded-full" />
              <div className="absolute inset-0 m-auto h-20 w-20 rounded-full bg-white" />
            </div>
            <div className="flex w-full flex-col gap-2">
              <Skeleton delayMs={200} className="h-3 w-full" />
              <Skeleton delayMs={260} className="h-3 w-4/5" />
            </div>
          </div>
        </div>
        {/* Bottom panels */}
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn('flex flex-col gap-3 p-5', CARD)}>
              <div className="flex items-center justify-between">
                <Skeleton delayMs={i * 80} className="h-4 w-28" />
                <Skeleton delayMs={i * 80 + 40} className="h-4 w-16" />
              </div>
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton delayMs={i * 80 + j * 50} className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton delayMs={i * 80 + j * 50 + 20} className="h-3 w-3/4" />
                    <Skeleton delayMs={i * 80 + j * 50 + 40} className="h-2.5 w-1/2" />
                  </div>
                  <Skeleton delayMs={i * 80 + j * 50 + 60} className="h-3.5 w-12" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn('space-y-3 p-4', CARD)}>
            <div className="flex items-center gap-2.5">
              <Skeleton delayMs={i * 90} className="h-8 w-8 rounded-lg" />
              <Skeleton delayMs={i * 90 + 30} className="h-4 w-24" />
            </div>
            <Skeleton delayMs={i * 90 + 60} className="h-8 w-full" />
            <Skeleton delayMs={i * 90 + 90} className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className={cn('space-y-3 p-4', CARD)}>
        <Skeleton className="h-4 w-36" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} delayMs={i * 60} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

/** Convenience alias used by form/create pages. */
export function FormPageSkeleton(props: { className?: string }) {
  return <PageSkeleton variant="form" className={props.className} />
}

export function TablePageSkeleton(props: { className?: string }) {
  return <PageSkeleton variant="table" className={props.className} />
}

export function DashboardPageSkeleton(props: { className?: string }) {
  return <PageSkeleton variant="dashboard" className={props.className} />
}
