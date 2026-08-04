'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { History } from 'lucide-react'

interface StatusEvent {
  id: string
  from_status: string
  to_status: string
  note: string
  changed_by: string
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface InvoiceStatusTrackerProps {
  invoiceId: string
  currentStatus: string
  onUpdated?: (status: string) => void
}

export default function InvoiceStatusTracker({ invoiceId, currentStatus, onUpdated }: InvoiceStatusTrackerProps) {
  const [history, setHistory] = useState<StatusEvent[]>([])
  const [status, setStatus] = useState(currentStatus)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(currentStatus)
  }, [currentStatus])

  const loadHistory = async () => {
    const res = await apiFetch(`/invoices/${invoiceId}/status-history`)
    if (res.ok) setHistory(await res.json())
  }

  useEffect(() => {
    if (invoiceId) loadHistory()
  }, [invoiceId])

  const updateStatus = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      })
      if (res.ok) {
        const inv = await res.json()
        notifySuccess('Status updated')
        setNote('')
        onUpdated?.(inv.status)
        await loadHistory()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Failed to update status')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 font-medium text-gray-900">
        <History className="h-4 w-4" />
        Status tracking
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Update status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Reason for status change…" />
        </div>
      </div>
      <Button type="button" size="sm" onClick={updateStatus} disabled={saving}>
        {saving ? 'Saving…' : 'Save status'}
      </Button>

      {history.length > 0 && (
        <ol className="relative space-y-4 border-l border-gray-200 pl-4">
          {history.map((ev) => (
            <li key={ev.id} className="text-sm">
              <p className="font-medium text-gray-900">
                {(ev.from_status || '—').toUpperCase()} → {ev.to_status.toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(ev.created_at)} · {ev.changed_by || 'user'}
              </p>
              {ev.note && <p className="mt-1 text-gray-600">{ev.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
