'use client'

import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle, Copy, ExternalLink, Loader2, RefreshCw, Save, Send } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime } from '@/lib/utils'
import {
  TELEGRAM_LOG_KIND_LABELS,
  fetchTelegramLogs,
  fetchTelegramSettings,
  saveTelegramSettings,
  sendTelegramTest,
  type TelegramLog,
  type TelegramSettings,
} from '@/lib/telegram'
import { telegramSettingsPayload } from './TelegramInvoicePanel'

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
      <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
        <span className="text-sm text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </Label>
    </div>
  )
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    notifySuccess(`${what} copied`)
  } catch {
    notifyError('Could not copy. Select and copy the link manually.')
  }
}

/** Telegram tab: connect the store's bot, customer linking, owner alerts and the message log. */
export default function TelegramChannelPanel() {
  const [settings, setSettings] = useState<TelegramSettings | null>(null)
  const [botToken, setBotToken] = useState('')
  const [logs, setLogs] = useState<TelegramLog[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadLogs = useCallback(() => {
    fetchTelegramLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
  }, [])

  useEffect(() => {
    fetchTelegramSettings()
      .then(setSettings)
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load Telegram settings'))
    loadLogs()
  }, [loadLogs])

  if (!settings) return <FormPageSkeleton />

  const update = <K extends keyof TelegramSettings>(key: K, value: TelegramSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s))

  const save = async (extra: { disconnect?: boolean } = {}) => {
    setSaving(true)
    try {
      const saved = await saveTelegramSettings({
        ...telegramSettingsPayload(settings),
        enabled: extra.disconnect ? false : settings.enabled,
        bot_token: botToken.trim(),
        disconnect: extra.disconnect,
      })
      setSettings(saved)
      setBotToken('')
      notifySuccess(extra.disconnect ? 'Telegram bot disconnected' : 'Telegram settings saved')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save Telegram settings')
    } finally {
      setSaving(false)
    }
  }

  // Re-read settings to pick up owner chats linked in Telegram since loading.
  const refresh = async () => {
    setRefreshing(true)
    try {
      const fresh = await fetchTelegramSettings()
      setSettings((s) => (s ? { ...fresh, enabled: s.enabled } : fresh))
      loadLogs()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      await sendTelegramTest()
      notifySuccess('Test message sent to the owner chats')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to send test message')
    } finally {
      setTesting(false)
      loadLogs()
    }
  }

  const connected = settings.has_bot_token

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>

      {/* 1. Bot connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            1. Connect your bot
            {connected ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle className="mr-1 h-3 w-3" /> @{settings.bot_username}
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            In Telegram, open <span className="font-medium">@BotFather</span>, send <code>/newbot</code>, choose a name
            (e.g. your store name) and paste the token it gives you here. Customers will see messages from this bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tg-token">{connected ? 'Replace bot token' : 'Bot token'}</Label>
            <Input
              id="tg-token"
              type="password"
              autoComplete="off"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={connected ? 'Leave empty to keep the current bot' : '123456789:AA…'}
            />
            <p className="text-xs text-muted-foreground">Checked with Telegram when you save. Stored encrypted.</p>
          </div>
          {settings.poll_error && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Customers can&apos;t link right now: {settings.poll_error}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <ToggleRow
              id="tg-enabled"
              label="Send Telegram messages"
              hint="Master switch for invoices, statements, alerts and reports. Linking still works while it's off."
              checked={settings.enabled}
              disabled={!connected && !botToken.trim()}
              onChange={(v) => update('enabled', v)}
            />
            {connected && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={saving}
                onClick={() => void save({ disconnect: true })}
              >
                Disconnect bot
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Link customers</CardTitle>
          <CardDescription>
            Telegram bots can&apos;t message a phone number. Each customer links once: open the party, copy their
            Telegram link (or show the QR code) and ask them to press <span className="font-medium">Start</span>.{' '}
            {connected && (
              <span className="font-medium text-gray-900">{settings.linked_customers} linked so far.</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Choose what linked customers receive in the <span className="font-medium">Invoices</span> and{' '}
            <span className="font-medium">Party statements</span> tabs.
          </p>
        </CardContent>
      </Card>

      {/* 3. Owner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            3. Your alerts &amp; reports
            <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Open the owner link on your phone and press Start to receive alerts and reports in that chat. Share it only
            with people who should see your sales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.owner_link ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="w-fit rounded-md border bg-white p-2">
                <QRCodeSVG value={settings.owner_link} size={112} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Input readOnly value={settings.owner_link} onFocus={(e) => e.currentTarget.select()} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copyText(settings.owner_link, 'Owner link')}>
                    <Copy className="mr-1 h-4 w-4" /> Copy link
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={settings.owner_link} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" /> Open in Telegram
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Connect a bot first to get your owner link.</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tg-owner-chats">Owner chats</Label>
            <Textarea
              id="tg-owner-chats"
              rows={2}
              value={settings.owner_chat_ids}
              onChange={(e) => update('owner_chat_ids', e.target.value)}
              placeholder="Filled in automatically when you press Start on the owner link"
            />
            <p className="text-xs text-muted-foreground">
              Chat IDs, comma separated. Remove one to stop sending to that chat.
            </p>
          </div>

          <ToggleRow
            id="tg-owner-invoice"
            label="Alert me on every new sale"
            hint="Sends the invoice PDF with the customer and amount to the owner chats."
            checked={settings.notify_owner_on_invoice}
            onChange={(v) => update('notify_owner_on_invoice', v)}
          />
          <p className="text-xs text-muted-foreground">
            Scheduled reports: turn on <span className="font-medium">Also send to Telegram</span> in the Business report
            email and Party balance report email settings on the dashboard.
          </p>
          <Button variant="outline" size="sm" onClick={() => void test()} disabled={testing || !connected}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send test message
          </Button>
        </CardContent>
      </Card>

      {/* Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Telegram messages</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 pr-3 font-medium">Chat</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(l.created_at)}</td>
                      <td className="py-2 pr-3">{TELEGRAM_LOG_KIND_LABELS[l.kind] ?? l.kind}</td>
                      <td className="py-2 pr-3">
                        {l.reference}
                        {l.party_name && <span className="block text-xs text-muted-foreground">{l.party_name}</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{l.chat_id || '—'}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            l.status === 'sent'
                              ? 'text-green-700'
                              : l.status === 'skipped'
                                ? 'text-gray-500'
                                : 'text-red-600'
                          }
                        >
                          {l.status}
                        </span>
                        {l.error && <span className="block max-w-xs text-xs text-muted-foreground">{l.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
