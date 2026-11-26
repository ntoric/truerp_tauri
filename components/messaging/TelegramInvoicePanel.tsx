'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { fetchTelegramSettings, saveTelegramSettings, type TelegramSettings } from '@/lib/telegram'
import ChannelStatusCard from './ChannelStatusCard'

/** Full save payload that keeps the current bot (empty token = keep). */
export function telegramSettingsPayload(s: TelegramSettings) {
  return {
    enabled: s.enabled,
    bot_token: '',
    send_invoice_to_customer: s.send_invoice_to_customer,
    send_for_pos: s.send_for_pos,
    send_for_non_pos: s.send_for_non_pos,
    notify_owner_on_invoice: s.notify_owner_on_invoice,
    owner_chat_ids: s.owner_chat_ids,
  }
}

export function telegramReady(s: TelegramSettings) {
  return s.has_bot_token && s.enabled
}

/** Invoices → Telegram: send the invoice PDF to linked customers after a sale. */
export default function TelegramInvoicePanel({
  toolbar,
  onOpenChannel,
}: {
  toolbar: ReactNode
  onOpenChannel: () => void
}) {
  const [settings, setSettings] = useState<TelegramSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTelegramSettings()
      .then(setSettings)
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load Telegram settings'))
  }, [])

  if (!settings) return <FormPageSkeleton />

  const update = <K extends keyof TelegramSettings>(key: K, value: TelegramSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s))

  const handleSave = async () => {
    setSaving(true)
    try {
      setSettings(await saveTelegramSettings(telegramSettingsPayload(settings)))
      notifySuccess('Telegram invoice settings saved')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save Telegram settings')
    } finally {
      setSaving(false)
    }
  }

  const ready = telegramReady(settings)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {toolbar}
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>

      <ChannelStatusCard
        ok={ready}
        title={
          !settings.has_bot_token
            ? 'Telegram bot not connected'
            : settings.enabled
              ? `Telegram bot connected (@${settings.bot_username})`
              : `Telegram messages are off (@${settings.bot_username})`
        }
        hint={`Only customers who have linked Telegram receive invoices; others are skipped. ${settings.linked_customers} linked so far.`}
        actionLabel="Telegram settings"
        onAction={onOpenChannel}
      />

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">Send the invoice PDF on Telegram after every sale</p>
            <p className="text-sm text-muted-foreground">
              Sent from the store&apos;s bot in the background after an invoice is saved. No template approval is
              needed.
            </p>
          </div>
          <Switch
            checked={settings.send_invoice_to_customer}
            onCheckedChange={(v) => update('send_invoice_to_customer', v)}
            aria-label="Send the invoice PDF on Telegram after every sale"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When to send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="tg-pos">POS sales</Label>
            <Switch
              id="tg-pos"
              checked={settings.send_for_pos}
              disabled={!settings.send_invoice_to_customer}
              onCheckedChange={(v) => update('send_for_pos', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="tg-nonpos">Sales invoices (non-POS)</Label>
            <Switch
              id="tg-nonpos"
              checked={settings.send_for_non_pos}
              disabled={!settings.send_invoice_to_customer}
              onCheckedChange={(v) => update('send_for_non_pos', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
