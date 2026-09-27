'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAYMENT_METHODS } from '@/lib/paymentSplits'
import { formatCurrency } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Loader2 } from 'lucide-react'

export interface ConvertibleEstimate {
  id: string
  quotation_number: string
  total_amount: number
}

export default function EstimateConvertDialog({
  estimate,
  open,
  onClose,
  onConverted,
}: {
  estimate: ConvertibleEstimate | null
  open: boolean
  onClose: () => void
  onConverted?: (invoice: { id: string; invoice_number: string }) => void
}) {
  const [paymentMode, setPaymentMode] = useState('cash')
  const [amountPaid, setAmountPaid] = useState(0)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    if (open && estimate) {
      setPaymentMode('cash')
      setAmountPaid(estimate.total_amount || 0)
    }
  }, [open, estimate])

  const handleConvert = async () => {
    if (!estimate) return
    setConverting(true)
    try {
      const res = await apiFetch(`/quotations/${estimate.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          payment_mode: paymentMode,
          amount_paid: Number(amountPaid) || 0,
        }),
      })
      if (res.ok) {
        const invoice = await res.json()
        notifySuccess(`Converted to invoice ${invoice.invoice_number || ''}`)
        onConverted?.(invoice)
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to convert estimate')
      }
    } catch {
      notifyError('Failed to convert estimate')
    } finally {
      setConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Estimate to Sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            Estimate <span className="font-medium">{estimate?.quotation_number}</span> will be added
            to Sales Invoices for {formatCurrency(estimate?.total_amount || 0)}.
          </p>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Amount Received</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to record the invoice as unpaid.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={converting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConvert} disabled={converting || !estimate}>
            {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Convert to Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
