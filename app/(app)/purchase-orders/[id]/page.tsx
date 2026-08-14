'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
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

interface PurchaseOrderItem {
  id: string
  description: string
  quantity: number
  received_qty: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total: number
}

interface PurchaseOrder {
  id: string
  order_number: string
  party: Party
  status: string
  order_date: string
  expected_date?: string
  sub_total: number
  tax_total: number
  total_amount: number
  notes: string
  terms: string
  items: PurchaseOrderItem[]
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchOrder()
    }
  }, [params.id])

  const fetchOrder = async () => {
    try {
      const res = await apiFetch(`/purchase/orders/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data)
      } else {
        notifyError('Failed to fetch purchase order')
        router.push('/purchase-orders')
      }
    } catch (err) {
      console.error(err)
      router.push('/purchase-orders')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!(await confirm({
      title: 'Submit purchase order?',
      description: 'Are you sure you want to submit this purchase order?',
      confirmLabel: 'Submit',
      variant: 'default',
    }))) return
    setSubmitting(true)
    try {
      const res = await apiFetch(`/purchase/orders/${params.id}/submit`, { method: 'POST' })
      if (res.ok) {
        fetchOrder()
      } else {
        notifyError('Failed to submit purchase order')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Delete purchase order?',
      description: 'Are you sure you want to delete this purchase order? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/purchase/orders/${params.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/purchase-orders')
      } else {
        notifyError('Failed to delete purchase order')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      submitted: 'bg-blue-100 text-blue-700',
      received: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    return <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>{status}</span>
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-gray-500">Purchase order not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/purchase-orders')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="app-page-title">{order.order_number}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            {order.status === 'draft' && (
              <>
                <Button variant="outline" onClick={() => router.push(`/purchase-orders/${order.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit Order
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">{getStatusBadge(order.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-medium">{new Date(order.order_date).toLocaleDateString()}</p>
                </div>
                {order.expected_date && (
                  <div>
                    <p className="text-sm text-gray-500">Expected Date</p>
                    <p className="font-medium">{new Date(order.expected_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              {order.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{order.notes}</p>
                </div>
              )}
              {order.terms && (
                <div>
                  <p className="text-sm text-gray-500">Terms & Conditions</p>
                  <p className="font-medium">{order.terms}</p>
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
                <p className="font-medium">{order.party?.name}</p>
              </div>
              {order.party?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{order.party.phone}</p>
                </div>
              )}
              {order.party?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{order.party.email}</p>
                </div>
              )}
              {order.party?.gstin && (
                <div>
                  <p className="text-sm text-gray-500">GSTIN</p>
                  <p className="font-medium">{order.party.gstin}</p>
                </div>
              )}
              {order.party?.address && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{order.party.address}, {order.party.city}, {order.party.state}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Tax Amount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.received_qty || 0}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right">{item.tax_rate}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.tax_amount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub Total:</span>
                  <span className="font-medium">{formatCurrency(order.sub_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax Total:</span>
                  <span className="font-medium">{formatCurrency(order.tax_total)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
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
