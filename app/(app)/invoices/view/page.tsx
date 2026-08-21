'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton, { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Download, Loader2, Printer as ThermalPrinter, Gift } from 'lucide-react'
import ThermalPrintModal from '@/components/ThermalPrintModal'
import InvoiceAttachments from '@/components/InvoiceAttachments'
import InvoiceStatusTracker from '@/components/InvoiceStatusTracker'
import InvoiceCustomFieldsForm, {
  type InvoiceCustomFieldDefinition,
  displayCustomFields,
  parseCustomFieldsFromInvoice,
} from '@/components/InvoiceCustomFieldsForm'
import { downloadInvoicePdf } from '@/lib/printDocument'
import { notifyError } from '@/lib/notify'
import type { LoyaltySettings } from '@/lib/loyalty-types'

interface InvoiceItem {
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

interface Invoice {
  id: string
  invoice_number: string
  party?: PartyInfo
  customer?: PartyInfo
  date: string
  due_date?: string
  status: string
  sub_total: number
  discount_total: number
  cgst_total: number
  sgst_total: number
  igst_total: number
  total_amount: number
  is_inter_state: boolean
  notes: string
  custom_fields?: string
  pdf_template?: string
  items: InvoiceItem[]
  loyalty_points_earned?: number
  loyalty_points_redeemed?: number
  loyalty_discount?: number
}

function partyName(invoice: Invoice) {
  return invoice.party?.name || invoice.customer?.name || 'N/A'
}

function partyDetails(invoice: Invoice) {
  const p = invoice.party || invoice.customer
  return p
}

function InvoiceViewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [fieldDefs, setFieldDefs] = useState<InvoiceCustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [thermalPrintOpen, setThermalPrintOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null)

  useEffect(() => {
    if (id) {
      fetchInvoice()
      fetchFieldDefs()
    }
    fetchLoyaltySettings()
  }, [id])

  const fetchFieldDefs = async () => {
    const res = await apiFetch('/settings/invoice-custom-fields')
    if (res.ok) setFieldDefs(await res.json())
  }

  const fetchLoyaltySettings = async () => {
    try {
      const res = await apiFetch('/loyalty/settings', { timeoutMs: 5000 })
      if (res.ok) setLoyaltySettings(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchInvoice = async () => {
    try {
      const res = await apiFetch(`/invoices/${id}`)
      if (res.ok) setInvoice(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!invoice?.id || downloading) return
    setDownloading(true)
    try {
      await downloadInvoicePdf(invoice.id, { invoiceNumber: invoice.invoice_number })
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

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Invoice not found</p>
          <Link href="/invoices">
            <Button variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      sent: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
      overdue: 'bg-red-100 text-red-700',
      partial: 'bg-amber-100 text-amber-800',
      cancelled: 'bg-yellow-100 text-yellow-800',
    }
    return <span className={`rounded-full px-3 py-1 text-xs font-medium ${variants[status] || variants.draft}`}>{status.toUpperCase()}</span>
  }

  const customValues = parseCustomFieldsFromInvoice(invoice.custom_fields)
  const p = partyDetails(invoice)

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/invoices">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setThermalPrintOpen(true)}>
              <ThermalPrinter className="mr-2 h-4 w-4" /> Thermal
            </Button>
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

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-2">
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="app-page-title">TAX INVOICE</h1>
                  <p className="text-gray-500 mt-1">{invoice.invoice_number}</p>
                  {invoice.pdf_template && (
                    <p className="text-xs text-muted-foreground mt-1">Layout: {invoice.pdf_template}</p>
                  )}
                </div>
                <div className="text-right">
                  {getStatusBadge(invoice.status)}
                  <p className="text-sm text-gray-500 mt-2">Date: {formatDate(invoice.date)}</p>
                  {invoice.due_date && <p className="text-sm text-gray-500">Due: {formatDate(invoice.due_date)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8 border-b pb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Bill To</p>
                  <p className="font-bold text-gray-900">{partyName(invoice)}</p>
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
                  {invoice.items?.map((item) => (
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
                    <span>{formatCurrency(invoice.sub_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-red-600">-{formatCurrency(invoice.discount_total)}</span>
                  </div>
                  {invoice.is_inter_state ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">IGST</span>
                      <span>{formatCurrency(invoice.igst_total)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">CGST</span>
                        <span>{formatCurrency(invoice.cgst_total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">SGST</span>
                        <span>{formatCurrency(invoice.sgst_total)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(invoice.total_amount)}</span>
                    </div>
                  </div>
                  {loyaltySettings?.is_enabled && ((invoice.loyalty_points_redeemed ?? 0) > 0 || (invoice.loyalty_points_earned ?? 0) > 0 || (invoice.loyalty_discount ?? 0) > 0) && (
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                        <Gift className="h-3.5 w-3.5" />
                        Loyalty points
                      </div>
                      {(invoice.loyalty_points_redeemed ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Points redeemed</span>
                          <span className="font-medium text-amber-800">{invoice.loyalty_points_redeemed} pts</span>
                        </div>
                      )}
                      {(invoice.loyalty_discount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Loyalty discount</span>
                          <span className="font-medium text-red-600">-{formatCurrency(invoice.loyalty_discount ?? 0)}</span>
                        </div>
                      )}
                      {(invoice.loyalty_points_earned ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Points earned</span>
                          <span className="font-medium text-emerald-700">+{invoice.loyalty_points_earned} pts</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {invoice.notes && (
                <div className="mt-8 border-t pt-4">
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-sm text-gray-600 mt-1">{invoice.notes}</p>
                </div>
              )}

              {displayCustomFields(fieldDefs, customValues)}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <InvoiceStatusTracker
                  invoiceId={invoice.id}
                  currentStatus={invoice.status}
                  onUpdated={(s) => setInvoice({ ...invoice, status: s })}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <InvoiceAttachments invoiceId={invoice.id} />
              </CardContent>
            </Card>
          </div>
        </div>

        {invoice && (
          <ThermalPrintModal
            isOpen={thermalPrintOpen}
            onClose={() => setThermalPrintOpen(false)}
            documentType="invoice"
            documentId={invoice.id}
            documentNumber={invoice.invoice_number}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

export default function ViewInvoicePage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <InvoiceViewContent />
    </Suspense>
  )
}
