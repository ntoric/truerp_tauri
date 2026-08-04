'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { printPurchaseBill } from '@/lib/printDocument'

interface PurchaseBillItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  unit: string
  hsn_code: string
}

interface PurchaseBill {
  id: string
  bill_number: string
  party: { name: string; address: string; city: string; state: string; gstin: string }
  bill_date: string
  due_date?: string
  status: string
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
  const [printing, setPrinting] = useState(false)

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

  const handlePrint = async () => {
    if (!bill?.id || printing) return
    setPrinting(true)
    try {
      await printPurchaseBill(bill.id, { billNumber: bill.bill_number })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Print failed')
    } finally {
      setPrinting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
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

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/purchase-invoices">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void handlePrint()} disabled={printing}>
              {printing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Print
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await apiFetch(`/purchase/bills/${bill.id}/download-pdf`)
                  if (res.ok) {
                    const blob = await res.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `Purchase_Invoice_${bill.bill_number}.pdf`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    window.URL.revokeObjectURL(url)
                  } else {
                    notifyError('Failed to download PDF')
                  }
                } catch (err) {
                  notifyError('Error downloading PDF')
                  console.error(err)
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>

        <Card className="border-2">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PURCHASE INVOICE</h1>
                <p className="text-gray-500 mt-1">{bill.bill_number}</p>
              </div>
              <div className="text-right">
                {getStatusBadge(bill.status)}
                <p className="text-sm text-gray-500 mt-2">Date: {formatDate(bill.bill_date)}</p>
                {bill.due_date && <p className="text-sm text-gray-500">Due: {formatDate(bill.due_date)}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 border-b pb-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Vendor</p>
                <p className="font-bold text-gray-900">{bill.party?.name || 'N/A'}</p>
                <p className="text-sm text-gray-600">{bill.party?.address}</p>
                <p className="text-sm text-gray-600">{bill.party?.city}{bill.party?.city && bill.party?.state ? ', ' : ''}{bill.party?.state}</p>
                {bill.party?.gstin && <p className="text-sm text-gray-600 mt-1">GSTIN: {bill.party.gstin}</p>}
              </div>
            </div>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Unit</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">Tax%</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items?.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{item.unit}</td>
                    <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right py-2">{item.tax_rate}%</td>
                    <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub Total</span>
                  <span>{formatCurrency(bill.sub_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax Total</span>
                  <span>{formatCurrency(bill.tax_total)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(bill.total_amount)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid</span>
                  <span className="text-green-600">{formatCurrency(bill.paid_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Balance Due</span>
                  <span className="text-orange-600">{formatCurrency(bill.balance_due)}</span>
                </div>
              </div>
            </div>

            {bill.notes && (
              <div className="mt-8 border-t pt-4">
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-600 mt-1">{bill.notes}</p>
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
