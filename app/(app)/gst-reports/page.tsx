'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { gstGet, GST_PERIOD_STATUS_COLORS } from '@/lib/gstComposition'
import { AlertTriangle, FileWarning, Info } from 'lucide-react'

export default function GstDashboardPage() {
  const gst = useGstScope()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await gstGet(`/dashboard?${gst.query}`)
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [gst.query, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const ss = data?.sales_summary
  const ps = data?.purchase_summary
  const period = data?.return_period

  return (
    <GstReportShell
      gst={gst}
      title="GST Composition Dashboard"
      description="Turnover, levy estimate and filing position for the selected period. Figures are computed from billing records, not from the GST portal."
    >
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}
      {!data?.registration && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            No GST registration is configured. Set one up under{' '}
            <Link href="/gst-reports/config" className="underline font-medium">Configuration</Link>{' '}
            to enable composition calculations.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Gross Sales" value={formatCurrency(ss?.gross_sales ?? 0)} hint={`${ss?.invoice_count ?? 0} invoices`} />
        <SummaryStat label="Net Sales" value={formatCurrency(ss?.net_sales ?? 0)} hint={`returns ${formatCurrency(ss?.sales_return_amount ?? 0)}`} />
        <SummaryStat label="Taxable Outward Supplies" value={formatCurrency(ss?.taxable_supply_value ?? 0)} />
        <SummaryStat label="Exempt + Nil Rated" value={formatCurrency((ss?.exempt_supply_value ?? 0) + (ss?.nil_rated_supply_value ?? 0))} />
        <SummaryStat label="Composition Turnover" value={formatCurrency(ss?.composition_turnover_basis ?? 0)} hint="levy basis" tone="brand" />
        <SummaryStat label="Estimated Levy" value={formatCurrency(data?.liability?.total_composition_liability ?? 0)} hint={`${data?.liability?.composition_rate ?? 0}% estimated`} tone="warning" />
        <SummaryStat label="RCM Liability" value={formatCurrency(data?.liability?.rcm_liability ?? 0)} hint={`base ${formatCurrency(data?.liability?.rcm_taxable_value ?? 0)}`} />
        <SummaryStat label="Tax Paid" value={formatCurrency(data?.tax_paid ?? 0)} hint={`${formatCurrency(data?.tax_paid_unverified ?? 0)} unverified`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Outstanding Liability" value={formatCurrency(Math.max(0, data?.outstanding_liability ?? 0))} hint="estimated, not portal-verified" tone={data?.outstanding_liability > 0 ? 'danger' : 'success'} />
        <SummaryStat label="Open Errors" value={String(data?.open_errors ?? 0)} hint="validation issues" tone={data?.open_errors > 0 ? 'danger' : 'default'} />
        <SummaryStat label="Open Warnings" value={String(data?.open_warnings ?? 0)} tone={data?.open_warnings > 0 ? 'warning' : 'default'} />
        <SummaryStat label="Purchases" value={formatCurrency((ps?.registered_supplier_purchase_value ?? 0) + (ps?.unregistered_supplier_purchase_value ?? 0))} hint={`${ps?.purchase_invoice_count ?? 0} bills`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Return Preparation Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>CMP-08 (quarterly)</span>
              <Badge className={GST_PERIOD_STATUS_COLORS[data?.cmp08_status] || 'bg-slate-100 text-slate-700'}>
                {data?.cmp08_status || 'not_started'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>GSTR-4 (annual)</span>
              <Badge className={GST_PERIOD_STATUS_COLORS[data?.gstr4_status] || 'bg-slate-100 text-slate-700'}>
                {data?.gstr4_status || 'not_started'}
              </Badge>
            </div>
            {period?.generated_at && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Last report generated {formatDateTime(period.generated_at)}
              </div>
            )}
            {period?.filed_at && (
              <div className="text-xs text-emerald-700">
                Marked filed {period.filed_at?.slice(0, 10)}
                {period.portal_reference ? ` — ARN ${period.portal_reference}` : ''}
              </div>
            )}
            <p className="text-xs text-muted-foreground border-t pt-2 flex gap-1.5">
              <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Filing status reflects only manually recorded evidence (ARN). Report generation or export does not file a return.
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/gst-reports/cmp08">Open CMP-08</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/gst-reports/gstr4">Open GSTR-4</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {[
              ['Taxable supplies', ss?.taxable_supply_value],
              ['Nil-rated supplies', ss?.nil_rated_value ?? ss?.nil_rated_supply_value],
              ['Exempt supplies', ss?.exempt_supply_value],
              ['Non-GST supplies', ss?.non_gst_supply_value],
              ['Discounts', ss?.discount_amount],
              ['Sales returns', ss?.sales_return_amount],
              ['Credit notes', ss?.credit_note_value],
              ['Inter-state outward (review)', ss?.interstate_outward_supply_value],
            ].map(([label, v]) => (
              <div key={label as string} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{formatCurrency((v as number) ?? 0)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1.5 font-semibold">
              <span>Composition turnover basis</span>
              <span className="tabular-nums">{formatCurrency(ss?.composition_turnover_basis ?? 0)}</span>
            </div>
            <div className="pt-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/gst-reports/sales">Drill into sales register</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
    </GstReportShell>
  )
}
