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
  GST_PERIOD_STATUS_COLORS, GST_SEVERITY_COLORS,
} from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Download, FileCheck2, PlayCircle, Lock, AlertTriangle } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function GstCmp08Page() {
  const gst = useGstScope()
  const { period, loading: periodLoading, ensurePeriod, reload: reloadPeriod } = useGstPeriod(gst)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [filedOpen, setFiledOpen] = useState(false)
  const [arn, setArn] = useState('')
  const [filedAt, setFiledAt] = useState('')

  const load = useCallback(async () => {
    if (gst.scope.mode === 'custom') return
    setLoading(true)
    try {
      const qs = period ? `period_id=${period.id}` : gst.query
      const d = await gstGet(`/cmp08?${qs}`)
      setData(d)
    } catch (e) {
      setData(null)
      if (period || gst.scope.registrationId) {
        notifyError(e instanceof Error ? e.message : 'Failed to load CMP-08')
      }
    } finally {
      setLoading(false)
    }
  }, [gst.query, period?.id, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gst.scope.mode === 'quarter' && !periodLoading) load()
  }, [load, periodLoading, gst.scope.mode])

  const act = async (action: string, payload: any = {}, label = '') => {
    if (!period) return
    setBusy(label)
    try {
      await gstSend(`/periods/${period.id}/status`, 'PUT', { action, ...payload })
      notifySuccess('Done')
      await reloadPeriod()
      await load()
    } catch (e: any) {
      const body = e?.body
      if (body?.open_errors) {
        notifyError(`${e.message} (${body.open_errors} open errors — resolve them or retry with force)`)
      } else {
        notifyError(e instanceof Error ? e.message : 'Action failed')
      }
    } finally {
      setBusy('')
    }
  }

  const doExport = async (kind: 'cmp08/excel' | 'cmp08/pdf') => {
    setBusy('export')
    try {
      await downloadGstExport(gst.scope, kind, period?.id)
      notifySuccess('Export downloaded')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy('')
    }
  }

  if (gst.scope.mode !== 'quarter') {
    return (
      <GstReportShell gst={gst} title="CMP-08 Quarterly Statement" description="Select quarterly mode to prepare CMP-08.">
        <Card><CardContent className="py-8 text-center text-muted-foreground">CMP-08 is a quarterly statement. Switch the period selector to <b>Quarterly</b>.</CardContent></Card>
      </GstReportShell>
    )
  }

  const turnover = data?.turnover
  const liab = data?.liability
  const pay = data?.payment_reconciliation
  const issues: any[] = data?.open_issues || []

  return (
    <GstReportShell
      gst={gst}
      title={`CMP-08 Working Paper — FY ${gst.scope.fy} Q${gst.scope.quarter}`}
      description="Self-assessed quarterly tax statement working paper. Generating or exporting this does not file CMP-08 with the GST portal."
      actions={
        <div className="flex gap-2">
          {!period && gst.scope.registrationId && (
            <Button size="sm" onClick={async () => { try { await ensurePeriod() } catch (e) { notifyError(e instanceof Error ? e.message : 'Failed to create period') } }}>
              <PlayCircle className="h-4 w-4 mr-1.5" /> Start period
            </Button>
          )}
          {period && (
            <>
              <Button size="sm" variant="outline" disabled={busy !== ''} onClick={() => act('generate', {}, 'generate')}>
                <PlayCircle className="h-4 w-4 mr-1.5" /> {busy === 'generate' ? 'Generating…' : 'Generate report'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={busy !== ''}>
                    <Download className="h-4 w-4 mr-1.5" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => doExport('cmp08/excel')}>Excel (.xlsx)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('cmp08/pdf')}>PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {period.status !== 'FILED' && (
                <Button size="sm" variant="outline" onClick={() => act('finalize', {}, 'finalize')} disabled={busy !== ''}>
                  <Lock className="h-4 w-4 mr-1.5" /> Finalize
                </Button>
              )}
              {period.status !== 'FILED' && (
                <Button size="sm" onClick={() => setFiledOpen(true)}>
                  <FileCheck2 className="h-4 w-4 mr-1.5" /> Mark filed
                </Button>
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
          <span className="text-muted-foreground">
            {formatDate(period.period_start)} – {formatDate(period.period_end)}
          </span>
          {period.generated_at && <span className="text-muted-foreground">generated {formatDateTime(period.generated_at)}</span>}
          {period.filed_at && <span className="text-emerald-700">filed {period.filed_at.slice(0, 10)} · ARN {period.portal_reference}</span>}
        </div>
      )}

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Turnover</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {[
                    ['Gross sales', turnover?.gross_sales],
                    ['Discounts', turnover?.discount_amount],
                    ['Sales returns', turnover?.sales_return_amount],
                    ['Credit notes', turnover?.credit_note_value],
                    ['Net sales', turnover?.net_sales],
                    ['Taxable outward turnover', turnover?.taxable_outward_turnover],
                    ['Exempt outward (incl. nil rated)', turnover?.exempt_outward_turnover],
                    ['Non-GST supplies', turnover?.non_gst_supply_value],
                    ['Inter-state outward (review)', turnover?.interstate_outward_supply_value],
                  ].map(([l, v]) => (
                    <TableRow key={l as string}>
                      <TableCell className="text-muted-foreground">{l}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency((v as number) ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Composition turnover basis</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(turnover?.composition_turnover_basis ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Self-Assessed Tax</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {[
                    [`Composition rate ${liab?.applicable_composition_rate ?? 0}%`, null],
                    ['CGST liability', liab?.cgst_composition_liability],
                    ['SGST liability', liab?.sgst_composition_liability],
                    ['Total composition liability', liab?.total_composition_liability],
                    ['RCM taxable value', liab?.rcm_taxable_value],
                    ['RCM tax liability', liab?.rcm_tax_liability],
                    ['Interest', liab?.interest_amount],
                    ['Late fee', liab?.late_fee_amount],
                    ['Adjustments', liab?.adjustments_total],
                  ].map(([l, v]) => (
                    <TableRow key={l as string}>
                      <TableCell className="text-muted-foreground">{l}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{v == null ? '' : formatCurrency(v as number)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total payable</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(liab?.total_payable ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">{liab?.rate_note}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Payment Reconciliation</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5">
              {[
                ['Current period liability', pay?.current_period_liability],
                ['Tax paid (recorded)', pay?.tax_paid],
                ['Portal-confirmed paid', pay?.portal_confirmed_paid],
                ['Unverified payments', pay?.unverified_paid],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="tabular-nums font-medium">{formatCurrency((v as number) ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Outstanding balance</span>
                <span className="tabular-nums">{formatCurrency(pay?.outstanding_balance ?? 0)}</span>
              </div>
              {(pay?.payments || []).length > 0 && (
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead>
                      <TableHead>Challan</TableHead><TableHead>Confirmed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pay.payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(p.amount)}</TableCell>
                        <TableCell>{p.challan_reference || '—'}</TableCell>
                        <TableCell>{p.portal_confirmed ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Recording a payment here does not confirm it on the GST portal — confirmed amounts require portal evidence.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Open Validation Issues ({issues.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {issues.length === 0 && <p className="text-sm text-muted-foreground">No open issues.</p>}
              {issues.map((i) => (
                <div key={i.id} className="flex gap-2 text-sm border-b pb-2 last:border-0">
                  <Badge className={GST_SEVERITY_COLORS[i.severity] || 'bg-slate-100'}>{i.severity}</Badge>
                  <div>
                    <div className="font-medium">{i.code}</div>
                    <div className="text-muted-foreground">{i.message}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {data?.disclaimer && (
        <p className="text-xs text-muted-foreground border rounded-md bg-muted/40 px-3 py-2">{data.disclaimer}</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <Dialog open={filedOpen} onOpenChange={setFiledOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark CMP-08 as filed</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Only mark a period filed after the statement is actually submitted on the GST portal.
              Provide the acknowledgement reference (ARN) as evidence.
            </p>
            <div>
              <Label>ARN / acknowledgement reference *</Label>
              <Input value={arn} onChange={(e) => setArn(e.target.value)} placeholder="e.g. AB3304..." />
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
                await act('mark_filed', { portal_reference: arn.trim(), filed_at: filedAt }, 'filed')
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
