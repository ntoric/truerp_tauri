import * as React from 'react'
import { cn } from '@/lib/utils'

/*
  Gooseroot avatar (gooseroot-ui .gr-avatar): initials on a circle.
  brand — Red → Crimson button gradient (default)
  wine  — Deep Wine strong neutral
  tint  — soft accent wash with strong accent text
*/
export type BrandAvatarTone = 'brand' | 'wine' | 'tint'
export type BrandAvatarSize = 'sm' | 'md' | 'lg'

const TONES: Record<BrandAvatarTone, string> = {
  brand: 'bg-button-gradient text-primary-foreground',
  wine: 'bg-[hsl(var(--theme-900))] text-white dark:bg-[#fff4f4] dark:text-[#161314]',
  tint: 'bg-tint text-[hsl(var(--theme-700))] dark:text-[hsl(var(--theme-300))]',
}

const SIZES: Record<BrandAvatarSize, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-14 w-14 text-lg',
}

/** Up to two initials: first + last word, ignoring punctuation ("M/s. Sri Ram Traders" → "ST"). */
export function initialsFor(name?: string | null): string {
  const words = (name || '')
    .replace(/^(m\/s\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '')
    .split(/[\s\-_.,&/]+/)
    .map((w) => w.replace(/[^A-Za-z0-9\u00C0-\uFFFF]/g, ''))  // keep letters incl. Indic scripts
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : words[0][1] ?? ''
  return (first + last).toUpperCase()
}

export interface BrandAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string | null
  tone?: BrandAvatarTone
  size?: BrandAvatarSize
}

export function BrandAvatar({ name, tone = 'brand', size = 'md', className, ...props }: BrandAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold leading-none tracking-[0.02em]',
        TONES[tone],
        SIZES[size],
        className
      )}
      {...props}
    >
      {initialsFor(name)}
    </span>
  )
}
