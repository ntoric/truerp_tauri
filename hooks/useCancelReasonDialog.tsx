'use client'

import * as React from 'react'
import { CancelReasonDialog } from '@/components/ui/cancel-reason-dialog'

export type CancelReasonOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
}

type PendingCancel = CancelReasonOptions & {
  resolve: (value: string | null) => void
}

/**
 * Promise-based cancellation dialog that collects a mandatory reason.
 * Resolves with the trimmed reason, or null when dismissed.
 *
 * Usage:
 *   const { requestCancelReason, cancelReasonDialog } = useCancelReasonDialog()
 *   const reason = await requestCancelReason({ title: 'Cancel invoice?' })
 *   if (!reason) return
 *   // …call the cancel endpoint with reason
 *   return (<>…{cancelReasonDialog}</>)
 */
export function useCancelReasonDialog() {
  const [pending, setPending] = React.useState<PendingCancel | null>(null)

  const requestCancelReason = React.useCallback((options: CancelReasonOptions) => {
    return new Promise<string | null>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const close = React.useCallback((result: string | null) => {
    setPending((current) => {
      current?.resolve(result)
      return null
    })
  }, [])

  const cancelReasonDialog = (
    <CancelReasonDialog
      open={pending != null}
      onOpenChange={(open) => {
        if (!open) close(null)
      }}
      title={pending?.title ?? ''}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      onConfirm={(reason) => close(reason)}
    />
  )

  return { requestCancelReason, cancelReasonDialog }
}
