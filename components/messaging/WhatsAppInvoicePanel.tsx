'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useAuth } from '@/hooks/useAuth'
import { isSuperAdmin } from '@/lib/roles'
import {
  DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW,
  DEFAULT_TEMPLATE_PREVIEW,
  buildTemplatePreview,
  sampleFieldValue,
  WHATSAPP_PROVIDER_COPY,
  fetchWhatsAppInvoiceSettings,
  saveWhatsAppInvoiceSettings,
  sendWhatsAppInvoiceTest,
  type WhatsAppInvoiceSettings,
  type WhatsAppProvider,
} from '@/lib/whatsappInvoice'
import ChannelStatusCard from './ChannelStatusCard'

export function whatsAppGatewayConnected(s: WhatsAppInvoiceSettings, superAdmin: boolean) {
  const isTwilio = s.provider === 'twilio'
  return !!s.has_api_key && !!s.has_phone_number_id && (!isTwilio || !superAdmin || !!s.account_sid)
}

export function whatsAppProvider(s: { provider?: string }): WhatsAppProvider {
  return s.provider === 'fast2sms' || s.provider === 'twilio' ? s.provider : 'whatsapp_cloud'
}

/** Full save payload; shared by the invoice and channel panels so neither drops the other's fields. */
export function whatsAppSettingsPayload(s: WhatsAppInvoiceSettings) {
  return {
    enabled: s.enabled,
    message_id: s.message_id,
    language_code: s.language_code,
    variable_mapping: s.variable_mapping || s.default_mapping || '',
    store_display_name: s.store_display_name,
    template_body: s.template_body,
    no_loyalty_message_id: s.no_loyalty_message_id ?? '',
    no_loyalty_variable_mapping: s.no_loyalty_variable_mapping ?? '',
    no_loyalty_template_body: s.no_loyalty_template_body ?? '',
    attach_pdf: s.attach_pdf,
    public_base_url: s.public_base_url,
    country_code: s.country_code,
    send_for_pos: s.send_for_pos,
    send_for_non_pos: s.send_for_non_pos,
    pdf_link_ttl_minutes: s.pdf_link_ttl_minutes,
  }
}

