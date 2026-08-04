'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

interface Party {
  id: string
  name: string
}

interface PurchaseOrder {
  id: string
  order_number: string
  party: Party
  status: string
  order_date: string
  expected_date?: string
  total_amount: number
}

export default function PurchaseOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!authLoading && user) fetchData() }, [authLoading, user])

  const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(orders)

  const fetchData = async () => {
    try {
      const res = await apiFetch('/purchase/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.data || data)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      submitted: 'bg-blue-100 text-blue-700',
      received: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    return <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>{status}</span>
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) return
    try {
      const res = await apiFetch(`/purchase/orders/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to delete purchase order')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <Button onClick={() => router.push('/purchase-orders/create')}>
            <Plus className="mr-2 h-4 w-4" /> New Purchase Order
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.party?.name}</TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                    <TableCell>{order.expected_date ? new Date(order.expected_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/purchase-orders/${order.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === 'draft' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/purchase-orders/${order.id}/edit`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(order.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">No purchase orders found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
