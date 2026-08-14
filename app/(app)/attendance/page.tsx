'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { notifyError, notifySuccess } from '@/lib/notify'
import { parseApiError } from '@/lib/form-errors'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CheckCircle,
  XCircle,
  Clock,
  Coffee,
  Home,
  Pencil,
  Trash2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { cn } from '@/lib/utils'

interface Staff {
  id: string
  name: string
  designation: string
  department?: string
  is_active?: boolean
}

interface Attendance {
  id: string
  staff_id: string
  staff: Staff
  date: string
  status: string
  check_in_time: string
  check_out_time: string
  work_hours: number
  notes: string
}

interface AttendanceStats {
  total_staff: number
  present: number
  absent: number
  half_day: number
  paid_leave: number
  weekly_off: number
  date: string
}

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'paid_leave', label: 'Paid Leave' },
  { value: 'weekly_off', label: 'Weekly Off' },
] as const

const QUICK_STATUS = [
  { value: 'present', short: 'P', label: 'Present', active: 'bg-green-600 text-white', idle: 'bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'absent', short: 'A', label: 'Absent', active: 'bg-red-600 text-white', idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
  { value: 'half_day', short: '½', label: 'Half Day', active: 'bg-yellow-500 text-white', idle: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { value: 'paid_leave', short: 'L', label: 'Paid Leave', active: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { value: 'weekly_off', short: 'Off', label: 'Weekly Off', active: 'bg-purple-600 text-white', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
] as const

function localDateISO(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return localDateISO(date)
}

function formatSelectedDate(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', options)
}

function defaultWorkHours(status: string) {
  if (status === 'half_day') return 4
  if (status === 'present') return 8
  return 0
}

function calculateWorkHours(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const [inH, inM] = checkIn.split(':').map(Number)
  const [outH, outM] = checkOut.split(':').map(Number)
  if ([inH, inM, outH, outM].some((n) => Number.isNaN(n))) return 0
  const start = inH * 60 + inM
  const end = outH * 60 + outM
  if (end <= start) return 0
  return Math.round(((end - start) / 60) * 100) / 100
}

function withAutoWorkHours(prev: {
  staff_id: string
  date: string
  status: string
  check_in_time: string
  check_out_time: string
  work_hours: number
  notes: string
}, patch: Partial<typeof prev>) {
  const next = { ...prev, ...patch }
  if (next.check_in_time && next.check_out_time) {
    next.work_hours = calculateWorkHours(next.check_in_time, next.check_out_time)
  } else if (patch.status !== undefined && !next.check_in_time && !next.check_out_time) {
    next.work_hours = defaultWorkHours(next.status)
  }
  return next
}

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ||
    status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'present': return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'absent': return <XCircle className="h-4 w-4 text-red-600" />
    case 'half_day': return <Clock className="h-4 w-4 text-yellow-600" />
    case 'paid_leave': return <Coffee className="h-4 w-4 text-blue-600" />
    case 'weekly_off': return <Home className="h-4 w-4 text-purple-600" />
    default: return null
  }
}

export default function AttendancePage() {
  const { user, loading: authLoading } = useAuth()
  const { activeStore, loading: storeLoading } = useStore()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [staffs, setStaffs] = useState<Staff[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(localDateISO())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [designationFilter, setDesignationFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkStatusConfirmOpen, setIsBulkStatusConfirmOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<string>('present')
  const [markingStaffId, setMarkingStaffId] = useState<string | null>(null)
  const [bulkMarking, setBulkMarking] = useState(false)
  const [formData, setFormData] = useState({
    staff_id: '',
    date: selectedDate,
    status: 'present',
    check_in_time: '',
    check_out_time: '',
    work_hours: 0,
    notes: ''
  })

  const activeStaffs = useMemo(
    () => staffs.filter((s) => s.is_active !== false),
    [staffs]
  )

  const attendanceByStaff = useMemo(() => {
    const map = new Map<string, Attendance>()
    for (const a of attendances) map.set(a.staff_id, a)
    return map
  }, [attendances])

  const markedCount = useMemo(
    () => activeStaffs.filter((s) => attendanceByStaff.has(s.id)).length,
    [activeStaffs, attendanceByStaff]
  )

  const unmarkedStaffIds = useMemo(
    () => activeStaffs.filter((s) => !attendanceByStaff.has(s.id)).map((s) => s.id),
    [activeStaffs, attendanceByStaff]
  )

  const notMarkedCount = activeStaffs.length - markedCount

  useEffect(() => {
    if (authLoading || storeLoading || !user || !activeStore) return
    setLoading(true)
    fetchStaffs()
    fetchAttendance()
    fetchStats()
  }, [authLoading, storeLoading, user, activeStore?.id, selectedDate])

  const filteredStaffs = activeStaffs.filter((staff) => {
    const query = search.toLowerCase()
    const attendance = attendanceByStaff.get(staff.id)

    const matchesSearch =
      !search ||
      staff.name.toLowerCase().includes(query) ||
      staff.designation?.toLowerCase().includes(query) ||
      staff.department?.toLowerCase().includes(query)

    const matchesDesignation =
      designationFilter === 'all' || staff.designation === designationFilter

    const matchesDepartment =
      departmentFilter === 'all' || staff.department === departmentFilter

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'not_marked' && !attendance) ||
      (attendance?.status === statusFilter)

    return matchesSearch && matchesDesignation && matchesDepartment && matchesStatus
  })

  const designations = [...new Set(activeStaffs.map((s) => s.designation).filter(Boolean))].sort()
  const departments = [...new Set(activeStaffs.map((s) => s.department).filter(Boolean))].sort()

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredStaffs)

  useEffect(() => {
    resetPage()
    setSelectedStaffIds(new Set())
  }, [selectedDate, search, statusFilter, designationFilter, departmentFilter])

  const fetchStaffs = async () => {
    try {
      const res = await apiFetch('/staff')
      if (res.ok) setStaffs(await res.json())
    } catch (err) { console.error(err) }
  }

  const fetchAttendance = async () => {
    try {
      const res = await apiFetch(`/attendance?start_date=${selectedDate}&end_date=${selectedDate}`)
      if (res.ok) {
        const data = await res.json()
        setAttendances(Array.isArray(data) ? data : [])
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchStats = async () => {
    try {
      const res = await apiFetch(`/attendance/stats?date=${selectedDate}`)
      if (res.ok) setStats(await res.json())
    } catch (err) { console.error(err) }
  }

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

  const removeAttendanceLocal = useCallback((staffId: string) => {
    setAttendances((prev) => prev.filter((a) => a.staff_id !== staffId))
  }, [])

  const handleSubmit = async () => {
    if (!formData.staff_id) {
      notifyError('Please select a staff member')
      return
    }
    try {
      const res = await apiFetch('/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: formData.staff_id,
          date: selectedDate,
          status: formData.status,
          work_hours: formData.work_hours,
          notes: formData.notes,
          check_in_time: formData.check_in_time ? new Date(`${selectedDate}T${formData.check_in_time}`).toISOString() : null,
          check_out_time: formData.check_out_time ? new Date(`${selectedDate}T${formData.check_out_time}`).toISOString() : null,
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        mergeAttendance(saved)
        notifySuccess('Attendance saved')
        setIsDialogOpen(false)
        resetForm()
        fetchStats()
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to save attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to save attendance')
    }
  }

  const resetForm = () => {
    setFormData({
      staff_id: '',
      date: selectedDate,
      status: 'present',
      check_in_time: '',
      check_out_time: '',
      work_hours: 0,
      notes: ''
    })
  }

  const handleQuickMark = async (staffId: string, status: string) => {
    if (!staffId || markingStaffId) return

    const staff = activeStaffs.find((s) => s.id === staffId)
    const prev = attendanceByStaff.get(staffId)
    const optimistic: Attendance = {
      id: prev?.id || `temp-${staffId}`,
      staff_id: staffId,
      staff: staff || { id: staffId, name: '', designation: '' },
      date: selectedDate,
      status,
      check_in_time: '',
      check_out_time: '',
      work_hours: defaultWorkHours(status),
      notes: prev?.notes || '',
    }

    mergeAttendance(optimistic)
    setMarkingStaffId(staffId)

    try {
      const res = await apiFetch('/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          status,
        }),
      })
      if (res.ok) {
        mergeAttendance(await res.json())
        fetchStats()
        return
      }
      if (prev) mergeAttendance(prev)
      else removeAttendanceLocal(staffId)
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to mark attendance')
    } catch (err) {
      if (prev) mergeAttendance(prev)
      else removeAttendanceLocal(staffId)
      console.error(err)
      notifyError('Unable to mark attendance')
    } finally {
      setMarkingStaffId(null)
    }
  }

  const handleEdit = (staff: Staff, attendance?: Attendance) => {
    setFormData({
      staff_id: staff.id,
      date: selectedDate,
      status: attendance?.status || 'present',
      check_in_time: attendance?.check_in_time
        ? new Date(attendance.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '',
      check_out_time: attendance?.check_out_time
        ? new Date(attendance.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '',
      work_hours: attendance?.work_hours || defaultWorkHours(attendance?.status || 'present'),
      notes: attendance?.notes || '',
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (attendance: Attendance) => {
    if (!(await confirm({
      title: 'Clear attendance?',
      description: 'Remove this attendance record for the day?',
    }))) return
    try {
      const res = await apiFetch(`/attendance/${attendance.id}`, { method: 'DELETE' })
      if (res.ok) {
        removeAttendanceLocal(attendance.staff_id)
        notifySuccess('Attendance cleared')
        fetchStats()
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to delete attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to delete attendance')
    }
  }

  const handleSelectStaff = (id: string) => {
    const next = new Set(selectedStaffIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStaffIds(next)
  }

  const handleSelectAll = () => {
    if (selectedStaffIds.size === filteredStaffs.length) {
      setSelectedStaffIds(new Set())
    } else {
      setSelectedStaffIds(new Set(filteredStaffs.map((staff) => staff.id)))
    }
  }

  const handleBulkMark = (status: string) => {
    if (selectedStaffIds.size === 0) return
    setBulkStatus(status)
    if (status === 'present') {
      void confirmBulkMark(status)
      return
    }
    setIsBulkStatusConfirmOpen(true)
  }

  const bulkMarkStaff = async (staffIds: string[], status: string) => {
    if (staffIds.length === 0) return
    setBulkMarking(true)
    try {
      const res = await apiFetch('/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          attendance: staffIds.map((staffId) => ({
            staff_id: staffId,
            status,
          })),
        }),
      })
      if (res.ok) {
        const saved: Attendance[] = await res.json()
        for (const record of saved) mergeAttendance(record)
        notifySuccess(`Marked ${saved.length} staff as ${getStatusLabel(status).toLowerCase()}`)
        setSelectedStaffIds(new Set())
        setIsBulkStatusConfirmOpen(false)
        fetchStats()
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to bulk mark attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to bulk mark attendance')
    } finally {
      setBulkMarking(false)
    }
  }

  const confirmBulkMark = async (statusOverride?: string) => {
    const status = statusOverride || bulkStatus
    await bulkMarkStaff(Array.from(selectedStaffIds), status)
  }

  const markAllPresent = () => bulkMarkStaff(activeStaffs.map((s) => s.id), 'present')

  const markUnmarkedPresent = () => bulkMarkStaff(unmarkedStaffIds, 'present')

  const handleBulkDelete = async () => {
    const deletableIds = Array.from(selectedStaffIds)
      .map((staffId) => attendanceByStaff.get(staffId))
      .filter((attendance): attendance is Attendance => Boolean(attendance))
      .map((attendance) => attendance.id)

    if (deletableIds.length === 0) return
    if (!(await confirm({
      title: 'Clear attendance records?',
      description: `Remove attendance for ${deletableIds.length} selected staff?`,
    }))) return

    try {
      const res = await apiFetch('/attendance/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletableIds }),
      })
      if (res.ok) {
        for (const staffId of selectedStaffIds) {
          if (attendanceByStaff.has(staffId)) removeAttendanceLocal(staffId)
        }
        setSelectedStaffIds(new Set())
        notifySuccess('Attendance cleared')
        fetchStats()
      }
    } catch (err) { console.error(err) }
  }

  const selectedDeletableCount = Array.from(selectedStaffIds).filter((staffId) =>
    attendanceByStaff.has(staffId)
  ).length

  const formatTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''

  const handleExport = async () => {
    const exportList =
      selectedStaffIds.size > 0
        ? filteredStaffs.filter((staff) => selectedStaffIds.has(staff.id))
        : filteredStaffs

    const rows: (string | number)[][] = [
      [
        'Date',
        'Staff Name',
        'Designation',
        'Department',
        'Status',
        'Check In',
        'Check Out',
        'Work Hours',
        'Notes',
      ],
      ...exportList.map((staff) => {
        const attendance = attendanceByStaff.get(staff.id)
        return [
          selectedDate,
          staff.name,
          staff.designation || '',
          staff.department || '',
          attendance ? getStatusLabel(attendance.status) : 'Not Marked',
          formatTime(attendance?.check_in_time),
          formatTime(attendance?.check_out_time),
          attendance?.work_hours ?? '',
          attendance?.notes || '',
        ]
      }),
    ]
    await downloadCsv(`attendance_${selectedDate}_${accountingExportDateStamp()}.csv`, rows, { label: 'Exporting attendance' })
  }

  const isToday = selectedDate === localDateISO()
  const progressPct = activeStaffs.length > 0 ? Math.round((markedCount / activeStaffs.length) * 100) : 0

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="app-page-title">Staff Attendance</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-white">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[140px] border-0 shadow-none focus-visible:ring-0"
              />
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isToday && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(localDateISO())}>
                Today
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredStaffs.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* Progress + quick actions */}
        <Card className="border-blue-100 bg-gradient-to-r from-blue-50/80 to-white">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-semibold">{markedCount}/{activeStaffs.length}</span>
                  <span className="text-sm text-muted-foreground">staff marked</span>
                  {notMarkedCount > 0 && (
                    <span className="text-sm font-medium text-amber-700">· {notMarkedCount} pending</span>
                  )}
                </div>
                <div className="h-2 w-full max-w-md rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={markUnmarkedPresent}
                  disabled={bulkMarking || notMarkedCount === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {bulkMarking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}
                  Mark unmarked present
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markAllPresent}
                  disabled={bulkMarking || activeStaffs.length === 0}
                >
                  Mark all present
                </Button>
                {notMarkedCount > 0 && statusFilter !== 'not_marked' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatusFilter('not_marked')}
                  >
                    Show pending ({notMarkedCount})
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card className="cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setStatusFilter('all')}>
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold">{stats.total_staff}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card
              className={cn('cursor-pointer hover:border-green-300 transition-colors', statusFilter === 'present' && 'ring-2 ring-green-400')}
              onClick={() => setStatusFilter(statusFilter === 'present' ? 'all' : 'present')}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-green-600">{stats.present}</div>
                <div className="text-xs text-muted-foreground">Present</div>
              </CardContent>
            </Card>
            <Card
              className={cn('cursor-pointer hover:border-red-300 transition-colors', statusFilter === 'absent' && 'ring-2 ring-red-400')}
              onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-red-600">{stats.absent}</div>
                <div className="text-xs text-muted-foreground">Absent</div>
              </CardContent>
            </Card>
            <Card
              className={cn('cursor-pointer hover:border-yellow-300 transition-colors', statusFilter === 'half_day' && 'ring-2 ring-yellow-400')}
              onClick={() => setStatusFilter(statusFilter === 'half_day' ? 'all' : 'half_day')}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-yellow-600">{stats.half_day}</div>
                <div className="text-xs text-muted-foreground">Half Day</div>
              </CardContent>
            </Card>
            <Card
              className={cn('cursor-pointer hover:border-blue-300 transition-colors', statusFilter === 'paid_leave' && 'ring-2 ring-blue-400')}
              onClick={() => setStatusFilter(statusFilter === 'paid_leave' ? 'all' : 'paid_leave')}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-blue-600">{stats.paid_leave}</div>
                <div className="text-xs text-muted-foreground">Leave</div>
              </CardContent>
            </Card>
            <Card
              className={cn('cursor-pointer hover:border-purple-300 transition-colors', statusFilter === 'weekly_off' && 'ring-2 ring-purple-400')}
              onClick={() => setStatusFilter(statusFilter === 'weekly_off' ? 'all' : 'weekly_off')}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-purple-600">{stats.weekly_off}</div>
                <div className="text-xs text-muted-foreground">Weekly Off</div>
              </CardContent>
            </Card>
            <Card
              className={cn('cursor-pointer hover:border-amber-300 transition-colors', statusFilter === 'not_marked' && 'ring-2 ring-amber-400')}
              onClick={() => setStatusFilter(statusFilter === 'not_marked' ? 'all' : 'not_marked')}
            >
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-amber-600">{notMarkedCount}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap flex-1">
                <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search staff..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {departments.length > 0 && (
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department} value={department}>{department}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {designations.length > 0 && (
                  <Select value={designationFilter} onValueChange={setDesignationFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Designation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Designations</SelectItem>
                      {designations.map((designation) => (
                        <SelectItem key={designation} value={designation}>{designation}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {statusFilter !== 'all' && (
                  <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                    Clear filter
                  </Button>
                )}
              </div>
              {selectedStaffIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedStaffIds.size} selected</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={bulkMarking}>Mark as</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUS_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={() => handleBulkMark(option.value)}
                        >
                          {getStatusIcon(option.value)}
                          <span className="ml-2">{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedDeletableCount === 0}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Clear{selectedDeletableCount > 0 ? ` (${selectedDeletableCount})` : ''}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedStaffIds.size === filteredStaffs.length && filteredStaffs.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Mark</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((staff) => {
                  const attendance = attendanceByStaff.get(staff.id)
                  const isMarking = markingStaffId === staff.id
                  return (
                    <TableRow
                      key={staff.id}
                      className={cn(!attendance && 'bg-amber-50/40')}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStaffIds.has(staff.id)}
                          onCheckedChange={() => handleSelectStaff(staff.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{staff.name}</div>
                        <div className="text-xs text-muted-foreground">{staff.designation}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {staff.department || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {isMarking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mr-1 shrink-0" />}
                          {QUICK_STATUS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isMarking || bulkMarking}
                              title={opt.label}
                              onClick={() => void handleQuickMark(staff.id, opt.value)}
                              className={cn(
                                'h-7 min-w-[1.75rem] rounded px-1 text-xs font-semibold transition-all',
                                attendance?.status === opt.value ? opt.active : opt.idle,
                                (isMarking || bulkMarking) && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {opt.short}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {attendance ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            {getStatusIcon(attendance.status)}
                            <span>{getStatusLabel(attendance.status)}</span>
                            {attendance.check_in_time && (
                              <span className="text-xs text-muted-foreground">
                                {formatTime(attendance.check_in_time)}
                                {attendance.check_out_time ? `–${formatTime(attendance.check_out_time)}` : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit details"
                            onClick={() => handleEdit(staff, attendance)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {attendance && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              title="Clear attendance"
                              onClick={() => void handleDelete(attendance)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredStaffs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      {activeStaffs.length === 0
                        ? 'No active staff found. Add staff first.'
                        : statusFilter === 'not_marked'
                          ? 'All staff marked for this day!'
                          : 'No staff match the selected filters.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Attendance Details</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {formData.staff_id && (
                <div className="space-y-1">
                  <Label>Staff</Label>
                  <p className="text-sm font-medium">
                    {activeStaffs.find((s) => s.id === formData.staff_id)?.name}
                    {' '}
                    <span className="text-muted-foreground font-normal">
                      — {activeStaffs.find((s) => s.id === formData.staff_id)?.designation}
                    </span>
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((prev) => withAutoWorkHours(prev, { status: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Check In</Label>
                  <Input
                    type="time"
                    value={formData.check_in_time}
                    onChange={(e) => setFormData((prev) => withAutoWorkHours(prev, { check_in_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Check Out</Label>
                  <Input
                    type="time"
                    value={formData.check_out_time}
                    onChange={(e) => setFormData((prev) => withAutoWorkHours(prev, { check_out_time: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Work Hours</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.work_hours}
                  readOnly={!!(formData.check_in_time && formData.check_out_time)}
                  className={formData.check_in_time && formData.check_out_time ? 'bg-slate-50' : undefined}
                  onChange={(e) => setFormData({ ...formData, work_hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkStatusConfirmOpen} onOpenChange={setIsBulkStatusConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk Mark</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-muted-foreground">
              Mark {selectedStaffIds.size} staff as {getStatusLabel(bulkStatus)} for {formatSelectedDate(selectedDate)}?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusConfirmOpen(false)}>Cancel</Button>
              <Button onClick={() => void confirmBulkMark()} disabled={bulkMarking}>
                {bulkMarking && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