/** Invoices → WhatsApp: on/off, template, variables, preview and test for the invoice message. */
export default function WhatsAppInvoicePanel({
  toolbar,
  onOpenChannel,
}: {
  toolbar: ReactNode
  onOpenChannel: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<WhatsAppInvoiceSettings | null>(null)
  const { user } = useAuth()
  const superAdmin = !!user && isSuperAdmin(user.role)
  const [mapping, setMapping] = useState<string[]>([])
  const [templateBody, setTemplateBody] = useState(DEFAULT_TEMPLATE_PREVIEW)
  // Template sent while the loyalty program is off.
  const [nlMapping, setNlMapping] = useState<string[]>([])
  const [nlBody, setNlBody] = useState(DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW)
  // Which template the variables + preview cards are editing.
  const [variant, setVariant] = useState<'main' | 'no_loyalty'>('main')
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)

  const applySettings = (s: WhatsAppInvoiceSettings) => {
    setSettings(s)
    setMapping((s.variable_mapping || s.default_mapping || '').split(',').filter(Boolean))
    setTemplateBody(s.template_body?.trim() ? s.template_body : DEFAULT_TEMPLATE_PREVIEW)
    setNlMapping((s.no_loyalty_variable_mapping || s.default_no_loyalty_mapping || '').split(',').filter(Boolean))
    setNlBody(s.no_loyalty_template_body?.trim() ? s.no_loyalty_template_body : DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW)
  }

  useEffect(() => {
    fetchWhatsAppInvoiceSettings()
      .then(applySettings)
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const fields = settings?.available_fields ?? []
  const fieldLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key

  const isNoLoyalty = variant === 'no_loyalty'
  const curMapping = isNoLoyalty ? nlMapping : mapping
  const setCurMapping = isNoLoyalty ? setNlMapping : setMapping
  const curBody = isNoLoyalty ? nlBody : templateBody
  const setCurBody = isNoLoyalty ? setNlBody : setTemplateBody
  const curDefaultBody = isNoLoyalty ? DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW : DEFAULT_TEMPLATE_PREVIEW

  const preview = useMemo(
    () => buildTemplatePreview(curBody, curMapping, settings?.store_display_name),
    [curBody, curMapping, settings?.store_display_name]
  )
  // {{n}} in the text with no mapped value, and mapped values the text never uses.
  // WhatsApp rejects a send when the parameter count differs from the template.
  const unmappedVars = preview.used.filter((n) => n > curMapping.length)
  // PDF-file variables live in a Twilio media URL, not the body text.
  const unusedVars = curMapping
    .map((_, i) => i + 1)
    .filter((n) => !preview.used.includes(n) && curMapping[n - 1] !== 'invoice_pdf_file')

  if (loading || !settings) return <FormPageSkeleton />

  const provider = whatsAppProvider(settings)
  const isTwilio = provider === 'twilio'
  const copy = WHATSAPP_PROVIDER_COPY[provider]
  const gatewayConnected = whatsAppGatewayConnected(settings, superAdmin)
  const hasPublicUrl = !!(settings.public_base_url?.trim() || settings.env_public_base_url)

  const update = <K extends keyof WhatsAppInvoiceSettings>(key: K, value: WhatsAppInvoiceSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s))

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await saveWhatsAppInvoiceSettings({
        ...whatsAppSettingsPayload(settings),
        variable_mapping: mapping.join(','),
        template_body: templateBody.trim() === DEFAULT_TEMPLATE_PREVIEW.trim() ? '' : templateBody,
        no_loyalty_variable_mapping: nlMapping.join(','),
        no_loyalty_template_body: nlBody.trim() === DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW.trim() ? '' : nlBody,
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
    }
  }

  const templateSwitch = (
    <Tabs value={variant} onValueChange={(v) => setVariant(v as typeof variant)}>
      <TabsList aria-label="Template to edit" className="min-h-0">
        <TabsTrigger value="main" className="px-3 py-1.5 text-xs">
          Main
        </TabsTrigger>
        <TabsTrigger value="no_loyalty" className="px-3 py-1.5 text-xs">
          Without loyalty
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )

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
        ok={gatewayConnected}
        title={gatewayConnected ? `WhatsApp connected (${copy.label})` : 'WhatsApp not connected'}
        hint="Sender, country code, store name and the Public API URL are shared with party statements."
        actionLabel="WhatsApp settings"
        onAction={onOpenChannel}
      />

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">Send WhatsApp message on every sale</p>
            <p className="text-sm text-muted-foreground">
              Sent automatically in the background after an invoice is saved. Customers without a valid mobile
              number are skipped.
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => update('enabled', v)}
            aria-label="Send WhatsApp message on every sale"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`grid gap-4 ${copy.usesLanguage ? 'sm:grid-cols-2' : ''}`}>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-message-id">{copy.templateLabel}</Label>
                  <Input
                    id="wa-message-id"
                    value={settings.message_id}
                    onChange={(e) => update('message_id', e.target.value)}
                    placeholder={copy.templatePlaceholder}
                  />
                  <p className="text-xs text-muted-foreground">{copy.templateHint}</p>
                </div>
                {copy.usesLanguage && (
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
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Attach invoice PDF</p>
                  <p className="text-xs text-muted-foreground">{copy.pdfHint}</p>
                </div>
                <Switch
                  checked={settings.attach_pdf}
                  onCheckedChange={(v) => update('attach_pdf', v)}
                  aria-label="Attach invoice PDF"
                />
              </div>
              {settings.attach_pdf && !hasPublicUrl && (
                <p className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Set the Public API URL in the{' '}
                    <button type="button" className="font-medium underline" onClick={onOpenChannel}>
                      WhatsApp tab
                    </button>{' '}
                    so WhatsApp can download the PDF.
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">When to send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="wa-pos">POS sales</Label>
                <Switch id="wa-pos" checked={settings.send_for_pos} onCheckedChange={(v) => update('send_for_pos', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="wa-nonpos">Sales invoices (non-POS)</Label>
                <Switch
                  id="wa-nonpos"
                  checked={settings.send_for_non_pos}
                  onCheckedChange={(v) => update('send_for_non_pos', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Template when loyalty program is off</CardTitle>
              <Badge className={settings.loyalty_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
                Loyalty {settings.loyalty_enabled ? 'on' : 'off'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Sent instead of the main template while the loyalty program is disabled, e.g. a template without the
                points lines. Leave blank to always send the main template. Language, sender and PDF settings are
                shared.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="wa-nl-message-id">{copy.templateLabel} (without loyalty)</Label>
                <Input
                  id="wa-nl-message-id"
                  value={settings.no_loyalty_message_id ?? ''}
                  onChange={(e) => update('no_loyalty_message_id', e.target.value)}
                  placeholder={
                    isTwilio
                      ? 'HX… (blank = use main template)'
                      : 'e.g. purchase_summary_basic (blank = use main template)'
                  }
                />
              </div>
              {settings.no_loyalty_message_id?.trim() && (
                <Button variant="outline" size="sm" onClick={() => setVariant('no_loyalty')} disabled={isNoLoyalty}>
                  Edit its variables and preview
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Template variables</CardTitle>
              <div className="flex items-center gap-2">
                {templateSwitch}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCurMapping(
                      ((isNoLoyalty ? settings.default_no_loyalty_mapping : settings.default_mapping) || '')
                        .split(',')
                        .filter(Boolean)
                    )
                  }
                >
                  Reset to default
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Map each {'{{n}}'} placeholder in your approved WhatsApp template to a value. The order must match the
                template.
                {isTwilio && ' For Twilio media templates, also map the media URL variable to "Invoice PDF file".'}
              </p>
              {isNoLoyalty && !settings.no_loyalty_message_id?.trim() && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No template set for when loyalty is off, so these variables aren&apos;t used. Enter its{' '}
                  {copy.templateLabel.toLowerCase()} in &quot;Template when loyalty program is off&quot;.
                </p>
              )}
              {curMapping.map((key, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{`{{${idx + 1}}}`}</span>
                  <Select
                    value={key}
                    onValueChange={(v) => setCurMapping((m) => m.map((k, i) => (i === idx ? v : k)))}
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
                    title={sampleFieldValue(key, settings.store_display_name)}
                  >
                    e.g. {sampleFieldValue(key, settings.store_display_name)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove variable ${idx + 1}`}
                    onClick={() => setCurMapping((m) => m.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurMapping((m) => [...m, fields[0]?.key ?? 'invoice_number'])}
              >
                <Plus className="mr-2 h-4 w-4" /> Add variable
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Preview (sample data)</CardTitle>
              {templateSwitch}
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-[#e5ddd5] p-3">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  {settings.attach_pdf && (
                    <div className="mb-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      📄 Invoice_INV-0042.pdf
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm text-gray-900">
                    {preview.parts.map((part, i) =>
                      part.kind === 'text' ? (
                        <span key={i}>{part.text}</span>
                      ) : part.key ? (
                        <span
                          key={i}
                          className="rounded bg-green-100 px-0.5 font-medium text-green-900"
                          title={`{{${part.n}}} = ${fieldLabel(part.key)}`}
                        >
                          {part.value}
                        </span>
                      ) : (
                        <span
                          key={i}
                          className="rounded bg-red-100 px-0.5 font-mono text-red-700"
                          title="Not mapped to any value"
                        >
                          {`{{${part.n}}}`}
                        </span>
                      )
                    )}
                  </p>
                </div>
              </div>
              {(unmappedVars.length > 0 || unusedVars.length > 0) && (
                <div className="mt-2 space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {unmappedVars.length > 0 && (
                    <p>
                      {unmappedVars.map((n) => `{{${n}}}`).join(', ')} {unmappedVars.length === 1 ? 'is' : 'are'} in
                      the template but not mapped. Add a variable for {unmappedVars.length === 1 ? 'it' : 'them'}.
                    </p>
                  )}
                  {unusedVars.length > 0 && (
                    <p>
                      {unusedVars.map((n) => `{{${n}}}`).join(', ')} {unusedVars.length === 1 ? 'is' : 'are'} mapped
                      but not in the template text. WhatsApp rejects the message if the variable count doesn&apos;t
                      match your approved template.
                    </p>
                  )}
                </div>
              )}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wa-template-body">Template text</Label>
                  {curBody !== curDefaultBody && (
                    <Button variant="ghost" size="sm" onClick={() => setCurBody(curDefaultBody)}>
                      Use sample
                    </Button>
                  )}
                </div>
                <Textarea
                  id="wa-template-body"
                  rows={8}
                  value={curBody}
                  onChange={(e) => setCurBody(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Paste your approved template&apos;s body with its {'{{1}}'}, {'{{2}}'}… placeholders to preview it.
                  Used for this preview only; WhatsApp always sends the approved template&apos;s wording.
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
                aria-label="Test WhatsApp number"
              />
              <Button className="w-full" variant="outline" onClick={() => void handleTest()} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send test with latest invoice
              </Button>
              <p className="text-xs text-muted-foreground">
                Uses saved settings. Save your changes first. Sends the{' '}
                {settings.loyalty_enabled || !settings.no_loyalty_message_id?.trim() ? 'main' : 'without-loyalty'}{' '}
                template, matching the current loyalty setting.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
