'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bell,
  FlaskConical,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  Zap,
} from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { isSuperAdmin } from '@/lib/roles'
import {
  broadcastNotification,
  clearNotificationDeliveries,
  createNotificationEvent,
  deleteNotificationEvent,
  EVENT_CATEGORIES,
  fetchNotificationChannels,
  fetchNotificationDeliveries,
  fetchNotificationEvents,
  NOTIFICATION_CHANNELS,
  testNotificationChannel,
  triggerNotificationEvent,
  updateNotificationChannel,
  updateNotificationEvent,
  type DeliveryResult,
  type NotificationChannel,
  type NotificationChannelKey,
  type NotificationDelivery,
  type NotificationEvent,
} from '@/lib/notificationAdmin'

// ---------- Event form ----------

interface EventFormState {
  key: string
  name: string
  description: string
  category: string
  is_active: boolean
  email_enabled: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  telegram_enabled: boolean
  push_enabled: boolean
  internal_enabled: boolean
  recipient_emails: string
  recipient_phones: string
  recipient_telegram_chats: string
  push_device_tokens: string
  notify_store_owner: boolean
  subject_template: string
  body_template: string
  variables: string
}

const emptyEventForm: EventFormState = {
  key: '',
  name: '',
  description: '',
  category: 'custom',
  is_active: true,
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  telegram_enabled: false,
  push_enabled: false,
  internal_enabled: true,
  recipient_emails: '',
  recipient_phones: '',
  recipient_telegram_chats: '',
  push_device_tokens: '',
  notify_store_owner: false,
  subject_template: '',
  body_template: '',
  variables: '',
}

function eventToForm(e: NotificationEvent): EventFormState {
  return {
    key: e.key,
    name: e.name,
    description: e.description,
    category: e.category,
    is_active: e.is_active,
    email_enabled: e.email_enabled,
    sms_enabled: e.sms_enabled,
    whatsapp_enabled: e.whatsapp_enabled,
    telegram_enabled: e.telegram_enabled,
    push_enabled: e.push_enabled,
    internal_enabled: e.internal_enabled,
    recipient_emails: e.recipient_emails,
    recipient_phones: e.recipient_phones,
    recipient_telegram_chats: e.recipient_telegram_chats,
    push_device_tokens: e.push_device_tokens,
    notify_store_owner: e.notify_store_owner,
    subject_template: e.subject_template,
    body_template: e.body_template,
    variables: e.variables,
  }
}

const EVENT_CHANNEL_TOGGLES: { field: keyof EventFormState; label: string }[] = [
  { field: 'email_enabled', label: 'Email' },
  { field: 'sms_enabled', label: 'SMS' },
  { field: 'whatsapp_enabled', label: 'WhatsApp' },
  { field: 'telegram_enabled', label: 'Telegram' },
  { field: 'push_enabled', label: 'Push' },
  { field: 'internal_enabled', label: 'Internal alert' },
]

// ---------- Channel field schemas ----------

interface FieldSpec {
  key: string
  label: string
  placeholder?: string
  type?: string
  /** Only render when this provider is selected (for multi-provider channels). */
  forProviders?: string[]
}

interface ChannelSpec {
  key: NotificationChannelKey
  label: string
  icon: typeof Mail
  description: string
  providers?: { value: string; label: string }[]
  configFields: FieldSpec[]
  secretFields: FieldSpec[]
  recipientLabel: string
  recipientPlaceholder: string
}

