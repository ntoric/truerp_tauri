'use client'

import { useCallback, useEffect, useState } from 'react'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import { useGstPeriod } from '@/components/gst/useGstPeriod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import {
  gstGet, gstSend, GST_SEVERITY_COLORS, type GstValidationIssue,
} from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { PlayCircle, AlertTriangle } from 'lucide-react'

export default function GstValidationPage() {
  const gst = useGstScope()
  const { period, loading: periodLoading, ensurePeriod } = useGstPeriod(gst)
  const [issues, setIssues] = useState<GstValidationIssue[]>([])
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('open')
  const [busy, setBusy] = useState(false)
  const [resolving, setResolving] = useState<GstValidationIssue | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    if (!period) { setIssues([]); return }
    try {
      const params = new URLSearchParams()
      if (severity !== 'all') params.set('severity', severity)
      params.set('resolution_status', status)
      const data = await gstGet<GstValidationIssue[]>(`/periods/${period.id}/issues?${params}`)
      setIssues(data || [])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load issues')
    }
  }, [period?.id, severity, status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load, period?.id])

  const runValidation = async () => {
    setBusy(true)
    try {
      let p = period
      if (!p) {
        p = await ensurePeriod()
        if (!p) { notifyError('Select a registration and quarterly/annual scope first'); return }
      }
      const res = await gstSend<{ issues: GstValidationIssue[]; errors: number; warnings: number; infos: number }>(
        `/periods/${p.id}/validate`, 'POST',
      )
      notifySuccess(`Validation complete: ${res.errors} errors, ${res.warnings} warnings, ${res.infos} info`)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setBusy(false)
    }
  }

  const resolveIssue = async (issue: GstValidationIssue, resolution: 'resolved' | 'open') => {
    try {
      await gstSend(`/issues/${issue.id}/resolve`, 'PUT', {
        resolution_status: resolution,
        resolution_note: note,
      })
      notifySuccess(resolution === 'resolved' ? 'Issue resolved' : 'Issue reopened')
      setResolving(null)
      setNote('')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const counts = {
    ERROR: issues.filter((i) => i.severity === 'ERROR').length,
    WARNING: issues.filter((i) => i.severity === 'WARNING').length,
    INFO: issues.filter((i) => i.severity === 'INFO').length,
  }

  return (
    <GstReportShell
      gst={gst}
      title="Validation & Reconciliation Issues"
      description="Pre-filing checks on the transactions in the selected period. Resolve each finding or add an explanation before finalizing."
      actions={
        <Button size="sm" onClick={runValidation} disabled={busy || !gst.scope.registrationId || gst.scope.mode === 'custom'}>
          <PlayCircle className="h-4 w-4 mr-1.5" /> {busy ? 'Running…' : 'Run validation'}
        </Button>
      }
    >
      {gst.scope.mode === 'custom' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Validation runs against a return period — switch to Quarterly or Annual mode.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 text-sm">
          <Badge className={GST_SEVERITY_COLORS.ERROR}>{counts.ERROR} errors</Badge>
          <Badge className={GST_SEVERITY_COLORS.WARNING}>{counts.WARNING} warnings</Badge>
          <Badge className={GST_SEVERITY_COLORS.INFO}>{counts.INFO} info</Badge>
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="ERROR">Errors</SelectItem>
            <SelectItem value="WARNING">Warnings</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        {!period && !periodLoading && gst.scope.registrationId && (
          <span className="text-sm text-muted-foreground">No return period yet — run validation to create and check one.</span>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Finding</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><Badge className={GST_SEVERITY_COLORS[i.severity]}>{i.severity}</Badge></TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{i.code}</TableCell>
                  <TableCell className="max-w-md">{i.message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {i.source_transaction_type}{i.source_reference ? ` · ${i.source_reference}` : ''}
                  </TableCell>
                  <TableCell>
                    {i.resolution_status === 'resolved' ? (
                      <span className="text-emerald-700 text-xs">resolved{i.resolved_at ? ` ${formatDateTime(i.resolved_at)}` : ''}{i.resolution_note ? ` — ${i.resolution_note}` : ''}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">open</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.resolution_status === 'open' ? (
                      <Button size="sm" variant="outline" onClick={() => { setResolving(i); setNote('') }}>Resolve</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => resolveIssue(i, 'open')}>Reopen</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {period ? 'No issues found — run validation to check the latest data.' : 'No validation results yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve issue</DialogTitle></DialogHeader>
          {resolving && (
            <div className="space-y-3">
              <p className="text-sm"><Badge className={GST_SEVERITY_COLORS[resolving.severity]}>{resolving.severity}</Badge> <span className="font-mono text-xs">{resolving.code}</span></p>
              <p className="text-sm text-muted-foreground">{resolving.message}</p>
              <Textarea placeholder="Resolution note (required for audit)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
            <Button disabled={!note.trim()} onClick={() => resolving && resolveIssue(resolving, 'resolved')}>Mark resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GstReportShell>
  )
}
