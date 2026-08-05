'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  buildDailyReportShareText,
  dailyReportSections,
  downloadDailyReportJson,
  downloadDailyReportPdf,
  type DailyReport,
} from '@/lib/dailyReport'
import { downloadBlob } from '@/lib/accountingExport'
import { useToast } from '@/hooks/use-toast'
import {
  CalendarDays,
  Download,
  Share2,
  Mail,
  Copy,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function DailyReportPage() {
  const [reportDate, setReportDate] = useState(todayISO)
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/dashboard/daily-report?date=${reportDate}`)
      if (res.ok) {
        setReport(await res.json())
      } else {
        setReport(null)
        toast({ title: 'Failed to load daily report', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Failed to load daily report', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [reportDate, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const shareText = report ? buildDailyReportShareText(report) : ''

  const copyToClipboard = async () => {
    if (!shareText) return
    try {
      await navigator.clipboard.writeText(shareText)
      toast({ title: 'Report copied to clipboard' })
    } catch {
      toast({ title: 'Could not copy report', variant: 'destructive' })
    }
  }

  const shareReport = async () => {
    if (!report || !shareText) return
    const title = report.business_name
      ? `Daily Report — ${report.business_name}`
      : 'Daily Business Report'

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: shareText })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    await copyToClipboard()
  }

  const emailReport = () => {
    if (!report || !shareText) return
    const subject = encodeURIComponent(
      report.business_name
        ? `Daily Report — ${report.business_name} — ${report.date}`
        : `Daily Report — ${report.date}`
    )
    const body = encodeURIComponent(shareText)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const exportCsv = async () => {
    try {
      const res = await apiFetch(`/dashboard/daily-report/export?date=${reportDate}`)
      if (!res.ok) {
        toast({ title: 'Export failed', variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      await downloadBlob(`daily_report_${reportDate}.csv`, blob, {
        label: 'Exporting daily report CSV',
      })
      toast({ title: 'CSV exported' })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const exportJson = async () => {
    if (!report) return
    try {
      await downloadDailyReportJson(report)
      toast({ title: 'JSON exported' })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const exportPdf = async () => {
    try {
      await downloadDailyReportPdf(reportDate)
      toast({ title: 'PDF exported' })
    } catch {
      toast({ title: 'PDF export failed', variant: 'destructive' })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Report</h1>
            <p className="text-sm text-gray-500">
              Purchase expense, payment out, accounts payable, sales, and cash movement
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/reports"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Analytics reports
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">
                {report?.business_name || 'Business'} ·{' '}
                {formatDate(reportDate + 'T00:00:00')}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={shareReport}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={emailReport}>
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="default" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportPdf()}>
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportCsv()}>
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportJson()}>
                    Download JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : report ? (
              <>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border bg-green-50 p-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Sales</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-green-900">
                      {formatCurrency(report.sales.total_amount)}
                    </p>
                    <p className="text-xs text-green-700">{report.sales.count} invoices</p>
                  </div>
                  <div className="rounded-lg border bg-orange-50 p-4">
                    <div className="flex items-center gap-2 text-orange-800">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">Purchase expense</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-orange-900">
                      {formatCurrency(report.purchases.total_amount)}
                    </p>
                    <p className="text-xs text-orange-700">
                      {report.purchases.count} bills · full invoice total
                    </p>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">Payment out</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-amber-900">
                      {formatCurrency(report.payments_out.total_amount)}
                    </p>
                    <p className="text-xs text-amber-700">
                      {report.payments_out.count} payments · AP today{' '}
                      {formatCurrency(report.accounts_payable?.total_amount || 0)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'rounded-lg border p-4',
                      report.net_cash_flow >= 0 ? 'bg-blue-50' : 'bg-red-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        report.net_cash_flow >= 0 ? 'text-blue-800' : 'text-red-800'
                      )}
                    >
                      <Wallet className="h-4 w-4" />
                      <span className="text-sm font-medium">Net cash flow</span>
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-2xl font-bold',
                        report.net_cash_flow >= 0 ? 'text-blue-900' : 'text-red-900'
                      )}
                    >
                      {formatCurrency(report.net_cash_flow)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Payments in − out − expenses
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Section</th>
                        <th className="px-4 py-3 font-medium text-right">Transactions</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReportSections.map(({ key, label }) => {
                        const metric = report[key] as DailyReport['sales']
                        return (
                          <tr key={key} className="border-t">
                            <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              {metric.count}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(metric.total_amount)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="border-t bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          Accounts Payable (total outstanding)
                        </td>
                        <td className="px-4 py-3 text-right">—</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(report.accounts_payable_total || 0)}
                        </td>
                      </tr>
                      <tr className="border-t bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">GST collected (sales)</td>
                        <td className="px-4 py-3 text-right">—</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(report.gst_collected)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-gray-500">
                  Purchase expense = full bill total; Payment out = amount paid; Accounts payable =
                  unpaid balance. Cancelled documents are excluded from counts.
                </p>
              </>
            ) : (
              <p className="py-8 text-center text-gray-500">No report data for this date.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
