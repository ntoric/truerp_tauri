'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  Loader2,
  Mail,
  MessageSquare,
  Save,
  Send,
  Smartphone,
  Trash2,
  CheckCheck,
  Play,
} from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

type NotificationTypeKey = 'invoice_due' | 'payment_due' | 'overdue'

interface NotificationPreference {
  id?: string
  notification_type: NotificationTypeKey
  is_enabled: boolean
  email_enabled: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  internal_enabled: boolean
  lead_days: number
}

interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  channels: string
  status: string
  priority: string
  is_read: boolean
  created_at: string
}

interface NotificationTemplate {
  id: string
  name: string
  type: string
  subject: string
  body: string
  sms_body: string
  whatsapp_body: string
  is_active: boolean
}

interface Reminder {
  id: string
  title: string
  description: string
  reminder_date: string
  reminder_type: string
  repeat: string
}

const REMINDER_CATEGORIES: {
  type: NotificationTypeKey
  title: string
  description: string
  runEndpoint: string
  runLabel: string
  showLeadDays: boolean
}[] = [
  {
    type: 'invoice_due',
    title: 'Invoice due reminders',
    description: 'Notify customers before invoice due dates.',
    runEndpoint: '/notifications/send-invoice-due-reminders',
    runLabel: 'Run due reminders now',
    showLeadDays: true,
  },
  {
    type: 'payment_due',
    title: 'Payment reminders',
    description: 'Follow up on unpaid invoices after the due date.',
    runEndpoint: '/notifications/send-payment-reminders',
    runLabel: 'Run payment reminders now',
    showLeadDays: false,
  },
  {
    type: 'overdue',
    title: 'Overdue notifications',
    description: 'Escalate seriously overdue invoices (30+ days).',
    runEndpoint: '/notifications/send-overdue-notifications',
    runLabel: 'Run overdue alerts now',
    showLeadDays: false,
  },
]

const DEFAULT_PREFERENCES: Record<NotificationTypeKey, NotificationPreference> = {
  invoice_due: {
    notification_type: 'invoice_due',
    is_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    whatsapp_enabled: false,
    internal_enabled: true,
    lead_days: 3,
  },
  payment_due: {
    notification_type: 'payment_due',
    is_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    whatsapp_enabled: false,
    internal_enabled: true,
    lead_days: 0,
  },
  overdue: {
    notification_type: 'overdue',
    is_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    whatsapp_enabled: false,
    internal_enabled: true,
    lead_days: 0,
  },
}

function mergePreferences(apiPrefs: NotificationPreference[]): Record<NotificationTypeKey, NotificationPreference> {
  const merged = { ...DEFAULT_PREFERENCES }
  for (const pref of apiPrefs) {
    const key = pref.notification_type as NotificationTypeKey
    if (merged[key]) {
      merged[key] = { ...merged[key], ...pref }
    }
  }
  return merged
}

