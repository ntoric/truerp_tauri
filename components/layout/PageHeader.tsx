'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: ReactNode
  /** @deprecated Subheader bar no longer shows descriptions. Kept for call-site compatibility. */
  description?: ReactNode
  /** Prefer Link-based back for soft client navigation. */
  backHref?: string
  onBack?: () => void
  /** Custom leading control (overrides backHref/onBack when provided). */
  leading?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Sticky page toolbar under the app header — keeps titles and primary actions
 * (Create, Edit, filters) visible while scrolling.
 */
export default function PageHeader({
  title,
  backHref,
  onBack,
  leading,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const backButton = leading !== undefined ? (
    leading
  ) : backHref ? (
    <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Back">
      <Link href={backHref}>
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  ) : onBack ? (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0"
      title="Back"
      onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  ) : null

  return (
    <div
      className={cn(
        'app-page-subheader page-header',
        className
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          {backButton}
          <h1 className="app-page-title min-w-0 truncate">{title}</h1>
        </div>
        {actions ? (
          <div className="flex min-w-0 flex-1 basis-[10rem] justify-end sm:basis-[14rem]">
            <PageHeaderActions>{actions}</PageHeaderActions>
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-1.5 w-full basis-full">{children}</div> : null}
    </div>
  )
}
