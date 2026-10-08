'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatPaymentMethod } from '@/lib/paymentSplits'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  useBankAccounts,
  CASH_IN_HAND_ACCOUNT,
  bankAccountIdForApi,
  defaultBankAccountSelection,
} from '@/hooks/useBankAccounts'
import { ArrowLeft, CalendarDays, HandCoins, Plus, Sparkles, Trash2, Wallet } from 'lucide-react'

interface Staff {
  id: string
  name: string
  phone: string
  email: string
  address?: string
  designation: string
  department: string
  salary: number
  salary_type: string
  is_active: boolean
  joining_date: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  notes?: string
}

interface Payroll {
  id: string
  payment_number: string
  payment_date: string
  start_date: string
  end_date: string
  basic_salary: number
  present_days: number
  absent_days: number
  half_days: number
  paid_leave_days: number
  weekly_off_days: number
  deductions: number
  bonus: number
  net_salary: number
  paid_amount: number
  payment_mode: string
  status: string
  bank_account?: { account_name: string } | null
}

interface StaffAdvance {
  id: string
  advance_number: string
  amount: number
  reason: string
  advance_date: string
  expected_recovery_date?: string
  recovered_amount: number
  pending_amount: number
  payment_mode: string
  status: string
  notes: string
}

interface StaffDeduction {
  id: string
  deduction_number: string
  deduction_type: string
  amount: number
  description: string
  deduction_date: string
  is_recurring: boolean
  status: string
}

interface StaffExtra {
  id: string
  extra_number: string
  direction: 'add' | 'deduct'
  amount: number
  reason: string
  entry_date: string
  is_redeemed: boolean
  redeemed_at?: string
  payment_mode: string
  bank_account_id?: string | null
  bank_account?: { account_name: string } | null
  status: string
  settled_amount: number
  settled_by_payroll_id?: string | null
  notes: string
}

interface Attendance {
  id: string
  date: string
  status: string
  check_in_time?: string
  check_out_time?: string
  work_hours: number
  notes: string
}

interface StaffBalance {
  balance: number
  payable_from_payrolls: number
  earned_unpaid: number
  uncovered_payable_days: number
  salary_paid: number
  advances_pending: number
  deductions_pending: number
  extras_add_pending?: number
  extras_deduct_pending?: number
}

const ATTENDANCE_BADGES: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  half_day: 'bg-amber-100 text-amber-700',
  paid_leave: 'bg-blue-100 text-blue-700',
  weekly_off: 'bg-gray-100 text-gray-700',
}

const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  paid_leave: 'Paid Leave',
  weekly_off: 'Weekly Off',
}

const ADVANCE_BADGES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  recovered: 'bg-green-100 text-green-700',
}

