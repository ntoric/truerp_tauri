'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle, Loader2, Save } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useAuth } from '@/hooks/useAuth'
import { isSuperAdmin } from '@/lib/roles'
import {
  WHATSAPP_PROVIDER_COPY,
  fetchWhatsAppInvoiceSettings,
  saveWhatsAppInvoiceSettings,
  type WhatsAppInvoiceSettings,
} from '@/lib/whatsappInvoice'
import { whatsAppGatewayConnected, whatsAppProvider, whatsAppSettingsPayload } from './WhatsAppInvoicePanel'

/** WhatsApp tab: connection status and the options shared by invoice and statement messages. */
export default function WhatsAppChannelPanel() {
  const [settings, setSettings] = useState<WhatsAppInvoiceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const superAdmin = !!user && isSuperAdmin(user.role)

  useEffect(() => {
    fetchWhatsAppInvoiceSettings()
      .then(setSettings)
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load WhatsApp settings'))
  }, [])

  if (!settings) return <FormPageSkeleton />

  const copy = WHATSAPP_PROVIDER_COPY[whatsAppProvider(settings)]
  const connected = whatsAppGatewayConnected(settings, superAdmin)

  const update = <K extends keyof WhatsAppInvoiceSettings>(key: K, value: WhatsAppInvoiceSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s))

  const handleSave = async () => {
    setSaving(true)
    try {
      setSettings(await saveWhatsAppInvoiceSettings(whatsAppSettingsPayload(settings)))
      notifySuccess('WhatsApp settings saved')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save WhatsApp settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
            <div className="space-y-0.5">
              <p className="flex items-center gap-2 font-medium">
                {connected ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                {copy.label}
                {connected ? ' · Connected' : ' · Not connected'}
              </p>
              <p className="text-xs text-muted-foreground">
                {superAdmin
                  ? 'Provider, credentials and sender are set in Developer Settings → Integrations.'
                  : 'The WhatsApp connection is managed by your super admin.'}
              </p>
            </div>
            {superAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link href="/developer-settings?tab=integrations&section=whatsapp">Manage connection</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared options</CardTitle>
          <CardDescription>Used by both invoice and party statement messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wa-cc">Default country code</Label>
              <Input
                id="wa-cc"
                value={settings.country_code}
                onChange={(e) => update('country_code', e.target.value)}
                placeholder="91"
              />
              <p className="text-xs text-muted-foreground">Added to customer numbers saved without one.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-store-name">Store name in message</Label>
              <Input
                id="wa-store-name"
                value={settings.store_display_name}
                onChange={(e) => update('store_display_name', e.target.value)}
                placeholder="Defaults to the store / business name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-base-url">Public API URL</Label>
            <Input
              id="wa-base-url"
              value={settings.public_base_url}
              onChange={(e) => update('public_base_url', e.target.value)}
              placeholder={settings.env_public_base_url || 'https://api.yourdomain.com'}
            />
            <p className="text-xs text-muted-foreground">
              Internet-reachable address of this backend, needed to attach invoice and statement PDFs. WhatsApp
              downloads the PDF from a signed link; the PDF is never stored on the server.
              {settings.env_public_base_url && ` Leave blank to use ${settings.env_public_base_url}.`}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-link-ttl">PDF link expiry (minutes)</Label>
            <Input
              id="wa-link-ttl"
              type="number"
              className="sm:w-48"
              min={settings.min_link_ttl_minutes ?? 5}
              max={settings.max_link_ttl_minutes ?? 10080}
              value={settings.pdf_link_ttl_minutes}
              disabled={!settings.can_edit_link_ttl}
              onChange={(e) => update('pdf_link_ttl_minutes', Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              {settings.can_edit_link_ttl
                ? `How long WhatsApp can download the PDF after sending (${settings.min_link_ttl_minutes ?? 5} min to ${Math.round((settings.max_link_ttl_minutes ?? 10080) / 1440)} days). Raise it if attachments fail on delayed deliveries.`
                : 'Only a super admin can change this.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
