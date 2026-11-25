'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess, notifyWarning } from '@/lib/notify'
import { fetchPartyLedger, type PartyLedger } from '@/lib/partyLedger'
import {
  DEFAULT_STATEMENT_TEMPLATE,
  SAMPLE_STATEMENT_VALUES,
  STATEMENT_CHANNELS,
  STATEMENT_PERIODS,
  displayDate,
  downloadPartyStatementPdf,
  fetchPartyStatementSettings,
  savePartyStatementSchedule,
  sendPartyStatement,
  sendPartyStatementsBulk,
  statementBalanceText,
  statementPeriodRange,
  fetchStatementExclusions,
  DEFAULT_PERIOD_DAYS,
  normalizePeriodDays,
  type BulkStatementSelection,
  type PartyStatementSettings,
  type StatementChannel,
  type StatementPeriod,
} from '@/lib/partyStatement'
import { CalendarClock, FileDown, FileText, Loader2, Send } from 'lucide-react'
import { TelegramLinkPanel } from '@/components/parties/TelegramLinkPanel'
import StatementPeriodDaysInput from '@/components/parties/StatementPeriodDaysInput'
import StatementScheduleFields, { defaultScheduleTiming, type ScheduleTiming } from '@/components/parties/StatementScheduleFields'

type Target =
  | { kind: 'single'; party: { id: string; name: string; phone?: string } }
  | { kind: 'bulk'; selection: BulkStatementSelection; count: number }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: Target | null
  /** Preselects this range instead of the store's default period (e.g. the ledger page's range). */
  initialRange?: { from_date: string; to_date: string }
  onSent?: () => void
}

