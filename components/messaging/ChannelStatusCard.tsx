'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

/** "Channel connected / not connected" banner with a button to that channel's tab. */
export default function ChannelStatusCard({
  ok,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  ok: boolean
  title: string
  hint: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {ok ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
