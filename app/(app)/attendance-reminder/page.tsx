'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlarmClock, BellRing, Clock, Globe, Loader2, Save } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  deviceTimezone,
  fetchAttendanceReminderSettings,
  updateAttendanceReminderSettings,
  type AttendanceReminderSettings,
} from '@/lib/attendanceReminder'

const DEVICE_TZ = '__device__'

export default function AttendanceReminderPage() {
  const [settings, setSettings] = useState<AttendanceReminderSettings>({
    enabled: false,
    reminder_time: '09:00',
    timezone: '',
    remind_later_minutes: 30,
  })
  const [timezones, setTimezones] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const deviceTz = useMemo(() => deviceTimezone(), [])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAttendanceReminderSettings()
        setSettings({
          enabled: data.enabled,
          reminder_time: data.reminder_time || '09:00',
          timezone: data.timezone || '',
          remind_later_minutes: data.remind_later_minutes || 30,
        })
        setTimezones(data.common_timezones || [])
      } catch (err) {
        console.error(err)
        notifyError('Failed to load attendance reminder settings')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const timezoneOptions = useMemo(() => {
    const list = [...timezones]
    if (deviceTz && !list.includes(deviceTz)) list.push(deviceTz)
    if (settings.timezone && !list.includes(settings.timezone)) list.push(settings.timezone)
    return list.sort()
  }, [timezones, deviceTz, settings.timezone])

  const save = async () => {
    setSaving(true)
    try {
      const saved = await updateAttendanceReminderSettings({
        enabled: settings.enabled,
        reminder_time: settings.reminder_time,
        timezone: settings.timezone,
        remind_later_minutes: settings.remind_later_minutes,
      })
      setSettings({
        enabled: saved.enabled,
        reminder_time: saved.reminder_time || '09:00',
        timezone: saved.timezone || '',
        remind_later_minutes: saved.remind_later_minutes || 30,
      })
      notifySuccess('Attendance reminder settings saved')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="app-page-title">Attendance Reminder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Show a daily on-screen reminder to mark staff attendance.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Daily attendance reminder
            </CardTitle>
            <CardDescription>
              When enabled, a popup appears on screen every day at the configured time
              with quick actions to mark staff attendance or jump to the Attendance page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <Label htmlFor="attendance-reminder-enabled" className="text-sm font-medium">
                  Enable reminder
                </Label>
                <p className="text-xs text-muted-foreground">
                  Turn the daily attendance reminder popup on or off.
                </p>
              </div>
              <Switch
                id="attendance-reminder-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="attendance-reminder-time" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Reminder time
                </Label>
                <Input
                  id="attendance-reminder-time"
                  type="time"
                  value={settings.reminder_time}
                  onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                  disabled={!settings.enabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Timezone
                </Label>
                <Select
                  value={settings.timezone || DEVICE_TZ}
                  onValueChange={(value) =>
                    setSettings({ ...settings, timezone: value === DEVICE_TZ ? '' : value })
                  }
                  disabled={!settings.enabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Device local" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEVICE_TZ}>
                      Device local{deviceTz ? ` (${deviceTz})` : ''}
                    </SelectItem>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance-remind-later" className="flex items-center gap-1.5">
                <AlarmClock className="h-3.5 w-3.5" />
                Remind me later interval
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="attendance-remind-later"
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  className="w-28"
                  value={settings.remind_later_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      remind_later_minutes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  disabled={!settings.enabled}
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
              <p className="text-xs text-muted-foreground">
                How long to wait before showing the reminder again when
                &ldquo;Remind me later&rdquo; is chosen and attendance is still pending.
              </p>
            </div>

            {settings.enabled && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                The reminder will appear daily at {settings.reminder_time || '09:00'} ({settings.timezone || `device local${deviceTz ? ` — ${deviceTz}` : ''}`}).
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