/** Sends a party's balance statement (summary message + detailed PDF), or queues it for many parties. */
export default function SendStatementDialog({ open, onOpenChange, target, initialRange, onSent }: Props) {
  const [settings, setSettings] = useState<PartyStatementSettings | null>(null)
  const [mode, setMode] = useState<'now' | 'schedule'>('now')
  const [timing, setTiming] = useState<ScheduleTiming>(defaultScheduleTiming)
  const [channel, setChannel] = useState<StatementChannel>('whatsapp')
  const [period, setPeriod] = useState<StatementPeriod>('previous_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [periodDays, setPeriodDays] = useState(DEFAULT_PERIOD_DAYS)
  const [recipient, setRecipient] = useState('')
  const [includeZero, setIncludeZero] = useState(false)
  const [excludedCount, setExcludedCount] = useState(0)
  const [singleExcluded, setSingleExcluded] = useState(false)
  const [ledger, setLedger] = useState<PartyLedger | null>(null)
  const [busy, setBusy] = useState<'send' | 'pdf' | null>(null)

  const single = target?.kind === 'single' ? target.party : null

  useEffect(() => {
    if (!open) return
    setRecipient(single?.phone ?? '')
    setIncludeZero(false)
    setMode('now')
    setTiming(defaultScheduleTiming())
    setExcludedCount(0)
    setSingleExcluded(false)
    fetchStatementExclusions()
      .then((rows) => {
        setExcludedCount(rows.length)
        setSingleExcluded(!!single && rows.some((r) => r.party_id === single.id))
      })
      .catch(() => {})
    fetchPartyStatementSettings()
      .then((s) => {
        setSettings(s)
        if (initialRange?.from_date && initialRange.to_date) {
          setPeriod('custom')
          setCustomFrom(initialRange.from_date)
          setCustomTo(initialRange.to_date)
        } else {
          const p = s.default_period || 'previous_month'
          const days = normalizePeriodDays(s.default_period_days)
          setPeriod(p)
          setPeriodDays(days)
          const r = statementPeriodRange(p === 'custom' ? 'previous_month' : p, '', '', days)
          setCustomFrom(r.from_date)
          setCustomTo(r.to_date)
        }
      })
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load statement settings'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const range = useMemo(
    () => statementPeriodRange(period, customFrom, customTo, periodDays),
    [period, customFrom, customTo, periodDays]
  )
  const rangeValid = !!range.from_date && !!range.to_date && range.from_date <= range.to_date

  // Live figures for the single-party preview.
  const singleId = single?.id ?? ''
  useEffect(() => {
    if (!open || !singleId || !rangeValid) {
      setLedger(null)
      return
    }
    let cancelled = false
    fetchPartyLedger(singleId, range.from_date, range.to_date)
      .then((l) => {
        if (!cancelled) setLedger(l)
      })
      .catch(() => {
        if (!cancelled) setLedger(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, singleId, range.from_date, range.to_date, rangeValid])

  const isTelegram = channel === 'telegram'
  const setupProblem = !settings
    ? ''
    : isTelegram
      ? settings.telegram_ready
        ? ''
        : 'Connect the store\'s Telegram bot and switch it on first.'
    : !settings.whatsapp_ready
      ? 'Connect WhatsApp first in WhatsApp Invoice settings.'
      : !settings.whatsapp_message_id
        ? 'Set the WhatsApp template for statements first.'
        : settings.whatsapp_attach_pdf && !settings.has_public_base_url
          ? 'Set the Public API URL in WhatsApp Invoice settings so the PDF can be attached.'
          : ''

  const previewText = useMemo(() => {
    if (channel === 'telegram') {
      const opening = ledger ? statementBalanceText(ledger.opening_balance) : SAMPLE_STATEMENT_VALUES.opening_balance
      const closing = ledger ? statementBalanceText(ledger.closing_balance) : SAMPLE_STATEMENT_VALUES.closing_balance
      return [
        settings?.store_name || SAMPLE_STATEMENT_VALUES.store_name,
        `Account statement for ${single?.name ?? SAMPLE_STATEMENT_VALUES.customer_name}`,
        `Period: ${displayDate(range.from_date)} – ${displayDate(range.to_date)}`,
        `Opening balance: ₹${opening}`,
        `Closing balance: ₹${closing}`,
      ].join('\n')
    }
    const body = settings?.whatsapp_template_body?.trim() || DEFAULT_STATEMENT_TEMPLATE
    const mapping = (settings?.whatsapp_variable_mapping || settings?.default_mapping || '').split(',')
    const values: Record<string, string> = {
      ...SAMPLE_STATEMENT_VALUES,
      store_name: settings?.store_name || SAMPLE_STATEMENT_VALUES.store_name,
      from_date: displayDate(range.from_date),
      to_date: displayDate(range.to_date),
    }
    if (single) values.customer_name = single.name
    if (ledger) {
      values.opening_balance = statementBalanceText(ledger.opening_balance)
      values.closing_balance = statementBalanceText(ledger.closing_balance)
      values.total_sales = statementBalanceText(ledger.total_sales)
      values.total_received = statementBalanceText(ledger.total_received)
    }
    return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => {
      const key = mapping[Number(n) - 1]
      return key ? (values[key] ?? m) : m
    })
  }, [settings, range.from_date, range.to_date, single, ledger, channel])

  // A custom range is fixed dates, so only a one-time schedule can use it.
  const scheduleRangeProblem =
    mode === 'schedule' && period === 'custom' && timing.frequency !== 'once'
      ? 'Repeating schedules need a period like "Previous month". Custom ranges work only with "Once".'
      : ''

  const handleSchedule = async () => {
    if (!target) return
    setBusy('send')
    try {
      const fallbackName = single
        ? `Statement for ${single.name}`
        : `Statements for ${target.kind === 'bulk' ? target.count : 0} parties`
      const saved = await savePartyStatementSchedule({
        name: timing.name.trim() || fallbackName,
        channel,
        frequency: timing.frequency,
        run_date: timing.run_date,
        weekday: timing.weekday,
        day_of_month: timing.day_of_month,
        send_time: timing.send_time,
        period,
        period_days: period === 'last_n_days' ? periodDays : undefined,
        from_date: period === 'custom' ? range.from_date : '',
        to_date: period === 'custom' ? range.to_date : '',
        ...(target.kind === 'single'
          ? { party_ids: [target.party.id] }
          : 'ids' in target.selection
            ? { party_ids: target.selection.ids }
            : { filters: target.selection.filters }),
        include_zero_balance: target.kind === 'single' ? true : includeZero,
      })
      if (saved.warning) notifyWarning(saved.warning)
      else notifySuccess('Schedule saved. Manage it in Settings → Customer Messaging → Party statements → Schedules.')
      onSent?.()
      onOpenChange(false)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save schedule')
    } finally {
      setBusy(null)
    }
  }

  const handleSend = async () => {
    if (mode === 'schedule') return handleSchedule()
    if (!target || !rangeValid) return
    setBusy('send')
    try {
      if (target.kind === 'single') {
        // Telegram goes to the party's linked chat; the phone field is WhatsApp-only.
        await sendPartyStatement(target.party.id, channel, range.from_date, range.to_date, isTelegram ? '' : recipient.trim())
        notifySuccess(`Statement sent to ${target.party.name}`)
      } else {
        const res = await sendPartyStatementsBulk(target.selection, channel, range.from_date, range.to_date, includeZero)
        notifySuccess(`${res.message}. Track progress in Settings → Customer Messaging → Party statements → Sent statements.`)
      }
      onSent?.()
      onOpenChange(false)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to send statement')
    } finally {
      setBusy(null)
    }
  }

  const handlePdf = async () => {
    if (!single || !rangeValid) return
    setBusy('pdf')
    try {
      await downloadPartyStatementPdf(single.id, range.from_date, range.to_date, single.name)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to download statement')
    } finally {
      setBusy(null)
    }
  }

  const title = single ? `Send statement to ${single.name}` : `Send statements to ${target?.kind === 'bulk' ? target.count : 0} parties`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Sends the previous and current balance for the period with the detailed statement (sales and payments in
            date and time order) as a PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 rounded-md border p-0.5 text-sm" role="tablist" aria-label="When to send">
              {(
                [
                  { v: 'now', label: 'Send now', Icon: Send },
                  { v: 'schedule', label: 'Schedule', Icon: CalendarClock },
                ] as const
              ).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={mode === v}
                  onClick={() => {
                    setMode(v)
                    // A repeating schedule needs a relative period, not fixed dates.
                    if (v === 'schedule' && period === 'custom') {
                      const d = settings?.default_period
                      setPeriod(d && d !== 'custom' ? d : 'previous_month')
                    }
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded px-3 py-1.5',
                    mode === v ? 'bg-green-600 font-medium text-white' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            {mode === 'schedule' && <StatementScheduleFields value={timing} onChange={setTiming} />}

            <div className="space-y-1.5">
              <Label>Send via</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Channel">
                {STATEMENT_CHANNELS.map((c) => {
                  const available = (settings?.channels ?? ['whatsapp']).includes(c.value)
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={channel === c.value}
                      disabled={!available}
                      onClick={() => setChannel(c.value)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm',
                        channel === c.value ? 'border-green-600 bg-green-50 font-medium text-green-800' : 'border-gray-200',
                        !available && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      {c.label}
                      {!available && <span className="ml-1 text-[10px] uppercase">soon</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stmt-period">Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as StatementPeriod)}>
                <SelectTrigger id="stmt-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATEMENT_PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === 'last_n_days' && <StatementPeriodDaysInput value={periodDays} onChange={setPeriodDays} />}
              {period === 'custom' ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Input type="date" aria-label="From" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <Input type="date" aria-label="To" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {mode === 'schedule'
                    ? `Worked out at each send (if sent today: ${displayDate(range.from_date)} to ${displayDate(range.to_date)})`
                    : `${displayDate(range.from_date)} to ${displayDate(range.to_date)}`}
                </p>
              )}
              {!rangeValid && period === 'custom' && (
                <p className="text-xs text-red-600">Choose a start date on or before the end date.</p>
              )}
            </div>

            {single && isTelegram ? (
              <div className="space-y-1.5">
                <Label>Telegram</Label>
                <TelegramLinkPanel compact partyId={single.id} partyName={single.name} partyPhone={single.phone} />
                <p className="text-xs text-muted-foreground">
                  Sent to the chat the party linked{mode === 'schedule' ? ' at each send' : ''}.
                </p>
              </div>
            ) : single && mode === 'schedule' ? (
              <p className="text-xs text-muted-foreground">
                Sent to the party&apos;s mobile number{single.phone ? ` (${single.phone})` : ''} on file at each send.
              </p>
            ) : single ? (
              <div className="space-y-1.5">
                <Label htmlFor="stmt-recipient">WhatsApp number</Label>
                <Input
                  id="stmt-recipient"
                  inputMode="tel"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Party has no mobile number. Enter one"
                />
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-gray-50 p-3 text-sm">
                <label className="flex items-start gap-2">
                  <Checkbox checked={includeZero} onCheckedChange={(v) => setIncludeZero(v === true)} className="mt-0.5" />
                  <span>
                    Include parties with zero balance
                    <span className="block text-xs text-muted-foreground">
                      Off: parties whose balance at the end of the period is zero are skipped.
                    </span>
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  {isTelegram
                    ? 'Parties who have not linked Telegram are skipped.'
                    : 'Parties without a valid mobile number are skipped.'}{' '}
                  Sending happens in the background.
                  {mode === 'schedule' &&
                    target?.kind === 'bulk' &&
                    'all_matching' in target.selection &&
                    ' The filters are re-applied at each send, so new matching parties are included.'}
                </p>
              </div>
            )}

            {scheduleRangeProblem && <p className="text-xs text-red-600">{scheduleRangeProblem}</p>}

            {single && singleExcluded && (
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                {single.name} is on the excluded list.{' '}
                {mode === 'now'
                  ? 'Sending it yourself still works; bulk sends and schedules skip this party.'
                  : 'A schedule will skip this party until you include it again.'}{' '}
                <Link href="/settings/messaging?tab=statements" className="font-medium underline">
                  Manage excluded parties
                </Link>
              </p>
            )}
            {!single && excludedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Parties on the excluded list ({excludedCount}) are skipped.{' '}
                <Link href="/settings/messaging?tab=statements" className="underline">
                  Manage
                </Link>
              </p>
            )}

            {setupProblem && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {setupProblem}{' '}
                {mode === 'schedule' && 'You can still save the schedule; it stays paused until this is done. '}
                <Link href={isTelegram ? '/settings/messaging?tab=telegram' : '/settings/messaging?tab=statements'} className="font-medium underline">
                  {isTelegram ? 'Open Telegram settings' : 'Open statement settings'}
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Message preview</Label>
            <div className={cn('rounded-lg p-3', isTelegram ? 'bg-sky-100' : 'bg-[#e5ddd5]')}>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                {(isTelegram || settings?.whatsapp_attach_pdf !== false) && (
                  <div className="mb-2 flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <FileText className="h-4 w-4 text-red-500" />
                    Statement_{(single?.name ?? 'Party').replace(/\s+/g, '_')}.pdf
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{previewText}</p>
              </div>
            </div>
            {!single && (
              <p className="text-xs text-muted-foreground">Sample values; each party gets their own name and balances.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {single && mode === 'now' && (
            <Button variant="outline" onClick={() => void handlePdf()} disabled={!rangeValid || busy !== null} className="sm:mr-auto">
              {busy === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={!target || !rangeValid || busy !== null || (!!setupProblem && mode === 'now') || !!scheduleRangeProblem || !settings}
            className="bg-green-600 hover:bg-green-700"
          >
            {busy === 'send' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : mode === 'schedule' ? (
              <CalendarClock className="mr-2 h-4 w-4" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {mode === 'schedule'
              ? 'Save schedule'
              : single
                ? 'Send'
                : `Send to ${target?.kind === 'bulk' ? target.count : 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
