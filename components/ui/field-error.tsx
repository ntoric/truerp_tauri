'use client'

import { cn } from '@/lib/utils'

export function FieldError({
  message,
  className,
}: {
  message?: string | null
  className?: string
}) {
  if (!message) return null
  return (
    <p className={cn('text-sm text-red-600', className)} role="alert">
      {message}
    </p>
  )
}
