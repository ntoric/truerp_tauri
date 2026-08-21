'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import {
  buildDailyReportShareText,
  buildPeriodReportShareText,
  buildPeriodicReportQuery,
  dailyReportSections,
  dailyReportSummaryHelp,
  downloadDailyReportJson,
  downloadDailyReportPdf,
  downloadPeriodReportJson,
  downloadPeriodReportPdf,
  paymentMethodsForReport,
  PERIODIC_REPORT_OPTIONS,
  type DailyReport,
  type PeriodicReportPeriod,
  type PeriodReport,
  type PaymentMethodTotal,
  type ExpenseLine,
  type LoyaltyReportSummary,
} from '@/lib/dailyReport'
import { downloadBlob } from '@/lib/accountingExport'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  CalendarDays,
  Download,
  Share2,
  Mail,
  Copy,
  TrendingDown,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Package,
  CalendarRange,
  RefreshCw,
  HelpCircle,
  Banknote,
  Smartphone,
  CreditCard,
  Landmark,
  ScrollText,
  Receipt,
  Gift,
  type LucideIcon,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartISO(date = todayISO()) {
  return `${date.slice(0, 7)}-01`
}

function TermHelp({
  label,
  help,
  hideLabel = false,
}: {
  label: string
  help: string
  hideLabel?: boolean
}) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }

  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <span className="inline-flex items-center gap-1.5">
      {!hideLabel && <span>{label}</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`What ${label} means`}
            className="inline-flex shrink-0 rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
            onFocus={openNow}
            onBlur={closeSoon}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          collisionPadding={12}
          className="w-72 p-3"
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{help}</p>
        </PopoverContent>
      </Popover>
    </span>
  )
}

function methodAppearance(method: string): { icon: LucideIcon; className: string } {
  switch (method) {
    case 'cash':
      return { icon: Banknote, className: 'bg-emerald-100 text-emerald-800' }
    case 'upi':
      return { icon: Smartphone, className: 'bg-sky-100 text-sky-800' }
    case 'card':
      return { icon: CreditCard, className: 'bg-violet-100 text-violet-800' }
    case 'bank_transfer':
      return { icon: Landmark, className: 'bg-indigo-100 text-indigo-800' }
    case 'cheque':
      return { icon: ScrollText, className: 'bg-orange-100 text-orange-800' }
    default:
      return { icon: Wallet, className: 'bg-slate-100 text-slate-800' }
  }
}

