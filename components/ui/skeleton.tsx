import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Staggers the shimmer sweep (ms) so grouped blocks light up in sequence. */
  delayMs?: number
  /** Use on dark surfaces (sidebar, hero cards) for a lighter sheen. */
  dark?: boolean
}

function Skeleton({ className, delayMs, dark, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton rounded-md', dark && 'skeleton-dark', className)}
      style={{
        ...(delayMs
          ? ({ '--skeleton-delay': `${delayMs}ms` } as CSSProperties)
          : undefined),
        ...style,
      }}
      {...props}
    />
  )
}

export { Skeleton }
