'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export const STORE_RESET_SCOPES = [
  {
    id: 'sales',
    label: 'Sales',
    description: 'Invoices, payments in, sales returns, credit notes, delivery challans',
  },
  {
    id: 'purchases',
    label: 'Purchases',
    description: 'Purchase orders, bills, receipts, returns, debit notes, payment outs',
  },
  {
    id: 'products',
    label: 'Products & inventory',
    description: 'Products, categories, stock, warehouses, transfers',
  },
  {
    id: 'parties',
    label: 'Parties',
    description: 'Customers and suppliers',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    description: 'Expense records and categories',
  },
  {
    id: 'accounting',
    label: 'Accounting',
    description: 'Chart of accounts, journals, ledger, bank accounts, cash transactions',
  },
  {
    id: 'pos',
    label: 'POS',
    description: 'POS sessions, drafts, and cash movements',
  },
  {
    id: 'staff',
    label: 'Staff & payroll',
    description: 'Staff records, attendance, payroll, advances, deductions',
  },
  {
    id: 'gst',
    label: 'GST & tax',
    description: 'Tax periods, ITC, GST filing data',
  },
  {
    id: 'settings',
    label: 'Settings & notifications',
    description: 'Print settings, reminders, loyalty, portal access, media, drafts',
  },
  {
    id: 'audit',
    label: 'Audit logs',
    description: 'Activity and audit history for this store',
  },
] as const

export type StoreResetScopeId = (typeof STORE_RESET_SCOPES)[number]['id']

type StoreResetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeName: string
  storeCode: string
  loading?: boolean
  onConfirm: (scopes: StoreResetScopeId[]) => void | Promise<void>
}

export function StoreResetDialog({
  open,
  onOpenChange,
  storeName,
  storeCode,
  loading = false,
  onConfirm,
}: StoreResetDialogProps) {
  const allScopeIds = useMemo(() => STORE_RESET_SCOPES.map((scope) => scope.id), [])
  const [selectedScopes, setSelectedScopes] = useState<StoreResetScopeId[]>([])
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelectedScopes([])
      setConfirmText('')
      setSubmitting(false)
    }
  }, [open])

  const allSelected = selectedScopes.length === allScopeIds.length
  const noneSelected = selectedScopes.length === 0
  const matchOk = confirmText === storeCode
  const busy = loading || submitting

  const toggleScope = (scopeId: StoreResetScopeId, checked: boolean) => {
    setSelectedScopes((current) => {
      if (checked) {
        return current.includes(scopeId) ? current : [...current, scopeId]
      }
      return current.filter((id) => id !== scopeId)
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelectedScopes(checked ? [...allScopeIds] : [])
  }

  const handleConfirm = async () => {
    if (noneSelected || !matchOk || busy) return
    try {
      setSubmitting(true)
      await onConfirm(selectedScopes)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Reset store &quot;{storeName}&quot;</DialogTitle>
          <DialogDescription>
            Choose what to permanently delete for this store. Users and the business profile are
            always kept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Select all</p>
              <p className="text-xs text-muted-foreground">Reset every category below</p>
            </div>
            <Checkbox
              checked={allSelected}
              onCheckedChange={(value) => toggleAll(value === true)}
              disabled={busy}
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
            {STORE_RESET_SCOPES.map((scope) => {
              const checked = selectedScopes.includes(scope.id)
              return (
                <label
                  key={scope.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleScope(scope.id, value === true)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{scope.label}</span>
                    <span className="block text-xs text-muted-foreground">{scope.description}</span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-reset-confirm">
              Type <span className="font-semibold text-foreground">{storeCode}</span> to confirm
            </Label>
            <Input
              id="store-reset-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={busy || noneSelected || !matchOk}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting…
              </>
            ) : (
              'Reset selected'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