const CHANNEL_SPECS: ChannelSpec[] = [
  {
    key: 'smtp',
    label: 'Email (SMTP)',
    icon: Mail,
    description: 'Send event emails through your own SMTP server.',
    configFields: [
      { key: 'host', label: 'SMTP host', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', placeholder: '587', type: 'number' },
      { key: 'username', label: 'Username', placeholder: 'smtp user' },
      { key: 'from_email', label: 'From email', placeholder: 'alerts@yourapp.com' },
      { key: 'from_name', label: 'From name', placeholder: 'TruERP Alerts' },
    ],
    secretFields: [{ key: 'password', label: 'SMTP password' }],
    recipientLabel: 'Email address',
    recipientPlaceholder: 'admin@example.com',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: Send,
    description: 'Deliver messages via a Telegram bot to configured chat IDs.',
    configFields: [],
    secretFields: [{ key: 'bot_token', label: 'Bot token', placeholder: '123456:ABC-DEF…' }],
    recipientLabel: 'Chat ID',
    recipientPlaceholder: '123456789',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    description: 'Send WhatsApp messages via Meta Cloud API or Twilio.',
    providers: [
      { value: 'meta', label: 'Meta Cloud API' },
      { value: 'twilio', label: 'Twilio' },
    ],
    configFields: [
      { key: 'phone_number_id', label: 'Phone number ID', placeholder: 'Meta phone number ID', forProviders: ['meta'] },
      { key: 'business_account_id', label: 'Business account ID', forProviders: ['meta'] },
      { key: 'twilio_account_sid', label: 'Twilio account SID', forProviders: ['twilio'] },
      { key: 'twilio_from', label: 'Twilio WhatsApp sender', placeholder: '+14155238886', forProviders: ['twilio'] },
    ],
    secretFields: [
      { key: 'access_token', label: 'Meta access token', forProviders: ['meta'] },
      { key: 'twilio_auth_token', label: 'Twilio auth token', forProviders: ['twilio'] },
    ],
    recipientLabel: 'Phone number',
    recipientPlaceholder: '+919876543210',
  },
  {
    key: 'sms',
    label: 'SMS',
    icon: Smartphone,
    description: 'Send SMS through Twilio, MSG91, TextLocal or a custom webhook.',
    providers: [
      { value: 'twilio', label: 'Twilio' },
      { value: 'msg91', label: 'MSG91' },
      { value: 'textlocal', label: 'TextLocal' },
      { value: 'webhook', label: 'Custom webhook' },
    ],
    configFields: [
      { key: 'twilio_account_sid', label: 'Twilio account SID', forProviders: ['twilio'] },
      { key: 'twilio_from', label: 'Twilio sender number', placeholder: '+15005550006', forProviders: ['twilio'] },
      { key: 'sender_id', label: 'Sender ID', placeholder: 'TRUERP', forProviders: ['msg91'] },
      { key: 'country', label: 'Country code', placeholder: '91', forProviders: ['msg91'] },
      { key: 'sender', label: 'Sender ID', placeholder: 'TXTLCL', forProviders: ['textlocal'] },
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://…', forProviders: ['webhook'] },
    ],
    secretFields: [
      { key: 'twilio_auth_token', label: 'Twilio auth token', forProviders: ['twilio'] },
      { key: 'auth_key', label: 'MSG91 auth key', forProviders: ['msg91'] },
      { key: 'api_key', label: 'TextLocal API key', forProviders: ['textlocal'] },
      { key: 'webhook_secret', label: 'Webhook bearer token (optional)', forProviders: ['webhook'] },
    ],
    recipientLabel: 'Phone number',
    recipientPlaceholder: '+919876543210',
  },
  {
    key: 'push',
    label: 'Push notifications',
    icon: Zap,
    description: 'Send push via Firebase Cloud Messaging or a custom webhook gateway.',
    providers: [
      { value: 'fcm', label: 'Firebase Cloud Messaging' },
      { value: 'webhook', label: 'Custom webhook' },
    ],
    configFields: [{ key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://…', forProviders: ['webhook'] }],
    secretFields: [
      { key: 'server_key', label: 'FCM server key', forProviders: ['fcm'] },
      { key: 'webhook_secret', label: 'Webhook bearer token (optional)', forProviders: ['webhook'] },
    ],
    recipientLabel: 'Device token(s)',
    recipientPlaceholder: 'fcm-device-token',
  },
]

function statusBadge(status: string) {
  const cls =
    status === 'sent'
      ? 'border-green-200 bg-green-50 text-green-700'
      : status === 'failed'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-gray-200 bg-gray-50 text-gray-600'
  return <Badge variant="outline" className={cls}>{status}</Badge>
}

function channelBadges(e: NotificationEvent) {
  const active: string[] = []
  if (e.email_enabled) active.push('email')
  if (e.sms_enabled) active.push('sms')
  if (e.whatsapp_enabled) active.push('whatsapp')
  if (e.telegram_enabled) active.push('telegram')
  if (e.push_enabled) active.push('push')
  if (e.internal_enabled) active.push('internal')
  if (active.length === 0) return <span className="text-xs text-gray-400">no channels</span>
  return active.map((ch) => (
    <Badge key={ch} variant="secondary" className="capitalize">
      {ch}
    </Badge>
  ))
}

export default function NotificationCenterPage() {
  const { user, loading: authLoading } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('events')

  const [events, setEvents] = useState<NotificationEvent[]>([])
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([])
  const [deliveriesTotal, setDeliveriesTotal] = useState(0)
  const [deliveryFilters, setDeliveryFilters] = useState({ channel: '', status: '', event_key: '' })

  // Event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<NotificationEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventFormState>(emptyEventForm)
  const [savingEvent, setSavingEvent] = useState(false)

  // Trigger dialog state
  const [triggerEvent, setTriggerEvent] = useState<NotificationEvent | null>(null)
  const [triggerData, setTriggerData] = useState('{}')
  const [triggerResults, setTriggerResults] = useState<DeliveryResult[] | null>(null)
  const [triggering, setTriggering] = useState(false)

  // Channel editing state: per-channel local copy of config + secrets inputs
  const [channelDrafts, setChannelDrafts] = useState<Record<string, { config: Record<string, string>; secrets: Record<string, string> }>>({})
  const [channelBusy, setChannelBusy] = useState<string | null>(null)
  const [testRecipients, setTestRecipients] = useState<Record<string, string>>({})

  // Broadcast state
  const [broadcast, setBroadcast] = useState({
    title: '',
    message: '',
    channels: [] as string[],
    emails: '',
    phones: '',
    telegram_chat_ids: '',
    device_tokens: '',
  })
  const [broadcastResults, setBroadcastResults] = useState<DeliveryResult[] | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)

  const isAdmin = !!user && isSuperAdmin(user.role)

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await fetchNotificationEvents())
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load events')
    }
  }, [])

  const loadChannels = useCallback(async () => {
    try {
      const list = await fetchNotificationChannels()
      setChannels(list)
      setChannelDrafts((prev) => {
        const next = { ...prev }
        for (const ch of list) {
          if (!next[ch.channel]) {
            next[ch.channel] = { config: { ...ch.config }, secrets: {} }
          } else {
            next[ch.channel] = { config: { ...next[ch.channel].config, ...ch.config }, secrets: next[ch.channel].secrets }
          }
        }
        return next
      })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load channels')
    }
  }, [])

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await fetchNotificationDeliveries({ ...deliveryFilters, limit: 100 })
      setDeliveries(res.deliveries)
      setDeliveriesTotal(res.total)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load deliveries')
    }
  }, [deliveryFilters])

  useEffect(() => {
    if (!authLoading && isAdmin) {
      setLoading(true)
      void Promise.all([loadEvents(), loadChannels(), loadDeliveries()]).finally(() => setLoading(false))
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, isAdmin, loadEvents, loadChannels, loadDeliveries])

  useEffect(() => {
    if (isAdmin) void loadDeliveries()
  }, [deliveryFilters, isAdmin, loadDeliveries])

  const channelByKey = useMemo(() => {
    const map = new Map<string, NotificationChannel>()
    channels.forEach((c) => map.set(c.channel, c))
    return map
  }, [channels])

  // ---------- Event handlers ----------

  const openCreateEvent = () => {
    setEditingEvent(null)
    setEventForm(emptyEventForm)
    setEventDialogOpen(true)
  }

  const openEditEvent = (e: NotificationEvent) => {
    setEditingEvent(e)
    setEventForm(eventToForm(e))
    setEventDialogOpen(true)
  }

  const saveEvent = async () => {
    setSavingEvent(true)
    setMessage('')
    try {
      if (editingEvent) {
        await updateNotificationEvent(editingEvent.id, eventForm)
        setMessage('Event updated.')
      } else {
        await createNotificationEvent(eventForm)
        setMessage('Event created.')
      }
      setEventDialogOpen(false)
      await loadEvents()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save event')
    } finally {
      setSavingEvent(false)
    }
  }

  const removeEvent = async (e: NotificationEvent) => {
    if (!(await confirm({
      title: `Delete event "${e.name}"?`,
      description: 'Delivery history is kept, but this event can no longer be triggered.',
    }))) return
    try {
      await deleteNotificationEvent(e.id)
      setMessage('Event deleted.')
      await loadEvents()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete event')
    }
  }

  const toggleEventActive = async (e: NotificationEvent) => {
    try {
      await updateNotificationEvent(e.id, { is_active: !e.is_active })
      await loadEvents()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update event')
    }
  }

  const runTrigger = async () => {
    if (!triggerEvent) return
    let data: Record<string, string>
    try {
      const parsed = JSON.parse(triggerData || '{}')
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bad')
      data = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]))
    } catch {
      setMessage('Trigger data must be a JSON object, e.g. {"invoice_number": "INV-1"}')
      return
    }
    setTriggering(true)
    setTriggerResults(null)
    try {
      const res = await triggerNotificationEvent(triggerEvent.id, data)
      setTriggerResults(res.results)
      await loadDeliveries()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to trigger event')
    } finally {
      setTriggering(false)
    }
  }

  // ---------- Channel handlers ----------

  const draftFor = (key: string) => channelDrafts[key] || { config: {}, secrets: {} }

  const setDraftConfig = (key: string, field: string, value: string) => {
    setChannelDrafts((prev) => ({
      ...prev,
      [key]: { config: { ...draftFor(key).config, [field]: value }, secrets: draftFor(key).secrets },
    }))
  }

  const setDraftSecret = (key: string, field: string, value: string) => {
    setChannelDrafts((prev) => ({
      ...prev,
      [key]: { config: draftFor(key).config, secrets: { ...draftFor(key).secrets, [field]: value } },
    }))
  }

  const saveChannel = async (spec: ChannelSpec) => {
    const draft = draftFor(spec.key)
    setChannelBusy(spec.key)
    setMessage('')
    try {
      await updateNotificationChannel(spec.key, { config: draft.config, secrets: draft.secrets })
      setMessage(`${spec.label} configuration saved.`)
      await loadChannels()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Failed to save ${spec.label}`)
    } finally {
      setChannelBusy(null)
    }
  }

  const toggleChannel = async (spec: ChannelSpec, enabled: boolean) => {
    setChannelBusy(spec.key)
    setMessage('')
    try {
      await updateNotificationChannel(spec.key, { is_enabled: enabled })
      setMessage(`${spec.label} ${enabled ? 'enabled' : 'disabled'}.`)
      await loadChannels()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Failed to update ${spec.label}`)
    } finally {
      setChannelBusy(null)
    }
  }

  const testChannel = async (spec: ChannelSpec) => {
    const recipient = (testRecipients[spec.key] || '').trim()
    if (!recipient) {
      setMessage(`Enter a ${spec.recipientLabel.toLowerCase()} to send the ${spec.label} test.`)
      return
    }
    setChannelBusy(`test-${spec.key}`)
    setMessage('')
    try {
      const msg = await testNotificationChannel(spec.key, recipient)
      setMessage(msg)
      await loadDeliveries()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `${spec.label} test failed`)
    } finally {
      setChannelBusy(null)
    }
  }

  // ---------- Broadcast ----------

  const sendBroadcast = async () => {
    setBroadcasting(true)
    setBroadcastResults(null)
    setMessage('')
    try {
      const results = await broadcastNotification({
        title: broadcast.title,
        message: broadcast.message,
        channels: broadcast.channels,
        emails: broadcast.emails,
        phones: broadcast.phones,
        telegram_chat_ids: broadcast.telegram_chat_ids,
        device_tokens: broadcast.device_tokens,
      })
      setBroadcastResults(results)
      await loadDeliveries()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Broadcast failed')
    } finally {
      setBroadcasting(false)
    }
  }

  const clearOldDeliveries = async () => {
    if (!(await confirm({
      title: 'Clear delivery log?',
      description: 'Delete all delivery log entries older than 30 days.',
    }))) return
    try {
      const deleted = await clearNotificationDeliveries(30)
      setMessage(`Cleared ${deleted} old delivery entries.`)
      await loadDeliveries()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to clear deliveries')
    }
  }

  // ---------- Render ----------

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only super admins can manage the notification center.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Notification Center</h1>
            <p className="text-sm text-gray-500">
              Manage notification events, external channels and delivery history across the platform.
            </p>
          </div>
          {activeTab === 'events' && (
            <Button onClick={openCreateEvent}>
              <Plus className="mr-2 h-4 w-4" /> New event
            </Button>
          )}
        </div>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.toLowerCase().includes('fail') || message.toLowerCase().includes('error')
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}
          >
            {message}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            <TabsTrigger value="deliveries">Delivery log</TabsTrigger>
          </TabsList>

          {/* ---------------- Events ---------------- */}
          <TabsContent value="events" className="space-y-3">
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-gray-500">
                  No notification events yet. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              events.map((e) => (
                <Card key={e.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{e.name}</CardTitle>
                          <Badge variant="outline" className="font-mono text-xs">{e.key}</Badge>
                          <Badge variant="outline" className="capitalize">{e.category}</Badge>
                          {!e.is_active && <Badge variant="secondary">disabled</Badge>}
                        </div>
                        {e.description && <CardDescription>{e.description}</CardDescription>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={e.is_active} onCheckedChange={() => toggleEventActive(e)} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTriggerEvent(e)
                            setTriggerData(
                              e.variables
                                ? JSON.stringify(
                                    Object.fromEntries(
                                      e.variables.split(',').map((v) => [v.trim(), `${v.trim()}_sample`])
                                    ),
                                    null,
                                    2
                                  )
                                : '{}'
                            )
                            setTriggerResults(null)
                          }}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" /> Trigger
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditEvent(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => removeEvent(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-1.5">{channelBadges(e)}</div>
                    {e.subject_template && (
                      <p className="mt-2 text-xs text-gray-500">
                        Subject: <span className="font-mono">{e.subject_template}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ---------------- Channels ---------------- */}
          <TabsContent value="channels" className="space-y-4">
            {CHANNEL_SPECS.map((spec) => {
              const live = channelByKey.get(spec.key)
              const draft = draftFor(spec.key)
              const provider = draft.config['provider'] || spec.providers?.[0]?.value || ''
              const visibleConfig = spec.configFields.filter((f) => !f.forProviders || f.forProviders.includes(provider))
              const visibleSecrets = spec.secretFields.filter((f) => !f.forProviders || f.forProviders.includes(provider))
              return (
                <Card key={spec.key}>
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <spec.icon className="h-5 w-5 text-gray-500" />
                        <div>
                          <CardTitle className="text-base">{spec.label}</CardTitle>
                          <CardDescription>{spec.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-gray-600">
                          {live?.is_enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                          checked={!!live?.is_enabled}
                          disabled={channelBusy === spec.key}
                          onCheckedChange={(v) => toggleChannel(spec, v)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {spec.providers && (
                      <div className="max-w-xs space-y-2">
                        <Label>Provider</Label>
                        <Select value={provider} onValueChange={(v) => setDraftConfig(spec.key, 'provider', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {spec.providers.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      {visibleConfig.map((f) => (
                        <div key={f.key} className="space-y-1.5">
                          <Label>{f.label}</Label>
                          <Input
                            type={f.type || 'text'}
                            placeholder={f.placeholder}
                            value={draft.config[f.key] || ''}
                            onChange={(e) => setDraftConfig(spec.key, f.key, e.target.value)}
                          />
                        </div>
                      ))}
                      {visibleSecrets.map((f) => {
                        const isSet = live?.secrets_set?.includes(f.key)
                        return (
                          <div key={f.key} className="space-y-1.5">
                            <Label className="flex items-center gap-2">
                              {f.label}
                              {isSet && (
                                <Badge variant="secondary" className="text-[10px]">configured</Badge>
                              )}
                            </Label>
                            <Input
                              type="password"
                              placeholder={isSet ? '•••••••• (leave blank to keep)' : f.placeholder || 'Enter secret'}
                              value={draft.secrets[f.key] || ''}
                              onChange={(e) => setDraftSecret(spec.key, f.key, e.target.value)}
                              autoComplete="new-password"
                            />
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                      <Button
                        size="sm"
                        disabled={channelBusy === spec.key}
                        onClick={() => saveChannel(spec)}
                      >
                        {channelBusy === spec.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save {spec.label}
                      </Button>
                      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 sm:justify-end">
                        <div className="w-full max-w-xs space-y-1.5">
                          <Label className="text-xs">{spec.recipientLabel} (test)</Label>
                          <Input
                            placeholder={spec.recipientPlaceholder}
                            value={testRecipients[spec.key] || ''}
                            onChange={(e) => setTestRecipients((p) => ({ ...p, [spec.key]: e.target.value }))}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!live?.is_enabled || channelBusy === `test-${spec.key}`}
                          onClick={() => testChannel(spec)}
                        >
                          {channelBusy === `test-${spec.key}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FlaskConical className="mr-2 h-4 w-4" />
                          )}
                          Send test
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* ---------------- Broadcast ---------------- */}
          <TabsContent value="broadcast">
            <Card>
              <CardHeader>
                <CardTitle>Send a notification</CardTitle>
                <CardDescription>
                  Compose an ad-hoc notification and deliver it immediately over the enabled channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={broadcast.title}
                      onChange={(e) => setBroadcast((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Maintenance window tonight"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Channels</Label>
                    <div className="flex flex-wrap gap-3 rounded-md border p-2.5">
                      {NOTIFICATION_CHANNELS.map((ch) => {
                        const enabled = !!channelByKey.get(ch.value)?.is_enabled
                        const checked = broadcast.channels.includes(ch.value)
                        return (
                          <label key={ch.value} className={`flex items-center gap-1.5 text-sm ${enabled ? '' : 'text-gray-400'}`}>
                            <Checkbox
                              checked={checked}
                              disabled={!enabled}
                              onCheckedChange={(v) =>
                                setBroadcast((p) => ({
                                  ...p,
                                  channels: v ? [...p.channels, ch.value] : p.channels.filter((c) => c !== ch.value),
                                }))
                              }
                            />
                            {ch.label}
                            {!enabled && <span className="text-[10px]">(disabled)</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Message</Label>
                  <Textarea
                    rows={3}
                    value={broadcast.message}
                    onChange={(e) => setBroadcast((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Write the notification message…"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Emails <span className="text-xs text-gray-400">(comma separated)</span></Label>
                    <Textarea rows={2} value={broadcast.emails} onChange={(e) => setBroadcast((p) => ({ ...p, emails: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phones <span className="text-xs text-gray-400">(SMS &amp; WhatsApp)</span></Label>
                    <Textarea rows={2} value={broadcast.phones} onChange={(e) => setBroadcast((p) => ({ ...p, phones: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telegram chat IDs</Label>
                    <Textarea rows={2} value={broadcast.telegram_chat_ids} onChange={(e) => setBroadcast((p) => ({ ...p, telegram_chat_ids: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Push device tokens</Label>
                    <Textarea rows={2} value={broadcast.device_tokens} onChange={(e) => setBroadcast((p) => ({ ...p, device_tokens: e.target.value }))} />
                  </div>
                </div>

                <Button
                  onClick={sendBroadcast}
                  disabled={broadcasting || !broadcast.title || !broadcast.message || broadcast.channels.length === 0}
                >
                  {broadcasting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send broadcast
                </Button>

                {broadcastResults && (
                  <div className="space-y-1 rounded-md border p-3">
                    <p className="text-sm font-medium">Delivery results</p>
                    {broadcastResults.map((r, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                        {statusBadge(r.status)}
                        <span className="font-medium capitalize">{r.channel}</span>
                        <span className="text-gray-500">{r.recipient || '—'}</span>
                        {r.error && <span className="text-red-500">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- Deliveries ---------------- */}
          <TabsContent value="deliveries">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Delivery log</CardTitle>
                    <CardDescription>{deliveriesTotal} delivery attempts recorded.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={deliveryFilters.channel || 'all'}
                      onValueChange={(v) => setDeliveryFilters((p) => ({ ...p, channel: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All channels</SelectItem>
                        {NOTIFICATION_CHANNELS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                        <SelectItem value="internal">Internal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={deliveryFilters.status || 'all'}
                      onValueChange={(v) => setDeliveryFilters((p) => ({ ...p, status: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="skipped">Skipped</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={loadDeliveries}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearOldDeliveries}>
                      Clear old
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {deliveries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No deliveries recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500">
                          <th className="py-2 pr-3 font-medium">Time</th>
                          <th className="py-2 pr-3 font-medium">Event</th>
                          <th className="py-2 pr-3 font-medium">Channel</th>
                          <th className="py-2 pr-3 font-medium">Recipient</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((d) => (
                          <tr key={d.id} className="border-b last:border-0">
                            <td className="whitespace-nowrap py-2 pr-3 text-xs text-gray-500">
                              {new Date(d.created_at).toLocaleString()}
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs">{d.event_key}</td>
                            <td className="py-2 pr-3 capitalize">{d.channel}</td>
                            <td className="max-w-[200px] truncate py-2 pr-3 text-xs" title={d.recipient}>
                              {d.recipient}
                            </td>
                            <td className="py-2 pr-3">{statusBadge(d.status)}</td>
                            <td className="max-w-[240px] truncate py-2 text-xs text-red-500" title={d.error_message}>
                              {d.error_message}
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

      {/* ---------- Event create/edit dialog ---------- */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? `Edit event: ${editingEvent.name}` : 'New notification event'}</DialogTitle>
            <DialogDescription>
              Events fire notifications over the enabled channels whenever they are triggered. Templates support{' '}
              <code className="text-xs">{'{{variable}}'}</code> placeholders.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Event key</Label>
              <Input
                value={eventForm.key}
                disabled={!!editingEvent}
                onChange={(e) => setEventForm((p) => ({ ...p, key: e.target.value }))}
                placeholder="invoice.created"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={eventForm.name} onChange={(e) => setEventForm((p) => ({ ...p, name: e.target.value }))} placeholder="Invoice created" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Input value={eventForm.description} onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={eventForm.category} onValueChange={(v) => setEventForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={eventForm.is_active} onCheckedChange={(v) => setEventForm((p) => ({ ...p, is_active: v }))} />
              <Label>Event active</Label>
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Channels for this event</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {EVENT_CHANNEL_TOGGLES.map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={!!eventForm[field]}
                    onCheckedChange={(v) => setEventForm((p) => ({ ...p, [field]: v }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Recipients</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Email addresses</Label>
                <Textarea rows={2} value={eventForm.recipient_emails} onChange={(e) => setEventForm((p) => ({ ...p, recipient_emails: e.target.value }))} placeholder="admin@example.com, ops@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone numbers (SMS &amp; WhatsApp)</Label>
                <Textarea rows={2} value={eventForm.recipient_phones} onChange={(e) => setEventForm((p) => ({ ...p, recipient_phones: e.target.value }))} placeholder="+919876543210" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telegram chat IDs</Label>
                <Textarea rows={2} value={eventForm.recipient_telegram_chats} onChange={(e) => setEventForm((p) => ({ ...p, recipient_telegram_chats: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Push device tokens</Label>
                <Textarea rows={2} value={eventForm.push_device_tokens} onChange={(e) => setEventForm((p) => ({ ...p, push_device_tokens: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={eventForm.notify_store_owner} onCheckedChange={(v) => setEventForm((p) => ({ ...p, notify_store_owner: v }))} />
              Also notify the store owner in the trigger data (user_id)
            </label>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Subject template</Label>
              <Input value={eventForm.subject_template} onChange={(e) => setEventForm((p) => ({ ...p, subject_template: e.target.value }))} placeholder="Invoice {{invoice_number}} created" />
            </div>
            <div className="space-y-1.5">
              <Label>Message template</Label>
              <Textarea rows={3} value={eventForm.body_template} onChange={(e) => setEventForm((p) => ({ ...p, body_template: e.target.value }))} placeholder="Invoice {{invoice_number}} for {{party_name}}…" />
            </div>
            <div className="space-y-1.5">
              <Label>Available variables <span className="text-xs text-gray-400">(comma separated, for documentation)</span></Label>
              <Input value={eventForm.variables} onChange={(e) => setEventForm((p) => ({ ...p, variables: e.target.value }))} placeholder="invoice_number,party_name,total_amount" className="font-mono text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEvent} disabled={savingEvent || !eventForm.name.trim()}>
              {savingEvent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingEvent ? 'Save changes' : 'Create event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Trigger dialog ---------- */}
      <Dialog open={!!triggerEvent} onOpenChange={(open) => !open && setTriggerEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trigger: {triggerEvent?.name}</DialogTitle>
            <DialogDescription>
              Provide template data as JSON. Placeholders in the subject/body are replaced from these values. Optional
              recipient keys: <code className="text-xs">emails</code>, <code className="text-xs">phones</code>,{' '}
              <code className="text-xs">telegram_chat_id</code>, <code className="text-xs">device_tokens</code>,{' '}
              <code className="text-xs">user_id</code>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={triggerData}
            onChange={(e) => setTriggerData(e.target.value)}
            className="font-mono text-xs"
          />
          {triggerResults && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
              {triggerResults.length === 0 ? (
                <p className="text-xs text-gray-500">No deliveries attempted — enable channels/recipients on the event.</p>
              ) : (
                triggerResults.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                    {statusBadge(r.status)}
                    <span className="font-medium capitalize">{r.channel}</span>
                    <span className="max-w-[180px] truncate text-gray-500">{r.recipient}</span>
                    {r.error && <span className="text-red-500">{r.error}</span>}
                  </div>
                ))
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerEvent(null)}>Close</Button>
            <Button onClick={runTrigger} disabled={triggering}>
              {triggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              Fire event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </DashboardLayout>
  )
}
