'use client'

import { useCallback, useEffect, useState } from 'react'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import { useGstPeriod } from '@/components/gst/useGstPeriod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import {
  downloadGstExport, gstGet, gstSend,
  GST_PERIOD_STATUS_COLORS,
} from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Download, FileCheck2, PlayCircle, Lock, AlertTriangle } from 'lucide-react'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid_confirmed: 'Paid (confirmed)',
  pending_verification: 'Pending verification',
  recorded: 'Recorded',
  filed_no_payment_recorded: 'Filed (no payment recorded)',
  not_recorded: 'Not recorded',
}

export default function GstGstr4Page() {
  const gst = useGstScope()
  const { period, loading: periodLoading, ensurePeriod, reload: reloadPeriod } = useGstPeriod(gst)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [filedOpen, setFiledOpen] = useState(false)
  const [arn, setArn] = useState('')
  const [filedAt, setFiledAt] = useState('')

  const load = useCallback(async () => {
    if (gst.scope.mode !== 'annual') return
    setLoading(true)
    try {
      const qs = period ? `period_id=${period.id}` : gst.query
      const d = await gstGet(`/gstr4?${qs}`)
      setData(d)
    } catch (e) {
      setData(null)
      if (gst.scope.registrationId) {
        notifyError(e instanceof Error ? e.message : 'Failed to load GSTR-4')
      }
    } finally {
      setLoading(false)
    }
  }, [gst.query, period?.id, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gst.scope.mode === 'annual' && !periodLoading) load()
  }, [load, periodLoading, gst.scope.mode])

  const act = async (action: string, payload: any = {}) => {
    if (!period) return
    setBusy(action)
    try {
      await gstSend(`/periods/${period.id}/status`, 'PUT', { action, ...payload })
      notifySuccess('Done')
      await reloadPeriod()
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy('')
    }
  }

  const doExport = async () => {
    setBusy('export')
    try {
      await downloadGstExport(gst.scope, 'gstr4/excel', period?.id)
      notifySuccess('Export downloaded')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy('')
    }
  }

  if (gst.scope.mode !== 'annual') {
    return (
      <GstReportShell gst={gst} title="GSTR-4 Annual Return" description="Select annual mode to prepare GSTR-4.">
        <Card><CardContent className="py-8 text-center text-muted-foreground">GSTR-4 is an annual return. Switch the period selector to <b>Annual</b>.</CardContent></Card>
      </GstReportShell>
    )
  }

  const summary = data?.annual_summary
  const quarters: any[] = data?.quarterly_reconciliation || []

  return (
    <GstReportShell
      gst={gst}
      title={`GSTR-4 Annual Working Paper — FY ${gst.scope.fy}`}
      description="Annual return working paper consolidated from billing records and reconciled with quarterly CMP-08 statements."
      actions={
        <div className="flex gap-2">
          {!period && gst.scope.registrationId && (
            <Button size="sm" onClick={async () => { try { await ensurePeriod() } catch (e) { notifyError(e instanceof Error ? e.message : 'Failed') } }}>
              <PlayCircle className="h-4 w-4 mr-1.5" /> Start period
            </Button>
          )}
          {period && (
            <>
              <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => act('generate')}>
                <PlayCircle className="h-4 w-4 mr-1.5" /> Generate report
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== ''} onClick={doExport}>
                <Download className="h-4 w-4 mr-1.5" /> Export Excel
              </Button>
              {period.status !== 'FILED' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => act('finalize')} disabled={busy !== ''}>
                    <Lock className="h-4 w-4 mr-1.5" /> Finalize
                  </Button>
                  <Button size="sm" onClick={() => setFiledOpen(true)}>
                    <FileCheck2 className="h-4 w-4 mr-1.5" /> Mark filed
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      }
    >
      {!gst.scope.registrationId && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Configure a GST registration under Configuration first.
          </CardContent>
        </Card>
      )}

      {period && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge className={GST_PERIOD_STATUS_COLORS[period.status] || 'bg-slate-100'}>{period.status}</Badge>
          <span className="text-muted-foreground">{formatDate(period.period_start)} – {formatDate(period.period_end)}</span>
          {period.generated_at && <span className="text-muted-foreground">generated {formatDateTime(period.generated_at)}</span>}
          {period.filed_at && <span className="text-emerald-700">filed {period.filed_at.slice(0, 10)} · ARN {period.portal_reference}</span>}
        </div>
      )}

      {summary && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Annual Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-x-8 text-sm">
              {[
                ['Annual turnover (composition basis)', summary.annual_turnover],
                ['Taxable outward supplies', summary.taxable_outward_supplies],
                ['Exempt outward supplies', summary.exempt_outward_supplies],
                ['Nil-rated supplies', summary.nil_rated_supplies],
                ['Non-GST supplies', summary.non_gst_supplies],
                ['Registered supplier purchases', summary.registered_supplier_purchases],
                ['Unregistered supplier purchases', summary.unregistered_supplier_purchases],
                ['Inter-state purchases', summary.interstate_purchases],
                ['RCM taxable value', summary.rcm_taxable_value],
                ['RCM liability', summary.rcm_liability],
                [`Composition tax @ ${summary.composition_rate ?? 0}%`, summary.composition_tax_liability],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between border-b py-1.5 last:border-0">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="tabular-nums font-medium">{formatCurrency((v as number) ?? 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quarterly CMP-08 Reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Sales Turnover</TableHead>
                <TableHead className="text-right">Calculated Liability</TableHead>
                <TableHead className="text-right">CMP-08 Liability</TableHead>
                <TableHead>CMP-08 Status</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right">Tax Paid</TableHead>
                <TableHead className="text-right">Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarters.map((q) => (
                <TableRow key={q.quarter}>
                  <TableCell className="font-medium">Q{q.quarter}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(q.sales_turnover)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(q.calculated_liability)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {q.cmp08_liability == null ? '—' : formatCurrency(q.cmp08_liability)}
                  </TableCell>
                  <TableCell>
                    <Badge className={GST_PERIOD_STATUS_COLORS[q.cmp08_status] || 'bg-slate-100 text-slate-600'}>{q.cmp08_status}</Badge>
                  </TableCell>
                  <TableCell>{PAYMENT_STATUS_LABELS[q.payment_status] || q.payment_status}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(q.tax_paid)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${q.difference && Math.abs(q.difference) > 0.01 ? 'text-amber-600 font-medium' : ''}`}>
                    {q.difference == null ? '—' : formatCurrency(q.difference)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data?.disclaimer && (
        <p className="text-xs text-muted-foreground border rounded-md bg-muted/40 px-3 py-2">{data.disclaimer}</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <Dialog open={filedOpen} onOpenChange={setFiledOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark GSTR-4 as filed</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Only mark the return filed after it is actually submitted on the GST portal. Provide the ARN as evidence.
            </p>
            <div>
              <Label>ARN / acknowledgement reference *</Label>
              <Input value={arn} onChange={(e) => setArn(e.target.value)} />
            </div>
            <div>
              <Label>Filing date</Label>
              <Input type="date" value={filedAt} onChange={(e) => setFiledAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFiledOpen(false)}>Cancel</Button>
            <Button
              disabled={!arn.trim() || busy !== ''}
              onClick={async () => {
                await act('mark_filed', { portal_reference: arn.trim(), filed_at: filedAt })
                setFiledOpen(false)
              }}
            >
              Confirm filed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GstReportShell>
  )
}
