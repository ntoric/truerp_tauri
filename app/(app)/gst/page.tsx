'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Calculator, FileCheck, FileX, Search, FileDigit, Truck, XCircle } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

export default function GSTPage() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [summary, setSummary] = useState<any>(null)
  const [gstr1, setGstr1] = useState<any[]>([])
  const [gstr2, setGstr2] = useState<any[]>([])
  const [gstr3b, setGstr3b] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [eInvoiceResult, setEInvoiceResult] = useState<any>(null)
  const [ewayBillResult, setEwayBillResult] = useState<any>(null)
  const [invoices, setInvoices] = useState<any>([])
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'summary')

  useEffect(() => { if (!authLoading && user) { fetchGSTData(); fetchInvoices() } }, [authLoading, user, period])

  const gstr1Pagination = usePagination(gstr1)
  const gstr2Pagination = usePagination(gstr2)

  useEffect(() => {
    gstr1Pagination.resetPage()
    gstr2Pagination.resetPage()
  }, [period])

  const fetchGSTData = async () => {
    setLoading(true)
    try {
      const [s, g1, g2, g3] = await Promise.all([
        apiFetch(`/gst/summary?period=${period}`),
        apiFetch(`/gst/gstr1?period=${period}`),
        apiFetch(`/gst/gstr2?period=${period}`),
        apiFetch(`/gst/gstr3b?period=${period}`)
      ])
      if (s.ok) setSummary(await s.json())
      if (g1.ok) { const d = await g1.json(); setGstr1(d.data || []) }
      if (g2.ok) { const d = await g2.json(); setGstr2(d.data || []) }
      if (g3.ok) setGstr3b(await g3.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('/invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data || [])
      }
    } catch (err) { console.error(err) }
  }

  const handleGenerateEInvoice = async () => {
    if (!selectedInvoiceId) return
    try {
      const res = await apiFetch('/gst/einvoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: selectedInvoiceId })
      })
      if (res.ok) {
        const data = await res.json()
        setEInvoiceResult(data)
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to generate e-invoice')
      }
    } catch (err) { console.error(err); notifyError('Failed to generate e-invoice') }
  }

  const handleCancelEInvoice = async () => {
    if (!selectedInvoiceId) return
    const reason = prompt('Enter cancellation reason:')
    if (!reason) return
    try {
      const res = await apiFetch('/gst/einvoice/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: selectedInvoiceId, cancel_reason: reason })
      })
      if (res.ok) {
        const data = await res.json()
        setEInvoiceResult(data)
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to cancel e-invoice')
      }
    } catch (err) { console.error(err); notifyError('Failed to cancel e-invoice') }
  }

  const handleGenerateEWayBill = async () => {
    if (!selectedInvoiceId) return
    const transporter = prompt('Enter transporter name:')
    const vehicleNo = prompt('Enter vehicle number:')
    const distance = prompt('Enter distance (km):')
    if (!transporter || !vehicleNo || !distance) return
    try {
      const res = await apiFetch('/gst/ewaybill/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: selectedInvoiceId,
          transporter,
          vehicle_no: vehicleNo,
          distance: parseInt(distance)
        })
      })
      if (res.ok) {
        const data = await res.json()
        setEwayBillResult(data)
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to generate e-way bill')
      }
    } catch (err) { console.error(err); notifyError('Failed to generate e-way bill') }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">GST</h1>
          <div className="flex items-center gap-2">
            <Label>Period:</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CGST</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.cgst || gstr3b?.cgst_liability || 0)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">SGST</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.sgst || gstr3b?.sgst_liability || 0)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">IGST</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.igst || gstr3b?.igst_liability || 0)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Liability</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(summary?.liability || gstr3b?.total_tax_liability || 0)}</div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="gstr1">GSTR-1</TabsTrigger><TabsTrigger value="gstr2">GSTR-2</TabsTrigger><TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger><TabsTrigger value="einvoice">E-Invoicing</TabsTrigger></TabsList>
          
          <TabsContent value="summary">
            <Card>
              <CardHeader><CardTitle>GST Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-gray-500">Total Tax Liability</p><p className="text-xl font-bold">{formatCurrency(summary?.total_tax || 0)}</p></div>
                  <div><p className="text-sm text-gray-500">Net Liability</p><p className="text-xl font-bold">{formatCurrency(summary?.liability || 0)}</p></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gstr1">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead></TableRow></TableHeader>
                <TableBody>
                  {gstr1Pagination.paginatedItems.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.invoice_number}</TableCell>
                      <TableCell>{r.invoice_date}</TableCell>
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell>{r.gstin}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.taxable_value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.cgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.sgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.igst)}</TableCell>
                    </TableRow>
                  ))}
                  {gstr1.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
              <PaginationControls
                page={gstr1Pagination.page}
                totalPages={gstr1Pagination.totalPages}
                totalItems={gstr1Pagination.totalItems}
                pageSize={gstr1Pagination.pageSize}
                onPageChange={gstr1Pagination.setPage}
              />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="gstr2">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Bill #</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead></TableRow></TableHeader>
                <TableBody>
                  {gstr2Pagination.paginatedItems.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.bill_number}</TableCell>
                      <TableCell>{r.receipt_date}</TableCell>
                      <TableCell>{r.vendor_name}</TableCell>
                      <TableCell>{r.gstin}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.taxable_value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.cgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.sgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.igst)}</TableCell>
                    </TableRow>
                  ))}
                  {gstr2.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
              <PaginationControls
                page={gstr2Pagination.page}
                totalPages={gstr2Pagination.totalPages}
                totalItems={gstr2Pagination.totalItems}
                pageSize={gstr2Pagination.pageSize}
                onPageChange={gstr2Pagination.setPage}
              />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="gstr3b">
            <Card>
              <CardHeader><CardTitle>GSTR-3B Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 border-b pb-4">
                    <div><p className="text-sm text-gray-500">Total Tax Liability</p><p className="text-xl font-bold">{formatCurrency(gstr3b?.total_tax_liability || 0)}</p></div>
                    <div><p className="text-sm text-gray-500">Tax Payable</p><p className="text-xl font-bold">{formatCurrency(gstr3b?.tax_payable || 0)}</p></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-sm text-gray-500">CGST</p><p className="font-bold">{formatCurrency(gstr3b?.cgst_liability || 0)}</p></div>
                    <div><p className="text-sm text-gray-500">SGST</p><p className="font-bold">{formatCurrency(gstr3b?.sgst_liability || 0)}</p></div>
                    <div><p className="text-sm text-gray-500">IGST</p><p className="font-bold">{formatCurrency(gstr3b?.igst_liability || 0)}</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="einvoice">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileDigit className="h-5 w-5" />E-Invoicing</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Select Invoice</Label>
                    <select
                      value={selectedInvoiceId}
                      onChange={(e) => setSelectedInvoiceId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">-- Select an invoice --</option>
                      {invoices.map((inv: any) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} - {inv.party?.name || 'Unknown'} ({formatCurrency(inv.total_amount)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateEInvoice} disabled={!selectedInvoiceId} className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" /> Generate E-Invoice
                    </Button>
                    <Button onClick={handleCancelEInvoice} disabled={!selectedInvoiceId} variant="destructive" className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" /> Cancel E-Invoice
                    </Button>
                  </div>
                  {eInvoiceResult && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <p className="font-semibold text-green-800">E-Invoice Generated Successfully!</p>
                        <p className="text-sm text-green-700">IRN: {eInvoiceResult.irn}</p>
                        <p className="text-sm text-green-700">Status: {eInvoiceResult.status}</p>
                        {eInvoiceResult.ewb_number && <p className="text-sm text-green-700">E-Way Bill: {eInvoiceResult.ewb_number}</p>}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />E-Way Bill</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateEWayBill} disabled={!selectedInvoiceId} className="flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Generate E-Way Bill
                    </Button>
                  </div>
                  {ewayBillResult && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <p className="font-semibold text-blue-800">E-Way Bill Generated Successfully!</p>
                        <p className="text-sm text-blue-700">E-Way Bill Number: {ewayBillResult.ewb_number}</p>
                        <p className="text-sm text-blue-700">Status: {ewayBillResult.status}</p>
                        <p className="text-sm text-blue-700">Valid Until: {new Date(ewayBillResult.valid_until).toLocaleDateString()}</p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
