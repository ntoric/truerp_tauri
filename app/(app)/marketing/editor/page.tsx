'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import BrandLoader from '@/components/BrandLoader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { notifyError, notifySuccess } from '@/lib/notify'
import PlaceholderTextarea from '@/components/marketing/PlaceholderTextarea'
import { CHANNEL_ICONS } from '@/components/marketing/ChannelStatusPanel'
import {
  AUDIENCE_TYPES,
  CAMPAIGN_TYPES,
  MARKETING_CHANNELS,
  MESSAGE_PRESETS,
  WHATSAPP_TEMPLATE_SAMPLES,
  campaignToForm,
  emptyCampaignForm,
  marketingApi,
  MarketingApiError,
  previewValues,
  renderPreview,
  type AudiencePreview,
  type CampaignForm,
  type ChannelsResponse,
  type MarketingChannel,
  type WATemplateSample,
} from '@/lib/marketing'

interface PartyLite {
  id: string
  name: string
  phone: string
  email: string
  party_type: string
  category: string
}

type SendMode = 'draft' | 'schedule' | 'now'

/** SMS length: GSM-7 160/153, Unicode (e.g. Hindi, emoji) 70/67 per part. */
function smsParts(text: string): { chars: number; parts: number; unicode: boolean } {
  // eslint-disable-next-line no-control-regex
  const unicode = /[^\x00-\x7F₹]/.test(text)
  const chars = Array.from(text).length
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  return { chars, unicode, parts: chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi) }
}

function localDateTimeValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function applyTemplateSample(form: CampaignForm, t: WATemplateSample): CampaignForm {
  const preset = MESSAGE_PRESETS[t.campaignType]
  return {
    ...form,
    type: t.campaignType,
    channels: form.channels.includes('whatsapp') ? form.channels : [...form.channels, 'whatsapp'],
    wa_template_name: t.name,
    wa_language: t.language,
    wa_variables: t.variables.map((v) => v.placeholder),
    message: form.message || preset.message,
    sms_message: form.sms_message || preset.sms,
    email_subject: form.email_subject || preset.subject,
  }
}

