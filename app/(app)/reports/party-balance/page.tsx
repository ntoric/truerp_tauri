'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import PaginationControls from '@/components/ui/pagination-controls'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { getServerTime, type ServerTimeInfo } from '@/lib/dailyReport'
import {
  downloadPartyBalanceReport,
  fetchPartyBalanceReport,
  getPartyBalanceEmailSettings,
  sendPartyBalanceEmailNow,
  updatePartyBalanceEmailSettings,
  PARTY_BALANCE_REPORT_DAY_OPTIONS,
  type PartyBalanceEmailSettings,
  type PartyBalanceReport,
  type PartyBalanceReportDay,
  type PartyBalanceType,
} from '@/lib/partyBalanceReport'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  Mail,
  RefreshCw,
  Search,
} from 'lucide-react'

const PARTY_TYPE_OPTIONS: { value: PartyBalanceType; label: string }[] = [
  { value: 'all', label: 'All parties' },
  { value: 'customer', label: 'Customers' },
  { value: 'vendor', label: 'Vendors' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Signed balance → "₹x" with a To collect / To pay hint. */
function BalanceCell({ value, strong }: { value: number; strong?: boolean }) {
  if (value === 0) return <span className="text-gray-400">{formatCurrency(0)}</span>
  const receivable = value > 0
  return (
    <span className={cn(strong && 'font-semibold', receivable ? 'text-emerald-700' : 'text-red-700')}>
      {formatCurrency(Math.abs(value))}
      <span className="ml-1 text-[11px] font-normal text-gray-500">
        {receivable ? 'To collect' : 'To pay'}
      </span>
    </span>
  )
}

/** Signed change in balance over the day (closing − opening). */
function DifferenceCell({ value, strong }: { value: number; strong?: boolean }) {
  if (value === 0) return <span className="text-gray-400">—</span>
  return (
    <span className={cn(strong && 'font-semibold', value > 0 ? 'text-amber-700' : 'text-blue-700')}>
      {value > 0 ? '+' : '−'}
      {formatCurrency(Math.abs(value))}
    </span>
  )
}

function PartyBalanceEmailCard() {
  const [settings, setSettings] = useState<PartyBalanceEmailSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverTime, setServerTime] = useState<ServerTimeInfo | null>(null)

  const [isEnabled, setIsEnabled] = useState(false)
  const [recipients, setRecipients] = useState('')
  const [reportDay, setReportDay] = useState<PartyBalanceReportDay>('today')
  const [partyType, setPartyType] = useState<PartyBalanceType>('all')
  const [sendTime, setSendTime] = useState('21:00')
  const [subject, setSubject] = useState('')

  const applySettings = (s: PartyBalanceEmailSettings) => {
    setSettings(s)
    setIsEnabled(s.is_enabled)
    setRecipients(s.recipient_emails || '')
    setReportDay(s.report_day || 'today')
    setPartyType(s.party_type || 'all')
    setSendTime(s.send_time || '21:00')
    setSubject(s.subject || '')
  }

  useEffect(() => {
    getPartyBalanceEmailSettings()
      .then(applySettings)
      .catch((err) => notifyError(err instanceof Error ? err.message : 'Failed to load email settings'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let active = true
    const tick = () =>
      getServerTime()
        .then((info) => active && setServerTime(info))
        .catch(() => undefined)
    void tick()
    const interval = setInterval(tick, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      applySettings(
        await updatePartyBalanceEmailSettings({
          is_enabled: isEnabled,
          recipient_emails: recipients,
          report_day: reportDay,
          party_type: partyType,
          send_time: sendTime,
          subject,
        })
      )
      notifySuccess('Report email settings saved')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const sendNow = async () => {
    setSending(true)
    try {
      const result = await sendPartyBalanceEmailNow()
      if (result.settings) setSettings(result.settings)
      if (result.warning) {
        notifyError(`Sent ${result.sent_count} of ${result.total}. ${result.warning_msg || ''}`)
      } else {
        notifySuccess(`Report email sent to ${result.sent_count} recipient(s)`)
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to send report email')
    } finally {
      setSending(false)
    }
  }

  const stamp = (iso?: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    return `${formatDate(d.toISOString())} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  const statusLabel =
    settings?.last_sent_status === 'success'
      ? '✓ sent'
      : settings?.last_sent_status === 'partial'
        ? '⚠ partial'
        : settings?.last_sent_status === 'failed'
          ? '✗ failed'
          : ''

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <div>
            <CardTitle className="text-base">Auto-email report PDF</CardTitle>
            <p className="text-sm text-muted-foreground">
              Email the party balance report PDF to a list of recipients at a scheduled time each day.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{isEnabled ? 'On' : 'Off'}</span>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} aria-label="Enable report email" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Report day</Label>
                <Select value={reportDay} onValueChange={(v) => setReportDay(v as PartyBalanceReportDay)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_BALANCE_REPORT_DAY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parties</Label>
                <Select value={partyType} onValueChange={(v) => setPartyType(v as PartyBalanceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Send time (24h)</Label>
                <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
                <p className="text-xs text-gray-500">
                  {serverTime?.has_configured_timezone
                    ? `In your configured timezone (${serverTime.configured_timezone_name}).`
                    : 'In the server timezone — set a timezone in Developer Settings.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Email subject (optional)</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Defaults to &quot;Party Balance Report — Business — date&quot;"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Recipient email addresses</Label>
              <Textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder={'Comma or newline separated, e.g.\nowner@example.com\naccountant@example.com'}
                rows={3}
              />
              <p className="text-xs text-gray-500">
                SMTP must be configured in Developer Settings for emails to send.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-gray-50 px-3 py-2">
              <div className="space-y-0.5 text-xs text-gray-600">
                <div>
                  <span className="font-medium text-gray-800">Scheduler time:</span>{' '}
                  {serverTime ? (
                    <span>
                      {serverTime.configured_time} (
                      {serverTime.configured_timezone_name || serverTime.configured_timezone || 'server-default'})
                    </span>
                  ) : (
                    <span className="text-gray-400">Loading…</span>
                  )}
                </div>
                <div>
                  <span className="font-medium text-gray-800">Last sent (any):</span>{' '}
                  {stamp(settings?.last_sent_at) ? `${stamp(settings?.last_sent_at)} · ${statusLabel}` : 'Never'}
                  {settings?.last_sent_error && (
                    <span className="ml-2 block text-red-600">{settings.last_sent_error}</span>
                  )}
                </div>
                <div>
                  <span className="font-medium text-gray-800">Last scheduled send:</span>{' '}
                  {stamp(settings?.last_scheduled_at) ?? 'Never (waiting for scheduled time)'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void sendNow()}
                  disabled={sending || !settings?.recipient_emails}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {sending ? 'Sending…' : 'Send now (test)'}
                </Button>
                <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save settings'}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function PartyBalanceReportPage() {
  const [date, setDate] = useState(todayISO)
  const [partyType, setPartyType] = useState<PartyBalanceType>('all')
  const [search, setSearch] = useState('')
  const [report, setReport] = useState<PartyBalanceReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (d: string, t: PartyBalanceType, s: string) => {
    setLoading(true)
    try {
      setReport(await fetchPartyBalanceReport({ date: d, partyType: t, search: s }))
    } catch (err) {
      setReport(null)
      notifyError(err instanceof Error ? err.message : 'Failed to load party balance report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date, partyType, search)
    // Search is applied on submit; date/type reload immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, partyType, load])

  const pagination = usePagination(report?.lines ?? [])
  const params = { date, partyType, search }
  const isToday = date === todayISO()

  const exportFile = (kind: 'excel' | 'pdf') =>
    void downloadPartyBalanceReport(params, kind)
      .then(() => notifySuccess(`${kind === 'excel' ? 'Excel' : 'PDF'} exported`))
      .catch((err) => notifyError(err instanceof Error ? err.message : 'Export failed'))

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="app-page-title">Party Balance Report</h1>
          <div className="flex items-center gap-3">
            <Link href="/parties/ledger" className="text-sm font-medium text-blue-600 hover:underline">
              Party ledger
            </Link>
            <Link href="/reports/daily" className="text-sm font-medium text-blue-600 hover:underline">
              Daily report
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4">
            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                void load(date, partyType, search)
              }}
            >
              <div className="space-y-1.5">
                <Label>Date</Label>
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Parties</Label>
                <Select value={partyType} onValueChange={(v) => setPartyType(v as PartyBalanceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Search</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Party name or phone"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loading ? 'Loading…' : 'Apply'}
                </Button>
                {report && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => exportFile('excel')}>Download Excel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportFile('pdf')}>Download PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-lg">
                  {report?.business_name || 'Business'} · {formatDate(date)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Opening = close of the previous day · Closing ={' '}
                  {isToday ? 'as of now' : 'end of the day'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !report ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : report ? (
              <>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryStat
                    tone="success"
                    icon={ArrowDownLeft}
                    label="Opening receivable"
                    value={formatCurrency(report.opening_receivable)}
                    hint="to collect at day start"
                  />
                  <SummaryStat
                    tone="danger"
                    icon={ArrowUpRight}
                    label="Opening payable"
                    value={formatCurrency(report.opening_payable)}
                    hint="to pay at day start"
                  />
                  <SummaryStat
                    tone="success"
                    icon={ArrowDownLeft}
                    label="Closing receivable"
                    value={formatCurrency(report.closing_receivable)}
                    hint={isToday ? 'to collect now' : 'to collect at day end'}
                  />
                  <SummaryStat
                    tone="danger"
                    icon={ArrowUpRight}
                    label="Closing payable"
                    value={formatCurrency(report.closing_payable)}
                    hint={isToday ? 'to pay now' : 'to pay at day end'}
                  />
                </div>

                {report.lines.length > 0 ? (
                  <>
                    <div className="table-scroll rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600">
                          <tr>
                            <th className="px-4 py-3 font-medium">Party</th>
                            <th className="px-4 py-3 text-right font-medium">Opening Balance</th>
                            <th className="px-4 py-3 text-right font-medium">Debit</th>
                            <th className="px-4 py-3 text-right font-medium">Credit</th>
                            <th className="px-4 py-3 text-right font-medium">Closing Balance</th>
                            <th className="px-4 py-3 text-right font-medium">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagination.paginatedItems.map((line) => (
                            <tr key={line.party_id} className="border-t">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/parties/ledger?party_id=${line.party_id}`}
                                  className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                                >
                                  {line.party_name}
                                </Link>
                                <div className="text-xs capitalize text-gray-500">
                                  {[line.party_type, line.phone].filter(Boolean).join(' · ')}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <BalanceCell value={line.opening_balance} />
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {line.debit ? formatCurrency(line.debit) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {line.credit ? formatCurrency(line.credit) : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <BalanceCell value={line.closing_balance} strong />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <DifferenceCell value={line.difference} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t bg-gray-50 font-semibold">
                          <tr>
                            <td className="px-4 py-3">Total ({report.lines.length} parties)</td>
                            <td className="px-4 py-3 text-right">
                              <BalanceCell value={report.net_opening} />
                            </td>
                            <td className="px-4 py-3 text-right">{formatCurrency(report.total_debit)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(report.total_credit)}</td>
                            <td className="px-4 py-3 text-right">
                              <BalanceCell value={report.net_closing} strong />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DifferenceCell value={report.net_difference} strong />
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <PaginationControls
                      page={pagination.page}
                      totalPages={pagination.totalPages}
                      totalItems={pagination.totalItems}
                      pageSize={pagination.pageSize}
                      onPageChange={pagination.setPage}
                    />
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-gray-500">
                    No parties with an outstanding balance on this day.
                  </p>
                )}

                <p className="mt-4 text-xs text-gray-500">
                  Balances follow the party ledger: “To collect” means the party owes you, “To pay” means
                  you owe the party. Debit = sales, payments out, purchase returns and debit notes dated
                  this day; Credit = payments in, sales returns, purchases and credit notes. Difference = closing −
                  opening (+ means the balance moved towards you being owed more). Parties with
                  a zero opening and closing balance are not listed.
                </p>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-gray-500">No report data.</p>
            )}
          </CardContent>
        </Card>

        <PartyBalanceEmailCard />
      </div>
    </DashboardLayout>
  )
}
