'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Edit, Trash2, MoreVertical, Eye, CheckCircle } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface Party {
  name: string
}

interface PurchaseOrder {
  id: string
  order_number: string
  party?: Party
  vendor?: Party
  status: string
  order_date: string
  total_amount: number
}

interface PurchaseReceipt {
  id: string
  receipt_number: string
  party?: Party
  vendor?: Party
  status: string
  receipt_date: string
  total_amount: number
}

interface PurchaseBill {
  id: string
  bill_number: string
  party?: Party
  vendor?: Party
  status: string
  bill_date: string
  total_amount: number
  balance_due: number
}

export default function PurchasesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [bills, setBills] = useState<PurchaseBill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!authLoading && user) fetchData() }, [authLoading, user])

  const ordersPagination = usePagination(orders)
  const receiptsPagination = usePagination(receipts)
  const billsPagination = usePagination(bills)

  const fetchData = async () => {
    try {
      const [o, r, b] = await Promise.all([
        apiFetch('/purchase/orders'),
        apiFetch('/purchase/receipts'),
        apiFetch('/purchase/bills')
      ])
      if (o.ok) { const d = await o.json(); setOrders(d.data || d) }
      if (r.ok) { const d = await r.json(); setReceipts(d.data || d) }
      if (b.ok) setBills(await b.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  const getVendorName = (item: { party?: Party; vendor?: Party }) =>
    item.party?.name || item.vendor?.name || 'N/A'

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', unpaid: 'bg-orange-100 text-orange-700', paid: 'bg-green-100 text-green-700' }
    return <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>{status}</span>
  }

  const handleDeleteOrder = async (id: string) => {
    if (!(await confirm({
      title: 'Delete purchase order?',
      description: 'Are you sure you want to delete this purchase order? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/purchase/orders/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to delete purchase order')
      }
    } catch {
      notifyError('An error occurred')
    }
  }

  const handleSubmitOrder = async (id: string) => {
    try {
      const res = await apiFetch(`/purchase/orders/${id}/submit`, { method: 'POST' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to submit purchase order')
      }
    } catch {
      notifyError('An error occurred')
    }
  }

  const handleSubmitReceipt = async (id: string) => {
    try {
      const res = await apiFetch(`/purchase/receipts/${id}/submit`, { method: 'POST' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to submit receipt')
      }
    } catch {
      notifyError('An error occurred')
    }
  }

  const handleDeleteBill = async (id: string) => {
    if (!(await confirm({
      title: 'Delete bill?',
      description: 'Are you sure you want to delete this bill? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/purchase/bills/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to delete bill')
      }
    } catch {
      notifyError('An error occurred')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Purchases</h1>
          <Button><Plus className="mr-2 h-4 w-4" /> New Purchase Order</Button>
        </div>

        <Tabs defaultValue="orders">
          <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="receipts">Receipts (GRN)</TabsTrigger><TabsTrigger value="bills">Bills</TabsTrigger></TabsList>
          
          <TabsContent value="orders">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ordersPagination.paginatedItems.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.order_number}</TableCell>
                      <TableCell>{getVendorName(o)}</TableCell>
                      <TableCell>{new Date(o.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(o.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(o.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/purchase-orders/${o.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {o.status === 'draft' && (
                              <>
                                <DropdownMenuItem onClick={() => router.push(`/purchase-orders/${o.id}/edit`)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSubmitOrder(o.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Submit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteOrder(o.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No orders</TableCell></TableRow>}
                </TableBody>
              </Table>
              <PaginationControls
                page={ordersPagination.page}
                totalPages={ordersPagination.totalPages}
                totalItems={ordersPagination.totalItems}
                pageSize={ordersPagination.pageSize}
                onPageChange={ordersPagination.setPage}
              />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="receipts">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Receipt #</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {receiptsPagination.paginatedItems.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.receipt_number}</TableCell>
                      <TableCell>{getVendorName(r)}</TableCell>
                      <TableCell>{new Date(r.receipt_date).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        {r.status === 'draft' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleSubmitReceipt(r.id)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Submit
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {receipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No receipts</TableCell></TableRow>}
                </TableBody>
              </Table>
              <PaginationControls
                page={receiptsPagination.page}
                totalPages={receiptsPagination.totalPages}
                totalItems={receiptsPagination.totalItems}
                pageSize={receiptsPagination.pageSize}
                onPageChange={receiptsPagination.setPage}
              />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="bills">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Bill #</TableHead><TableHead>Vendor</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {billsPagination.paginatedItems.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.bill_number}</TableCell>
                      <TableCell>{getVendorName(b)}</TableCell>
                      <TableCell>{new Date(b.bill_date).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(b.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.total_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.balance_due)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/purchase-invoices/view?id=${b.id}`} className="flex items-center">
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/purchase-invoices/create?id=${b.id}`} className="flex items-center">
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteBill(b.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bills.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No bills</TableCell></TableRow>}
                </TableBody>
              </Table>
              <PaginationControls
                page={billsPagination.page}
                totalPages={billsPagination.totalPages}
                totalItems={billsPagination.totalItems}
                pageSize={billsPagination.pageSize}
                onPageChange={billsPagination.setPage}
              />
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
