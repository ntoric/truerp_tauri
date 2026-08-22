'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { notifyError, notifySuccess } from '@/lib/notify'
import { isSuperAdmin } from '@/lib/roles'
import {
  defaultPageFeatures,
  groupToggleablePages,
  mergePageFeatures,
  type PageFeaturesMap,
} from '@/lib/pageFeatures'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Mail, MessageSquare, Send, Loader2, CheckCircle, XCircle,
  Smartphone, Save, LayoutGrid, Sparkles, Clock,
} from 'lucide-react'
import { getServerTime, type ServerTimeInfo } from '@/lib/dailyReport'

interface AiBusinessSettings {
  enable_ai_hsn_search: boolean
  enable_ai_bill_parsing: boolean
  gemini_api_key: string
  [key: string]: unknown
}

interface DeveloperSettings {
  id: string
  user_id: string
  email_provider: string
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password?: string
  from_email: string
  from_name: string
  mailgun_domain: string
  whatsapp_provider: string
  whatsapp_api_key?: string
  whatsapp_phone_number_id: string
  whatsapp_business_account_id: string
  twilio_account_sid: string
  twilio_auth_token?: string
  twilio_phone_number: string
  sms_provider: string
  twilio_sms_account_sid: string
  twilio_sms_auth_token?: string
  twilio_sms_phone_number: string
  msg91_sender_id: string
  msg91_auth_key?: string
  textlocal_sender_id: string
  textlocal_api_key?: string
  aws_access_key: string
  aws_secret_key?: string
  aws_region: string
  sendgrid_sms_api_key?: string
  timezone: string
}

