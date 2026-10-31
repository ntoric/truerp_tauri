'use client'

import { useCallback, useEffect, useState } from 'react'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import { useGstPeriod } from '@/components/gst/useGstPeriod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  gstGet, gstSend, type GstReconciliationRecord, type GstTaxPayment,
} from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { AlertTriangle, Plus } from 'lucide-react'

const RECON_TYPES = [
  { value: 'cmp08_turnover', label: 'CMP-08 turnover' },
  { value: 'cmp08_liability', label: 'CMP-08 liability' },
  { value: 'cmp08_tax_paid', label: 'CMP-08 tax paid' },
  { value: 'gstr4_turnover', label: 'GSTR-4 turnover' },
  { value: 'gstr4_liability', label: 'GSTR-4 liability' },
  { value: 'rcm_liability', label: 'RCM liability' },
]

export default function GstPaymentsPage() {
  const gst = useGstScope()
  const { period, loading: periodLoading, ensurePeriod } = useGstPeriod(gst)
  const [payments, setPayments] = useState<GstTaxPayment[]>([])
  const [recons, setRecons] = useState<GstReconciliationRecord[]>([])
  const [payOpen, setPayOpen] = useState(false)
  const [reconOpen, setReconOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [payForm, setPayForm] = useState({ payment_date: '', amount: '', component: 'composition_tax', challan_reference: '', portal_reference: '', notes: '' })
  const [reconForm, setReconForm] = useState({ reconciliation_type: 'cmp08_liability', recorded_return_value: '', portal_confirmed_value: '' })
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!period) { setPayments([]); setRecons([]); return }
    try {
      const [p, r] = await Promise.all([
        gstGet<GstTaxPayment[]>(`/periods/${period.id}/payments`),
        gstGet<GstReconciliationRecord[]>(`/periods/${period.id}/reconciliation`),
      ])
      setPayments(p || [])
      setRecons(r || [])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [period?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const ensure = async () => {
    if (period) return period
    return ensurePeriod()
  }

  const addPayment = async () => {
    const p = await ensure()
    if (!p) { notifyError('Create a return period first (quarterly/annual scope + registration)'); return }
    setBusy(true)
    try {
      await gstSend(`/periods/${p.id}/payments`, 'POST', {
        payment_date: payForm.payment_date,
        amount: parseFloat(payForm.amount || '0'),
        component: payForm.component,
        challan_reference: payForm.challan_reference,
        portal_reference: payForm.portal_reference,
        portal_confirmed: !!payForm.portal_reference.trim(),
        notes: payForm.notes,
      })
      notifySuccess('Payment recorded')
      setPayOpen(false)
      setPayForm({ payment_date: '', amount: '', component: 'composition_tax', challan_reference: '', portal_reference: '', notes: '' })
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setBusy(false)
    }
  }

  const addRecon = async () => {
    const p = await ensure()
    if (!p) { notifyError('Create a return period first'); return }
    setBusy(true)
    try {
      await gstSend(`/periods/${p.id}/reconciliation`, 'POST', {
        reconciliation_type: reconForm.reconciliation_type,
        recorded_return_value: parseFloat(reconForm.recorded_return_value || '0'),
        portal_confirmed_value: reconForm.portal_confirmed_value ? parseFloat(reconForm.portal_confirmed_value) : undefined,
      })
      notifySuccess('Reconciliation recorded')
      setReconOpen(false)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed — generate the report first so a system value exists')
    } finally {
      setBusy(false)
    }
  }

  const resolveRecon = async (r: GstReconciliationRecord, status: string) => {
    try {
      await gstSend(`/reconciliation/${r.id}/resolve`, 'PUT', {
        resolution_status: status,
        resolution_note: resolveNote[r.id] || '',
      })
      notifySuccess('Updated')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const totals = {
    paid: payments.reduce((s, p) => s + p.amount, 0),
    confirmed: payments.filter((p) => p.portal_confirmed).reduce((s, p) => s + p.amount, 0),
  }

  return (
    <GstReportShell
      gst={gst}
      title="Payments & Reconciliation"
      description="Recorded tax payments (challans) and reconciliation of calculated figures against filed returns. Portal confirmation always requires evidence."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setReconOpen(true)} disabled={!gst.scope.registrationId || gst.scope.mode === 'custom'}>
            <Plus className="h-4 w-4 mr-1" /> Record filed value
          </Button>
          <Button size="sm" onClick={() => setPayOpen(true)} disabled={!gst.scope.registrationId || gst.scope.mode === 'custom'}>
            <Plus className="h-4 w-4 mr-1" /> Record payment
          </Button>
        </div>
      }
    >
      {gst.scope.mode === 'custom' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Payments and reconciliation attach to a return period — switch to Quarterly or Annual mode.
          </CardContent>
        </Card>
      )}
      {!period && !periodLoading && gst.scope.registrationId && gst.scope.mode !== 'custom' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800">
            No return period exists for this scope yet — it will be created when you record a payment or filed value.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Tax Payments</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span>Total recorded: <b>{formatCurrency(totals.paid)}</b></span>
            <span>Portal-confirmed: <b className="text-emerald-700">{formatCurrency(totals.confirmed)}</b></span>
            <span>Unverified: <b className="text-amber-700">{formatCurrency(totals.paid - totals.confirmed)}</b></span>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>Challan Ref</TableHead>
                    <TableHead>Portal Confirmed</TableHead>
                    <TableHead>Portal Ref</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>{p.component.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="font-mono text-xs">{p.challan_reference || '—'}</TableCell>
                      <TableCell>
                        {p.portal_confirmed
                          ? <Badge className="bg-emerald-100 text-emerald-700">Confirmed</Badge>
                          : <Badge className="bg-amber-100 text-amber-700">Unverified</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.portal_reference || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.notes || ''}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payments recorded for this period</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            A payment record is evidence of intent, not proof of payment. It is marked confirmed only when a portal reference (challan CIN/ARN) is supplied.
          </p>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">System Calculated</TableHead>
                    <TableHead className="text-right">Recorded on Return</TableHead>
                    <TableHead className="text-right">Portal Confirmed</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recons.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.reconciliation_type.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.system_calculated_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.recorded_return_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.portal_confirmed_value == null ? '—' : formatCurrency(r.portal_confirmed_value)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${Math.abs(r.difference) > 0.01 ? 'text-amber-600 font-medium' : ''}`}>
                        {formatCurrency(r.difference)}
                      </TableCell>
                      <TableCell>
                        <Badge className={r.resolution_status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                          {r.resolution_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        {r.resolution_status === 'open' ? (
                          <div className="flex gap-1.5">
                            <Input
                              placeholder="Explanation"
                              className="h-8 text-xs"
                              value={resolveNote[r.id] || ''}
                              onChange={(e) => setResolveNote({ ...resolveNote, [r.id]: e.target.value })}
                            />
                            <Button size="sm" variant="outline" className="h-8" onClick={() => resolveRecon(r, 'explained')}>Explain</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.resolution_note}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recons.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reconciliation records yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Record the figures actually declared on the filed return to surface differences. The system calculation is not assumed to be correct — document the explanation for any difference.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record tax payment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment date *</Label>
              <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Component</Label>
              <Select value={payForm.component} onValueChange={(v) => setPayForm({ ...payForm, component: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="composition_tax">Composition tax</SelectItem>
                  <SelectItem value="reverse_charge">Reverse charge</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="late_fee">Late fee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Challan reference (CPIN/CIN)</Label>
              <Input value={payForm.challan_reference} onChange={(e) => setPayForm({ ...payForm, challan_reference: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Portal reference (marks confirmed)</Label>
              <Input value={payForm.portal_reference} onChange={(e) => setPayForm({ ...payForm, portal_reference: e.target.value })} placeholder="Only if verified on the GST portal" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button disabled={busy || !payForm.payment_date || !parseFloat(payForm.amount)} onClick={addPayment}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reconOpen} onOpenChange={setReconOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record filed return value</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reconciliation type</Label>
              <Select value={reconForm.reconciliation_type} onValueChange={(v) => setReconForm({ ...reconForm, reconciliation_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECON_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value declared on filed return (₹)</Label>
              <Input type="number" step="0.01" value={reconForm.recorded_return_value} onChange={(e) => setReconForm({ ...reconForm, recorded_return_value: e.target.value })} />
            </div>
            <div>
              <Label>Portal-confirmed value (₹, optional)</Label>
              <Input type="number" step="0.01" value={reconForm.portal_confirmed_value} onChange={(e) => setReconForm({ ...reconForm, portal_confirmed_value: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconOpen(false)}>Cancel</Button>
            <Button disabled={busy || reconForm.recorded_return_value === ''} onClick={addRecon}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GstReportShell>
  )
}
