'use client'

import * as React from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  confirmText?: string
  confirmTextLabel?: string
}

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void
}

/**
 * Promise-based confirmation dialog that replaces browser `confirm()`.
 *
 * Usage:
 *   const { confirm, confirmDialog } = useConfirmDialog()
 *   if (!(await confirm({ title: 'Delete?', description: '…' }))) return
 *   // …perform delete
 *   return (<>…{confirmDialog}</>)
 */
export function useConfirmDialog() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const close = React.useCallback((result: boolean) => {
    setPending((current) => {
      current?.resolve(result)
      return null
    })
  }, [])

  const confirmDialog = (
    <ConfirmDialog
      open={pending != null}
      onOpenChange={(open) => {
        if (!open) close(false)
      }}
      title={pending?.title ?? ''}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      variant={pending?.variant}
      confirmText={pending?.confirmText}
      confirmTextLabel={pending?.confirmTextLabel}
      onConfirm={() => close(true)}
    />
  )

  return { confirm, confirmDialog }
}