function CampaignEditor() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id')
  const templateId = params.get('template')
  const { isPageEnabled } = usePageFeatures()
  const templatesEnabled = isPageEnabled('/marketing/whatsapp-templates')

  const [form, setForm] = useState<CampaignForm>(emptyCampaignForm)
  const [meta, setMeta] = useState<ChannelsResponse | null>(null)
  const [parties, setParties] = useState<PartyLite[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<SendMode | null>(null)
  const [mode, setMode] = useState<SendMode>('now')
  const [scheduleAt, setScheduleAt] = useState(() => localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [partySearch, setPartySearch] = useState('')
  const [testChannel, setTestChannel] = useState<MarketingChannel | ''>('')
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)

  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Initial load: channel status, parties (+ categories), the campaign being edited.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ch, partiesRes] = await Promise.all([marketingApi.channels(), apiFetch('/parties?page=1&per_page=0')])
        if (cancelled) return
        setMeta(ch)
        if (partiesRes.ok) {
          const body = await partiesRes.json()
          setParties(body.parties ?? [])
          setCategories(body.categories ?? [])
        }
        if (editId) {
          const camp = await marketingApi.get(editId)
          if (cancelled) return
          if (camp.status !== 'draft' && camp.status !== 'scheduled') {
            notifyError('Only draft or scheduled campaigns can be edited')
            router.replace('/marketing')
            return
          }
          setForm(campaignToForm(camp))
          if (camp.status === 'scheduled' && camp.scheduled_at) {
            setMode('schedule')
            setScheduleAt(localDateTimeValue(new Date(camp.scheduled_at)))
          }
        } else {
          const ready = ch.channels.filter((c) => c.ready).map((c) => c.key)
          const sample = templateId ? WHATSAPP_TEMPLATE_SAMPLES.find((t) => t.id === templateId) : undefined
          setForm((f) => {
            let next: CampaignForm = { ...f, channels: ready }
            if (sample) next = applyTemplateSample({ ...next, name: sample.title }, sample)
            return next
          })
        }
      } catch (e) {
        notifyError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editId, templateId, router])

  // Audience reach preview (debounced).
  const audienceKey = `${form.audience_type}|${form.audience_category}|${form.audience_party_ids.join(',')}`
  useEffect(() => {
    if (loading) return
    if (form.audience_type === 'category' && !form.audience_category) return setPreview(null)
    if (form.audience_type === 'specific' && form.audience_party_ids.length === 0) return setPreview(null)
    const t = setTimeout(async () => {
      try {
        setPreview(await marketingApi.preview({ ...form, name: form.name || 'preview', channels: [] }))
      } catch {
        setPreview(null)
      }
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey, loading])

  const statusOf = useCallback((ch: MarketingChannel) => meta?.channels.find((c) => c.key === ch), [meta])
  const placeholders = meta?.placeholders ?? []
  const values = useMemo(() => previewValues(form, meta?.store_name), [form, meta?.store_name])
  const has = (ch: MarketingChannel) => form.channels.includes(ch)

  const toggleChannel = (ch: MarketingChannel, on: boolean) =>
    set('channels', on ? MARKETING_CHANNELS.map((c) => c.value).filter((c) => c === ch || form.channels.includes(c)) : form.channels.filter((c) => c !== ch))

  const fillPreset = () => {
    const p = MESSAGE_PRESETS[form.type]
    setForm((f) => ({ ...f, message: p.message, sms_message: p.sms, email_subject: p.subject }))
    notifySuccess('Sample text added for Telegram, email and SMS. Edit it as you like.')
  }

  const filteredParties = useMemo(() => {
    const q = partySearch.trim().toLowerCase()
    const list = q ? parties.filter((p) => [p.name, p.phone, p.email].some((s) => (s || '').toLowerCase().includes(q))) : parties
    return list.slice(0, 200)
  }, [parties, partySearch])

  const toggleParty = (id: string, on: boolean) =>
    set('audience_party_ids', on ? [...form.audience_party_ids, id] : form.audience_party_ids.filter((x) => x !== id))

  const save = async (how: SendMode) => {
    setErrors([])
    if (!form.name.trim()) return setErrors(['Campaign name is required'])
    if (form.channels.length === 0) return setErrors(['Pick at least one channel'])
    let scheduledISO: string | null = null
    if (how === 'schedule') {
      const d = new Date(scheduleAt)
      if (isNaN(d.getTime()) || d.getTime() < Date.now()) return setErrors(['Pick a schedule time in the future'])
      scheduledISO = d.toISOString()
    }
    setSaving(how)
    try {
      const saved = editId ? await marketingApi.update(editId, form, scheduledISO) : await marketingApi.create(form, scheduledISO)
      if (how === 'now') {
        await marketingApi.send(saved.id).catch(async (e) => {
          // Keep the saved draft editable; show what blocks sending.
          if (!editId) router.replace(`/marketing/editor?id=${saved.id}`)
          throw e
        })
        notifySuccess('Campaign is sending. Results appear in the delivery report.')
      } else {
        notifySuccess(how === 'schedule' ? `Scheduled for ${new Date(scheduleAt).toLocaleString()}` : 'Draft saved')
      }
      router.push('/marketing')
    } catch (e) {
      const err = e as MarketingApiError
      setErrors(err.errors?.length ? err.errors : [err.message])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(null)
    }
  }

  const sendTest = async () => {
    if (!testChannel) return
    setTesting(true)
    try {
      const res = await marketingApi.test({ ...form, name: form.name || 'Test' }, testChannel, testTo)
      notifySuccess(res.message)
    } catch (e) {
      const err = e as MarketingApiError
      notifyError(err.errors?.length ? err.errors.join('\n') : err.message, 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  // Readiness warnings for the selected channels (shown before sending).
  const warnings = form.channels
    .map((ch) => statusOf(ch))
    .filter((s) => s && !s.ready)
    .map((s) => `${s!.label}: ${s!.reason}`)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoader />
      </div>
    )
  }

  const sms = smsParts(form.sms_message || form.message)

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/marketing">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{editId ? 'Edit campaign' : 'New campaign'}</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.store_name ? <>For <b>{meta.store_name}</b>. </> : null}Placeholders like {'{{customer_name}}'} are filled per customer.
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" /> Fix these before continuing
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* 1. Basics + offer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Campaign &amp; offer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Campaign name *</Label>
                <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Diwali Sale 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as CampaignForm['type'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer_title">Offer title / headline</Label>
                <Input id="offer_title" value={form.offer_title} onChange={(e) => set('offer_title', e.target.value)} placeholder="Festive Collection" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discount">Discount</Label>
                <Input id="discount" value={form.discount} onChange={(e) => set('discount', e.target.value)} placeholder="20% off / ₹100 off / Buy 1 Get 1" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer_code">Coupon / offer code</Label>
                <Input
                  id="offer_code"
                  value={form.offer_code}
                  onChange={(e) => set('offer_code', e.target.value.toUpperCase())}
                  placeholder="DIWALI20"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valid_until">Valid until</Label>
                <Input id="valid_until" type="date" value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link">Link (optional)</Label>
                <Input id="link" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://yourstore.in/offers" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="image_url">Banner image URL (optional)</Label>
                <Input id="image_url" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…/banner.jpg" />
                <p className="text-xs text-muted-foreground">Public https link. WhatsApp image header, Telegram photo, email banner.</p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Audience */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Send to</Label>
                  <Select value={form.audience_type} onValueChange={(v) => set('audience_type', v as CampaignForm['audience_type'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.audience_type === 'category' && (
                  <div className="space-y-1.5">
                    <Label>Party category</Label>
                    <Select value={form.audience_category} onValueChange={(v) => set('audience_category', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={categories.length ? 'Pick a category' : 'No categories on parties yet'} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {form.audience_type === 'specific' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Input value={partySearch} onChange={(e) => setPartySearch(e.target.value)} placeholder="Search parties" className="h-9 max-w-xs" />
                    <span className="text-xs text-muted-foreground">{form.audience_party_ids.length} selected</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    {filteredParties.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40">
                        <Checkbox checked={form.audience_party_ids.includes(p.id)} onCheckedChange={(v) => toggleParty(p.id, v === true)} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{p.phone || p.email || 'no contact'}</span>
                        <span className="text-[11px] capitalize text-muted-foreground">{p.party_type}</span>
                      </label>
                    ))}
                    {filteredParties.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No parties found.</p>}
                  </div>
                </div>
              )}

              {preview && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4" /> {preview.total} {preview.total === 1 ? 'party' : 'parties'} in this audience
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {MARKETING_CHANNELS.map((c) => (
                      <span key={c.value} className={has(c.value) ? 'text-foreground' : ''}>
                        {c.label}: <b>{preview.reachable[c.value] ?? 0}</b> reachable
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Parties without a mobile number, email or linked Telegram chat are skipped on that channel. Duplicate numbers get one message.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Channels</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {MARKETING_CHANNELS.map((c) => {
                const st = statusOf(c.value)
                const Icon = CHANNEL_ICONS[c.value].icon
                return (
                  <label
                    key={c.value}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${has(c.value) ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                  >
                    <Checkbox checked={has(c.value)} onCheckedChange={(v) => toggleChannel(c.value, v === true)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Icon className={`h-4 w-4 ${CHANNEL_ICONS[c.value].color}`} /> {c.label}
                        {st?.ready ? (
                          <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {st.provider || 'Ready'}
                          </span>
                        ) : (
                          <Link href={st?.setup_url || '#'} className="ml-auto text-xs text-rose-700 underline" onClick={(e) => e.stopPropagation()}>
                            Connect
                          </Link>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{st?.ready ? c.hint : st?.reason}</p>
                    </div>
                  </label>
                )
              })}
            </CardContent>
          </Card>

          {/* 4. Content */}
          {form.channels.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">4. Messages</CardTitle>
                {(has('telegram') || has('email') || has('sms')) && (
                  <Button type="button" variant="outline" size="sm" onClick={fillPreset}>
                    <Wand2 className="mr-1.5 h-4 w-4" /> Fill sample text
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {has('whatsapp') && (
                  <section className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <CHANNEL_ICONS.whatsapp.icon className="h-4 w-4 text-green-600" /> WhatsApp template
                    </h3>
                    {templatesEnabled && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-green-50/60 px-3 py-2 text-xs text-green-900 dark:bg-green-950/30 dark:text-green-200">
                      <Sparkles className="h-3.5 w-3.5" /> Start from a sample:
                      <Select
                        value=""
                        onValueChange={(id) => {
                          const t = WHATSAPP_TEMPLATE_SAMPLES.find((x) => x.id === id)
                          if (t) setForm((f) => applyTemplateSample(f, t))
                        }}
                      >
                        <SelectTrigger className="h-7 w-56 bg-white text-xs dark:bg-transparent">
                          <SelectValue placeholder="Pick a sample template" />
                        </SelectTrigger>
                        <SelectContent>
                          {WHATSAPP_TEMPLATE_SAMPLES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Link href="/marketing?tab=templates" className="underline">
                        See all &amp; copy
                      </Link>
                    </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                      <div className="space-y-1.5">
                        <Label htmlFor="wa_name">Approved template name *</Label>
                        <Input
                          id="wa_name"
                          value={form.wa_template_name}
                          onChange={(e) => set('wa_template_name', e.target.value.trim())}
                          placeholder={statusOf('whatsapp')?.provider === 'Twilio' ? 'HXxxxxxxxx (Content SID)' : 'festival_offer'}
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="wa_lang">Language code</Label>
                        <Input id="wa_lang" value={form.wa_language} onChange={(e) => set('wa_language', e.target.value.trim())} placeholder="en" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Body variables</Label>
                      <p className="text-xs text-muted-foreground">
                        Must match the template: one row per {'{{1}}'}, {'{{2}}'}… in order. Use placeholders or fixed text.
                      </p>
                      {form.wa_variables.map((v, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-2 w-10 shrink-0 font-mono text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                          <div className="min-w-0 flex-1">
                            <PlaceholderTextarea
                              singleLine
                              value={v}
                              onChange={(nv) => set('wa_variables', form.wa_variables.map((x, j) => (j === i ? nv : x)))}
                              placeholders={placeholders}
                              placeholder="{{customer_name}} or fixed text"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove variable ${i + 1}`}
                            onClick={() => set('wa_variables', form.wa_variables.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => set('wa_variables', [...form.wa_variables, ''])} disabled={form.wa_variables.length >= 20}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add variable
                      </Button>
                    </div>
                  </section>
                )}

                {(has('telegram') || has('email') || has('sms')) && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      Message{' '}
                      <span className="font-normal text-muted-foreground">
                        ({[has('telegram') && 'Telegram', has('email') && 'email if no HTML body', has('sms') && 'SMS if no SMS text'].filter(Boolean).join(', ')})
                      </span>
                    </h3>
                    <PlaceholderTextarea value={form.message} onChange={(v) => set('message', v)} placeholders={placeholders} rows={6} />
                  </section>
                )}

                {has('email') && (
                  <section className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <CHANNEL_ICONS.email.icon className="h-4 w-4 text-violet-600" /> Email
                    </h3>
                    <div className="space-y-1.5">
                      <Label>Subject *</Label>
                      <PlaceholderTextarea singleLine value={form.email_subject} onChange={(v) => set('email_subject', v)} placeholders={placeholders.slice(0, 7)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>HTML body (optional)</Label>
                      <PlaceholderTextarea
                        value={form.email_body}
                        onChange={(v) => set('email_body', v)}
                        placeholders={placeholders}
                        rows={6}
                        placeholder="Leave empty to send the message above. HTML is allowed, e.g. <h2>Big sale!</h2><p>Hi {{first_name}}…</p>"
                      />
                      <p className="text-xs text-muted-foreground">The offer code and a &quot;Shop now&quot; button are added automatically when not in the text.</p>
                    </div>
                  </section>
                )}

                {has('sms') && (
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <CHANNEL_ICONS.sms.icon className="h-4 w-4 text-amber-600" /> SMS text (optional)
                    </h3>
                    <PlaceholderTextarea
                      value={form.sms_message}
                      onChange={(v) => set('sms_message', v)}
                      placeholders={placeholders.slice(0, 9)}
                      rows={3}
                      placeholder="Short version for SMS. Leave empty to use the message above."
                    />
                    <p className={`text-xs ${sms.parts > 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                      ~{sms.chars} characters before placeholders are filled · {sms.parts} SMS part{sms.parts === 1 ? '' : 's'}
                      {sms.unicode ? ' (Unicode: 70 chars per part)' : ''}. In India, promotional SMS must match a DLT-registered template.
                    </p>
                  </section>
                )}
              </CardContent>
            </Card>
          )}

          {/* 5. Send */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">5. Test &amp; send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" /> Send a test first
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Select value={testChannel} onValueChange={(v) => setTestChannel(v as MarketingChannel)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETING_CHANNELS.filter((c) => has(c.value)).map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    className="min-w-0 flex-1 sm:max-w-xs"
                    placeholder={
                      testChannel === 'email' ? 'you@example.com' : testChannel === 'telegram' ? 'Chat ID (blank = owner chat)' : 'Mobile number'
                    }
                  />
                  <Button type="button" variant="outline" onClick={sendTest} disabled={!testChannel || testing}>
                    {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Send test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Uses sample customer values (&quot;Test Customer&quot;). Nothing is saved.</p>
              </div>

              <div className="space-y-2">
                <Label>When</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['now', 'Send now'],
                      ['schedule', 'Schedule'],
                      ['draft', 'Save as draft'],
                    ] as const
                  ).map(([v, l]) => (
                    <Button key={v} type="button" variant={mode === v ? 'default' : 'outline'} size="sm" onClick={() => setMode(v)}>
                      {l}
                    </Button>
                  ))}
                </div>
                {mode === 'schedule' && (
                  <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="max-w-xs" />
                )}
              </div>

              {warnings.length > 0 && mode !== 'draft' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {warnings.map((w) => (
                    <div key={w}>⚠ {w}</div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button asChild variant="ghost">
                  <Link href="/marketing">Cancel</Link>
                </Button>
                <Button type="button" onClick={() => save(mode)} disabled={saving != null}>
                  {saving ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : mode === 'now' ? (
                    <Send className="mr-1.5 h-4 w-4" />
                  ) : mode === 'schedule' ? (
                    <CalendarClock className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  {mode === 'now'
                    ? preview
                      ? `Send to ${preview.total} ${preview.total === 1 ? 'party' : 'parties'}`
                      : 'Send now'
                    : mode === 'schedule'
                      ? 'Schedule campaign'
                      : 'Save draft'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <p className="text-xs text-muted-foreground">With sample customer “Asha Rao”.</p>
            </CardHeader>
            <CardContent>
              {form.channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pick a channel to see a preview.</p>
              ) : (
                <Tabs defaultValue={form.channels[0]} key={form.channels.join(',')}>
                  <TabsList className="mb-3 h-auto flex-wrap justify-start">
                    {form.channels.map((ch) => (
                      <TabsTrigger key={ch} value={ch} className="text-xs">
                        {MARKETING_CHANNELS.find((c) => c.value === ch)?.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="whatsapp" className="mt-0">
                    <div className="rounded-2xl bg-[#e5ddd5] p-3 dark:bg-emerald-950/40">
                      <div className="rounded-lg bg-white p-2.5 text-[13px] text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100">
                        {form.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.image_url} alt="" className="mb-2 w-full rounded-md object-cover" />
                        )}
                        <div className="font-mono text-[11px] text-muted-foreground">{form.wa_template_name || 'template_name'}</div>
                        <ol className="mt-1.5 space-y-0.5">
                          {form.wa_variables.map((v, i) => (
                            <li key={i}>
                              <span className="font-mono text-[11px] text-emerald-700">{`{{${i + 1}}}`}</span> → {renderPreview(v, values) || '—'}
                            </li>
                          ))}
                          {form.wa_variables.length === 0 && <li className="text-muted-foreground">No variables</li>}
                        </ol>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                        WhatsApp shows the approved template text with these values filled in.
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="telegram" className="mt-0">
                    <div className="rounded-2xl bg-sky-50 p-3 dark:bg-sky-950/30">
                      <div className="whitespace-pre-wrap rounded-lg bg-white p-2.5 text-[13px] shadow-sm dark:bg-slate-900">
                        {form.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.image_url} alt="" className="mb-2 w-full rounded-md object-cover" />
                        )}
                        {renderPreview(form.message, values) || <span className="text-muted-foreground">Write a message…</span>}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="email" className="mt-0">
                    <div className="rounded-lg border">
                      <div className="border-b px-3 py-2 text-sm font-medium">{renderPreview(form.email_subject, values) || 'Subject…'}</div>
                      <div className="p-3 text-[13px]">
                        {form.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.image_url} alt="" className="mb-2 w-full rounded-md object-cover" />
                        )}
                        {form.email_body ? (
                          <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-xs">
                            {renderPreview(form.email_body, values)}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{renderPreview(form.message, values)}</div>
                        )}
                        {form.offer_code && !(form.email_body + form.message).includes('offer_code') && (
                          <div className="my-3 rounded-md border-2 border-dashed border-amber-500 py-2 text-center font-mono font-bold tracking-widest">
                            {form.offer_code}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="sms" className="mt-0">
                    <div className="rounded-2xl bg-muted/50 p-3">
                      <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white p-2.5 text-[13px] shadow-sm dark:bg-slate-900">
                        {renderPreview(form.sms_message || form.message, values) || <span className="text-muted-foreground">Write a message…</span>}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
              {placeholders.length > 0 && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">All placeholders</summary>
                  <div className="mt-2">
                    <ul className="space-y-0.5 text-muted-foreground">
                      {placeholders.map((p) => (
                        <li key={p.key}>
                          <code className="font-mono">{`{{${p.key}}}`}</code> — {p.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function CampaignEditorPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <BrandLoader />
          </div>
        }
      >
        <CampaignEditor />
      </Suspense>
    </DashboardLayout>
  )
}
