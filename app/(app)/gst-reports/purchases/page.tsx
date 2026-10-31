'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { downloadGstExport, gstGet, type GstPurchaseRegisterRow } from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { Download } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function GstPurchasesPage() {
  const gst = useGstScope()
  const [rows, setRows] = useState<GstPurchaseRegisterRow[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [docType, setDocType] = useState('all')
  const [reg, setReg] = useState('all')
  const [rcmOnly, setRcmOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await gstGet(`/purchase-register?${gst.query}`)
      setRows(d.rows || [])
      setSummary(d.summary)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load purchase register')
    } finally {
      setLoading(false)
    }
  }, [gst.query, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const filtered = rows.filter((r) => {
    if (docType !== 'all' && r.document_type !== docType) return false
    if (reg !== 'all' && r.supplier_registration !== reg) return false
    if (rcmOnly && !r.reverse_charge) return false
    if (search) {
      const hay = `${r.purchase_invoice_number} ${r.supplier_name} ${r.supplier_gstin}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })
  const pagination = usePagination(filtered)

  const doExport = async (kind: 'purchase-register/excel' | 'purchase-register/csv') => {
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
        ['Purchase bills', summary.purchase_invoice_count],
        ['From registered suppliers', summary.registered_supplier_purchase_value],
        ['From unregistered suppliers', summary.unregistered_supplier_purchase_value],
        ['Purchase returns', summary.purchase_return_value],
        ['Purchase discounts', summary.purchase_discount_value],
        ['Intra-state purchases', summary.intrastate_purchase_value],
        ['Inter-state purchases', summary.interstate_purchase_value],
        ['Taxable purchases', summary.taxable_purchase_value],
        ['Exempt purchases', summary.exempt_purchase_value],
        ['Supplier GST charged (no ITC under composition)', summary.supplier_gst_amount],
        ['RCM taxable value', summary.rcm_taxable_value],
        ['RCM tax liability', summary.rcm_tax_liability],
      ]
    : []

  return (
    <GstReportShell
      gst={gst}
      title="Purchases — Inward Supplies"
      description="Purchase register for annual reporting and RCM review. Input tax credit is not available to composition taxpayers and is never shown."
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={exporting}>
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => doExport('purchase-register/excel')}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport('purchase-register/csv')}>CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">Purchase Register</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader><CardTitle className="text-base">Purchase Summary — {summary?.period}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {summaryRows.map(([label, v]) => (
                    <TableRow key={label}>
                      <TableCell className="text-muted-foreground">{label}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {label.includes('bills') ? v ?? 0 : formatCurrency(v ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search bill / supplier / GSTIN"
              className="h-9 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All documents</SelectItem>
                <SelectItem value="purchase_bill">Purchase bills</SelectItem>
                <SelectItem value="purchase_return">Purchase returns</SelectItem>
                <SelectItem value="debit_note">Debit notes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reg} onValueChange={setReg}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="unregistered">Unregistered</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={rcmOnly} onChange={(e) => setRcmOnly(e.target.checked)} className="h-4 w-4" />
              Reverse charge only
            </label>
            <span className="ml-auto self-center text-sm text-muted-foreground">
              {filtered.length} document{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Reg.</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead>RCM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((r) => (
                    <TableRow key={`${r.source_type}-${r.source_id}`} className={r.included_in_totals ? '' : 'opacity-55'}>
                      <TableCell className="font-medium whitespace-nowrap">{r.purchase_invoice_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.purchase_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.document_type.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <div>{r.supplier_name}</div>
                        {r.supplier_gstin && <div className="text-xs text-muted-foreground">{r.supplier_gstin}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge className={r.supplier_registration === 'registered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {r.supplier_registration === 'registered' ? 'Reg' : 'URD'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.net_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.taxable_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.cgst_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.sgst_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.igst_amount)}</TableCell>
                      <TableCell>
                        {r.reverse_charge ? (
                          <Badge className="bg-amber-100 text-amber-700">RCM {formatCurrency(r.rcm_tax_amount)}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
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
