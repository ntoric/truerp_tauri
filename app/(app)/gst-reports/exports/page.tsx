'use client'

import { useCallback, useEffect, useState } from 'react'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import { useGstPeriod } from '@/components/gst/useGstPeriod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import {
  downloadGstExport, gstGet, type GstExportKind, type GstReportExport,
} from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { Download } from 'lucide-react'

const EXPORT_BUTTONS: { kind: GstExportKind; label: string; needs?: 'quarter' | 'annual' }[] = [
  { kind: 'filing-summary/excel', label: 'Filing Summary (.xlsx)' },
  { kind: 'filing-summary/pdf', label: 'Filing Summary (.pdf)' },
  { kind: 'sales-register/excel', label: 'Sales Register (.xlsx)' },
  { kind: 'sales-register/csv', label: 'Sales Register (.csv)' },
  { kind: 'purchase-register/excel', label: 'Purchase Register (.xlsx)' },
  { kind: 'purchase-register/csv', label: 'Purchase Register (.csv)' },
  { kind: 'cmp08/excel', label: 'CMP-08 Working Paper (.xlsx)', needs: 'quarter' },
  { kind: 'cmp08/pdf', label: 'CMP-08 Working Paper (.pdf)', needs: 'quarter' },
  { kind: 'gstr4/excel', label: 'GSTR-4 Working Paper (.xlsx)', needs: 'annual' },
]

const VALIDATION_BADGE: Record<string, string> = {
  clean: 'bg-emerald-100 text-emerald-700',
  warnings: 'bg-amber-100 text-amber-700',
  errors: 'bg-red-100 text-red-700',
  not_validated: 'bg-slate-100 text-slate-600',
}

export default function GstExportsPage() {
  const gst = useGstScope()
  const { period } = useGstPeriod(gst)
  const [exports, setExports] = useState<GstReportExport[]>([])
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await gstGet<GstReportExport[]>('/exports')
      setExports(data || [])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load export history')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pagination = usePagination(exports)

  const doExport = async (kind: GstExportKind) => {
    setBusy(kind)
    try {
      await downloadGstExport(gst.scope, kind, period?.id)
      notifySuccess('Export downloaded')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy('')
    }
  }

  return (
    <GstReportShell
      gst={gst}
      title="Exports & History"
      description="Download working papers in Excel, CSV or PDF, and review the audit history of previously generated exports."
    >
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Generate for current scope</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXPORT_BUTTONS.map((b) => {
            const disabled = busy !== '' || (b.needs === 'quarter' && gst.scope.mode !== 'quarter') || (b.needs === 'annual' && gst.scope.mode !== 'annual')
            return (
              <Button key={b.kind} size="sm" variant="outline" disabled={disabled} onClick={() => doExport(b.kind)}>
                <Download className="h-4 w-4 mr-1.5" />
                {busy === b.kind ? 'Exporting…' : b.label}
              </Button>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Export History</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Generated</TableHead>
                <TableHead>Export</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Report Ver.</TableHead>
                <TableHead>Validation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(e.generated_at)}</TableCell>
                  <TableCell>{e.export_type.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="uppercase text-xs">{e.file_format}</TableCell>
                  <TableCell className="font-mono text-xs">{e.file_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.record_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.report_version || '—'}</TableCell>
                  <TableCell>
                    <Badge className={VALIDATION_BADGE[e.validation_status] || 'bg-slate-100 text-slate-600'}>
                      {e.validation_status || 'not_validated'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {exports.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No exports generated yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />
    </GstReportShell>
  )
}