export default function DeveloperSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { setPagesLocal, refresh: refreshPageFeatures } = usePageFeatures()
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState<DeveloperSettings>({
    id: '',
    user_id: '',
    email_provider: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    from_email: '',
    from_name: '',
    mailgun_domain: '',
    whatsapp_provider: 'meta',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    twilio_account_sid: '',
    twilio_phone_number: '',
    sms_provider: 'twilio',
    twilio_sms_account_sid: '',
    twilio_sms_phone_number: '',
    msg91_sender_id: '',
    textlocal_sender_id: '',
    aws_access_key: '',
    aws_region: '',
    timezone: '',
  })
  const [pageFeatures, setPageFeatures] = useState<PageFeaturesMap>(defaultPageFeatures)
  const [aiSettings, setAiSettings] = useState<AiBusinessSettings>({
    enable_ai_hsn_search: false,
    enable_ai_bill_parsing: false,
    gemini_api_key: '',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<'email' | 'whatsapp' | 'sms' | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [serverTime, setServerTime] = useState<ServerTimeInfo | null>(null)

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin(user.role)) {
      fetchSettings()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, user])

  // Poll server time so the user can see the detected server timezone and the
  // current time in their configured timezone (which the scheduler uses).
  useEffect(() => {
    if (!user || !isSuperAdmin(user.role)) return
    let active = true
    const fetchServerTime = async () => {
      try {
        const info = await getServerTime()
        if (active) setServerTime(info)
      } catch {
        // ignore — non-critical
      }
    }
    void fetchServerTime()
    const interval = setInterval(fetchServerTime, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user])

  const fetchSettings = async () => {
    try {
      const [settingsRes, pagesRes, businessRes] = await Promise.all([
        apiFetch('/developer-settings'),
        apiFetch('/page-features'),
        apiFetch('/business'),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data)
      }
      if (pagesRes.ok) {
        const data = await pagesRes.json()
        setPageFeatures(mergePageFeatures(data.pages))
      }
      if (businessRes.ok) {
        const data = await businessRes.json()
        setAiSettings(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (activeTab === 'pages') {
        const res = await apiFetch('/page-features', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: pageFeatures }),
        })
        if (res.ok) {
          const data = await res.json()
          const merged = mergePageFeatures(data.pages)
          setPageFeatures(merged)
          setPagesLocal(merged)
          await refreshPageFeatures()
          notifySuccess('Page features saved successfully')
        } else {
          notifyError('Failed to save page features')
        }
      } else if (activeTab === 'ai') {
        const res = await apiFetch('/business', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiSettings),
        })
        if (res.ok) {
          notifySuccess('AI settings saved successfully')
        } else {
          notifyError('Failed to save AI settings')
        }
      } else {
        const res = await apiFetch('/developer-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        })
        if (res.ok) {
          notifySuccess('Settings saved successfully')
        } else {
          const data = await res.json().catch(() => ({}))
          notifyError(data.error || 'Failed to save settings')
        }
      }
    } catch (err) {
      console.error(err)
      notifyError(
        activeTab === 'pages'
          ? 'Failed to save page features'
          : activeTab === 'ai'
            ? 'Failed to save AI settings'
            : 'Failed to save settings'
      )
    } finally {
      setSaving(false)
    }
  }

  const setAllPages = (enabled: boolean) => {
    setPageFeatures((prev) =>
      Object.fromEntries(Object.keys(prev).map((key) => [key, enabled]))
    )
  }

  const testEmailConnection = async () => {
    setTesting('email')
    setTestResult(null)
    try {
      const res = await apiFetch('/developer-settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_provider: settings.email_provider,
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_username: settings.smtp_username,
          smtp_password: settings.smtp_password,
          from_email: settings.from_email,
          from_name: settings.from_name,
        }),
      })
      const data = await res.json()
      setTestResult({
        success: res.ok,
        message: data.message || data.error || (res.ok ? 'Email connection successful' : 'Email connection failed'),
      })
    } catch (err) {
      setTestResult({ success: false, message: 'Email connection failed' })
    } finally {
      setTesting(null)
    }
  }

  const testWhatsAppConnection = async () => {
    setTesting('whatsapp')
    setTestResult(null)
    try {
      const res = await apiFetch('/developer-settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setTestResult({ success: res.ok, message: data.message || (res.ok ? 'WhatsApp connection successful' : 'WhatsApp connection failed') })
    } catch (err) {
      setTestResult({ success: false, message: 'WhatsApp connection failed' })
    } finally {
      setTesting(null)
    }
  }

  const testSMSConnection = async () => {
    setTesting('sms')
    setTestResult(null)
    try {
      const res = await apiFetch('/developer-settings/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setTestResult({ success: res.ok, message: data.message || (res.ok ? 'SMS connection successful' : 'SMS connection failed') })
    } catch (err) {
      setTestResult({ success: false, message: 'SMS connection failed' })
    } finally {
      setTesting(null)
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!user || !isSuperAdmin(user.role)) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only Super Admins can access Developer Settings.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Developer Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {activeTab === 'pages'
              ? 'Save Page Features'
              : activeTab === 'ai'
                ? 'Save AI Settings'
                : 'Save Settings'}
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-4 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {testResult.message}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Features
            </TabsTrigger>
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Pages & Menus
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timezone
                </CardTitle>
                <CardDescription>
                  Set the timezone used by all scheduled automations (e.g. the
                  daily report email send time). The server runs in UTC; this
                  setting converts the server clock to your local timezone so
                  scheduled times fire when you expect.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Configured timezone</Label>
                    <Select
                      value={settings.timezone ? settings.timezone : '__server__'}
                      onValueChange={(value) =>
                        setSettings({ ...settings, timezone: value === '__server__' ? '' : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Use server timezone (UTC)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__server__">
                          Use server timezone ({serverTime?.timezone_name || 'UTC'})
                        </SelectItem>
                        {(serverTime?.common_timezones || []).map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                        {settings.timezone &&
                          !(serverTime?.common_timezones || []).includes(settings.timezone) && (
                            <SelectItem value={settings.timezone}>{settings.timezone}</SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Choose an IANA timezone (e.g. Asia/Kolkata). Leave blank to use the
                      server&apos;s timezone.
                    </p>
                  </div>
                  <div className="space-y-1.5 rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium text-gray-800">Server time:</span>{' '}
                      {serverTime ? (
                        <span>
                          {serverTime.server_time} ({serverTime.timezone_name})
                          {serverTime.utc_offset_hours !== 0 && (
                            <span className="text-gray-500">
                              {' '}· UTC{serverTime.utc_offset_hours > 0 ? '+' : ''}
                              {serverTime.utc_offset_hours}h
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">Loading…</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">Scheduler time:</span>{' '}
                      {serverTime ? (
                        <span>
                          {serverTime.configured_time} ({serverTime.configured_timezone_name || serverTime.configured_timezone || 'server-default'})
                          {serverTime.configured_utc_offset_hours !== 0 && (
                            <span className="text-gray-500">
                              {' '}· UTC{serverTime.configured_utc_offset_hours > 0 ? '+' : ''}
                              {serverTime.configured_utc_offset_hours}h
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">Loading…</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">Status:</span>{' '}
                      {serverTime?.has_configured_timezone ? (
                        <span className="text-green-700">Using configured timezone</span>
                      ) : (
                        <span className="text-amber-700">
                          No timezone configured — using server timezone. Set one above so the
                          daily report scheduler fires at your local time.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Service Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email Provider</Label>
                    <Select
                      value={settings.email_provider}
                      onValueChange={(value) => setSettings({ ...settings, email_provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smtp">SMTP</SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="ses">Amazon SES</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {settings.email_provider === 'smtp' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Host</Label>
                        <Input
                          value={settings.smtp_host}
                          onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Port</Label>
                        <Input
                          type="number"
                          value={settings.smtp_port}
                          onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
                          placeholder="587"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Username</Label>
                        <Input
                          value={settings.smtp_username}
                          onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Password</Label>
                        <Input
                          type="password"
                          onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {settings.email_provider === 'mailgun' && (
                  <div className="space-y-2">
                    <Label>Mailgun Domain</Label>
                    <Input
                      value={settings.mailgun_domain}
                      onChange={(e) => setSettings({ ...settings, mailgun_domain: e.target.value })}
                      placeholder="mg.yourdomain.com"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Input
                      value={settings.from_email}
                      onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
                      placeholder="noreply@yourdomain.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input
                      value={settings.from_name}
                      onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
                      placeholder="Your Business Name"
                    />
                  </div>
                </div>

                <Button onClick={testEmailConnection} disabled={testing === 'email'} variant="outline">
                  {testing === 'email' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test Email Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  WhatsApp Service Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>WhatsApp Provider</Label>
                  <Select
                    value={settings.whatsapp_provider}
                    onValueChange={(value) => setSettings({ ...settings, whatsapp_provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">Meta (WhatsApp Business API)</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.whatsapp_provider === 'meta' && (
                  <>
                    <div className="space-y-2">
                      <Label>WhatsApp API Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, whatsapp_api_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input
                        value={settings.whatsapp_phone_number_id}
                        onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Business Account ID</Label>
                      <Input
                        value={settings.whatsapp_business_account_id}
                        onChange={(e) => setSettings({ ...settings, whatsapp_business_account_id: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.whatsapp_provider === 'twilio' && (
                  <>
                    <div className="space-y-2">
                      <Label>Twilio Account SID</Label>
                      <Input
                        value={settings.twilio_account_sid}
                        onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Auth Token</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Phone Number</Label>
                      <Input
                        value={settings.twilio_phone_number}
                        onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <Button onClick={testWhatsAppConnection} disabled={testing === 'whatsapp'} variant="outline">
                  {testing === 'whatsapp' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test WhatsApp Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  SMS Service Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SMS Provider</Label>
                  <Select
                    value={settings.sms_provider}
                    onValueChange={(value) => setSettings({ ...settings, sms_provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="msg91">Msg91</SelectItem>
                      <SelectItem value="textlocal">TextLocal</SelectItem>
                      <SelectItem value="aws_sns">AWS SNS</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.sms_provider === 'twilio' && (
                  <>
                    <div className="space-y-2">
                      <Label>Twilio Account SID</Label>
                      <Input
                        value={settings.twilio_sms_account_sid}
                        onChange={(e) => setSettings({ ...settings, twilio_sms_account_sid: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Auth Token</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, twilio_sms_auth_token: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Phone Number</Label>
                      <Input
                        value={settings.twilio_sms_phone_number}
                        onChange={(e) => setSettings({ ...settings, twilio_sms_phone_number: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'msg91' && (
                  <>
                    <div className="space-y-2">
                      <Label>Msg91 Auth Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, msg91_auth_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Msg91 Sender ID</Label>
                      <Input
                        value={settings.msg91_sender_id}
                        onChange={(e) => setSettings({ ...settings, msg91_sender_id: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'textlocal' && (
                  <>
                    <div className="space-y-2">
                      <Label>TextLocal API Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, textlocal_api_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TextLocal Sender ID</Label>
                      <Input
                        value={settings.textlocal_sender_id}
                        onChange={(e) => setSettings({ ...settings, textlocal_sender_id: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'aws_sns' && (
                  <>
                    <div className="space-y-2">
                      <Label>AWS Access Key</Label>
                      <Input
                        value={settings.aws_access_key}
                        onChange={(e) => setSettings({ ...settings, aws_access_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AWS Secret Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, aws_secret_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AWS Region</Label>
                      <Input
                        value={settings.aws_region}
                        onChange={(e) => setSettings({ ...settings, aws_region: e.target.value })}
                        placeholder="us-east-1"
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'sendgrid' && (
                  <>
                    <div className="space-y-2">
                      <Label>SendGrid SMS API Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, sendgrid_sms_api_key: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <Button onClick={testSMSConnection} disabled={testing === 'sms'} variant="outline">
                  {testing === 'sms' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test SMS Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Features
                </CardTitle>
                <CardDescription>
                  Configure Gemini-powered HSN search and purchase bill parsing for this business.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable_ai_hsn_search"
                      checked={!!aiSettings.enable_ai_hsn_search}
                      onCheckedChange={(checked) =>
                        setAiSettings((prev) => ({ ...prev, enable_ai_hsn_search: !!checked }))
                      }
                    />
                    <Label htmlFor="enable_ai_hsn_search">Enable AI-powered HSN code search using Gemini</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    When enabled, you can use AI to find HSN codes based on product descriptions
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable_ai_bill_parsing"
                      checked={!!aiSettings.enable_ai_bill_parsing}
                      onCheckedChange={(checked) =>
                        setAiSettings((prev) => ({ ...prev, enable_ai_bill_parsing: !!checked }))
                      }
                    />
                    <Label htmlFor="enable_ai_bill_parsing">Enable AI-powered purchase bill parsing using Gemini</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    When enabled, you can upload bill images and AI will extract vendor details, items, and amounts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gemini_api_key">Gemini API Key</Label>
                  <Input
                    id="gemini_api_key"
                    type="password"
                    value={String(aiSettings.gemini_api_key || '')}
                    onChange={(e) =>
                      setAiSettings((prev) => ({ ...prev, gemini_api_key: e.target.value }))
                    }
                    placeholder="Enter your Gemini API key"
                    disabled={!aiSettings.enable_ai_hsn_search && !aiSettings.enable_ai_bill_parsing}
                  />
                  <p className="text-xs text-gray-500">
                    Get your API key from{' '}
                    <a
                      href="https://makersuite.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Pages & Menus
                </CardTitle>
                <CardDescription>
                  Disable a page to hide it from the side menu. Opening a disabled URL still shows a Coming Soon screen. Dashboard, core Settings tabs, and Developer Settings stay available. Settings &gt; Reminders and Settings &gt; CA Share can be enabled or disabled below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllPages(true)}>
                    Enable all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllPages(false)}>
                    Disable all
                  </Button>
                </div>

                {groupToggleablePages().map(({ group, pages }) => (
                  <div key={group} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{group}</h3>
                    <div className="divide-y rounded-lg border">
                      {pages.map((page) => (
                        <div key={page.key} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{page.label}</p>
                            <p className="text-xs text-gray-500">{page.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {pageFeatures[page.key] !== false ? 'Enabled' : 'Disabled'}
                            </span>
                            <Switch
                              checked={pageFeatures[page.key] !== false}
                              onCheckedChange={(checked) =>
                                setPageFeatures((prev) => ({ ...prev, [page.key]: checked }))
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
