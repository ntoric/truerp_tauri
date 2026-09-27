'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Edit, Loader2, Printer, Trash2, ArrowRightCircle, FileText } from 'lucide-react'
import { printHtmlDocument } from '@/lib/printDocument'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import EstimateConvertDialog from '@/components/EstimateConvertDialog'
import { displayAdditionalChargeRows, type AdditionalChargeItem } from '@/lib/additionalCharges'

interface EstimateItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  cgst: number
  sgst: number
  igst: number
  total: number
  unit: string
}

interface PartyInfo {
  name: string
  address: string
  city: string
  state: string
  gstin: string
}

interface Estimate {
  id: string
  quotation_number: string
  party?: PartyInfo
  date: string
  valid_until?: string
  status: string
  approval_status?: string
  sub_total: number
  discount_total: number
  quotation_discount: number
  additional_charges: number
  additional_charge_items?: AdditionalChargeItem[]
  tax_total: number
  cgst_total: number
  sgst_total: number
  igst_total: number
  round_off: number
  total_amount: number
  is_inter_state: boolean
  notes: string
  terms: string
  signature?: string
  converted_to_invoice_id?: string
  items: EstimateItem[]
}

function EstimateViewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const { confirm, confirmDialog } = useConfirmDialog()
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  useEffect(() => {
    if (id) fetchEstimate()
  }, [id])

  const fetchEstimate = async () => {
    try {
      const res = await apiFetch(`/quotations/${id}`)
      if (res.ok) setEstimate(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    if (!estimate?.id || printing) return
    setPrinting(true)
    try {
      const res = await apiFetch(`/quotations/${estimate.id}/pdf`)
      if (!res.ok) throw new Error('Failed to load estimate print')
      const html = await res.text()
      await printHtmlDocument(html, { title: `Estimate ${estimate.quotation_number}` })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to print estimate')
    } finally {
      setPrinting(false)
    }
  }

  const handleDelete = async () => {
    if (!estimate) return
    if (!(await confirm({
      title: 'Delete estimate?',
      description: 'Are you sure you want to delete this estimate? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/quotations/${estimate.id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Estimate deleted')
        router.push('/estimates')
        return
      }
      const data = await res.json().catch(() => ({}))
      notifyError(data.error || 'Failed to delete estimate')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete estimate')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!estimate) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Estimate not found</p>
          <Link href="/estimates">
            <Button variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Estimates</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      converted: 'bg-amber-100 text-amber-800',
    }
    return <span className={`rounded-full px-3 py-1 text-xs font-medium ${variants[status] || variants.draft}`}>{status.toUpperCase()}</span>
  }

  const isConverted = estimate.status === 'converted'
  const p = estimate.party

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/estimates">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
          <div className="flex flex-wrap gap-2">
            {!isConverted && (
              <Button onClick={() => setConvertOpen(true)}>
                <ArrowRightCircle className="mr-2 h-4 w-4" /> Convert to Sale
              </Button>
            )}
            {isConverted && estimate.converted_to_invoice_id && (
              <Link href={`/invoices/view?id=${estimate.converted_to_invoice_id}`}>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> View Invoice
                </Button>
              </Link>
            )}
            {!isConverted && (
              <Link href={`/estimates/create?id=${estimate.id}`}>
                <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => void handlePrint()} disabled={printing}>
              {printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print
            </Button>
            {!isConverted && (
              <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => void handleDelete()}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>

        <Card className="border-2">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="app-page-title">ESTIMATE</h1>
                <p className="text-gray-500 mt-1">{estimate.quotation_number}</p>
              </div>
              <div className="text-right">
                {getStatusBadge(estimate.status)}
                <p className="text-sm text-gray-500 mt-2">Date: {formatDate(estimate.date)}</p>
                {estimate.valid_until && <p className="text-sm text-gray-500">Valid Until: {formatDate(estimate.valid_until)}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 border-b pb-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Bill To</p>
                <p className="font-bold text-gray-900">{p?.name || 'N/A'}</p>
                <p className="text-sm text-gray-600">{p?.address}</p>
                <p className="text-sm text-gray-600">{p?.city}{p?.city && p?.state ? ', ' : ''}{p?.state}</p>
                {p?.gstin && <p className="text-sm text-gray-600 mt-1">GSTIN: {p.gstin}</p>}
              </div>
            </div>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                  <th className="text-right py-2 font-medium">Disc%</th>
                  <th className="text-right py-2 font-medium">Tax%</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {estimate.items?.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity} {item.unit}</td>
                    <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right py-2">{item.discount}%</td>
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
                  <span>{formatCurrency(estimate.sub_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="text-red-600">-{formatCurrency(estimate.discount_total + (estimate.quotation_discount || 0))}</span>
                </div>
                {displayAdditionalChargeRows(estimate.additional_charge_items, estimate.additional_charges).map((charge, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{charge.label}</span>
                    <span>{formatCurrency(charge.amount)}</span>
                  </div>
                ))}
                {estimate.is_inter_state ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IGST</span>
                    <span>{formatCurrency(estimate.igst_total)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">CGST</span>
                      <span>{formatCurrency(estimate.cgst_total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">SGST</span>
                      <span>{formatCurrency(estimate.sgst_total)}</span>
                    </div>
                  </>
                )}
                {estimate.round_off !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Round Off</span>
                    <span>{formatCurrency(estimate.round_off)}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(estimate.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {estimate.notes && (
              <div className="mt-8 border-t pt-4">
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-600 mt-1">{estimate.notes}</p>
              </div>
            )}
            {estimate.terms && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-medium text-gray-500">Terms & Conditions</p>
                <p className="text-sm text-gray-600 mt-1">{estimate.terms}</p>
              </div>
            )}
            {estimate.signature && (
              <div className="mt-4 flex flex-col items-end border-t pt-4">
                <img src={estimate.signature} alt="Signature" className="max-h-20 max-w-[200px] object-contain" />
                <p className="mt-1 text-sm text-gray-500">Authorized Signatory</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EstimateConvertDialog
        estimate={estimate}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConverted={() => fetchEstimate()}
      />
      {confirmDialog}
    </DashboardLayout>
  )
}

export default function ViewEstimatePage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <EstimateViewContent />
    </Suspense>
  )
}
