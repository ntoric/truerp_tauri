'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type CancelReasonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: (reason: string) => void | Promise<void>
}

/**
 * Confirmation dialog that requires a cancellation reason before the
 * confirm button enables. Used wherever a document is cancelled instead of
 * deleted — the reason is stored on the record for audit.
 */
export function CancelReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Cancel document',
  cancelLabel = 'Back',
  loading = false,
  onConfirm,
}: CancelReasonDialogProps) {
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setReason('')
      setSubmitting(false)
    }
  }, [open])

  const busy = loading || submitting
  const reasonOk = reason.trim().length > 0

  const handleConfirm = async () => {
    if (!reasonOk || busy) return
    try {
      setSubmitting(true)
      await onConfirm(reason.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            typeof description === 'string' ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <div className="text-sm text-muted-foreground">{description}</div>
            )
          ) : null}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason-input">
            Reason for cancellation <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="cancel-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate entry, wrong amount…"
            autoComplete="off"
            disabled={busy}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={busy || !reasonOk}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