export default function NotificationsPage() {
  const searchParams = useSearchParams()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [activeTab, setActiveTab] = useState('preferences')
  const [loading, setLoading] = useState(true)
  const [savingType, setSavingType] = useState<NotificationTypeKey | null>(null)
  const [runningType, setRunningType] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [preferences, setPreferences] = useState<Record<NotificationTypeKey, NotificationPreference>>(DEFAULT_PREFERENCES)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'invoice_due',
    subject: '',
    body: '',
    sms_body: '',
    whatsapp_body: '',
  })
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    reminder_date: '',
    reminder_type: 'custom',
    repeat: 'once',
  })

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  )

  const notificationsPagination = usePagination(notifications)
  const templatesPagination = usePagination(templates)
  const remindersPagination = usePagination(reminders)

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const validTabs = ['preferences', 'alerts', 'templates', 'scheduled']
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchPreferences(), fetchNotifications(), fetchTemplates(), fetchReminders()])
    } finally {
      setLoading(false)
    }
  }

  const fetchPreferences = async () => {
    const res = await apiFetch('/notifications/preferences')
    if (res.ok) {
      const data: NotificationPreference[] = await res.json()
      setPreferences(mergePreferences(data))
    }
  }

  const fetchNotifications = async () => {
    const res = await apiFetch('/notifications')
    if (res.ok) {
      setNotifications(await res.json())
    }
  }

  const fetchTemplates = async () => {
    const res = await apiFetch('/notifications/templates')
    if (res.ok) {
      setTemplates(await res.json())
    }
  }

  const fetchReminders = async () => {
    const res = await apiFetch('/settings/reminders')
    if (res.ok) {
      setReminders(await res.json())
    }
  }

  const updatePreferenceField = (
    type: NotificationTypeKey,
    field: keyof NotificationPreference,
    value: boolean | number
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  const savePreference = async (type: NotificationTypeKey) => {
    setSavingType(type)
    setMessage('')
    try {
      const res = await apiFetch(`/notifications/preferences/${type}`, {
        method: 'PUT',
        body: JSON.stringify(preferences[type]),
      })
      if (res.ok) {
        setMessage(`${REMINDER_CATEGORIES.find((c) => c.type === type)?.title} saved successfully.`)
        await fetchPreferences()
      } else {
        setMessage('Failed to save notification settings.')
      }
    } catch {
      setMessage('An error occurred while saving.')
    } finally {
      setSavingType(null)
    }
  }

  const runAutomation = async (endpoint: string, label: string) => {
    setRunningType(endpoint)
    setMessage('')
    try {
      const res = await apiFetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message || `${label} completed.`)
        await fetchNotifications()
      } else {
        setMessage(data.error || `Failed to run ${label}.`)
      }
    } catch {
      setMessage('An error occurred while running automation.')
    } finally {
      setRunningType(null)
    }
  }

  const markAllRead = async () => {
    const res = await apiFetch('/notifications/read-all', { method: 'PUT' })
    if (res.ok) {
      await fetchNotifications()
    }
  }

  const markRead = async (id: string) => {
    const res = await apiFetch(`/notifications/${id}/read`, { method: 'PUT' })
    if (res.ok) {
      await fetchNotifications()
    }
  }

  const deleteNotification = async (id: string) => {
    if (!(await confirm({
      title: 'Delete notification?',
      description: 'Are you sure you want to delete this notification? This action cannot be undone.',
    }))) return
    const res = await apiFetch(`/notifications/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchNotifications()
    }
  }

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    const res = await apiFetch('/notifications/templates', {
      method: 'POST',
      body: JSON.stringify(newTemplate),
    })
    if (res.ok) {
      setNewTemplate({ name: '', type: 'invoice_due', subject: '', body: '', sms_body: '', whatsapp_body: '' })
      setMessage('Template created successfully.')
      await fetchTemplates()
    } else {
      setMessage('Failed to create template.')
    }
  }

  const toggleTemplateActive = async (template: NotificationTemplate) => {
    await apiFetch(`/notifications/templates/${template.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...template, is_active: !template.is_active }),
    })
    await fetchTemplates()
  }

  const deleteTemplate = async (id: string) => {
    if (!(await confirm({
      title: 'Delete template?',
      description: 'Are you sure you want to delete this notification template? This action cannot be undone.',
    }))) return
    await apiFetch(`/notifications/templates/${id}`, { method: 'DELETE' })
    await fetchTemplates()
  }

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await apiFetch('/settings/reminders', {
      method: 'POST',
      body: JSON.stringify(newReminder),
    })
    if (res.ok) {
      setNewReminder({ title: '', description: '', reminder_date: '', reminder_type: 'custom', repeat: 'once' })
      setMessage('Reminder added successfully.')
      await fetchReminders()
    } else {
      setMessage('Failed to create reminder.')
    }
  }

  const deleteReminder = async (id: string) => {
    if (!(await confirm({
      title: 'Delete reminder?',
      description: 'Are you sure you want to delete this reminder? This action cannot be undone.',
    }))) return
    await apiFetch(`/settings/reminders/${id}`, { method: 'DELETE' })
    await fetchReminders()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications &amp; Reminders</h1>
            <p className="text-sm text-gray-600">
              Enable channels, manage automated reminders, and review internal alerts.
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="w-fit">
              {unreadCount} unread internal alert{unreadCount === 1 ? '' : 's'}
            </Badge>
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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="preferences">Reminder settings</TabsTrigger>
            <TabsTrigger value="alerts">Internal alerts</TabsTrigger>
            <TabsTrigger value="templates">Message templates</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled reminders</TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="space-y-4">
            {REMINDER_CATEGORIES.map((category) => {
              const pref = preferences[category.type]
              return (
                <Card key={category.type}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-lg">{category.title}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`enabled-${category.type}`} className="text-sm text-gray-600">
                          Enabled
                        </Label>
                        <Switch
                          id={`enabled-${category.type}`}
                          checked={pref.is_enabled}
                          onCheckedChange={(checked) => updatePreferenceField(category.type, 'is_enabled', checked)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ChannelToggle
                        icon={Mail}
                        label="Email notifications"
                        checked={pref.email_enabled}
                        disabled={!pref.is_enabled}
                        onChange={(v) => updatePreferenceField(category.type, 'email_enabled', v)}
                      />
                      <ChannelToggle
                        icon={Smartphone}
                        label="SMS notifications"
                        checked={pref.sms_enabled}
                        disabled={!pref.is_enabled}
                        onChange={(v) => updatePreferenceField(category.type, 'sms_enabled', v)}
                      />
                      <ChannelToggle
                        icon={MessageSquare}
                        label="WhatsApp notifications"
                        checked={pref.whatsapp_enabled}
                        disabled={!pref.is_enabled}
                        onChange={(v) => updatePreferenceField(category.type, 'whatsapp_enabled', v)}
                      />
                      <ChannelToggle
                        icon={Bell}
                        label="Internal alerts"
                        checked={pref.internal_enabled}
                        disabled={!pref.is_enabled}
                        onChange={(v) => updatePreferenceField(category.type, 'internal_enabled', v)}
                      />
                    </div>

                    {category.showLeadDays && (
                      <div className="max-w-xs space-y-2">
                        <Label htmlFor={`lead-${category.type}`}>Remind days before due date</Label>
                        <Input
                          id={`lead-${category.type}`}
                          type="number"
                          min={0}
                          max={90}
                          disabled={!pref.is_enabled}
                          value={pref.lead_days}
                          onChange={(e) =>
                            updatePreferenceField(category.type, 'lead_days', parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => savePreference(category.type)}
                        disabled={savingType === category.type}
                      >
                        {savingType === category.type ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save settings
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!pref.is_enabled || runningType === category.runEndpoint}
                        onClick={() => runAutomation(category.runEndpoint, category.runLabel)}
                      >
                        {runningType === category.runEndpoint ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {category.runLabel}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Internal alerts</CardTitle>
                  <CardDescription>In-app notifications generated by your reminder rules.</CardDescription>
                </div>
                {notifications.some((n) => !n.is_read) && (
                  <Button variant="outline" size="sm" onClick={markAllRead}>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Mark all read
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500">No notifications yet.</p>
                ) : (
                  notificationsPagination.paginatedItems.map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-lg border p-3 ${notification.is_read ? 'bg-white' : 'bg-blue-50/50'}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{notification.title}</p>
                            <Badge variant="outline">{notification.type}</Badge>
                            <Badge variant={notification.status === 'sent' ? 'default' : 'secondary'}>
                              {notification.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(notification.created_at).toLocaleString()} · Channels:{' '}
                            {notification.channels || '—'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!notification.is_read && (
                            <Button variant="outline" size="sm" onClick={() => markRead(notification.id)}>
                              Mark read
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => deleteNotification(notification.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <PaginationControls
                  page={notificationsPagination.page}
                  totalPages={notificationsPagination.totalPages}
                  totalItems={notificationsPagination.totalItems}
                  pageSize={notificationsPagination.pageSize}
                  onPageChange={notificationsPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Message templates</CardTitle>
                <CardDescription>Customize email, SMS, and WhatsApp copy for automated reminders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={createTemplate} className="space-y-4 rounded-lg border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tpl_name">Template name</Label>
                      <Input
                        id="tpl_name"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={newTemplate.type}
                        onValueChange={(value) => setNewTemplate((p) => ({ ...p, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice_due">Invoice due</SelectItem>
                          <SelectItem value="payment_due">Payment reminder</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl_subject">Email subject</Label>
                    <Input
                      id="tpl_subject"
                      value={newTemplate.subject}
                      onChange={(e) => setNewTemplate((p) => ({ ...p, subject: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl_body">Email body</Label>
                    <Textarea
                      id="tpl_body"
                      rows={3}
                      value={newTemplate.body}
                      onChange={(e) => setNewTemplate((p) => ({ ...p, body: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tpl_sms">SMS message</Label>
                      <Textarea
                        id="tpl_sms"
                        rows={2}
                        value={newTemplate.sms_body}
                        onChange={(e) => setNewTemplate((p) => ({ ...p, sms_body: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tpl_wa">WhatsApp message</Label>
                      <Textarea
                        id="tpl_wa"
                        rows={2}
                        value={newTemplate.whatsapp_body}
                        onChange={(e) => setNewTemplate((p) => ({ ...p, whatsapp_body: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button type="submit">
                    <Send className="mr-2 h-4 w-4" />
                    Add template
                  </Button>
                </form>

                <div className="space-y-2">
                  {templates.length === 0 ? (
                    <p className="text-sm text-gray-500">No templates yet.</p>
                  ) : (
                    templatesPagination.paginatedItems.map((template) => (
                      <div key={template.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-gray-500">{template.type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-500">Active</Label>
                            <Switch checked={template.is_active} onCheckedChange={() => toggleTemplateActive(template)} />
                          </div>
                          <Button variant="destructive" size="sm" onClick={() => deleteTemplate(template.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <PaginationControls
                  page={templatesPagination.page}
                  totalPages={templatesPagination.totalPages}
                  totalItems={templatesPagination.totalItems}
                  pageSize={templatesPagination.pageSize}
                  onPageChange={templatesPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled reminders</CardTitle>
                <CardDescription>
                  Manual calendar reminders for tax filings, follow-ups, and custom tasks.{' '}
                  <Link href="/settings" className="text-blue-600 hover:underline">
                    Also available in Settings
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={createReminder} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newReminder.title}
                      onChange={(e) => setNewReminder((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newReminder.reminder_date}
                      onChange={(e) => setNewReminder((p) => ({ ...p, reminder_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newReminder.reminder_type}
                      onValueChange={(value) => setNewReminder((p) => ({ ...p, reminder_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_due">Payment due</SelectItem>
                        <SelectItem value="invoice_overdue">Invoice overdue</SelectItem>
                        <SelectItem value="tax_filing">Tax filing</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      rows={2}
                      value={newReminder.description}
                      onChange={(e) => setNewReminder((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="w-fit">
                    Add reminder
                  </Button>
                </form>

                <div className="space-y-2">
                  {remindersPagination.paginatedItems.map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{reminder.title}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(reminder.reminder_date).toLocaleDateString()} · {reminder.reminder_type}
                        </p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteReminder(reminder.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
                <PaginationControls
                  page={remindersPagination.page}
                  totalPages={remindersPagination.totalPages}
                  totalItems={remindersPagination.totalItems}
                  pageSize={remindersPagination.pageSize}
                  onPageChange={remindersPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}

function ChannelToggle({
  icon: Icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-sm">{label}</span>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}
