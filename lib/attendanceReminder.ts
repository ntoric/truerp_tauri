import { apiFetch } from '@/hooks/useAuth'

/** Types, API helpers and timezone math for the daily attendance reminder. */

export interface AttendanceReminderSettings {
  id?: string
  enabled: boolean
  /** "HH:MM", 24h, expressed in `timezone` */
  reminder_time: string
  /** IANA timezone name; empty = device local */
  timezone: string
  /** "Remind me later" snooze interval in minutes. */
  remind_later_minutes: number
  /** Curated IANA names returned by the server for the dropdown (GET only). */
  common_timezones?: string[]
}

export async function fetchAttendanceReminderSettings(): Promise<AttendanceReminderSettings> {
  const res = await apiFetch('/settings/attendance-reminder')
  if (!res.ok) throw new Error('Failed to load attendance reminder settings')
  return res.json()
}

export async function updateAttendanceReminderSettings(
  payload: Pick<
    AttendanceReminderSettings,
    'enabled' | 'reminder_time' | 'timezone' | 'remind_later_minutes'
  >
): Promise<AttendanceReminderSettings> {
  const res = await apiFetch('/settings/attendance-reminder', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save attendance reminder settings')
  return data
}

/** IANA name the device is currently running in. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

function zonedParts(tz: string, now: Date): Record<string, string> {
  const parts: Record<string, string> = {}
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }
  return parts
}

/** "YYYY-MM-DD" for `now` in the given timezone (empty = device local). */
export function zonedDateString(tz: string, now = new Date()): string {
  try {
    const p = zonedParts(tz, now)
    return `${p.year}-${p.month}-${p.day}`
  } catch {
    if (!tz) {
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      return `${now.getFullYear()}-${m}-${d}`
    }
    // Invalid tz name — fall back to device local.
    return zonedDateString('', now)
  }
}

/** "HH:MM" (24h) for `now` in the given timezone (empty = device local). */
export function zonedTimeString(tz: string, now = new Date()): string {
  try {
    const p = zonedParts(tz, now)
    let hour = parseInt(p.hour, 10)
    if (Number.isNaN(hour)) throw new Error('bad hour')
    // Engines that ignore hourCycle may emit 12-hour time (with a dayPeriod
    // part) or "24" at midnight — normalize both to 0–23.
    if (p.dayPeriod) {
      const pm = p.dayPeriod.toLowerCase().startsWith('p')
      if (pm && hour < 12) hour += 12
      if (!pm && hour === 12) hour = 0
    }
    if (hour === 24) hour = 0
    return `${String(hour).padStart(2, '0')}:${p.minute}`
  } catch {
    if (!tz) {
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }
    return zonedTimeString('', now)
  }
}

/**
 * Whether today's reminder instant has been reached: the wall clock in the
 * configured timezone is at or past reminder_time on that timezone's date.
 */
export function reminderDueToday(
  settings: Pick<AttendanceReminderSettings, 'enabled' | 'reminder_time' | 'timezone'>,
  now = new Date()
): { due: boolean; date: string } {
  const date = zonedDateString(settings.timezone, now)
  const time = zonedTimeString(settings.timezone, now)
  return {
    due: settings.enabled && time >= (settings.reminder_time || '09:00'),
    date,
  }
}

const dismissedKey = (userId: string) => `attendance-reminder-dismissed:${userId}`

/** The tz-local date the reminder was last dismissed for, or null. */
export function readReminderDismissal(userId: string): string | null {
  try {
    return localStorage.getItem(dismissedKey(userId))
  } catch {
    return null
  }
}

export function writeReminderDismissal(userId: string, date: string) {
  try {
    localStorage.setItem(dismissedKey(userId), date)
  } catch {
    // Storage unavailable (private mode) — dismissal lasts for this session.
  }
}

interface ReminderSnooze {
  /** The tz-local date the snooze applies to. */
  date: string
  /** Epoch ms after which the reminder may fire again. */
  until: number
}

const snoozeKey = (userId: string) => `attendance-reminder-snooze:${userId}`

/**
 * The active (unexpired) snooze record, or null when none is set / it belongs
 * to a different day / it has already expired.
 */
export function readReminderSnooze(userId: string, date: string, now = Date.now()): ReminderSnooze | null {
  try {
    const raw = localStorage.getItem(snoozeKey(userId))
    if (!raw) return null
    const snooze = JSON.parse(raw) as ReminderSnooze
    if (snooze.date !== date || !Number.isFinite(snooze.until) || snooze.until <= now) return null
    return snooze
  } catch {
    return null
  }
}

export function writeReminderSnooze(userId: string, date: string, until: number) {
  try {
    localStorage.setItem(snoozeKey(userId), JSON.stringify({ date, until }))
  } catch {
    // Storage unavailable — snooze lasts for this session only.
  }
}

export function clearReminderSnooze(userId: string) {
  try {
    localStorage.removeItem(snoozeKey(userId))
  } catch {
    // ignore
  }
}
