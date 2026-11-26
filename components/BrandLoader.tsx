'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

/** Leaf cut-out where the two Lens rings overlap (from gooseroot-ui). */
const LENS_LEAF =
  'M225.0 -181.37254478007415 A289 289 0 0 1 225.0 181.37254478007415 A289 289 0 0 1 225.0 -181.37254478007415 Z'

type BrandLoaderProps = {
  /** Width in px; height follows the Lens aspect ratio (0.58). */
  size?: number
  className?: string
  label?: string
}

/**
 * Gooseroot Lens loader (gooseroot-ui `.gr-lens`), tinted with the user's accent
 * theme ramp. Animation styles live in app/globals.css under `.gr-lens`.
 */
export default function BrandLoader({ size = 56, className, label = 'Loading' }: BrandLoaderProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gradId = `lens-g-${uid}`
  const maskId = `lens-m-${uid}`

  return (
    <svg
      className={cn('gr-lens', className)}
      style={{ width: size, height: size * 0.58 }}
      viewBox="-309 -309 1068 618"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="-309" y1="0" x2="759" y2="0">
          <stop offset="0" style={{ stopColor: 'hsl(var(--theme-500))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--theme-700))' }} />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-500" y="-500" width="1500" height="1000">
          <rect x="-500" y="-500" width="1500" height="1000" fill="#fff" />
          <path className="leaf" d={LENS_LEAF} fill="#000" stroke="#000" strokeWidth={44} strokeLinejoin="round" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} stroke={`url(#${gradId})`}>
        <g className="ga">
          <path className="ra" pathLength={100} d="M0 -208.5 A208.5 208.5 0 1 1 0 208.5 A208.5 208.5 0 1 1 0 -208.5" />
        </g>
        <g className="gb">
          <path className="rb" pathLength={100} d="M450 208.5 A208.5 208.5 0 1 1 450 -208.5 A208.5 208.5 0 1 1 450 208.5" />
        </g>
      </g>
    </svg>
  )
}
