'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PremiumEmpty from '@/components/ui/premium-empty'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess, notifyWarning } from '@/lib/notify'
import { cn, formatDateTime } from '@/lib/utils'
import StatementPeriodDaysInput from '@/components/parties/StatementPeriodDaysInput'
import StatementScheduleFields, {
  defaultScheduleTiming,
  type ScheduleTiming,
} from '@/components/parties/StatementScheduleFields'
import {
  STATEMENT_PERIODS,
  DEFAULT_PERIOD_DAYS,
  statementPeriodLabel,
  deletePartyStatementSchedule,
  describeSchedule,
  displayDate,
  fetchPartyStatementSchedules,
  runPartyStatementScheduleNow,
  savePartyStatementSchedule,
  setPartyStatementScheduleEnabled,
  type PartyStatementSchedule,
  type StatementChannel,
  type StatementPeriod,
} from '@/lib/partyStatement'
import { CalendarClock, Edit, Loader2, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'

const RUN_STATUS_CLASS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
}

interface FormState {
  timing: ScheduleTiming
  channel: StatementChannel
  period: StatementPeriod
  period_days: number
  from_date: string
  to_date: string
  party_type: string
  balance: string
  category: string
  include_zero_balance: boolean
}

function audienceLabel(s: PartyStatementSchedule): string {
  if (s.party_count > 0) return `${s.party_count} selected ${s.party_count === 1 ? 'party' : 'parties'}`
  const who = s.party_type === 'customer' ? 'customers' : s.party_type === 'vendor' ? 'vendors' : 'parties'
  const parts = [`All ${who}`]
  if (s.balance === 'to_collect') parts.push('to collect from')
  if (s.balance === 'to_pay') parts.push('to pay')
  if (s.category) parts.push(`in "${s.category}"`)
  if (s.search) parts.push(`matching "${s.search}"`)
  return parts.join(' ')
}

function periodLabel(s: PartyStatementSchedule): string {
  if (s.period === 'custom') return `${displayDate(s.from_date)} to ${displayDate(s.to_date)}`
  return statementPeriodLabel(s.period, s.period_days || DEFAULT_PERIOD_DAYS)
}

