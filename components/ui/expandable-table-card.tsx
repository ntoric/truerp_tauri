'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ExpandableTableCardProps = {
  title: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

export default function ExpandableTableCard({
  title,
  description,
  headerActions,
  className,
  contentClassName,
  children,
}: ExpandableTableCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!expanded) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  const expandButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={() => setExpanded((prev) => !prev)}
      aria-label={expanded ? 'Exit fullscreen table' : 'Enlarge table'}
      title={expanded ? 'Exit fullscreen' : 'Enlarge table'}
    >
      {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  )

  const card = (
    <Card
      className={cn(
        className,
        expanded &&
          'expandable-table-card-expanded flex h-full max-h-full w-full max-w-none flex-col rounded-none border-0 shadow-none'
      )}
    >
      <CardHeader className={cn('shrink-0', expanded && 'border-b bg-white px-4 py-3 sm:px-6')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {typeof title === 'string' ? <CardTitle>{title}</CardTitle> : title}
            {description}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {headerActions}
            {expandButton}
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          expanded &&
            'flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-6 [&_.table-scroll]:min-h-0',
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  )

  if (expanded && mounted) {
    return createPortal(
      <div className="fixed inset-x-0 top-0 bottom-[var(--app-bottom-nav-offset)] z-[80] bg-white">
        {card}
      </div>,
      document.body
    )
  }

  return card
}
