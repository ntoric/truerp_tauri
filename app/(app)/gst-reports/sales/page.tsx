'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import { downloadGstExport, gstGet, type GstSalesRegisterRow } from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { Download } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const CLS_COLORS: Record<string, string> = {
  taxable: 'bg-emerald-100 text-emerald-700',
  nil_rated: 'bg-sky-100 text-sky-700',
  exempt: 'bg-violet-100 text-violet-700',
  non_gst: 'bg-slate-100 text-slate-600',
  mixed: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-600',
  return: 'bg-orange-100 text-orange-700',
  credit_note: 'bg-orange-100 text-orange-700',
  unclassified: 'bg-red-100 text-red-700',
}

export default function GstSalesPage() {
  const gst = useGstScope()
  const [rows, setRows] = useState<GstSalesRegisterRow[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [docType, setDocType] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await gstGet(`/sales-register?${gst.query}`)
      setRows(d.rows || [])
      setSummary(d.summary)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load sales register')
    } finally {
      setLoading(false)
    }
  }, [gst.query, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const filtered = rows.filter((r) => {
    if (docType !== 'all' && r.document_type !== docType) return false
    if (status !== 'all' && r.invoice_status !== status) return false
    if (search) {
      const hay = `${r.invoice_number} ${r.customer_name} ${r.customer_gstin}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })
  const pagination = usePagination(filtered)

  const doExport = async (kind: 'sales-register/excel' | 'sales-register/csv') => {
    setExporting(true)
    try {
      await downloadGstExport(gst.scope, kind)
      notifySuccess('Export downloaded')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const summaryRows: [string, number | undefined][] = summary
    ? [
        ['Invoice count', summary.invoice_count],
        ['Gross sales', summary.gross_sales],
        ['Discounts', summary.discount_amount],
        ['Sales returns', summary.sales_return_amount],
        ['Credit notes', summary.credit_note_value],
        ['Net sales', summary.net_sales],
        ['Taxable supplies', summary.taxable_supply_value],
        ['Nil-rated supplies', summary.nil_rated_supply_value],
        ['Exempt supplies', summary.exempt_supply_value],
        ['Non-GST supplies', summary.non_gst_supply_value],
        ['Inter-state outward (review)', summary.interstate_outward_supply_value],
        ['Cancelled invoices', summary.cancelled_invoice_count],
      ]
    : []

  return (
    <GstReportShell
      gst={gst}
      title="Sales — Outward Supplies"
      description="Every figure traces back to a billing document. Cancelled and draft documents are shown for audit but excluded from totals."
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={exporting}>
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => doExport('sales-register/excel')}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport('sales-register/csv')}>CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">Sales Register</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader><CardTitle className="text-base">Sales Summary — {summary?.period}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {summaryRows.map(([label, v]) => (
                    <TableRow key={label}>
                      <TableCell className="text-muted-foreground">{label}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {label.includes('count') || label.includes('invoices') ? v ?? 0 : formatCurrency(v ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Composition turnover basis</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(summary?.composition_turnover_basis ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search invoice / customer / GSTIN"
              className="h-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All documents</SelectItem>
                <SelectItem value="sales_invoice">Invoices</SelectItem>
                <SelectItem value="sales_return">Sales returns</SelectItem>
                <SelectItem value="credit_note">Credit notes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto self-center text-sm text-muted-foreground">
              {filtered.length} document{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doc No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Txn</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Composition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((r) => (
                    <TableRow key={`${r.source_type}-${r.source_id}`} className={r.included_in_totals ? '' : 'opacity-55'}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link href={r.source_type === 'invoice' ? `/invoices/${r.source_id}` : '#'} className="hover:underline">
                          {r.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.invoice_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.document_type.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{r.invoice_status}</TableCell>
                      <TableCell>
                        <div>{r.customer_name}</div>
                        {r.customer_gstin && <div className="text-xs text-muted-foreground">{r.customer_gstin}</div>}
                      </TableCell>
                      <TableCell>{r.transaction_type}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.gross_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.net_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.taxable_value)}</TableCell>
                      <TableCell>
                        <Badge className={CLS_COLORS[r.supply_classification] || 'bg-slate-100 text-slate-600'}>
                          {r.supply_classification}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.composition_turnover === 'review' ? (
                          <Badge className="bg-amber-100 text-amber-700">inter-state review</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">{r.composition_turnover}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No documents in this period</TableCell></TableRow>
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
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        </TabsContent>
      </Tabs>
    </GstReportShell>
  )
}
