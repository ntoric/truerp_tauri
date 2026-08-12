'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileDigit, FileCheck, XCircle, Truck, Search, RefreshCw } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

export default function EInvoicingPage() {
  const { user, loading: authLoading } = useAuth()
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('')
  const [eInvoiceResult, setEInvoiceResult] = useState<any>(null)
  const [ewayBillResult, setEwayBillResult] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [eInvoiceHistory, setEInvoiceHistory] = useState<any[]>([])
  const [ewayBillHistory, setEwayBillHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ewayBillForm, setEwayBillForm] = useState({
    transporter: '',
    vehicleNo: '',
    distance: ''
  })

  useEffect(() => { if (!authLoading && user) { fetchInvoices(); fetchHistory() } }, [authLoading, user])

  const eInvoiceHistoryPagination = usePagination(eInvoiceHistory)
  const ewayBillHistoryPagination = usePagination(ewayBillHistory)

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('/invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data || [])
      }
    } catch (err) { console.error(err) }
  }

  const fetchHistory = async () => {
    try {
      const [eInvRes, ewbRes] = await Promise.all([
        apiFetch('/gst/einvoice/history'),
        apiFetch('/gst/ewaybill/history')
      ])
      if (eInvRes.ok) setEInvoiceHistory(await eInvRes.json())
      if (ewbRes.ok) setEwayBillHistory(await ewbRes.json())
    } catch (err) { console.error(err) }
  }

  const handleGenerateEInvoice = async () => {
    if (!selectedInvoiceId) return
    setLoading(true)
    try {
      const res = await apiFetch('/gst/einvoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: selectedInvoiceId })
      })
      if (res.ok) {
        const data = await res.json()
        setEInvoiceResult(data)
        fetchHistory()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to generate e-invoice')
      }
    } catch (err) { console.error(err); notifyError('Failed to generate e-invoice') }
    finally { setLoading(false) }
  }

  const handleCancelEInvoice = async () => {
    if (!selectedInvoiceId) return
    const reason = prompt('Enter cancellation reason:')
    if (!reason) return
    setLoading(true)
    try {
      const res = await apiFetch('/gst/einvoice/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: selectedInvoiceId, cancel_reason: reason })
      })
      if (res.ok) {
        const data = await res.json()
        setEInvoiceResult(data)
        fetchHistory()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to cancel e-invoice')
      }
    } catch (err) { console.error(err); notifyError('Failed to cancel e-invoice') }
    finally { setLoading(false) }
  }

  const handleGenerateEWayBill = async () => {
    if (!selectedInvoiceId || !ewayBillForm.transporter || !ewayBillForm.vehicleNo || !ewayBillForm.distance) {
      notifyError('Please fill all e-way bill details')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/gst/ewaybill/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: selectedInvoiceId,
          transporter: ewayBillForm.transporter,
          vehicle_no: ewayBillForm.vehicleNo,
          distance: parseInt(ewayBillForm.distance)
        })
      })
      if (res.ok) {
        const data = await res.json()
        setEwayBillResult(data)
        fetchHistory()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to generate e-way bill')
      }
    } catch (err) { console.error(err); notifyError('Failed to generate e-way bill') }
    finally { setLoading(false) }
  }

  const handleCancelEWayBill = async (ewbNo: string) => {
    const reason = prompt('Enter cancellation reason:')
    if (!reason) return
    setLoading(true)
    try {
      const res = await apiFetch('/gst/ewaybill/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ewb_no: ewbNo, cancel_reason: reason })
      })
      if (res.ok) {
        notifySuccess('E-Way Bill cancelled successfully')
        fetchHistory()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to cancel e-way bill')
      }
    } catch (err) { console.error(err); notifyError('Failed to cancel e-way bill') }
    finally { setLoading(false) }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  const selectedInvoice = invoices.find((inv: any) => inv.id === selectedInvoiceId)

  if (authLoading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="app-page-title flex items-center gap-2"><FileDigit className="h-5 w-5" />E-Invoicing</h1>
          <Button onClick={fetchHistory} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="generate">
          <TabsList><TabsTrigger value="generate">Generate</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
          
          <TabsContent value="generate">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Select Invoice</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Invoice</Label>
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
                  {selectedInvoice && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <p className="text-sm"><strong>Invoice:</strong> {selectedInvoice.invoice_number}</p>
                      <p className="text-sm"><strong>Customer:</strong> {selectedInvoice.party?.name}</p>
                      <p className="text-sm"><strong>Amount:</strong> {formatCurrency(selectedInvoice.total_amount)}</p>
                      <p className="text-sm"><strong>Date:</strong> {new Date(selectedInvoice.date).toLocaleDateString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5" />E-Invoice Actions</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={handleGenerateEInvoice} disabled={!selectedInvoiceId || loading} className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" /> Generate E-Invoice
                    </Button>
                    <Button onClick={handleCancelEInvoice} disabled={!selectedInvoiceId || loading} variant="destructive" className="flex items-center gap-2">
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

              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />E-Way Bill</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Transporter Name</Label>
                      <Input
                        value={ewayBillForm.transporter}
                        onChange={(e) => setEwayBillForm({ ...ewayBillForm, transporter: e.target.value })}
                        placeholder="Enter transporter name"
                      />
                    </div>
                    <div>
                      <Label>Vehicle Number</Label>
                      <Input
                        value={ewayBillForm.vehicleNo}
                        onChange={(e) => setEwayBillForm({ ...ewayBillForm, vehicleNo: e.target.value })}
                        placeholder="Enter vehicle number"
                      />
                    </div>
                    <div>
                      <Label>Distance (km)</Label>
                      <Input
                        type="number"
                        value={ewayBillForm.distance}
                        onChange={(e) => setEwayBillForm({ ...ewayBillForm, distance: e.target.value })}
                        placeholder="Enter distance"
                      />
                    </div>
                  </div>
                  <Button onClick={handleGenerateEWayBill} disabled={!selectedInvoiceId || loading} className="flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Generate E-Way Bill
                  </Button>
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

          <TabsContent value="history">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>E-Invoice History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>IRN</TableHead><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead>Generated At</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {eInvoiceHistoryPagination.paginatedItems.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{item.irn}</TableCell>
                          <TableCell>{item.invoice_number}</TableCell>
                          <TableCell><span className={`px-2 py-1 rounded-full text-xs ${item.status === 'Generated' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span></TableCell>
                          <TableCell>{new Date(item.generated_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {eInvoiceHistory.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No e-invoice history</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={eInvoiceHistoryPagination.page}
                    totalPages={eInvoiceHistoryPagination.totalPages}
                    totalItems={eInvoiceHistoryPagination.totalItems}
                    pageSize={eInvoiceHistoryPagination.pageSize}
                    onPageChange={eInvoiceHistoryPagination.setPage}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>E-Way Bill History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>E-Way Bill No</TableHead><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead>Valid Until</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {ewayBillHistoryPagination.paginatedItems.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{item.ewb_number}</TableCell>
                          <TableCell>{item.invoice_number}</TableCell>
                          <TableCell><span className={`px-2 py-1 rounded-full text-xs ${item.status === 'Generated' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span></TableCell>
                          <TableCell>{new Date(item.valid_until).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {item.status === 'Generated' && (
                              <Button size="sm" variant="destructive" onClick={() => handleCancelEWayBill(item.ewb_number)}>
                                Cancel
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {ewayBillHistory.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">No e-way bill history</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={ewayBillHistoryPagination.page}
                    totalPages={ewayBillHistoryPagination.totalPages}
                    totalItems={ewayBillHistoryPagination.totalItems}
                    pageSize={ewayBillHistoryPagination.pageSize}
                    onPageChange={ewayBillHistoryPagination.setPage}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
