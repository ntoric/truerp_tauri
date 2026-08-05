'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Loader2, Send, Trash2, Pencil } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface Party {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  gstin: string
}

interface PurchaseBill {
  id: string
  bill_number: string
  bill_date: string
  total_amount: number
  status: string
}

interface DebitNoteItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  reason: string
}

interface DebitNote {
  id: string
  debit_note_number: string
  party: Party
  purchase_bill: PurchaseBill
  status: string
  date: string
  total_amount: number
  reason: string
  refund_mode: string
  items: DebitNoteItem[]
}

export default function DebitNoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchDebitNote()
    }
  }, [params.id])

  const fetchDebitNote = async () => {
    try {
      const res = await apiFetch(`/debit-notes/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setDebitNote(data)
      } else {
        notifyError('Failed to fetch debit note')
        router.push('/debit-notes')
      }
    } catch (err) {
      console.error(err)
      router.push('/debit-notes')
    } finally {
      setLoading(false)
    }
  }

  const handleIssue = async () => {
    if (!(await confirm({
      title: 'Issue debit note?',
      description: 'Are you sure you want to issue this debit note? This will update the linked purchase bill.',
      confirmLabel: 'Issue',
      variant: 'default',
    }))) return
    setIssuing(true)
    try {
      const res = await apiFetch(`/debit-notes/${params.id}/issue`, { method: 'POST' })
      if (res.ok) {
        fetchDebitNote()
      } else {
        notifyError('Failed to issue debit note')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setIssuing(false)
    }
  }

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete debit note?',
      description: 'Are you sure you want to delete this debit note? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/debit-notes/${params.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/debit-notes')
      } else {
        notifyError('Failed to delete debit note')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      issued: 'bg-green-100 text-green-700',
    }
    return <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>{status}</span>
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!debitNote) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Debit note not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/debit-notes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{debitNote.debit_note_number}</h1>
              <p className="text-sm text-gray-500">Debit Note</p>
            </div>
          </div>
          <div className="flex gap-2">
            {debitNote.status === 'draft' && (
              <>
                <Button variant="outline" onClick={() => router.push(`/debit-notes/${debitNote.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
                <Button onClick={handleIssue} disabled={issuing}>
                  {issuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Issue Debit Note
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Debit Note Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">{getStatusBadge(debitNote.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{new Date(debitNote.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Refund Mode</p>
                  <p className="font-medium capitalize">{debitNote.refund_mode}</p>
                </div>
              </div>
              {debitNote.reason && (
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="font-medium">{debitNote.reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{debitNote.party?.name}</p>
              </div>
              {debitNote.party?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{debitNote.party.phone}</p>
                </div>
              )}
              {debitNote.party?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{debitNote.party.email}</p>
                </div>
              )}
              {debitNote.party?.gstin && (
                <div>
                  <p className="text-sm text-gray-500">GSTIN</p>
                  <p className="font-medium">{debitNote.party.gstin}</p>
                </div>
              )}
              {debitNote.party?.address && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{debitNote.party.address}, {debitNote.party.city}, {debitNote.party.state}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Linked Purchase Bill</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Bill Number</p>
                <p className="font-medium">{debitNote.purchase_bill?.bill_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bill Date</p>
                <p className="font-medium">{debitNote.purchase_bill?.bill_date ? new Date(debitNote.purchase_bill.bill_date).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bill Amount</p>
                <p className="font-medium">{debitNote.purchase_bill ? formatCurrency(debitNote.purchase_bill.total_amount) : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debitNote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{item.tax_rate}%</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                    <TableCell>{item.reason || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Debit Amount:</span>
                  <span>{formatCurrency(debitNote.total_amount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