function formatSalaryType(t: string) {
  if (t === 'daily') return 'Daily'
  if (t === 'hourly') return 'Hourly'
  return 'Monthly'
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function monthRange(month: string): { start: string; end: string } | null {
  if (!month) return null
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return null
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { start: `${month}-01`, end: lastDay }
}

export default function StaffDetailPage() {
  const router = useRouter()
  const params = useParams()
  const staffId = params.id as string

  const { accounts: bankAccounts, primaryAccount } = useBankAccounts()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [staff, setStaff] = useState<Staff | null>(null)
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [advances, setAdvances] = useState<StaffAdvance[]>([])
  const [deductions, setDeductions] = useState<StaffDeduction[]>([])
  const [extras, setExtras] = useState<StaffExtra[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [staffBalance, setStaffBalance] = useState<StaffBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendanceLoading, setAttendanceLoading] = useState(true)
  const [attendanceMonth, setAttendanceMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  )
  const [isExtraDialogOpen, setIsExtraDialogOpen] = useState(false)
  const [extraSaving, setExtraSaving] = useState(false)
  const [extraForm, setExtraForm] = useState({
    direction: 'deduct' as 'add' | 'deduct',
    amount: '',
    entry_date: new Date().toISOString().split('T')[0],
    reason: '',
    redeem_now: false,
    payment_mode: 'cash',
    paid_from: CASH_IN_HAND_ACCOUNT,
    reference: '',
    notes: '',
  })
  const [redeemingExtra, setRedeemingExtra] = useState<StaffExtra | null>(null)
  const [redeemSaving, setRedeemSaving] = useState(false)
  const [redeemForm, setRedeemForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    paid_from: CASH_IN_HAND_ACCOUNT,
    reference: '',
    notes: '',
  })

  const fetchExtras = useCallback(async () => {
    try {
      const [extraRes, balanceRes] = await Promise.all([
        apiFetch(`/staff/extras?staff_id=${staffId}`),
        apiFetch(`/staff/${staffId}/balance`),
      ])
      if (extraRes.ok) {
        const data = await extraRes.json()
        setExtras(Array.isArray(data) ? data : [])
      }
      if (balanceRes.ok) setStaffBalance(await balanceRes.json())
    } catch (err) {
      console.error(err)
    }
  }, [staffId])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [staffRes, payrollRes, advanceRes, deductionRes, extraRes, balanceRes] = await Promise.all([
          apiFetch(`/staff/${staffId}`),
          apiFetch(`/payroll?staff_id=${staffId}`),
          apiFetch(`/staff/advances?staff_id=${staffId}`),
          apiFetch(`/staff/deductions?staff_id=${staffId}`),
          apiFetch(`/staff/extras?staff_id=${staffId}`),
          apiFetch(`/staff/${staffId}/balance`),
        ])
        if (staffRes.ok) {
          setStaff(await staffRes.json())
        } else {
          notifyError('Staff member not found')
          router.push('/staff')
          return
        }
        if (payrollRes.ok) setPayrolls(await payrollRes.json())
        if (advanceRes.ok) {
          const data = await advanceRes.json()
          setAdvances(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
        }
        if (deductionRes.ok) {
          const data = await deductionRes.json()
          setDeductions(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [])
        }
        if (extraRes.ok) {
          const data = await extraRes.json()
          setExtras(Array.isArray(data) ? data : [])
        }
        if (balanceRes.ok) setStaffBalance(await balanceRes.json())
      } catch (err) {
        console.error(err)
        notifyError('Failed to load staff details')
      } finally {
        setLoading(false)
      }
    }
    if (staffId) void fetchAll()
  }, [staffId, router])

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try {
      const range = monthRange(attendanceMonth)
      const qs = range ? `?start_date=${range.start}&end_date=${range.end}` : ''
      const res = await apiFetch(`/attendance/staff/${staffId}${qs}`)
      if (res.ok) {
        const data = await res.json()
        setAttendances(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAttendanceLoading(false)
    }
  }, [staffId, attendanceMonth])

  useEffect(() => {
    void fetchAttendance()
  }, [fetchAttendance])

  const attendanceSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of attendances) {
      counts[a.status] = (counts[a.status] || 0) + 1
    }
    return counts
  }, [attendances])

  const totalSalaryPaid = payrolls
    .reduce((sum, p) => sum + (p.paid_amount || (p.status === 'paid' ? p.net_salary : 0)), 0)
  const totalAdvancePending = advances.reduce((sum, a) => sum + (a.pending_amount || 0), 0)

  const openExtraDialog = () => {
    setExtraForm({
      direction: 'deduct',
      amount: '',
      entry_date: new Date().toISOString().split('T')[0],
      reason: '',
      redeem_now: false,
      payment_mode: 'cash',
      paid_from: CASH_IN_HAND_ACCOUNT,
      reference: '',
      notes: '',
    })
    setIsExtraDialogOpen(true)
  }

  const handleCreateExtra = async () => {
    const amount = parseFloat(extraForm.amount)
    if (!extraForm.entry_date) {
      notifyError('Date is required')
      return
    }
    if (!amount || amount <= 0) {
      notifyError('Enter a valid amount')
      return
    }
    setExtraSaving(true)
    try {
      const res = await apiFetch('/staff/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          direction: extraForm.direction,
          amount,
          reason: extraForm.reason,
          entry_date: new Date(extraForm.entry_date).toISOString(),
          redeem_now: extraForm.redeem_now,
          payment_mode: extraForm.payment_mode,
          bank_account_id: extraForm.redeem_now ? bankAccountIdForApi(extraForm.paid_from) : null,
          reference: extraForm.reference,
          notes: extraForm.notes,
        }),
      })
      if (res.ok) {
        notifySuccess(extraForm.direction === 'add' ? 'Extra payable recorded' : 'Extra amount recorded')
        setIsExtraDialogOpen(false)
        fetchExtras()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to record extra amount')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to record extra amount')
    } finally {
      setExtraSaving(false)
    }
  }

  const openRedeemDialog = (extra: StaffExtra) => {
    setRedeemingExtra(extra)
    setRedeemForm({
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      paid_from: CASH_IN_HAND_ACCOUNT,
      reference: '',
      notes: '',
    })
  }

  const handleRedeemExtra = async () => {
    if (!redeemingExtra) return
    setRedeemSaving(true)
    try {
      const res = await apiFetch(`/staff/extras/${redeemingExtra.id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: new Date(redeemForm.payment_date).toISOString(),
          payment_mode: redeemForm.payment_mode,
          bank_account_id: bankAccountIdForApi(redeemForm.paid_from),
          reference: redeemForm.reference,
          notes: redeemForm.notes,
        }),
      })
      if (res.ok) {
        notifySuccess(`Extra amount ${redeemingExtra.extra_number} paid out`)
        setRedeemingExtra(null)
        fetchExtras()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to redeem extra amount')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to redeem extra amount')
    } finally {
      setRedeemSaving(false)
    }
  }

  const handleDeleteExtra = async (extra: StaffExtra) => {
    if (!(await confirm({
      title: 'Delete extra amount?',
      description: extra.is_redeemed
        ? 'This will also reverse the payout expense and cash/bank entry.'
        : 'This pending due will be removed.',
    }))) return
    try {
      const res = await apiFetch(`/staff/extras/${extra.id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Extra amount deleted')
        fetchExtras()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to delete extra amount')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to delete extra amount')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  if (!staff) return null

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/staff')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="app-page-title">{staff.name}</h1>
              <p className="text-sm text-gray-500">
                {[staff.designation, staff.department].filter(Boolean).join(' · ') || 'Staff details'}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                staff.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {staff.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryStat
            label="Salary"
            value={
              <>
                {formatCurrency(staff.salary)}
                <span className="text-sm font-normal text-[#5b5c6b]">
                  /{staff.salary_type === 'monthly' ? 'mo' : staff.salary_type === 'daily' ? 'day' : 'hr'}
                </span>
              </>
            }
            hint={formatSalaryType(staff.salary_type)}
          />
          <SummaryStat label="Total Salary Paid" value={formatCurrency(totalSalaryPaid)} hint={`${payrolls.length} payroll records`} />
          <SummaryStat tone="warning" label="Advance Pending" value={formatCurrency(totalAdvancePending)} hint={`${advances.length} advances`} />
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-500">Contact</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{staff.phone || '—'}</p>
              <p className="break-words text-xs text-gray-500">{staff.email || '—'}</p>
              <p className="text-xs text-gray-500">
                Joined {staff.joining_date ? formatDate(staff.joining_date) : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {staffBalance && (
          <Card className={staffBalance.balance < 0 ? 'border-red-200 bg-red-50/40' : ''}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Current Balance</p>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${
                      staffBalance.balance < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(staffBalance.balance)}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      staffBalance.balance < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {staffBalance.balance < 0
                      ? 'Payback due from staff'
                      : staffBalance.balance > 0
                        ? 'To be paid to staff'
                        : 'Settled'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                  <div>
                    <p className="text-xs text-gray-500">Earned (unpaid days)</p>
                    <p className="font-medium tabular-nums text-gray-900">
                      {formatCurrency(staffBalance.earned_unpaid)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {staffBalance.uncovered_payable_days} payable days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payroll payable</p>
                    <p className="font-medium tabular-nums text-gray-900">
                      {formatCurrency(staffBalance.payable_from_payrolls)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Salary paid</p>
                    <p className="font-medium tabular-nums text-gray-900">
                      -{formatCurrency(staffBalance.salary_paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Advances pending</p>
                    <p className="font-medium tabular-nums text-red-600">
                      -{formatCurrency(staffBalance.advances_pending)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deductions pending</p>
                    <p className="font-medium tabular-nums text-red-600">
                      -{formatCurrency(staffBalance.deductions_pending)}
                    </p>
                  </div>
                  {(staffBalance.extras_add_pending ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Extras payable</p>
                      <p className="font-medium tabular-nums text-green-600">
                        +{formatCurrency(staffBalance.extras_add_pending || 0)}
                      </p>
                    </div>
                  )}
                  {(staffBalance.extras_deduct_pending ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Extras recoverable</p>
                      <p className="font-medium tabular-nums text-red-600">
                        -{formatCurrency(staffBalance.extras_deduct_pending || 0)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Salary Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Paid On</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap font-medium">{p.payment_number}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-700">
                      {formatDate(p.start_date)} – {formatDate(p.end_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-gray-600">
                      P:{p.present_days} · A:{p.absent_days} · H:{p.half_days} · L:{p.paid_leave_days} · W:{p.weekly_off_days}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(p.basic_salary)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-red-600">{formatCurrency(p.deductions)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-green-600">{formatCurrency(p.bonus)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums font-semibold">
                      {formatCurrency(p.net_salary)}
                      {(p.status === 'partial' || p.status === 'pending') && (
                        <div className="mt-0.5 text-xs font-normal text-gray-500">
                          Paid {formatCurrency(p.paid_amount || 0)} · Due {formatCurrency(Math.max(0, p.net_salary - (p.paid_amount || 0)))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatPaymentMethod(p.payment_mode)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : p.status === 'partial'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {payrolls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-gray-500">
                      No salary payments recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="h-4 w-4" /> Advances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advance #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Recovered</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap font-medium">{a.advance_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(a.advance_date)}</TableCell>
                    <TableCell className="text-sm text-gray-700">{a.reason || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(a.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-green-600">{formatCurrency(a.recovered_amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-red-600">{formatCurrency(a.pending_amount)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatPaymentMethod(a.payment_mode)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ADVANCE_BADGES[a.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {advances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                      No advances recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Extra Amounts
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openExtraDialog}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Extra
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Extra amounts stay due until they are added to or deducted from the next salary payment.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Extra #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Redeemed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extras.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-medium">{e.extra_number}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.entry_date)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          e.direction === 'add'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {e.direction === 'add' ? 'Add to salary' : 'Deduct from salary'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">{e.reason || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {e.direction === 'add' ? '+' : '−'}{formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-700">
                      {e.is_redeemed
                        ? `${formatPaymentMethod(e.payment_mode)}${e.bank_account?.account_name ? ` · ${e.bank_account.account_name}` : ''}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          e.status === 'settled'
                            ? 'bg-green-100 text-green-700'
                            : e.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {e.status === 'settled' && e.settled_by_payroll_id
                          ? 'IN SALARY'
                          : e.status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {e.status === 'pending' && !e.is_redeemed && (
                        <Button variant="ghost" size="sm" onClick={() => openRedeemDialog(e)} title="Pay out now">
                          <Wallet className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status !== 'settled' && !e.settled_by_payroll_id && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteExtra(e)} title="Delete">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {extras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                      No extra amounts recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {deductions.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Deductions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deduction #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap font-medium">{d.deduction_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(d.deduction_date)}</TableCell>
                      <TableCell className="capitalize">{d.deduction_type.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-sm text-gray-700">{d.description || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(d.amount)}</TableCell>
                      <TableCell className="capitalize">{d.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> Attendance History
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  className="w-auto"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                />
                {attendanceMonth && (
                  <Button variant="ghost" size="sm" onClick={() => setAttendanceMonth('')}>
                    Show all
                  </Button>
                )}
              </div>
            </div>
            {attendances.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {Object.entries(ATTENDANCE_LABELS).map(([status, label]) =>
                  attendanceSummary[status] ? (
                    <span
                      key={status}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ATTENDANCE_BADGES[status]}`}
                    >
                      {label}: {attendanceSummary[status]}
                    </span>
                  ) : null
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {attendanceLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead className="text-right">Work Hours</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ATTENDANCE_BADGES[a.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {ATTENDANCE_LABELS[a.status] || a.status}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatTime(a.check_in_time)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatTime(a.check_out_time)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {a.work_hours ? `${a.work_hours.toFixed(1)}h` : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{a.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {attendances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                        No attendance records{attendanceMonth ? ' for this month' : ''}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isExtraDialogOpen} onOpenChange={setIsExtraDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Extra Amount — {staff?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Direction *</Label>
                  <Select
                    value={extraForm.direction}
                    onValueChange={(v: 'add' | 'deduct') => setExtraForm({ ...extraForm, direction: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deduct">Deduct from next salary</SelectItem>
                      <SelectItem value="add">Add to next salary</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {extraForm.direction === 'add'
                      ? 'Owed to staff — increases the next salary payment.'
                      : 'Owed by staff — recovered from the next salary payment.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraForm.amount}
                    onChange={(e) => setExtraForm({ ...extraForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={extraForm.entry_date}
                    onChange={(e) => setExtraForm({ ...extraForm, entry_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={extraForm.reason}
                    onChange={(e) => setExtraForm({ ...extraForm, reason: e.target.value })}
                    placeholder="e.g. Extra draw, incentive, reimbursement"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="redeem-now"
                  checked={extraForm.redeem_now}
                  onCheckedChange={(checked) =>
                    setExtraForm({ ...extraForm, redeem_now: checked === true })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="redeem-now" className="cursor-pointer">Pay out now</Label>
                  <p className="text-xs text-muted-foreground">
                    {extraForm.direction === 'add'
                      ? 'Pays the amount immediately and settles it — no payroll adjustment.'
                      : 'Pays the amount now; it still stays due and will be deducted from the next salary.'}
                  </p>
                </div>
              </div>
              {extraForm.redeem_now && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select
                      value={extraForm.payment_mode}
                      onValueChange={(v) =>
                        setExtraForm({
                          ...extraForm,
                          payment_mode: v,
                          paid_from:
                            v === 'cash'
                              ? CASH_IN_HAND_ACCOUNT
                              : defaultBankAccountSelection(bankAccounts, primaryAccount),
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Paid From</Label>
                    <Select
                      value={extraForm.paid_from}
                      onValueChange={(v) => setExtraForm({ ...extraForm, paid_from: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CASH_IN_HAND_ACCOUNT}>Cash in-hand</SelectItem>
                        {bankAccounts.filter((a) => a.is_active).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name}
                            {account.bank_name ? ` (${account.bank_name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Reference</Label>
                    <Input
                      value={extraForm.reference}
                      onChange={(e) => setExtraForm({ ...extraForm, reference: e.target.value })}
                      placeholder="Transaction ID, Cheque No, etc."
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={extraForm.notes}
                  onChange={(e) => setExtraForm({ ...extraForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExtraDialogOpen(false)} disabled={extraSaving}>Cancel</Button>
              <Button onClick={handleCreateExtra} disabled={extraSaving}>
                {extraSaving ? 'Saving...' : 'Save Extra Amount'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={redeemingExtra !== null} onOpenChange={(open) => { if (!open) setRedeemingExtra(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Pay Out — {redeemingExtra?.extra_number}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-600">Amount: </span>
                <span className="font-semibold tabular-nums">{formatCurrency(redeemingExtra?.amount || 0)}</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {redeemingExtra?.direction === 'add'
                    ? 'Paying now settles this extra immediately.'
                    : 'The amount stays due and will still be deducted from the next salary.'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={redeemForm.payment_date}
                    onChange={(e) => setRedeemForm({ ...redeemForm, payment_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select
                    value={redeemForm.payment_mode}
                    onValueChange={(v) =>
                      setRedeemForm({
                        ...redeemForm,
                        payment_mode: v,
                        paid_from:
                          v === 'cash'
                            ? CASH_IN_HAND_ACCOUNT
                            : defaultBankAccountSelection(bankAccounts, primaryAccount),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paid From</Label>
                <Select
                  value={redeemForm.paid_from}
                  onValueChange={(v) => setRedeemForm({ ...redeemForm, paid_from: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CASH_IN_HAND_ACCOUNT}>Cash in-hand</SelectItem>
                    {bankAccounts.filter((a) => a.is_active).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_name}
                        {account.bank_name ? ` (${account.bank_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={redeemForm.reference}
                    onChange={(e) => setRedeemForm({ ...redeemForm, reference: e.target.value })}
                    placeholder="Transaction ID, Cheque No, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={redeemForm.notes}
                    onChange={(e) => setRedeemForm({ ...redeemForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRedeemingExtra(null)} disabled={redeemSaving}>Cancel</Button>
              <Button onClick={handleRedeemExtra} disabled={redeemSaving}>
                {redeemSaving ? 'Paying...' : 'Pay Out'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
