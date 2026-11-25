'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PremiumEmpty from '@/components/ui/premium-empty'
import StatementSchedulesPanel from '@/components/parties/StatementSchedulesPanel'
import StatementPeriodDaysInput from '@/components/parties/StatementPeriodDaysInput'
import TelegramStatementSettings from '@/components/parties/TelegramStatementSettings'
import StatementExclusionsCard from '@/components/parties/StatementExclusionsCard'
import ChannelSwitch, { type MessagingChannel } from './ChannelSwitch'
import ChannelStatusCard from './ChannelStatusCard'
import {
  History,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
  FileText,
  CalendarClock,
} from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { WHATSAPP_PROVIDER_COPY, type WhatsAppProvider } from '@/lib/whatsappInvoice'
import {
  DEFAULT_STATEMENT_TEMPLATE,
  SAMPLE_STATEMENT_VALUES,
  STATEMENT_PERIODS,
  displayDate,
  fetchPartyStatementLogs,
  fetchPartyStatementSettings,
  savePartyStatementSettings,
  sendPartyStatementTest,
  statementPeriodRange,
  normalizePeriodDays,
  type PartyStatementLog,
  type PartyStatementSettings,
  type StatementPeriod,
} from '@/lib/partyStatement'

const STATUS_CLASS: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-700',
}

