'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, Loader2, MessageCircle, Save } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { notifyError, notifySuccess } from '@/lib/notify'
import { WHATSAPP_PROVIDER_COPY, type WhatsAppProvider } from '@/lib/whatsappInvoice'

// GET/PUT /developer-settings/integrations/whatsapp-gateway. The API key is
// write-only: the API reports has_api_key + a last-4 hint instead.
interface WhatsAppGateway {
  provider: WhatsAppProvider
  providers: { key: WhatsAppProvider; label: string }[]
  has_api_key: boolean
  api_key_hint: string
  phone_number_id: string
  account_sid: string
  configured: boolean
  missing_reason?: string
  invoices_enabled: boolean
  invoices_auto_disabled?: boolean
}

const PATH = '/developer-settings/integrations/whatsapp-gateway'

/**
 * Gateway credentials for WhatsApp invoice and party statement messages,
 * for the active store. Templates and send rules stay on
 * Settings → WhatsApp Invoice.
 */
export default function WhatsAppGatewayCard({ onSaved }: { onSaved?: () => void }) {
  const [gateway, setGateway] = useState<WhatsAppGateway | null>(null)
  const [provider, setProvider] = useState<WhatsAppProvider>('whatsapp_cloud')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accountSid, setAccountSid] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (g: WhatsAppGateway) => {
    setGateway(g)
    setProvider(g.provider || 'whatsapp_cloud')
    setApiKey('')
    setClearKey(false)
    setPhoneNumberId(g.phone_number_id || '')
    setAccountSid(g.account_sid || '')
  }

  useEffect(() => {
    apiFetch(PATH)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load WhatsApp gateway')
        apply(await res.json())
      })
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load WhatsApp gateway'))
  }, [])

  if (!gateway) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const copy = WHATSAPP_PROVIDER_COPY[provider] ?? WHATSAPP_PROVIDER_COPY.whatsapp_cloud
  const providerSwitched = provider !== gateway.provider
  const isTwilio = provider === 'twilio'
  const providerOptions = gateway.providers?.length
    ? gateway.providers
    : (Object.keys(WHATSAPP_PROVIDER_COPY) as WhatsAppProvider[]).map((key) => ({
        key,
        label: WHATSAPP_PROVIDER_COPY[key].label,
      }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          api_key: apiKey.trim(),
          clear_api_key: clearKey,
          phone_number_id: phoneNumberId.trim(),
          account_sid: isTwilio ? accountSid.trim() : gateway.account_sid,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save WhatsApp gateway')
      apply(data)
      notifySuccess(
        data.invoices_auto_disabled
          ? 'Connection saved. WhatsApp invoices were turned off: update the templates for the new provider, then turn them back on.'
          : 'WhatsApp connection saved',
      )
      onSaved?.()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save WhatsApp gateway')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp Connection
          </CardTitle>
          <CardDescription>
            This store&apos;s one WhatsApp account, used by every WhatsApp feature: invoice messages and party
            statements. Templates and send rules are set per feature on{' '}
            <Link href="/settings/messaging" className="text-primary hover:underline">
              Settings → Customer Messaging
            </Link>
            .
          </CardDescription>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Connection
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {gateway.configured ? (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" /> Connected
            {gateway.invoices_enabled ? ' · WhatsApp invoices are on' : ' · WhatsApp invoices are off'}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Not connected{gateway.missing_reason ? `: ${gateway.missing_reason}` : ''}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gw-provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as WhatsAppProvider)}>
              <SelectTrigger id="gw-provider">
                <SelectValue>{copy.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isTwilio && (
            <div className="space-y-1.5">
              <Label htmlFor="gw-account-sid">Account SID</Label>
              <Input
                id="gw-account-sid"
                autoComplete="off"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                placeholder="AC…"
              />
              <p className="text-xs text-muted-foreground">Twilio Console → Account Info → Account SID.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="gw-api-key">{copy.secretLabel}</Label>
            <Input
              id="gw-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                if (e.target.value) setClearKey(false)
              }}
              placeholder={
                gateway.has_api_key && !providerSwitched && !clearKey
                  ? `Saved (${gateway.api_key_hint || '••••'}), leave blank to keep`
                  : copy.secretPlaceholder
              }
            />
            <p className="text-xs text-muted-foreground">{copy.secretHint}</p>
            {gateway.has_api_key && !providerSwitched && !apiKey && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => setClearKey((v) => !v)}
              >
                {clearKey ? 'Keep saved key' : 'Remove saved key'}
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gw-phone-id">{copy.phoneIdLabel}</Label>
            <Input
              id="gw-phone-id"
              autoComplete="off"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder={copy.phoneIdPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{copy.phoneIdHint}</p>
          </div>
        </div>

        {providerSwitched && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            Switching provider removes the saved {WHATSAPP_PROVIDER_COPY[gateway.provider]?.secretLabel ?? 'key'}.
            Enter the {copy.secretLabel} before saving.
            {gateway.invoices_enabled &&
              ' WhatsApp invoices will be turned off, because template names are provider-specific. Update the templates on Settings → WhatsApp Invoice, then turn them back on.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