/** Settings tab listing statement schedules, with create / edit / pause / run now / delete. */
export default function StatementSchedulesPanel({
  defaultPeriod,
  defaultPeriodDays = DEFAULT_PERIOD_DAYS,
}: {
  defaultPeriod: StatementPeriod
  defaultPeriodDays?: number
}) {
  const [rows, setRows] = useState<PartyStatementSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<PartyStatementSchedule | 'new' | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { confirm, confirmDialog } = useConfirmDialog()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await fetchPartyStatementSchedules())
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openNew = () => {
    setEditing('new')
    setForm({
      timing: { ...defaultScheduleTiming(), name: 'Monthly balance reminder' },
      channel: 'whatsapp',
      period: defaultPeriod === 'custom' ? 'previous_month' : defaultPeriod,
      period_days: defaultPeriodDays,
      from_date: '',
      to_date: '',
      party_type: 'customer',
      balance: 'to_collect',
      category: '',
      include_zero_balance: false,
    })
  }

  const openEdit = (s: PartyStatementSchedule) => {
    setEditing(s)
    setForm({
      timing: {
        name: s.name,
        frequency: s.frequency,
        run_date: s.run_date || defaultScheduleTiming().run_date,
        weekday: s.weekday,
        day_of_month: s.day_of_month,
        send_time: s.send_time,
      },
      channel: s.channel === 'telegram' ? 'telegram' : 'whatsapp',
      period: s.period,
      period_days: s.period_days || DEFAULT_PERIOD_DAYS,
      from_date: s.from_date,
      to_date: s.to_date,
      party_type: s.party_type,
      balance: s.balance,
      category: s.category,
      include_zero_balance: s.include_zero_balance,
    })
  }

  const close = () => {
    setEditing(null)
    setForm(null)
  }

  const editingRow = editing && editing !== 'new' ? editing : null
  const fixedParties = (editingRow?.party_count ?? 0) > 0

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const saved = await savePartyStatementSchedule(
        {
          name: form.timing.name,
          is_enabled: editingRow ? editingRow.is_enabled : true,
          channel: form.channel,
          frequency: form.timing.frequency,
          run_date: form.timing.run_date,
          weekday: form.timing.weekday,
          day_of_month: form.timing.day_of_month,
          send_time: form.timing.send_time,
          period: form.period,
          period_days: form.period === 'last_n_days' ? form.period_days : undefined,
          from_date: form.from_date,
          to_date: form.to_date,
          // Fixed party lists are kept by the server when not resent.
          ...(fixedParties
            ? {}
            : {
                filters: {
                  search: editingRow?.search ?? '',
                  category: form.category.trim(),
                  party_type: form.party_type,
                  balance: form.balance,
                },
              }),
          include_zero_balance: form.include_zero_balance,
        },
        editingRow?.id
      )
      if (saved.warning) notifyWarning(saved.warning)
      else notifySuccess('Schedule saved')
      close()
      void load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (s: PartyStatementSchedule, enabled: boolean) => {
    setBusyId(s.id)
    try {
      const updated = await setPartyStatementScheduleEnabled(s.id, enabled)
      setRows((rs) => rs.map((r) => (r.id === s.id ? updated : r)))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update schedule')
    } finally {
      setBusyId(null)
    }
  }

  const runNow = async (s: PartyStatementSchedule) => {
    if (
      !(await confirm({
        title: `Run "${s.name}" now?`,
        description: `Sends statements to ${audienceLabel(s).toLowerCase()} now. The next scheduled run is unchanged.`,
        confirmLabel: 'Send now',
      }))
    )
      return
    setBusyId(s.id)
    try {
      const res = await runPartyStatementScheduleNow(s.id)
      notifySuccess(`${res.message}. See Sent statements for results.`)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to run schedule')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (s: PartyStatementSchedule) => {
    if (
      !(await confirm({
        title: `Delete "${s.name}"?`,
        description: 'No more statements will be sent by this schedule.',
        confirmLabel: 'Delete',
        variant: 'destructive',
      }))
    )
      return
    setBusyId(s.id)
    try {
      await deletePartyStatementSchedule(s.id)
      setRows((rs) => rs.filter((r) => r.id !== s.id))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete schedule')
    } finally {
      setBusyId(null)
    }
  }

  const customNotOnce = form?.period === 'custom' && form.timing.frequency !== 'once'

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Schedules</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          You can also schedule from the Parties list (select parties → Send Statement → Schedule) or a party&apos;s
          statement page. Times are in the store&apos;s timezone.
        </p>
        {rows.length === 0 ? (
          <PremiumEmpty
            compact
            icon={CalendarClock}
            title="No schedules yet"
            hint="Send balance statements automatically, e.g. every month on the 1st for the previous month."
          />
        ) : (
          rows.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Switch
                  checked={s.is_enabled}
                  disabled={busyId === s.id}
                  onCheckedChange={(v) => void toggle(s, v)}
                  aria-label={s.is_enabled ? `Pause ${s.name}` : `Resume ${s.name}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 space-y-0.5 text-sm">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted-foreground">
                    {s.channel === 'telegram' ? 'Telegram' : 'WhatsApp'} · {describeSchedule(s)} · {periodLabel(s)} ·{' '}
                    {audienceLabel(s)}
                    {s.include_zero_balance ? ' (incl. zero balance)' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.is_enabled && s.next_run_at
                      ? `Next: ${formatDateTime(s.next_run_at)}`
                      : s.frequency === 'once' && s.last_run_at
                        ? 'Done'
                        : 'Paused'}
                    {s.last_run_at && (
                      <>
                        {' · Last: '}
                        {formatDateTime(s.last_run_at)}{' '}
                        {s.last_run_status && (
                          <Badge className={`ml-1 ${RUN_STATUS_CLASS[s.last_run_status] ?? ''}`}>
                            {s.last_run_status}
                          </Badge>
                        )}
                      </>
                    )}
                  </p>
                  {s.last_run_summary && <p className="text-xs text-muted-foreground">{s.last_run_summary}</p>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="outline" size="sm" onClick={() => void runNow(s)} disabled={busyId === s.id}>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Run now
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => openEdit(s)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => void remove(s)}
                  disabled={busyId === s.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRow ? 'Edit schedule' : 'New statement schedule'}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <StatementScheduleFields value={form.timing} onChange={(timing) => setForm({ ...form, timing })} />

              <div className="space-y-1.5">
                <Label>Send via</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Channel">
                  {(['whatsapp', 'telegram'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={form.channel === c}
                      onClick={() => setForm({ ...form, channel: c })}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm',
                        form.channel === c
                          ? 'border-green-600 bg-green-50 font-medium text-green-800'
                          : 'border-gray-200'
                      )}
                    >
                      {c === 'telegram' ? 'Telegram' : 'WhatsApp'}
                    </button>
                  ))}
                </div>
                {form.channel === 'telegram' && (
                  <p className="text-xs text-muted-foreground">
                    Goes to parties who have linked Telegram; the rest are skipped and shown in Sent statements.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-period">Statement period</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as StatementPeriod })}>
                  <SelectTrigger id="sp-period">
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
                {form.period === 'last_n_days' && (
                  <StatementPeriodDaysInput
                    value={form.period_days}
                    onChange={(period_days) => setForm({ ...form, period_days })}
                  />
                )}
                {form.period === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      aria-label="From"
                      value={form.from_date}
                      onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                    />
                    <Input
                      type="date"
                      aria-label="To"
                      value={form.to_date}
                      onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                    />
                  </div>
                )}
                {customNotOnce && (
                  <p className="text-xs text-red-600">
                    Custom ranges work only with &quot;Once&quot;. Pick a period like Previous month.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Send to</Label>
                {fixedParties ? (
                  <p className="text-sm text-muted-foreground">
                    {audienceLabel(editingRow!)} (chosen when the schedule was created).
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={form.party_type || 'all'}
                      onValueChange={(v) => setForm({ ...form, party_type: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger aria-label="Party type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customers</SelectItem>
                        <SelectItem value="vendor">Vendors</SelectItem>
                        <SelectItem value="all">All parties</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={form.balance || 'all'}
                      onValueChange={(v) => setForm({ ...form, balance: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger aria-label="Balance">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_collect">To collect</SelectItem>
                        <SelectItem value="to_pay">To pay</SelectItem>
                        <SelectItem value="all">Any balance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="sm:col-span-2"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Category (optional)"
                      aria-label="Category"
                    />
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={form.include_zero_balance}
                    onCheckedChange={(v) => setForm({ ...form, include_zero_balance: v === true })}
                    className="mt-0.5"
                  />
                  <span>
                    Include parties with zero balance
                    <span className="block text-xs text-muted-foreground">
                      Off: parties whose balance at the end of the period is zero are skipped.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || customNotOnce}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Card>
  )
}
