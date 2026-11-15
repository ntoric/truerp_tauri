'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, MessageCircle, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime } from '@/lib/utils'
import {
  DEFAULT_TEMPLATE_PREVIEW,
  SAMPLE_FIELD_VALUES,
  fetchWhatsAppInvoiceLogs,
  fetchWhatsAppInvoiceSettings,
  saveWhatsAppInvoiceSettings,
  sendWhatsAppInvoiceTest,
  type WhatsAppInvoiceLog,
  type WhatsAppInvoiceSettings,
} from '@/lib/whatsappInvoice'

const STATUS_CLASS: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-700',
}

export default function WhatsAppInvoiceSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<WhatsAppInvoiceSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [mapping, setMapping] = useState<string[]>([])
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [logs, setLogs] = useState<WhatsAppInvoiceLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const applySettings = (s: WhatsAppInvoiceSettings) => {
    setSettings(s)
    setMapping((s.variable_mapping || s.default_mapping || '').split(',').filter(Boolean))
    setApiKey('')
  }

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      setLogs(await fetchWhatsAppInvoiceLogs(50))
    } catch {
      // non-fatal
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWhatsAppInvoiceSettings()
      .then(applySettings)
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
    void loadLogs()
  }, [loadLogs])

  const fields = settings?.available_fields ?? []
  const fieldLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key

  const preview = useMemo(
    () =>
      DEFAULT_TEMPLATE_PREVIEW.replace(/\{\{(\d+)\}\}/g, (m, n) => {
        const key = mapping[Number(n) - 1]
        if (!key) return m
        if (key === 'store_name' && settings?.store_display_name) return settings.store_display_name
        return SAMPLE_FIELD_VALUES[key] ?? m
      }),
    [mapping, settings?.store_display_name]
  )

  if (loading || !settings) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  const update = <K extends keyof WhatsAppInvoiceSettings>(key: K, value: WhatsAppInvoiceSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s))

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await saveWhatsAppInvoiceSettings({
        enabled: settings.enabled,
        message_id: settings.message_id,
        phone_number_id: settings.phone_number_id,
        language_code: settings.language_code,
        variable_mapping: mapping.join(','),
        store_display_name: settings.store_display_name,
        attach_pdf: settings.attach_pdf,
        public_base_url: settings.public_base_url,
        country_code: settings.country_code,
        send_for_pos: settings.send_for_pos,
        send_for_non_pos: settings.send_for_non_pos,
        pdf_link_ttl_minutes: settings.pdf_link_ttl_minutes,
        api_key: apiKey.trim() || undefined,
      })
      applySettings(saved)
      notifySuccess('WhatsApp invoice settings saved')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testPhone.trim()) {
      notifyError('Enter a WhatsApp number to send the test to')
      return
    }
    setTesting(true)
    try {
      await sendWhatsAppInvoiceTest(testPhone.trim())
      notifySuccess('Test message sent using your latest invoice')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to send test message')
    } finally {
      setTesting(false)
      void loadLogs()
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/settings?tab=invoice">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp Invoice
              </h1>
              <p className="text-sm text-muted-foreground">
                Send a purchase summary with the invoice PDF to the customer&apos;s WhatsApp via the WhatsApp Cloud API (Meta).
                These settings apply to the current store only.
              </p>
            </div>
          </div>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">Send WhatsApp message on every sale</p>
              <p className="text-sm text-muted-foreground">
                Sent automatically in the background after an invoice is saved. Customers without a valid mobile number are
                skipped.
              </p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => update('enabled', v)} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">WhatsApp Cloud API connection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-api-key">Access token</Label>
                  <Input
                    id="wa-api-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={settings.has_api_key ? `Saved (${settings.api_key_hint || '••••'}), leave blank to keep` : 'Permanent access token'}
                  />
                  <p className="text-xs text-muted-foreground">Meta → WhatsApp → API Setup → permanent token. Stored encrypted.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-message-id">Template name</Label>
                    <Input
                      id="wa-message-id"
                      value={settings.message_id}
                      onChange={(e) => update('message_id', e.target.value)}
                      placeholder="e.g. purchase_summary"
                    />
                    <p className="text-xs text-muted-foreground">Name of the approved template in WhatsApp Manager.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-language">Template language</Label>
                    <Input
                      id="wa-language"
                      value={settings.language_code}
                      onChange={(e) => update('language_code', e.target.value)}
                      placeholder="en"
                    />
                    <p className="text-xs text-muted-foreground">e.g. en, en_US or hi.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-phone-id">Phone Number ID</Label>
                    <Input
                      id="wa-phone-id"
                      value={settings.phone_number_id}
                      onChange={(e) => update('phone_number_id', e.target.value)}
                      placeholder="e.g. 123456789012345"
                    />
                    <p className="text-xs text-muted-foreground">From Meta → WhatsApp → API Setup.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-cc">Default country code</Label>
                    <Input
                      id="wa-cc"
                      value={settings.country_code}
                      onChange={(e) => update('country_code', e.target.value)}
                      placeholder="91"
                    />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice PDF attachment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Attach invoice PDF</p>
                    <p className="text-xs text-muted-foreground">Turn on if your template has a Document header.</p>
                  </div>
                  <Switch checked={settings.attach_pdf} onCheckedChange={(v) => update('attach_pdf', v)} />
                </div>
                {settings.attach_pdf && (
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-base-url">Public API URL</Label>
                    <Input
                      id="wa-base-url"
                      value={settings.public_base_url}
                      onChange={(e) => update('public_base_url', e.target.value)}
                      placeholder={settings.env_public_base_url || 'https://api.yourdomain.com'}
                    />
                    <p className="text-xs text-muted-foreground">
                      Internet-reachable address of this backend. WhatsApp downloads the PDF from a signed link; the
                      PDF is never stored on the server.
                      {settings.env_public_base_url && ` Leave blank to use ${settings.env_public_base_url}.`}
                    </p>
                  </div>
                )}
                {settings.attach_pdf && (
                  <div className="space-y-1.5">
                    <Label htmlFor="wa-link-ttl">PDF link expiry (minutes)</Label>
                    <Input
                      id="wa-link-ttl"
                      type="number"
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">When to send</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>POS sales</Label>
                  <Switch checked={settings.send_for_pos} onCheckedChange={(v) => update('send_for_pos', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Sales invoices (non-POS)</Label>
                  <Switch checked={settings.send_for_non_pos} onCheckedChange={(v) => update('send_for_non_pos', v)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
                  Map each {'{{n}}'} placeholder in your approved WhatsApp template to a value. The order must match the
                  template.
                </p>
                {mapping.map((key, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{`{{${idx + 1}}}`}</span>
                    <Select
                      value={key}
                      onValueChange={(v) => setMapping((m) => m.map((k, i) => (i === idx ? v : k)))}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove variable ${idx + 1}`}
                      onClick={() => setMapping((m) => m.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapping((m) => [...m, fields[0]?.key ?? 'invoice_number'])}
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
                    {settings.attach_pdf && (
                      <div className="mb-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        📄 Invoice_INV-0042.pdf
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900">{preview}</pre>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The actual wording comes from your approved WhatsApp template; only the variables are filled in.
                </p>
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
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send test with latest invoice
                </Button>
                <p className="text-xs text-muted-foreground">Uses saved settings. Save your changes first.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent messages</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void loadLogs()} disabled={logsLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Time</th>
                      <th className="py-2 pr-3 font-medium">Invoice</th>
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 pr-3 font-medium">Number</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b align-top last:border-0">
                        <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(l.created_at)}</td>
                        <td className="py-2 pr-3">
                          {l.invoice_id ? (
                            <Link className="text-blue-600 hover:underline" href={`/invoices/view?id=${l.invoice_id}`}>
                              {l.invoice_number || '—'}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 pr-3">{l.party_name || '—'}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{l.phone || '—'}</td>
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
      </div>
    </DashboardLayout>
  )
}