/** Messaging → Party statements: default period, per-channel message setup, schedules and the sent log. */
export default function PartyStatementPanel({
  channel,
  onChannelChange,
  onOpenChannel,
}: {
  channel: MessagingChannel
  onChannelChange: (c: MessagingChannel) => void
  onOpenChannel: (c: MessagingChannel) => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<PartyStatementSettings | null>(null)
  const [mapping, setMapping] = useState<string[]>([])
  const [body, setBody] = useState(DEFAULT_STATEMENT_TEMPLATE)
  const [testPhone, setTestPhone] = useState('')
  const [tgMessage, setTgMessage] = useState('')
  const [testChat, setTestChat] = useState('')
  const [testing, setTesting] = useState(false)
  const [logs, setLogs] = useState<PartyStatementLog[]>([])
  const [bulkRunning, setBulkRunning] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [tab, setTab] = useState<'settings' | 'schedules' | 'messages'>('settings')

  const apply = (s: PartyStatementSettings) => {
    setSettings(s)
    setMapping((s.whatsapp_variable_mapping || s.default_mapping || '').split(',').filter(Boolean))
    setBody(s.whatsapp_template_body?.trim() ? s.whatsapp_template_body : DEFAULT_STATEMENT_TEMPLATE)
    setTgMessage(s.telegram_message?.trim() ? s.telegram_message : (s.default_telegram_message ?? ''))
  }

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetchPartyStatementLogs({ limit: 100 })
      setLogs(res.logs)
      setBulkRunning(res.bulk_running)
    } catch {
      // non-fatal
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPartyStatementSettings()
      .then(apply)
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
    void loadLogs()
  }, [loadLogs])

  // Refresh the log while a bulk run is going.
  useEffect(() => {
    if (!bulkRunning || tab !== 'messages') return
    const t = setInterval(() => void loadLogs(), 5000)
    return () => clearInterval(t)
  }, [bulkRunning, tab, loadLogs])

  if (loading || !settings) return <FormPageSkeleton />

  const provider = (settings.whatsapp_provider || 'whatsapp_cloud') as WhatsAppProvider
  const copy = WHATSAPP_PROVIDER_COPY[provider] ?? WHATSAPP_PROVIDER_COPY.whatsapp_cloud
  const fields = settings.available_fields ?? []
  const fieldLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key
  const sampleValue = (key: string) =>
    key === 'store_name' && settings.store_name ? settings.store_name : (SAMPLE_STATEMENT_VALUES[key] ?? key)

  const update = <K extends keyof PartyStatementSettings>(key: K, value: PartyStatementSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s))

  // Preview with sample values; flags {{n}} the mapping doesn't cover.
  const re = /\{\{\s*(\d+)\s*\}\}/g
  const used = new Set<number>()
  const parts: { text: string; n?: number; key?: string }[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) })
    const n = Number(m[1])
    used.add(n)
    const key = mapping[n - 1]
    parts.push({ text: key ? sampleValue(key) : m[0], n, key })
    last = re.lastIndex
  }
  if (last < body.length) parts.push({ text: body.slice(last) })
  const unmapped = Array.from(used).filter((n) => n > mapping.length)
  const unused = mapping
    .map((k, i) => ({ k, n: i + 1 }))
    .filter(({ k, n }) => !used.has(n) && k !== 'statement_pdf_file')
    .map(({ n }) => n)

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await savePartyStatementSettings({
        default_period: settings.default_period,
        default_period_days: normalizePeriodDays(settings.default_period_days),
        whatsapp_message_id: settings.whatsapp_message_id,
        whatsapp_language_code: settings.whatsapp_language_code,
        whatsapp_variable_mapping: mapping.join(','),
        whatsapp_template_body: body.trim() === DEFAULT_STATEMENT_TEMPLATE.trim() ? '' : body,
        whatsapp_attach_pdf: settings.whatsapp_attach_pdf,
        telegram_message: tgMessage.trim() === (settings.default_telegram_message ?? '').trim() ? '' : tgMessage,
      })
      apply(saved)
      notifySuccess('Statement settings saved')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const testPeriod: StatementPeriod = settings.default_period === 'custom' ? 'previous_month' : settings.default_period
  const testRange = statementPeriodRange(testPeriod, '', '', normalizePeriodDays(settings.default_period_days))

  const handleTest = async () => {
    const to = (channel === 'telegram' ? testChat : testPhone).trim()
    if (!to) {
      notifyError(
        channel === 'telegram'
          ? 'Enter a Telegram chat ID to send the test to'
          : 'Enter a WhatsApp number to send the test to'
      )
      return
    }
    setTesting(true)
    try {
      await sendPartyStatementTest(to, testRange.from_date, testRange.to_date, channel)
      notifySuccess('Test statement sent')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to send test statement')
    } finally {
      setTesting(false)
      void loadLogs()
    }
  }

  return (
    <div className="w-full space-y-6">
      <p className="text-sm text-muted-foreground">
        Send parties their balance for a period with the detailed statement PDF. Send from the Parties list (one or
        many) or the Party Statement page, or on a schedule.
      </p>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as 'settings' | 'schedules' | 'messages')
          if (v === 'messages') void loadLogs()
        }}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="h-4 w-4" /> Setup
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-1.5">
              <CalendarClock className="h-4 w-4" /> Schedules
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <History className="h-4 w-4" /> Sent statements
            </TabsTrigger>
          </TabsList>
          {tab === 'settings' && (
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          )}
        </div>

        <TabsContent value="settings" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Select
                value={settings.default_period}
                onValueChange={(v) => update('default_period', v as StatementPeriod)}
              >
                <SelectTrigger className="sm:w-72">
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
              {settings.default_period === 'last_n_days' && (
                <StatementPeriodDaysInput
                  value={normalizePeriodDays(settings.default_period_days)}
                  onChange={(d) => update('default_period_days', d)}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Preselected when you send. You can pick any period, or a custom range, each time.
              </p>
            </CardContent>
          </Card>

          <StatementExclusionsCard />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <ChannelSwitch
              value={channel}
              onChange={onChannelChange}
              ready={{ whatsapp: !!settings.whatsapp_ready, telegram: !!settings.telegram_ready }}
            />
            <p className="text-xs text-muted-foreground">Message settings for the selected channel.</p>
          </div>

          {channel === 'telegram' && (
            <TelegramStatementSettings
              onOpenChannel={() => onOpenChannel('telegram')}
              ready={!!settings.telegram_ready}
              message={tgMessage}
              onMessageChange={setTgMessage}
              defaultMessage={settings.default_telegram_message ?? ''}
              fields={settings.telegram_fields ?? []}
              storeName={settings.store_name}
              testChat={testChat}
              onTestChatChange={setTestChat}
              testing={testing}
              onTest={() => void handleTest()}
              testRangeLabel={`${displayDate(testRange.from_date)} to ${displayDate(testRange.to_date)}`}
            />
          )}

          {channel === 'whatsapp' && (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                <ChannelStatusCard
                  ok={!!settings.whatsapp_ready}
                  title={settings.whatsapp_ready ? `WhatsApp connected (${copy.label})` : 'WhatsApp not connected'}
                  hint={
                    'Statements use the same WhatsApp account, sender and Public API URL as invoice messages.' +
                    (!settings.has_public_base_url && settings.whatsapp_attach_pdf
                      ? ' Set the Public API URL in the WhatsApp tab to attach the statement PDF.'
                      : '')
                  }
                  actionLabel="WhatsApp settings"
                  onAction={() => onOpenChannel('whatsapp')}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">WhatsApp template</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={`grid gap-4 ${copy.usesLanguage ? 'sm:grid-cols-2' : ''}`}>
                      <div className="space-y-1.5">
                        <Label htmlFor="st-message-id">{copy.templateLabel}</Label>
                        <Input
                          id="st-message-id"
                          value={settings.whatsapp_message_id}
                          onChange={(e) => update('whatsapp_message_id', e.target.value)}
                          placeholder={provider === 'twilio' ? 'HX…' : 'e.g. balance_reminder'}
                        />
                        <p className="text-xs text-muted-foreground">
                          The approved statement / balance reminder template (Utility category, Document header).
                        </p>
                      </div>
                      {copy.usesLanguage && (
                        <div className="space-y-1.5">
                          <Label htmlFor="st-language">Template language</Label>
                          <Input
                            id="st-language"
                            value={settings.whatsapp_language_code}
                            onChange={(e) => update('whatsapp_language_code', e.target.value)}
                            placeholder={settings.whatsapp_invoice_language || 'en'}
                          />
                          <p className="text-xs text-muted-foreground">Blank = same as the invoice template.</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Attach statement PDF</p>
                        <p className="text-xs text-muted-foreground">
                          {provider === 'twilio'
                            ? 'Use a Twilio media template whose media URL is <Public API URL>/api/v1/public/party-statement-pdf/{{n}}, and map {{n}} to "Statement PDF file".'
                            : 'Turn on if your template has a Document header.'}
                        </p>
                      </div>
                      <Switch
                        checked={settings.whatsapp_attach_pdf}
                        onCheckedChange={(v) => update('whatsapp_attach_pdf', v)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">Template variables</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMapping((settings.default_mapping || '').split(',').filter(Boolean))}
                    >
                      Reset to default
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Map each {'{{n}}'} placeholder in your approved template to a value, in order. Balances are
                      shown as amounts; an advance shows with a &quot;Cr&quot; suffix.
                    </p>
                    {mapping.map((key, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{`{{${idx + 1}}}`}</span>
                        <Select
                          value={key}
                          onValueChange={(v) => setMapping((mm) => mm.map((k, i) => (i === idx ? v : k)))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue>{fieldLabel(key)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span
                          className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:inline"
                          title={sampleValue(key)}
                        >
                          e.g. {sampleValue(key)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove variable ${idx + 1}`}
                          onClick={() => setMapping((mm) => mm.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMapping((mm) => [...mm, fields[0]?.key ?? 'customer_name'])}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add variable
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Preview (sample data)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg bg-[#e5ddd5] p-3">
                      <div className="rounded-lg bg-white p-3 shadow-sm">
                        {settings.whatsapp_attach_pdf && (
                          <div className="mb-2 flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            <FileText className="h-4 w-4 text-red-500" /> Statement_Rahul_2026-10-01_to_2026-10-31.pdf
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm text-gray-900">
                          {parts.map((p, i) =>
                            p.n === undefined ? (
                              <span key={i}>{p.text}</span>
                            ) : p.key ? (
                              <span
                                key={i}
                                className="rounded bg-green-100 px-0.5 font-medium text-green-900"
                                title={`{{${p.n}}} = ${fieldLabel(p.key)}`}
                              >
                                {p.text}
                              </span>
                            ) : (
                              <span
                                key={i}
                                className="rounded bg-red-100 px-0.5 font-mono text-red-700"
                                title="Not mapped"
                              >
                                {p.text}
                              </span>
                            )
                          )}
                        </p>
                      </div>
                    </div>
                    {(unmapped.length > 0 || unused.length > 0) && (
                      <div className="mt-2 space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {unmapped.length > 0 && (
                          <p>{unmapped.map((n) => `{{${n}}}`).join(', ')} in the template but not mapped.</p>
                        )}
                        {unused.length > 0 && (
                          <p>
                            {unused.map((n) => `{{${n}}}`).join(', ')} mapped but not in the template text. WhatsApp
                            rejects the message if the variable count doesn&apos;t match.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="st-body">Template text</Label>
                        {body !== DEFAULT_STATEMENT_TEMPLATE && (
                          <Button variant="ghost" size="sm" onClick={() => setBody(DEFAULT_STATEMENT_TEMPLATE)}>
                            Use sample
                          </Button>
                        )}
                      </div>
                      <Textarea
                        id="st-body"
                        rows={10}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste your approved template&apos;s body to preview it. Used for previews only; WhatsApp
                        always sends the approved wording.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Send a test</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="WhatsApp number, e.g. 9876543210"
                      inputMode="tel"
                    />
                    <Button className="w-full" variant="outline" onClick={() => void handleTest()} disabled={testing}>
                      {testing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send test statement
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Uses saved settings and your most recently updated customer, for{' '}
                      {displayDate(testRange.from_date)} to {displayDate(testRange.to_date)}. Save changes first.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="mt-0">
          <StatementSchedulesPanel
            defaultPeriod={settings.default_period}
            defaultPeriodDays={normalizePeriodDays(settings.default_period_days)}
          />
        </TabsContent>

        <TabsContent value="messages" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                Sent statements
                {bulkRunning && (
                  <Badge className="bg-blue-100 text-blue-800">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Bulk send in progress
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => void loadLogs()} disabled={logsLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <PremiumEmpty
                  compact
                  icon={FileText}
                  title="No statements sent yet"
                  hint="Statements you send to parties will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Time</th>
                        <th className="py-2 pr-3 font-medium">Party</th>
                        <th className="py-2 pr-3 font-medium">Period</th>
                        <th className="py-2 pr-3 text-right font-medium">Previous</th>
                        <th className="py-2 pr-3 text-right font-medium">Current</th>
                        <th className="py-2 pr-3 font-medium">Sent to</th>
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className="border-b align-top last:border-0">
                          <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(l.created_at)}</td>
                          <td className="py-2 pr-3">
                            {l.party_id ? (
                              <Link
                                className="text-blue-600 hover:underline"
                                href={`/parties/ledger?party_id=${l.party_id}`}
                              >
                                {l.party_name || '—'}
                              </Link>
                            ) : (
                              l.party_name || '—'
                            )}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3">
                            {displayDate(l.from_date)} – {displayDate(l.to_date)}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right">
                            {formatCurrency(l.opening_balance)}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right">
                            {formatCurrency(l.closing_balance)}
                          </td>
                          <td className="py-2 pr-3 text-xs">
                            <span className="capitalize">{l.channel}</span>
                            <span className="block font-mono text-muted-foreground">{l.recipient || '—'}</span>
                          </td>
                          <td className="py-2 pr-3 capitalize">{l.trigger}</td>
                          <td className="py-2 pr-3">
                            <Badge className={STATUS_CLASS[l.status] ?? ''}>{l.status}</Badge>
                            {l.error && <p className="mt-1 max-w-xs text-xs text-red-600">{l.error}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