function PaymentsByMethodTable({ report }: { report: DailyReport }) {
  const methods = paymentMethodsForReport(report)
  if (methods.length === 0) return null

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-blue-200">
      <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3">
        <Wallet className="h-4 w-4 text-blue-700" />
        <h3 className="text-sm font-semibold text-blue-900">Payments by method</h3>
        <TermHelp
          label="Payments by method"
          hideLabel
          help="Money received and paid for each payment method in this period. Cash, UPI, Card, Bank Transfer, and Cheque are always listed."
        />
      </div>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-blue-50/60 text-left text-blue-900">
            <tr>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium text-right">Received</th>
              <th className="px-4 py-3 font-medium text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((row: PaymentMethodTotal) => {
              const appearance = methodAppearance(row.method)
              const Icon = appearance.icon
              return (
                <tr key={row.method} className="border-t border-blue-100">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full',
                          appearance.className
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-emerald-800">
                      {formatCurrency(row.in.total_amount)}
                    </p>
                    <p className="text-xs text-gray-500">{row.in.count} txn</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-amber-800">
                      {formatCurrency(row.out.total_amount)}
                    </p>
                    <p className="text-xs text-gray-500">{row.out.count} txn</p>
                  </td>
                </tr>
              )
            })}
            <tr className="border-t border-blue-200 bg-blue-50">
              <td className="px-4 py-3 font-semibold text-blue-900">Total</td>
              <td className="px-4 py-3 text-right">
                <p className="font-semibold text-emerald-900">
                  {formatCurrency(report.payments_in.total_amount)}
                </p>
                <p className="text-xs text-blue-800">{report.payments_in.count} txn</p>
              </td>
              <td className="px-4 py-3 text-right">
                <p className="font-semibold text-amber-900">
                  {formatCurrency(report.payments_out.total_amount)}
                </p>
                <p className="text-xs text-blue-800">{report.payments_out.count} txn</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExpensesTable({ report }: { report: DailyReport }) {
  const expenses = report.expense_lines ?? []
  if (expenses.length === 0) return null

  const methodLabel = (mode: string): string => {
    if (!mode) return '-'
    const match = (report.payments_by_method ?? []).find((m) => m.method === mode)
    if (match) return match.label
    return mode
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const distinctExpenses = new Set(expenses.map((e) => e.expense_number)).size

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-amber-200">
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <Receipt className="h-4 w-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Expenses</h3>
        <span className="text-xs text-amber-700">
          {distinctExpenses} {distinctExpenses === 1 ? 'expense' : 'expenses'} ·{' '}
          {expenses.length} {expenses.length === 1 ? 'item' : 'items'} ·{' '}
          {formatCurrency(report.expenses.total_amount)}
        </span>
      </div>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-amber-50/60 text-left text-amber-900">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-right">Unit price</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((line: ExpenseLine, idx: number) => {
              const isFirstOfExpense =
                idx === 0 || expenses[idx - 1].expense_number !== line.expense_number
              const itemDesc = line.item_description || line.description || '-'
              return (
                <tr
                  key={(line.item_id ?? line.id) ?? idx}
                  className={cn(
                    'border-t border-amber-100',
                    isFirstOfExpense && 'bg-amber-50/40'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {isFirstOfExpense ? line.expense_number || '-' : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {isFirstOfExpense ? formatDate(line.date + 'T00:00:00') : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {isFirstOfExpense ? line.category || '-' : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <span className="flex flex-col">
                      <span>{itemDesc}</span>
                      {isFirstOfExpense && (
                        <span className="text-xs text-gray-500">
                          {line.vendor || '-'} · {methodLabel(line.payment_mode)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{line.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(line.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-800">
                    {formatCurrency(line.amount)}
                  </td>
                </tr>
              )
            })}
            <tr className="border-t border-amber-200 bg-amber-50">
              <td colSpan={6} className="px-4 py-3 font-semibold text-amber-900">
                Total ({distinctExpenses} {distinctExpenses === 1 ? 'expense' : 'expenses'},{' '}
                {expenses.length} {expenses.length === 1 ? 'item' : 'items'})
              </td>
              <td className="px-4 py-3 text-right font-semibold text-amber-900">
                {formatCurrency(report.expenses.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LoyaltySummaryTable({ report }: { report: DailyReport }) {
  const loyalty = report.loyalty
  if (!loyalty || !loyalty.enabled) return null
  if (loyalty.points_earned === 0 && loyalty.points_redeemed === 0) return null

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-amber-200">
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <Gift className="h-4 w-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Loyalty points</h3>
        <span className="text-xs text-amber-700">
          {loyalty.points_earned.toLocaleString()} earned · {loyalty.points_redeemed.toLocaleString()} redeemed
        </span>
      </div>
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-amber-50/60 text-left text-amber-900">
            <tr>
              <th className="px-4 py-3 font-medium">Activity</th>
              <th className="px-4 py-3 font-medium text-right">Transactions</th>
              <th className="px-4 py-3 font-medium text-right">Points</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-amber-100">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp
                  label="Points earned"
                  help={dailyReportSummaryHelp.loyalty_points_earned}
                />
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{loyalty.earn_transactions}</td>
              <td className="px-4 py-3 text-right font-semibold text-emerald-800">
                {loyalty.points_earned.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">—</td>
            </tr>
            <tr className="border-t border-amber-100">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp
                  label="Points redeemed"
                  help={dailyReportSummaryHelp.loyalty_points_redeemed}
                />
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{loyalty.redeem_transactions}</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-800">
                {loyalty.points_redeemed.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-amber-800">
                {formatCurrency(loyalty.redemption_value)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReportSummaryBody({
  report,
  profitLabel = 'Period profit',
}: {
  report: DailyReport
  profitLabel?: string
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            {report.payments_out.count} payments · AP{' '}
            {formatCurrency(report.accounts_payable?.total_amount || 0)}
          </p>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4',
            (report.daily_profit ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              (report.daily_profit ?? 0) >= 0 ? 'text-emerald-800' : 'text-red-800'
            )}
          >
            <CircleDollarSign className="h-4 w-4" />
            <span className="text-sm font-medium">{profitLabel}</span>
          </div>
          <p
            className={cn(
              'mt-2 text-2xl font-bold',
              (report.daily_profit ?? 0) >= 0 ? 'text-emerald-900' : 'text-red-900'
            )}
          >
            {formatCurrency(report.daily_profit ?? 0)}
          </p>
          <p className="text-xs text-gray-600">Sales − purchases − expenses ± returns</p>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4',
            (report.product_profit ?? 0) >= 0 ? 'bg-teal-50' : 'bg-red-50'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              (report.product_profit ?? 0) >= 0 ? 'text-teal-800' : 'text-red-800'
            )}
          >
            <Package className="h-4 w-4" />
            <span className="text-sm font-medium">Product profit</span>
          </div>
          <p
            className={cn(
              'mt-2 text-2xl font-bold',
              (report.product_profit ?? 0) >= 0 ? 'text-teal-900' : 'text-red-900'
            )}
          >
            {formatCurrency(report.product_profit ?? 0)}
          </p>
          <p className="text-xs text-gray-600">Sale value − purchase cost on items sold</p>
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
          <p className="text-xs text-gray-600">Payments in − out − expenses</p>
        </div>
      </div>

      <div className="table-scroll rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium text-right">Transactions</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {dailyReportSections.map(({ key, label, help }) => {
              const metric = report[key] as DailyReport['sales']
              return (
                <tr key={key} className="border-t">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <TermHelp label={label} help={help} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{metric.count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(metric.total_amount)}
                  </td>
                </tr>
              )
            })}
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp
                  label="Accounts Payable (total outstanding)"
                  help={dailyReportSummaryHelp.accounts_payable_total}
                />
              </td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatCurrency(report.accounts_payable_total || 0)}
              </td>
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp label="GST collected (sales)" help={dailyReportSummaryHelp.gst_collected} />
              </td>
              <td className="px-4 py-3 text-right">—</td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatCurrency(report.gst_collected)}
              </td>
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp
                  label={`${profitLabel} (accrual)`}
                  help={dailyReportSummaryHelp.daily_profit}
                />
              </td>
              <td className="px-4 py-3 text-right">—</td>
              <td
                className={cn(
                  'px-4 py-3 text-right font-semibold',
                  (report.daily_profit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                )}
              >
                {formatCurrency(report.daily_profit ?? 0)}
              </td>
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp
                  label="Product profit (items sold)"
                  help={dailyReportSummaryHelp.product_profit}
                />
              </td>
              <td className="px-4 py-3 text-right">—</td>
              <td
                className={cn(
                  'px-4 py-3 text-right font-semibold',
                  (report.product_profit ?? 0) >= 0 ? 'text-teal-700' : 'text-red-700'
                )}
              >
                {formatCurrency(report.product_profit ?? 0)}
              </td>
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <TermHelp label="Net cash flow" help={dailyReportSummaryHelp.net_cash_flow} />
              </td>
              <td className="px-4 py-3 text-right">—</td>
              <td
                className={cn(
                  'px-4 py-3 text-right font-semibold',
                  report.net_cash_flow >= 0 ? 'text-blue-700' : 'text-red-700'
                )}
              >
                {formatCurrency(report.net_cash_flow)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaymentsByMethodTable report={report} />

      <ExpensesTable report={report} />

      <LoyaltySummaryTable report={report} />

      <p className="mt-4 text-xs text-gray-500">
        Period profit = sales − purchases − expenses ± returns/notes (accrual). Product profit =
        taxable sale value − product purchase cost on invoice lines, net of sales returns and credit
        notes. Purchase expense = full bill total; Payment out = amount paid; Accounts payable =
        unpaid balance. A separate Payments by method table lists Cash, UPI, Card, Bank Transfer,
        and Cheque received vs paid. Cancelled documents are excluded from counts.
      </p>
    </>
  )
}

export default function DailyReportPage() {
  const [reportDate, setReportDate] = useState(todayISO)
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  const [period, setPeriod] = useState<PeriodicReportPeriod>('monthly')
  const [periodAnchor, setPeriodAnchor] = useState(todayISO)
  const [customStart, setCustomStart] = useState(monthStartISO())
  const [customEnd, setCustomEnd] = useState(todayISO)
  const [periodReport, setPeriodReport] = useState<PeriodReport | null>(null)
  const [periodLoading, setPeriodLoading] = useState(false)
  const [periodGenerated, setPeriodGenerated] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/dashboard/daily-report?date=${reportDate}`)
      if (res.ok) {
        setReport(await res.json())
      } else {
        setReport(null)
        notifyError('Failed to load daily report')
      }
    } catch {
      notifyError('Failed to load daily report')
    } finally {
      setLoading(false)
    }
  }, [reportDate])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const generatePeriodicReport = useCallback(async () => {
    setPeriodLoading(true)
    try {
      const qs = buildPeriodicReportQuery({
        period,
        date: periodAnchor,
        startDate: customStart,
        endDate: customEnd,
      })
      const res = await apiFetch(`/dashboard/periodic-report?${qs}`)
      if (res.ok) {
        setPeriodReport(await res.json())
        setPeriodGenerated(true)
      } else {
        const err = await res.json().catch(() => ({}))
        setPeriodReport(null)
        notifyError((err as { error?: string }).error || 'Failed to generate periodic report')
      }
    } catch {
      notifyError('Failed to generate periodic report')
    } finally {
      setPeriodLoading(false)
    }
  }, [period, periodAnchor, customStart, customEnd])

  const shareText = report ? buildDailyReportShareText(report) : ''
  const periodShareText = periodReport ? buildPeriodReportShareText(periodReport) : ''

  const copyText = async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      notifySuccess('Report copied to clipboard')
    } catch {
      notifyError('Could not copy report')
    }
  }

  const shareTextContent = async (text: string, title: string) => {
    if (!text) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    await copyText(text)
  }

  const emailText = (text: string, subject: string) => {
    if (!text) return
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  }

  const exportCsv = async () => {
    try {
      const res = await apiFetch(`/dashboard/daily-report/export?date=${reportDate}`)
      if (!res.ok) {
        notifyError('Export failed')
        return
      }
      const blob = await res.blob()
      await downloadBlob(`daily_report_${reportDate}.csv`, blob, {
        label: 'Exporting daily report CSV',
      })
      notifySuccess('CSV exported')
    } catch {
      notifyError('Export failed')
    }
  }

  const exportPeriodCsv = async () => {
    try {
      const qs = buildPeriodicReportQuery({
        period,
        date: periodAnchor,
        startDate: customStart,
        endDate: customEnd,
      })
      const res = await apiFetch(`/dashboard/periodic-report/export?${qs}`)
      if (!res.ok) {
        notifyError('Export failed')
        return
      }
      const blob = await res.blob()
      await downloadBlob(`periodic_report_${period}.csv`, blob, {
        label: 'Exporting periodic report CSV',
      })
      notifySuccess('CSV exported')
    } catch {
      notifyError('Export failed')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Business Reports</h1>
          </div>
          <Link href="/reports" className="text-sm font-medium text-blue-600 hover:underline">
            Analytics reports
          </Link>
        </div>

        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList>
            <TabsTrigger value="daily" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Daily report
            </TabsTrigger>
            <TabsTrigger value="periodic" className="gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              Periodic reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
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
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void shareTextContent(
                        shareText,
                        report?.business_name
                          ? `Daily Report — ${report.business_name}`
                          : 'Daily Business Report'
                      )
                    }
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      emailText(
                        shareText,
                        report?.business_name
                          ? `Daily Report — ${report.business_name} — ${reportDate}`
                          : `Daily Report — ${reportDate}`
                      )
                    }
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText(shareText)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          void downloadDailyReportPdf(reportDate)
                            .then(() => notifySuccess('PDF exported'))
                            .catch(() => notifyError('PDF export failed'))
                        }
                      >
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void exportCsv()}>Download CSV</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (!report) return
                          void downloadDailyReportJson(report)
                            .then(() => notifySuccess('JSON exported'))
                            .catch(() => notifyError('Export failed'))
                        }}
                      >
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
                  <ReportSummaryBody report={report} profitLabel="Daily profit" />
                ) : (
                  <p className="py-8 text-center text-gray-500">No report data for this date.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periodic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generate periodic report</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View aggregated business metrics for a day, week, month, year, or custom date range.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Period</Label>
                    <Select
                      value={period}
                      onValueChange={(value) => setPeriod(value as PeriodicReportPeriod)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODIC_REPORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {period !== 'custom' ? (
                    <div className="space-y-1.5">
                      <Label>
                        {period === 'daily'
                          ? 'Date'
                          : period === 'weekly'
                            ? 'Any day in week'
                            : period === 'monthly'
                              ? 'Any day in month'
                              : 'Any day in year'}
                      </Label>
                      <input
                        type="date"
                        value={periodAnchor}
                        onChange={(e) => setPeriodAnchor(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label>Start date</Label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>End date</Label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full gap-2"
                      onClick={() => void generatePeriodicReport()}
                      disabled={periodLoading}
                    >
                      <RefreshCw className={cn('h-4 w-4', periodLoading && 'animate-spin')} />
                      {periodLoading ? 'Generating…' : 'Generate report'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-lg">
                      {periodReport?.business_name || 'Business'}
                      {periodReport?.label ? ` · ${periodReport.label}` : ''}
                    </CardTitle>
                    {periodReport && (
                      <p className="text-xs text-muted-foreground">
                        {periodReport.start_date} → {periodReport.end_date}
                      </p>
                    )}
                  </div>
                </div>
                {periodReport && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void shareTextContent(
                          periodShareText,
                          periodReport.business_name
                            ? `Periodic Report — ${periodReport.business_name}`
                            : 'Periodic Business Report'
                        )
                      }
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        emailText(
                          periodShareText,
                          `Periodic Report — ${periodReport.label || period}`
                        )
                      }
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText(periodShareText)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            void downloadPeriodReportPdf({
                              period,
                              date: periodAnchor,
                              startDate: customStart,
                              endDate: customEnd,
                            })
                              .then(() => notifySuccess('PDF exported'))
                              .catch((err) =>
                                notifyError(err instanceof Error ? err.message : 'PDF export failed')
                              )
                          }
                        >
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void exportPeriodCsv()}>
                          Download CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void downloadPeriodReportJson(periodReport)
                              .then(() => notifySuccess('JSON exported'))
                              .catch(() => notifyError('Export failed'))
                          }
                        >
                          Download JSON
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {periodLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  </div>
                ) : periodReport ? (
                  <ReportSummaryBody report={periodReport} profitLabel="Period profit" />
                ) : (
                  <p className="py-10 text-center text-sm text-gray-500">
                    {periodGenerated
                      ? 'No report data for this period.'
                      : 'Choose a period and click Generate report to view results.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
