'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import {
  clearReminderSnooze,
  fetchAttendanceReminderSettings,
  readReminderDismissal,
  readReminderSnooze,
  reminderDueToday,
  writeReminderDismissal,
  writeReminderSnooze,
  type AttendanceReminderSettings,
} from '@/lib/attendanceReminder'
import { notifyError } from '@/lib/notify'
import { parseApiError } from '@/lib/form-errors'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, BellRing, CheckCircle, Clock, Loader2 } from 'lucide-react'

const POLL_MS = 15_000

interface Staff {
  id: string
  name: string
  designation?: string
  is_active?: boolean
}

interface Attendance {
  id: string
  staff_id: string
  date: string
  status: string
}

const QUICK_STATUS = [
  { value: 'present', short: 'P', label: 'Present', active: 'bg-green-600 text-white', idle: 'bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'absent', short: 'A', label: 'Absent', active: 'bg-red-600 text-white', idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
  { value: 'half_day', short: '½', label: 'Half Day', active: 'bg-yellow-500 text-white', idle: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { value: 'paid_leave', short: 'L', label: 'Paid Leave', active: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { value: 'weekly_off', short: 'Off', label: 'Weekly Off', active: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
] as const

function formatReminderDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function countUnmarked(staffs: Staff[], attendances: Attendance[]): number {
  const marked = new Set(attendances.map((a) => a.staff_id))
  return staffs.filter((s) => s.is_active !== false && !marked.has(s.id)).length
}

/**
 * Daily attendance reminder. Mounted in the app shell; polls the reminder
 * settings and, once the wall clock in the configured timezone passes the
 * configured time, pops a dialog to quick-mark staff attendance or jump to
 * the Attendance page. "Done" skips it for the day; "Remind me later" (and
 * the close button) snoozes it for the configured interval, re-showing only
 * if attendance is still pending.
 */
export default function AttendanceReminderDialog() {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [today, setToday] = useState('')
  const [settings, setSettings] = useState<AttendanceReminderSettings | null>(null)
  const [staffs, setStaffs] = useState<Staff[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [markingStaffId, setMarkingStaffId] = useState<string | null>(null)
  const [bulkMarking, setBulkMarking] = useState(false)

  const attendanceByStaff = useMemo(() => {
    const map = new Map<string, Attendance>()
    for (const a of attendances) map.set(a.staff_id, a)
    return map
  }, [attendances])

  const activeStaffs = useMemo(() => staffs.filter((s) => s.is_active !== false), [staffs])
  const unmarkedStaffIds = useMemo(
    () => activeStaffs.filter((s) => !attendanceByStaff.has(s.id)).map((s) => s.id),
    [activeStaffs, attendanceByStaff]
  )

  const loadStaff = useCallback(async (date: string) => {
    const [staffRes, attendanceRes] = await Promise.all([
      apiFetch('/staff'),
      apiFetch(`/attendance?start_date=${date}&end_date=${date}`),
    ])
    if (!staffRes.ok || !attendanceRes.ok) return null
    const staffData = await staffRes.json()
    const attendanceData = await attendanceRes.json()
    return {
      staffs: (Array.isArray(staffData) ? staffData : []) as Staff[],
      attendances: (Array.isArray(attendanceData) ? attendanceData : []) as Attendance[],
    }
  }, [])

  const checkingRef = useRef(false)

  const check = useCallback(async () => {
    if (!user?.id || open || checkingRef.current) return
    checkingRef.current = true
    try {
      const s = await fetchAttendanceReminderSettings()
      const { due, date } = reminderDueToday(s)
      if (!due) return
      if (readReminderDismissal(user.id) === date) return
      // Still inside a "Remind me later" window.
      if (readReminderSnooze(user.id, date)) return

      const data = await loadStaff(date)
      if (!data) return // Fetch failed — try again on the next tick.
      if (countUnmarked(data.staffs, data.attendances) === 0) {
        // Nothing left to mark today — don't nag.
        writeReminderDismissal(user.id, date)
        clearReminderSnooze(user.id)
        return
      }

      setSettings(s)
      setToday(date)
      setStaffs(data.staffs)
      setAttendances(data.attendances)
      setOpen(true)
    } catch (err) {
      // Reminder is non-critical; keep polling but leave a trace for debugging.
      console.warn('Attendance reminder check failed:', err)
    } finally {
      checkingRef.current = false
    }
  }, [user?.id, open, loadStaff])

  // Poll while mounted, and re-check immediately whenever the app comes back
  // to the foreground — timer throttling in hidden/idle views (browser tabs,
  // desktop webviews) can otherwise delay or skip the reminder entirely. The
  // due check uses absolute wall-clock time, so a late check still fires.
  useEffect(() => {
    if (!user) return
    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    const onWake = () => void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, check])

  // "Done" — skip the reminder for the rest of the day.
  const doneForToday = useCallback(() => {
    if (user?.id && today) {
      writeReminderDismissal(user.id, today)
      clearReminderSnooze(user.id)
    }
    setOpen(false)
  }, [user?.id, today])

  // "Remind me later" — snooze for the configured interval. The X/close
  // button and outside dismissal take this path too.
  const remindLater = useCallback(() => {
    if (user?.id && today) {
      const minutes = settings?.remind_later_minutes || 30
      writeReminderSnooze(user.id, today, Date.now() + minutes * 60_000)
    }
    setOpen(false)
  }, [user?.id, today, settings?.remind_later_minutes])

  const goToAttendance = useCallback(() => {
    doneForToday()
    router.push('/attendance')
  }, [doneForToday, router])

  const mergeAttendance = useCallback((record: Attendance) => {
    setAttendances((prev) => {
      const idx = prev.findIndex((a) => a.staff_id === record.staff_id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...record }
        return next
      }
      return [...prev, record]
    })
  }, [])

  const handleQuickMark = async (staffId: string, status: string) => {
    if (!staffId || markingStaffId || !today) return
    setMarkingStaffId(staffId)
    try {
      const res = await apiFetch('/attendance', {
        method: 'POST',
        body: JSON.stringify({ staff_id: staffId, date: today, status }),
      })
      if (res.ok) {
        mergeAttendance(await res.json())
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to mark attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to mark attendance')
    } finally {
      setMarkingStaffId(null)
    }
  }

  const markUnmarkedPresent = async () => {
    if (unmarkedStaffIds.length === 0 || !today) return
    setBulkMarking(true)
    try {
      const res = await apiFetch('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({
          date: today,
          attendance: unmarkedStaffIds.map((staff_id) => ({ staff_id, status: 'present' })),
        }),
      })
      if (res.ok) {
        const saved: Attendance[] = await res.json()
        for (const record of saved) mergeAttendance(record)
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to mark attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to mark attendance')
    } finally {
      setBulkMarking(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : remindLater())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-600" />
            Attendance reminder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Mark today&apos;s staff attendance
            {today ? ` — ${formatReminderDate(today)}` : ''}.
          </p>

          {activeStaffs.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground">
              No active staff found. Add staff first.
            </p>
          ) : (
            <div className="max-h-[55vh] divide-y overflow-y-auto rounded-md border">
              {activeStaffs.map((staff) => {
                const attendance = attendanceByStaff.get(staff.id)
                const isMarking = markingStaffId === staff.id
                return (
                  <div key={staff.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{staff.name}</div>
                      {staff.designation && (
                        <div className="truncate text-xs text-muted-foreground">{staff.designation}</div>
                      )}
                    </div>
                    {isMarking && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
                    <div className="flex shrink-0 items-center gap-1">
                      {QUICK_STATUS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isMarking || bulkMarking}
                          title={opt.label}
                          onClick={() => void handleQuickMark(staff.id, opt.value)}
                          className={cn(
                            'h-8 min-w-[2rem] rounded px-1.5 text-xs font-semibold transition-all',
                            attendance?.status === opt.value ? opt.active : opt.idle,
                            (isMarking || bulkMarking) && 'cursor-not-allowed opacity-50'
                          )}
                        >
                          {opt.short}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeStaffs.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {activeStaffs.length - unmarkedStaffIds.length}/{activeStaffs.length} marked
              </span>
              {unmarkedStaffIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => void markUnmarkedPresent()}
                  disabled={bulkMarking}
                  className="inline-flex items-center gap-1 font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
                >
                  {bulkMarking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Mark unmarked present
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={remindLater}>
              <Clock className="mr-1.5 h-4 w-4" />
              Remind me later{settings?.remind_later_minutes ? ` (${settings.remind_later_minutes}m)` : ''}
            </Button>
            <Button variant="outline" onClick={doneForToday}>
              Done
            </Button>
          </div>
          <Button onClick={goToAttendance}>
            Open Attendance
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
