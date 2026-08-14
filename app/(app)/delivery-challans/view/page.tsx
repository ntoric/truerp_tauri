'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton, { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Pencil } from 'lucide-react'

interface DeliveryChallanItem {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  batch_no: string
}

interface DeliveryChallan {
  id: string
  challan_number: string
  party?: { name: string; address?: string; city?: string; state?: string; gstin?: string }
  invoice?: { invoice_number: string }
  date: string
  due_date?: string
  status: string
  sub_total: number
  total_quantity: number
  notes: string
  terms: string
  vehicle_number: string
  transport_mode: string
  items: DeliveryChallanItem[]
}

function DeliveryChallanViewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [challan, setChallan] = useState<DeliveryChallan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchChallan()
  }, [id])

  const fetchChallan = async () => {
    try {
      const res = await apiFetch(`/delivery-challans/${id}`)
      if (res.ok) setChallan(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!challan) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Delivery challan not found</p>
          <Link href="/delivery-challans">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Delivery Challans
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      delivered: 'bg-green-100 text-green-700',
      draft: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${variants[status] || variants.draft}`}>
        {status.toUpperCase()}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/delivery-challans">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          {challan.status === 'draft' && (
            <Link href={`/delivery-challans/create?id=${challan.id}`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            </Link>
          )}
        </div>

        <Card className="border-2">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="app-page-title">DELIVERY CHALLAN</h1>
                <p className="text-gray-500 mt-1">{challan.challan_number}</p>
              </div>
              <div className="text-right">
                {getStatusBadge(challan.status)}
                <p className="text-sm text-gray-500 mt-2">Date: {formatDate(challan.date)}</p>
                {challan.due_date && (
                  <p className="text-sm text-gray-500">Due: {formatDate(challan.due_date)}</p>
                )}
                {challan.invoice?.invoice_number && (
                  <p className="text-sm text-gray-500">Invoice: {challan.invoice.invoice_number}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 border-b pb-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Party</p>
                <p className="font-bold text-gray-900">{challan.party?.name || 'N/A'}</p>
                {challan.party?.address && (
                  <p className="text-sm text-gray-600">{challan.party.address}</p>
                )}
                <p className="text-sm text-gray-600">
                  {challan.party?.city}
                  {challan.party?.city && challan.party?.state ? ', ' : ''}
                  {challan.party?.state}
                </p>
                {challan.party?.gstin && (
                  <p className="text-sm text-gray-600 mt-1">GSTIN: {challan.party.gstin}</p>
                )}
              </div>
              <div>
                {(challan.vehicle_number || challan.transport_mode) && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-500 mb-1">Transport</p>
                    {challan.transport_mode && (
                      <p className="text-sm text-gray-900 capitalize">{challan.transport_mode}</p>
                    )}
                    {challan.vehicle_number && (
                      <p className="text-sm text-gray-600">Vehicle: {challan.vehicle_number}</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Total Quantity</p>
                  <p className="text-sm text-gray-900">{challan.total_quantity}</p>
                </div>
              </div>
            </div>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Unit</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {challan.items?.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">
                      {item.description}
                      {item.batch_no && (
                        <p className="text-xs text-gray-500 mt-0.5">Batch: {item.batch_no}</p>
                      )}
                    </td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{item.unit || '-'}</td>
                    <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Sub Total</span>
                    <span>{formatCurrency(challan.sub_total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {challan.notes && (
              <div className="mt-8 border-t pt-4">
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-600 mt-1">{challan.notes}</p>
              </div>
            )}

            {challan.terms && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500">Terms</p>
                <p className="text-sm text-gray-600 mt-1">{challan.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function ViewDeliveryChallanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <DeliveryChallanViewContent />
    </Suspense>
  )
}
