'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  WHATSAPP_PROVIDER_COPY,
  fetchWhatsAppInvoiceSettings,
  setWhatsAppInvoiceEnabled,
  type WhatsAppInvoiceSettings,
} from '@/lib/whatsappInvoice'

/** Settings > Invoice card: on/off switch for WhatsApp invoice messages plus a link to the full setup. */
export default function WhatsAppInvoiceToggleCard() {
  const [settings, setSettings] = useState<WhatsAppInvoiceSettings | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWhatsAppInvoiceSettings()
      .then(setSettings)
      .catch(() => setLoadError(true))
  }, [])

  const handleToggle = async (enabled: boolean) => {
    if (!settings) return
    setSaving(true)
    setSettings({ ...settings, enabled })
    try {
      setSettings(await setWhatsAppInvoiceEnabled(enabled))
      notifySuccess(enabled ? 'WhatsApp invoice messages enabled' : 'WhatsApp invoice messages disabled')
    } catch (e) {
      setSettings({ ...settings, enabled: !enabled })
      notifyError(e instanceof Error ? e.message : 'Failed to update WhatsApp invoice messages')
    } finally {
      setSaving(false)
    }
  }

  const providerLabel = settings ? WHATSAPP_PROVIDER_COPY[settings.provider]?.label : undefined

  return (
    <Card className="mb-6 border-green-100 bg-green-50/40">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="pt-0.5">
            {settings ? (
              <Switch
                id="wa-invoice-enabled"
                checked={settings.enabled}
                disabled={saving}
                onCheckedChange={(v) => void handleToggle(v)}
                aria-label="Send WhatsApp invoice message on every sale"
              />
            ) : loadError ? null : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div>
            <label htmlFor="wa-invoice-enabled" className="font-semibold text-gray-900">
              WhatsApp invoice message
              {settings && (
                <span className={`ml-2 text-xs font-medium ${settings.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                  {settings.enabled ? 'On' : 'Off'}
                </span>
              )}
            </label>
            <p className="text-sm text-muted-foreground">
              Send the purchase summary and invoice PDF to customers on WhatsApp
              {providerLabel ? ` (${providerLabel})` : ''} after every sale, for this store.
            </p>
            {loadError && <p className="text-xs text-red-600">Couldn&apos;t load the current WhatsApp setting.</p>}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings/whatsapp-invoice">Configure WhatsApp</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
