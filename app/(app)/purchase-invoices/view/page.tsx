'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Download, Edit, Loader2 } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { downloadPurchaseBillPdf } from '@/lib/printDocument'

interface PurchaseBillItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount?: number
  tax_rate: number
  total: number
  unit: string
  hsn_code: string
}

interface PurchaseBill {
  id: string
  bill_number: string
  party: {
    name: string
    address: string
    city: string
    state: string
    pincode?: string
    gstin: string
  }
  bill_date: string
  due_date?: string
  status: string
  stock_status?: string
  sub_total: number
  tax_total: number
  total_amount: number
  paid_amount: number
  balance_due: number
  notes: string
  items: PurchaseBillItem[]
}

function PurchaseBillViewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [bill, setBill] = useState<PurchaseBill | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (id) fetchBill()
  }, [id])

  const fetchBill = async () => {
    try {
      const res = await apiFetch(`/purchase/bills/${id}`)
      if (res.ok) setBill(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!bill?.id || downloading) return
    setDownloading(true)
    try {
      await downloadPurchaseBillPdf(bill.id, { billNumber: bill.bill_number })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!bill) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Purchase invoice not found</p>
          <Link href="/purchase-invoices">
            <Button variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Purchase Invoices</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-yellow-100 text-yellow-700',
    }
    return <span className={`rounded-full px-3 py-1 text-xs font-medium ${variants[status] || variants.unpaid}`}>{status.toUpperCase()}</span>
  }

  const getStockStatusBadge = (status?: string) => {
    if (!status) return null
    const variants: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      received: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
    }
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-700'}`}>
        STOCK: {status.toUpperCase()}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/purchase-invoices">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/purchase-invoices/create?id=${bill.id}`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
            </Link>
            <Button variant="outline" onClick={() => void handleDownloadPdf()} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
              <div>
                <h1 className="app-page-title">Purchase Invoice</h1>
                <p className="mt-1 text-lg font-semibold text-gray-900">{bill.bill_number}</p>
              </div>
              <div className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {getStatusBadge(bill.status)}
                  {getStockStatusBadge(bill.stock_status)}
                </div>
                <p className="mt-2 text-sm text-gray-500">Bill date: {formatDate(bill.bill_date)}</p>
                <p className="text-sm text-gray-500">
                  Due date: {bill.due_date ? formatDate(bill.due_date) : '—'}
                </p>
                {bill.stock_status === 'pending' && (
                  <Link href="/inventory" className="mt-2 inline-block text-sm font-medium text-amber-700 hover:underline">
                    Review in Inventory →
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vendor</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{bill.party?.name || 'N/A'}</p>
              {bill.party?.gstin && (
                <p className="text-sm text-gray-600">GSTIN: {bill.party.gstin}</p>
              )}
              {(bill.party?.address || bill.party?.city || bill.party?.state) && (
                <p className="text-sm text-gray-600">
                  {[bill.party?.address, bill.party?.city, bill.party?.state].filter(Boolean).join(', ')}
                  {bill.party?.pincode ? ` - ${bill.party.pincode}` : ''}
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-700">Items</p>
              <div className="table-scroll rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium text-right">Qty</th>
                      <th className="px-3 py-2 font-medium text-right">Rate</th>
                      <th className="px-3 py-2 font-medium text-right">Disc%</th>
                      <th className="px-3 py-2 font-medium text-right">Tax%</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bill.items || []).map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">
                          <div>{item.description}</div>
                          {item.hsn_code && (
                            <div className="text-xs text-gray-500">HSN: {item.hsn_code}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 text-right">{item.discount || 0}%</td>
                        <td className="px-3 py-2 text-right">{item.tax_rate || 0}%</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    {(bill.items || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-gray-500">No items</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2 rounded-lg border bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sub Total</span>
                  <span className="font-medium">{formatCurrency(bill.sub_total)}</span>
                </div>
                {bill.tax_total > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{formatCurrency(bill.tax_total)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(bill.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-medium text-green-600">{formatCurrency(bill.paid_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Balance Due</span>
                  <span className="font-medium text-orange-600">{formatCurrency(bill.balance_due)}</span>
                </div>
              </div>
            </div>

            {bill.notes && (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                <p><span className="font-medium">Notes:</span> {bill.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function ViewPurchaseBillPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <PurchaseBillViewContent />
    </Suspense>
  )
}
