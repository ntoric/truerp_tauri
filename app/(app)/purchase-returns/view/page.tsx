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

interface PurchaseReturnItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  reason: string
}

interface PurchaseReturn {
  id: string
  return_number: string
  party?: { name: string; address?: string; city?: string; state?: string; gstin?: string }
  purchase_bill?: { bill_number: string }
  date: string
  amount: number
  status: string
  reason: string
  refund_mode: string
  notes: string
  items: PurchaseReturnItem[]
}

function PurchaseReturnViewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchReturn()
  }, [id])

  const fetchReturn = async () => {
    try {
      const res = await apiFetch(`/purchase-returns/${id}`)
      if (res.ok) setPurchaseReturn(await res.json())
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

  if (!purchaseReturn) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Purchase return not found</p>
          <Link href="/purchase-returns">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Purchase Returns
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      processed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${variants[status] || variants.draft}`}>
        {status.toUpperCase()}
      </span>
    )
  }

  const refundModeLabel: Record<string, string> = {
    cash: 'Cash',
    original_payment: 'Original Payment',
    credit_note: 'Credit Note',
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/purchase-returns">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          {purchaseReturn.status === 'draft' && (
            <Link href={`/purchase-returns/create?id=${purchaseReturn.id}`}>
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
                <h1 className="app-page-title">PURCHASE RETURN</h1>
                <p className="text-gray-500 mt-1">{purchaseReturn.return_number}</p>
              </div>
              <div className="text-right">
                {getStatusBadge(purchaseReturn.status)}
                <p className="text-sm text-gray-500 mt-2">Date: {formatDate(purchaseReturn.date)}</p>
                {purchaseReturn.purchase_bill?.bill_number && (
                  <p className="text-sm text-gray-500">Bill: {purchaseReturn.purchase_bill.bill_number}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 border-b pb-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Vendor</p>
                <p className="font-bold text-gray-900">{purchaseReturn.party?.name || 'N/A'}</p>
                {purchaseReturn.party?.address && (
                  <p className="text-sm text-gray-600">{purchaseReturn.party.address}</p>
                )}
                <p className="text-sm text-gray-600">
                  {purchaseReturn.party?.city}
                  {purchaseReturn.party?.city && purchaseReturn.party?.state ? ', ' : ''}
                  {purchaseReturn.party?.state}
                </p>
                {purchaseReturn.party?.gstin && (
                  <p className="text-sm text-gray-600 mt-1">GSTIN: {purchaseReturn.party.gstin}</p>
                )}
              </div>
              <div>
                {purchaseReturn.reason && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-500 mb-1">Reason</p>
                    <p className="text-sm text-gray-900">{purchaseReturn.reason}</p>
                  </div>
                )}
                {purchaseReturn.refund_mode && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Refund Mode</p>
                    <p className="text-sm text-gray-900">
                      {refundModeLabel[purchaseReturn.refund_mode] || purchaseReturn.refund_mode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">Tax%</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchaseReturn.items?.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">
                      {item.description}
                      {item.reason && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                      )}
                    </td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right py-2">{item.tax_rate}%</td>
                    <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(purchaseReturn.amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {purchaseReturn.notes && (
              <div className="mt-8 border-t pt-4">
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-600 mt-1">{purchaseReturn.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function ViewPurchaseReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <PurchaseReturnViewContent />
    </Suspense>
  )
}
