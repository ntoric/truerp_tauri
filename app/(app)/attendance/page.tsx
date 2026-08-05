'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { notifyError, notifySuccess } from '@/lib/notify'
import { parseApiError } from '@/lib/form-errors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Save,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  Download,
} from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface Staff {
  id: string
  name: string
  designation: string
  department?: string
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

function localDateISO(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

/** Compute decimal work hours from HH:mm check-in/out times. */
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
  const [formData, setFormData] = useState({
    staff_id: '',
    date: selectedDate,
    status: 'present',
    check_in_time: '',
    check_out_time: '',
    work_hours: 0,
    notes: ''
  })

  useEffect(() => {
    if (authLoading || storeLoading || !user || !activeStore) return
    setLoading(true)
    fetchStaffs()
    fetchAttendance()
    fetchStats()
  }, [authLoading, storeLoading, user, activeStore?.id, selectedDate])

  const filteredStaffs = staffs.filter((staff) => {
    const query = search.toLowerCase()
    const attendance = attendances.find((a) => a.staff_id === staff.id)

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

  const designations = [...new Set(staffs.map((s) => s.designation).filter(Boolean))].sort()
  const departments = [...new Set(staffs.map((s) => s.department).filter(Boolean))].sort()

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

  const refreshData = () => {
    fetchAttendance()
    fetchStats()
  }

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
        notifySuccess('Attendance saved')
        setIsDialogOpen(false)
        resetForm()
        refreshData()
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
    if (!staffId) {
      notifyError('Invalid staff selected')
      return
    }
    try {
      const res = await apiFetch('/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          date: selectedDate,
          status,
          work_hours: defaultWorkHours(status),
        }),
      })
      if (res.ok) {
        notifySuccess(`Marked as ${status.replace('_', ' ')}`)
        refreshData()
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to mark attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to mark attendance')
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
    // Defer dialog open so Radix dropdown can finish closing (prevents instant dismiss).
    window.setTimeout(() => setIsDialogOpen(true), 0)
  }

  const handleDelete = async (attendance: Attendance) => {
    if (!(await confirm({
      title: 'Delete attendance?',
      description: 'Are you sure you want to delete this attendance record? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/attendance/${attendance.id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Attendance deleted')
        refreshData()
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
    window.setTimeout(() => setIsBulkStatusConfirmOpen(true), 0)
  }

  const confirmBulkMark = async () => {
    try {
      const res = await apiFetch('/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          attendance: Array.from(selectedStaffIds).map((staffId) => ({
            staff_id: staffId,
            status: bulkStatus,
            work_hours: defaultWorkHours(bulkStatus),
          })),
        }),
      })
      if (res.ok) {
        notifySuccess('Attendance updated for selected staff')
        setSelectedStaffIds(new Set())
        setIsBulkStatusConfirmOpen(false)
        refreshData()
        return
      }
      const { message } = await parseApiError(res)
      notifyError(message, 'Unable to bulk mark attendance')
    } catch (err) {
      console.error(err)
      notifyError('Unable to bulk mark attendance')
    }
  }

  const handleBulkDelete = async () => {
    const deletableIds = Array.from(selectedStaffIds)
      .map((staffId) => attendances.find((a) => a.staff_id === staffId))
      .filter((attendance): attendance is Attendance => Boolean(attendance))
      .map((attendance) => attendance.id)

    if (deletableIds.length === 0) return
    if (!(await confirm({
      title: 'Delete attendance records?',
      description: `Are you sure you want to delete ${deletableIds.length} attendance records? This action cannot be undone.`,
    }))) return

    try {
      const res = await apiFetch('/attendance/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletableIds }),
      })
      if (res.ok) {
        setSelectedStaffIds(new Set())
        refreshData()
      }
    } catch (err) { console.error(err) }
  }

  const selectedDeletableCount = Array.from(selectedStaffIds).filter((staffId) =>
    attendances.some((a) => a.staff_id === staffId)
  ).length

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'absent': return <XCircle className="h-5 w-5 text-red-600" />
      case 'half_day': return <Clock className="h-5 w-5 text-yellow-600" />
      case 'paid_leave': return <Coffee className="h-5 w-5 text-blue-600" />
      case 'weekly_off': return <Home className="h-5 w-5 text-purple-600" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700'
      case 'absent': return 'bg-red-100 text-red-700'
      case 'half_day': return 'bg-yellow-100 text-yellow-700'
      case 'paid_leave': return 'bg-blue-100 text-blue-700'
      case 'weekly_off': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) =>
    STATUS_OPTIONS.find((option) => option.value === status)?.label ||
    status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())

  const formatTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''

  const handleExport = () => {
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
        const attendance = attendances.find((a) => a.staff_id === staff.id)
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
    downloadCsv(`attendance_${selectedDate}_${accountingExportDateStamp()}.csv`, rows)
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Attendance Management</h1>
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button variant="outline" onClick={handleExport} disabled={loading || filteredStaffs.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}><Save className="mr-2 h-4 w-4" /> Mark Attendance</Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total_staff}</div>
                <div className="text-sm text-gray-600">Total Staff</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                <div className="text-sm text-gray-600">Present</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                <div className="text-sm text-gray-600">Absent</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.half_day}</div>
                <div className="text-sm text-gray-600">Half Day</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.paid_leave}</div>
                <div className="text-sm text-gray-600">Paid Leave</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{stats.weekly_off}</div>
                <div className="text-sm text-gray-600">Weekly Off</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="mb-4">
              Attendance for {formatSelectedDate(selectedDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardTitle>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap flex-1">
                <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by name, designation..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="not_marked">Not Marked</SelectItem>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={designationFilter} onValueChange={setDesignationFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="Designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Designations</SelectItem>
                    {designations.map((designation) => (
                      <SelectItem key={designation} value={designation}>
                        {designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedStaffIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedStaffIds.size} selected</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">Mark As</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUS_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={(e) => {
                            e.preventDefault()
                            handleBulkMark(option.value)
                          }}
                        >
                          {getStatusIcon(option.value)}
                          <span className="ml-2">{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedDeletableCount === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete{selectedDeletableCount > 0 ? ` (${selectedDeletableCount})` : ''}
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
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((staff) => {
                  const attendance = attendances.find(a => a.staff_id === staff.id)
                  return (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStaffIds.has(staff.id)}
                          onCheckedChange={() => handleSelectStaff(staff.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>{staff.designation}</TableCell>
                      <TableCell>{staff.department || '—'}</TableCell>
                      <TableCell>
                        {attendance ? (
                          <div className="flex items-center gap-2">
                            {getStatusIcon(attendance.status)}
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(attendance.status)}`}>
                              {attendance.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not marked</span>
                        )}
                      </TableCell>
                      <TableCell>{attendance?.check_in_time ? new Date(attendance.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                      <TableCell>{attendance?.check_out_time ? new Date(attendance.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                      <TableCell>{attendance?.work_hours || 0} hrs</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STATUS_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onSelect={() => {
                                  void handleQuickMark(staff.id, option.value)
                                }}
                              >
                                {getStatusIcon(option.value)}
                                <span className="ml-2">Mark {option.label}</span>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                handleEdit(staff, attendance)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                            {attendance && (
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  handleDelete(attendance)
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredStaffs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      {staffs.length === 0 ? 'No staff found. Add staff first.' : 'No staff match the selected filters.'}
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
            <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Staff *</Label>
                <Select value={formData.staff_id} onValueChange={(v) => setFormData({...formData, staff_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staffs.map(s => <SelectItem key={s.id} value={s.id}>{s.name} - {s.designation}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                  <Label>Check In Time</Label>
                  <Input
                    type="time"
                    value={formData.check_in_time}
                    onChange={(e) => setFormData((prev) => withAutoWorkHours(prev, { check_in_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Check Out Time</Label>
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
                {formData.check_in_time && formData.check_out_time ? (
                  <p className="text-xs text-slate-500">Auto-calculated from check-in and check-out</p>
                ) : null}
              </div>
              <div className="space-y-2"><Label>Notes</Label><Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
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
            <p className="py-4 text-sm text-gray-600">
              Mark {selectedStaffIds.size} staff as {getStatusLabel(bulkStatus)} for {formatSelectedDate(selectedDate)}?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusConfirmOpen(false)}>Cancel</Button>
              <Button onClick={confirmBulkMark}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
