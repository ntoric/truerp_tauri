'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import PageSkeleton from '@/components/layout/PageSkeleton'
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
import { Plus, DollarSign, Calendar, Download, Search, MoreVertical, Pencil, Trash2, Power, BarChart3, ChevronUp, ChevronDown, Wallet, History } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { formatDate } from '@/lib/utils'
import { notifyError } from '@/lib/notify'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import {
  useBankAccounts,
  CASH_IN_HAND_ACCOUNT,
  bankAccountIdForApi,
  defaultBankAccountSelection,
  resolveBankAccountSelection,
} from '@/hooks/useBankAccounts'

interface Staff {
  id: string
  name: string
  designation: string
  salary: number
  salary_type: string
}

interface BankAccountInfo {
  id: string
  account_name: string
  bank_name?: string
}

interface Payroll {
  id: string
  staff_id: string
  staff: Staff
  payment_number: string
  payment_date: string
  start_date: string
  end_date: string
  basic_salary: number
  working_days: number
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
  bank_account_id?: string | null
  bank_account?: BankAccountInfo | null
  expense_id?: string | null
  reference: string
  notes: string
  status: string
  is_settlement?: boolean
  payments?: PayrollPayment[]
  created_at?: string
  updated_at?: string
}

interface PayrollPayment {
  id: string
  payroll_id: string
  payment_number: string
  amount: number
  payment_date: string
  payment_mode: string
  bank_account_id?: string | null
  bank_account?: BankAccountInfo | null
  expense_id?: string | null
  reference: string
  notes: string
  created_at?: string
}

interface PayrollCalc {
  salary: number
  salary_type: string
  working_days: number
  present_days: number
  absent_days: number
  half_days: number
  paid_leave_days: number
  weekly_off_days: number
  payable_days: number
  calculated_salary: number
  period_deductions: number
  advance_recovery: number
  advance_count: number
  estimated_net: number
}

interface PayrollStats {
  total_payments: number
  total_payrolls: number
  this_month: number
}

interface StaffBalance {
  balance: number
  payable_from_payrolls: number
  earned_unpaid: number
  uncovered_payable_days: number
  salary_paid: number
  advances_pending: number
  deductions_pending: number
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
] as const

const STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'pending', label: 'Pending' },
] as const

const PAYROLL_STATUS_BADGES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

function payrollStatusBadge(status: string) {
  return PAYROLL_STATUS_BADGES[status] || 'bg-gray-100 text-gray-700'
}

function formatPaymentMode(mode: string) {
  return PAYMENT_MODES.find((item) => item.value === mode)?.label || mode.replace('_', ' ')
}

function formatPaidFrom(payroll: Payroll) {
  if (payroll.bank_account?.account_name) {
    return payroll.bank_account.account_name
  }
  if (payroll.bank_account_id) {
    return 'Bank account'
  }
  return 'Cash in-hand'
}

export default function PayrollPage() {
  const { user, loading: authLoading } = useAuth()
  const { accounts: bankAccounts, primaryAccount } = useBankAccounts()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [staffs, setStaffs] = useState<Staff[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [stats, setStats] = useState<PayrollStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentModeFilter, setPaymentModeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPayrolls, setSelectedPayrolls] = useState<Set<string>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null)
  const [isBulkStatusConfirmOpen, setIsBulkStatusConfirmOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<'paid' | 'pending'>('paid')
  const [paymentNumber, setPaymentNumber] = useState('')
  const [formData, setFormData] = useState({
    staff_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    basic_salary: 0,
    deductions: 0,
    bonus: 0,
    payment_type: 'full' as 'full' | 'partial' | 'later' | 'all_due',
    amount_paid: 0,
    payment_mode: 'bank_transfer',
    paid_from: CASH_IN_HAND_ACCOUNT,
    reference: '',
    notes: ''
  })
  const [advanceRecovery, setAdvanceRecovery] = useState(0)
  const [advanceRecoveryCount, setAdvanceRecoveryCount] = useState(0)
  const [payrollCalc, setPayrollCalc] = useState<PayrollCalc | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [dueInfo, setDueInfo] = useState<StaffBalance | null>(null)
  const [dueLoading, setDueLoading] = useState(false)
  const [editFormData, setEditFormData] = useState({
    payment_date: '',
    deductions: 0,
    bonus: 0,
    payment_mode: 'bank_transfer',
    paid_from: CASH_IN_HAND_ACCOUNT,
    reference: '',
    notes: '',
    status: 'paid',
  })
  const [payingPayroll, setPayingPayroll] = useState<Payroll | null>(null)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank_transfer',
    paid_from: CASH_IN_HAND_ACCOUNT,
    reference: '',
    notes: '',
  })
  const [historyPayroll, setHistoryPayroll] = useState<Payroll | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [payrollPayments, setPayrollPayments] = useState<PayrollPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  useEffect(() => { if (!authLoading && user) { fetchStaffs(); fetchPayrolls(); fetchStats(); fetchNextNumber() } }, [authLoading, user])

  useEffect(() => {
    setFormData((prev) => {
      if (prev.paid_from !== CASH_IN_HAND_ACCOUNT && bankAccounts.some((a) => a.id === prev.paid_from)) {
        return prev
      }
      if (prev.payment_mode === 'cash') {
        return prev.paid_from === CASH_IN_HAND_ACCOUNT ? prev : { ...prev, paid_from: CASH_IN_HAND_ACCOUNT }
      }
      const preferred = defaultBankAccountSelection(bankAccounts, primaryAccount)
      return prev.paid_from === preferred ? prev : { ...prev, paid_from: preferred }
    })
  }, [bankAccounts, primaryAccount])

  // Prefill the attendance-based salary calculation for the selected staff +
  // period (same computation the backend applies on create, including
  // outstanding advance recovery and period deductions).
  useEffect(() => {
    if (!isDialogOpen || !formData.staff_id || !formData.start_date || !formData.end_date) {
      setPayrollCalc(null)
      setAdvanceRecovery(0)
      setAdvanceRecoveryCount(0)
      return
    }
    let cancelled = false
    setCalcLoading(true)
    apiFetch(`/payroll/calculate?staff_id=${formData.staff_id}&start_date=${formData.start_date}&end_date=${formData.end_date}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setPayrollCalc(null)
          return
        }
        const data: PayrollCalc = await res.json()
        if (cancelled) return
        setPayrollCalc(data)
        setAdvanceRecovery(data.advance_recovery || 0)
        setAdvanceRecoveryCount(data.advance_count || 0)
      })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setCalcLoading(false) })
    return () => { cancelled = true }
  }, [isDialogOpen, formData.staff_id, formData.start_date, formData.end_date])

  // "All Due" mode: fetch the staff's outstanding balance and prefill the
  // payment amount with it — no payroll period needed.
  useEffect(() => {
    if (!isDialogOpen || formData.payment_type !== 'all_due' || !formData.staff_id) {
      setDueInfo(null)
      return
    }
    let cancelled = false
    setDueLoading(true)
    apiFetch(`/staff/${formData.staff_id}/balance`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setDueInfo(null)
          return
        }
        const data: StaffBalance = await res.json()
        if (cancelled) return
        setDueInfo(data)
        setFormData((prev) =>
          prev.payment_type === 'all_due' && prev.amount_paid <= 0
            ? { ...prev, amount_paid: Math.max(0, data.balance) }
            : prev
        )
      })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setDueLoading(false) })
    return () => { cancelled = true }
  }, [isDialogOpen, formData.payment_type, formData.staff_id])

  const filteredPayrolls = payrolls.filter((payroll) => {
    const query = search.toLowerCase()
    const paymentDate = payroll.payment_date?.split('T')[0] || ''

    const matchesSearch =
      !search ||
      payroll.payment_number.toLowerCase().includes(query) ||
      payroll.staff?.name?.toLowerCase().includes(query) ||
      payroll.staff?.designation?.toLowerCase().includes(query) ||
      payroll.reference?.toLowerCase().includes(query)

    const matchesStaff = staffFilter === 'all' || payroll.staff_id === staffFilter
    const matchesStatus = statusFilter === 'all' || payroll.status === statusFilter
    const matchesPaymentMode = paymentModeFilter === 'all' || payroll.payment_mode === paymentModeFilter
    const matchesDateFrom = !dateFrom || paymentDate >= dateFrom
    const matchesDateTo = !dateTo || paymentDate <= dateTo

    return matchesSearch && matchesStaff && matchesStatus && matchesPaymentMode && matchesDateFrom && matchesDateTo
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredPayrolls)

  useEffect(() => {
    resetPage()
    setSelectedPayrolls(new Set())
  }, [search, staffFilter, statusFilter, paymentModeFilter, dateFrom, dateTo])

  const fetchStaffs = async () => {
    try {
      const res = await apiFetch('/staff')
      if (res.ok) setStaffs(await res.json())
    } catch (err) { console.error(err) }
  }

  const fetchPayrolls = async () => {
    try {
      const res = await apiFetch('/payroll')
      if (res.ok) setPayrolls(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchStats = async () => {
    try {
      const res = await apiFetch('/payroll/stats')
      if (res.ok) setStats(await res.json())
    } catch (err) { console.error(err) }
  }

  const fetchNextNumber = async () => {
    try {
      const res = await apiFetch('/payroll/next-number')
      if (res.ok) {
        const data = await res.json()
        setPaymentNumber(data.payment_number)
      }
    } catch (err) { console.error(err) }
  }

  const refreshData = () => {
    fetchPayrolls()
    fetchStats()
  }

  const handleSubmit = async () => {
    const isPartial = formData.payment_type === 'partial'
    const isAllDue = formData.payment_type === 'all_due'
    if (isPartial && (formData.amount_paid <= 0 || formData.amount_paid > estimatedNet)) {
      notifyError(`Partial amount must be between 0 and ${formatCurrency(estimatedNet)}`)
      return
    }
    if (isAllDue && (formData.amount_paid <= 0 || (dueInfo && formData.amount_paid > dueInfo.balance))) {
      notifyError(`Amount must be between 0 and ${formatCurrency(dueInfo?.balance || 0)}`)
      return
    }
    try {
      const res = await apiFetch('/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: formData.staff_id,
          payment_date: new Date(formData.payment_date).toISOString(),
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          basic_salary: formData.basic_salary,
          deductions: formData.deductions,
          bonus: formData.bonus,
          paid_amount: isPartial || isAllDue ? formData.amount_paid : 0,
          payment_mode: formData.payment_mode,
          bank_account_id: bankAccountIdForApi(formData.paid_from),
          reference: formData.reference,
          notes: formData.notes,
          status: formData.payment_type === 'later' ? 'pending' : 'paid',
          pay_all_due: isAllDue,
        })
      })
      if (res.ok) { setIsDialogOpen(false); resetForm(); refreshData(); fetchNextNumber() }
      else {
        const data = await res.json().catch(() => ({}))
        notifyError((data as { error?: string }).error || 'Failed to create payroll')
      }
    } catch (err) { console.error(err) }
  }

  const resetForm = () => {
    setFormData({
      staff_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      basic_salary: 0,
      deductions: 0,
      bonus: 0,
      payment_type: 'full',
      amount_paid: 0,
      payment_mode: 'bank_transfer',
      paid_from: defaultBankAccountSelection(bankAccounts, primaryAccount),
      reference: '',
      notes: ''
    })
    setAdvanceRecovery(0)
    setAdvanceRecoveryCount(0)
    setPayrollCalc(null)
    setDueInfo(null)
  }

  const payrollRemaining = (p: Payroll) => Math.max(0, p.net_salary - (p.paid_amount || 0))

  const openPayDialog = (payroll: Payroll) => {
    setPayingPayroll(payroll)
    setPaymentForm({
      amount: payrollRemaining(payroll),
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: payroll.payment_mode || 'bank_transfer',
      paid_from: resolveBankAccountSelection(payroll.bank_account_id, bankAccounts),
      reference: '',
      notes: '',
    })
    setIsPayDialogOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!payingPayroll) return
    const remaining = payrollRemaining(payingPayroll)
    if (paymentForm.amount <= 0 || paymentForm.amount > remaining) {
      notifyError(`Amount must be between 0 and ${formatCurrency(remaining)}`)
      return
    }
    try {
      const res = await apiFetch(`/payroll/${payingPayroll.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentForm.amount,
          payment_date: new Date(paymentForm.payment_date).toISOString(),
          payment_mode: paymentForm.payment_mode,
          bank_account_id: bankAccountIdForApi(paymentForm.paid_from),
          reference: paymentForm.reference,
          notes: paymentForm.notes,
        }),
      })
      if (res.ok) {
        setIsPayDialogOpen(false)
        setPayingPayroll(null)
        refreshData()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError((data as { error?: string }).error || 'Failed to record payment')
      }
    } catch (err) { console.error(err) }
  }

  const openPaymentHistory = async (payroll: Payroll) => {
    setHistoryPayroll(payroll)
    setIsHistoryOpen(true)
    setPaymentsLoading(true)
    try {
      const res = await apiFetch(`/payroll/${payroll.id}/payments`)
      if (res.ok) setPayrollPayments(await res.json())
      else setPayrollPayments([])
    } catch (err) {
      console.error(err)
      setPayrollPayments([])
    } finally { setPaymentsLoading(false) }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!historyPayroll) return
    if (!(await confirm({
      title: 'Delete payment?',
      description: 'This will reverse the cash/bank entry and expense for this payment.',
    }))) return
    try {
      const res = await apiFetch(`/payroll/${historyPayroll.id}/payments/${paymentId}`, { method: 'DELETE' })
      if (res.ok) {
        const updated: Payroll = await res.json()
        setHistoryPayroll(updated)
        await openPaymentHistory(updated)
        refreshData()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError((data as { error?: string }).error || 'Failed to delete payment')
      }
    } catch (err) { console.error(err) }
  }

  const handleEdit = (payroll: Payroll) => {
    setEditingPayroll(payroll)
    setEditFormData({
      payment_date: payroll.payment_date?.split('T')[0] || '',
      deductions: payroll.deductions,
      bonus: payroll.bonus,
      payment_mode: payroll.payment_mode || 'bank_transfer',
      paid_from: resolveBankAccountSelection(payroll.bank_account_id, bankAccounts),
      reference: payroll.reference || '',
      notes: payroll.notes || '',
      status: payroll.status || 'paid',
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingPayroll) return
    try {
      const res = await apiFetch(`/payroll/${editingPayroll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: new Date(editFormData.payment_date).toISOString(),
          deductions: editFormData.deductions,
          bonus: editFormData.bonus,
          payment_mode: editFormData.payment_mode,
          bank_account_id: bankAccountIdForApi(editFormData.paid_from),
          reference: editFormData.reference,
          notes: editFormData.notes,
          status: editFormData.status,
        }),
      })
      if (res.ok) {
        setIsEditDialogOpen(false)
        setEditingPayroll(null)
        refreshData()
      }
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete payroll record?',
      description: 'Are you sure you want to delete this payroll record? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/payroll/${id}`, { method: 'DELETE' })
      if (res.ok) {
        refreshData()
      }
    } catch (err) { console.error(err) }
  }

  const handleSelectPayroll = (id: string) => {
    const next = new Set(selectedPayrolls)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedPayrolls(next)
  }

  const handleSelectAll = () => {
    if (selectedPayrolls.size === filteredPayrolls.length) {
      setSelectedPayrolls(new Set())
    } else {
      setSelectedPayrolls(new Set(filteredPayrolls.map((payroll) => payroll.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedPayrolls.size === 0) return
    if (!(await confirm({
      title: 'Delete payroll records?',
      description: `Are you sure you want to delete ${selectedPayrolls.size} payroll records? This action cannot be undone.`,
    }))) return
    try {
      const res = await apiFetch('/payroll/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedPayrolls) }),
      })
      if (res.ok) {
        setSelectedPayrolls(new Set())
        refreshData()
      }
    } catch (err) { console.error(err) }
  }

  const handleBulkStatus = (status: 'paid' | 'pending') => {
    if (selectedPayrolls.size === 0) return
    setBulkStatus(status)
    setIsBulkStatusConfirmOpen(true)
  }

  const confirmBulkStatus = async () => {
    try {
      const res = await apiFetch('/payroll/bulk/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedPayrolls),
          status: bulkStatus,
        }),
      })
      if (res.ok) {
        setSelectedPayrolls(new Set())
        setIsBulkStatusConfirmOpen(false)
        refreshData()
      }
    } catch (err) { console.error(err) }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  // Attendance-based salary preview — mirrors the backend calc. When no
  // attendance exists for the period the full basic salary is payable.
  const selectedStaffType = staffs.find((s) => s.id === formData.staff_id)?.salary_type || payrollCalc?.salary_type || 'monthly'
  const calcDailyRate = selectedStaffType === 'monthly' ? formData.basic_salary / 30 : formData.basic_salary
  const calculatedPayable = payrollCalc && payrollCalc.working_days > 0
    ? payrollCalc.payable_days * calcDailyRate
    : formData.basic_salary
  const periodDeductions = payrollCalc?.period_deductions || 0
  const estimatedNet = Math.max(0, calculatedPayable - formData.deductions - periodDeductions - advanceRecovery + formData.bonus)

  const handleExport = async () => {
    const exportList =
      selectedPayrolls.size > 0
        ? filteredPayrolls.filter((payroll) => selectedPayrolls.has(payroll.id))
        : filteredPayrolls

    const rows: (string | number)[][] = [
      [
        'Payment No',
        'Staff',
        'Designation',
        'Period Start',
        'Period End',
        'Payment Date',
        'Present Days',
        'Absent Days',
        'Half Days',
        'Paid Leave Days',
        'Weekly Off Days',
        'Basic Salary',
        'Deductions',
        'Bonus',
        'Net Salary',
        'Paid Amount',
        'Balance Due',
        'Payment Mode',
        'Paid From',
        'Reference',
        'Status',
        'Notes',
        'Created',
        'Last Updated',
      ],
      ...exportList.map((payroll) => [
        payroll.payment_number,
        payroll.staff?.name || '',
        payroll.staff?.designation || '',
        payroll.start_date ? formatDate(payroll.start_date) : '',
        payroll.end_date ? formatDate(payroll.end_date) : '',
        payroll.payment_date ? formatDate(payroll.payment_date) : '',
        payroll.present_days,
        payroll.absent_days,
        payroll.half_days,
        payroll.paid_leave_days,
        payroll.weekly_off_days,
        payroll.basic_salary,
        payroll.deductions,
        payroll.bonus,
        payroll.net_salary,
        payroll.paid_amount || 0,
        Math.max(0, payroll.net_salary - (payroll.paid_amount || 0)),
        formatPaymentMode(payroll.payment_mode),
        formatPaidFrom(payroll),
        payroll.reference || '',
        payroll.status,
        payroll.notes || '',
        payroll.created_at ? formatDate(payroll.created_at) : '',
        payroll.updated_at ? formatDate(payroll.updated_at) : '',
      ]),
    ]
    await downloadCsv(`payroll_${accountingExportDateStamp()}.csv`, rows, { label: 'Exporting payroll' })
  }

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
        <div className="app-page-subheader">
          <h1 className="app-page-title">Payroll Management</h1>
          <PageHeaderActions>
            <Button
              type="button"
              variant={showStats ? 'secondary' : 'outline'}
              className="gap-1.5"
              onClick={() => setShowStats((prev) => !prev)}
              aria-expanded={showStats}
              aria-controls="payroll-stats"
            >
              <BarChart3 className="h-4 w-4" />
              Stats
              {showStats ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={loading || filteredPayrolls.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}><Plus className="mr-2 h-4 w-4" /> Make Payment</Button>
          </PageHeaderActions>
        </div>

        {showStats && stats && (
          <div id="payroll-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryStat label="Total Payments" icon={DollarSign} value={formatCurrency(stats.total_payments)} />
            <SummaryStat tone="success" label="Total Payrolls" icon={Calendar} value={stats.total_payrolls} />
            <SummaryStat label="This Month" icon={Download} value={formatCurrency(stats.this_month)} />
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="mb-4">Payment History</CardTitle>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap flex-1">
                <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search payment no, staff, reference..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffs.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="Payment Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full sm:w-[160px]"
                  placeholder="From date"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full sm:w-[160px]"
                  placeholder="To date"
                />
              </div>
              {selectedPayrolls.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedPayrolls.size} selected</span>
                  <Button variant="outline" size="sm" onClick={() => handleBulkStatus('paid')}>
                    <Power className="mr-2 h-4 w-4" /> Mark Paid
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkStatus('pending')}>
                    <Power className="mr-2 h-4 w-4" /> Mark Pending
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[1400px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedPayrolls.size === filteredPayrolls.length && filteredPayrolls.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Payment No</TableHead>
                    <TableHead className="whitespace-nowrap">Staff</TableHead>
                    <TableHead className="whitespace-nowrap">Period</TableHead>
                    <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                    <TableHead className="whitespace-nowrap">Days</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Basic Salary</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Deductions</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Bonus</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Net Salary</TableHead>
                    <TableHead className="whitespace-nowrap">Mode</TableHead>
                    <TableHead className="whitespace-nowrap">Paid From</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPayrolls.has(p.id)}
                          onCheckedChange={() => handleSelectPayroll(p.id)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{p.payment_number}</TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="font-medium leading-5">{p.staff?.name}</div>
                        <div className="mt-0.5 text-xs text-gray-500">{p.staff?.designation}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-gray-700">
                        {formatDate(p.start_date)} – {formatDate(p.end_date)}
                        {p.is_settlement && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            All dues
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <span title="Present">P:{p.present_days}</span>
                          <span className="text-gray-300">·</span>
                          <span title="Absent">A:{p.absent_days}</span>
                          <span className="text-gray-300">·</span>
                          <span title="Half day">H:{p.half_days}</span>
                          <span className="text-gray-300">·</span>
                          <span title="Paid leave">L:{p.paid_leave_days}</span>
                          <span className="text-gray-300">·</span>
                          <span title="Weekly off">W:{p.weekly_off_days}</span>
                        </div>
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
                      <TableCell className="whitespace-nowrap">{formatPaymentMode(p.payment_mode)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-gray-700">{formatPaidFrom(p)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${payrollStatusBadge(p.status)}`}>
                          {p.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {payrollRemaining(p) > 0 && (
                              <DropdownMenuItem onClick={() => openPayDialog(p)}>
                                <Wallet className="mr-2 h-4 w-4" />
                                Record Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openPaymentHistory(p)}>
                              <History className="mr-2 h-4 w-4" />
                              Payment History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(p)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPayrolls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-gray-500">
                        {payrolls.length === 0 ? 'No payroll records found' : 'No payroll records match the selected filters.'}
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Make Payment - {paymentNumber}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Staff *</Label>
                  <Button
                    type="button"
                    variant={formData.payment_type === 'all_due' ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={!formData.staff_id}
                    onClick={() => setFormData({ ...formData, payment_type: 'all_due' })}
                  >
                    <Wallet className="mr-1.5 h-3.5 w-3.5" /> All Due
                  </Button>
                </div>
                <Select value={formData.staff_id} onValueChange={(v) => {
                  const staff = staffs.find(s => s.id === v)
                  setFormData({
                    ...formData,
                    staff_id: v,
                    basic_salary: staff?.salary || 0,
                  })
                }}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staffs.map(s => <SelectItem key={s.id} value={s.id}>{s.name} - {s.designation} ({formatCurrency(s.salary)}/{s.salary_type})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Payment Date *</Label><Input type="date" value={formData.payment_date} onChange={(e) => setFormData({...formData, payment_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>Payment Mode</Label>
                  <Select
                    value={formData.payment_mode}
                    onValueChange={(v) => {
                      const nextPaidFrom =
                        v === 'cash'
                          ? CASH_IN_HAND_ACCOUNT
                          : defaultBankAccountSelection(bankAccounts, primaryAccount)
                      setFormData({ ...formData, payment_mode: v, paid_from: nextPaidFrom })
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paid From *</Label>
                <Select
                  value={formData.paid_from}
                  onValueChange={(v) => setFormData({ ...formData, paid_from: v })}
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
                <p className="text-xs text-muted-foreground">
                  The paid amount will be deducted from this account and recorded as a Payroll expense.
                </p>
              </div>
              {formData.payment_type !== 'all_due' && (
                <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>End Date *</Label><Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Basic Salary</Label><Input type="number" value={formData.basic_salary} readOnly disabled className="bg-gray-50" /></div>
                <div className="space-y-2"><Label>Deductions</Label><Input type="number" value={formData.deductions} onChange={(e) => setFormData({...formData, deductions: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Bonus</Label><Input type="number" value={formData.bonus} onChange={(e) => setFormData({...formData, bonus: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2">
                  <Label>Advance Salary</Label>
                  <Input type="number" value={advanceRecovery} readOnly disabled className="bg-gray-50" />
                  <p className="text-xs text-muted-foreground">
                    {advanceRecoveryCount > 0
                      ? `${advanceRecoveryCount} outstanding advance${advanceRecoveryCount === 1 ? '' : 's'} will be deducted`
                      : 'No outstanding advances to deduct'}
                  </p>
                </div>
              </div>
              {formData.staff_id && (
                <div className="rounded-md border bg-blue-50 px-3 py-2 text-sm space-y-1">
                  {calcLoading ? (
                    <p className="text-blue-800">Calculating salary from attendance...</p>
                  ) : payrollCalc && payrollCalc.working_days > 0 ? (
                    <>
                      <p className="font-medium text-blue-900">
                        Attendance: {payrollCalc.payable_days} payable of {payrollCalc.working_days} recorded days
                      </p>
                      <p className="text-xs text-blue-800">
                        Present {payrollCalc.present_days} · Absent {payrollCalc.absent_days} · Half-day {payrollCalc.half_days} · Paid leave {payrollCalc.paid_leave_days} · Weekly off {payrollCalc.weekly_off_days}
                      </p>
                      <p className="text-blue-900">
                        Calculated salary: <span className="font-semibold">{formatCurrency(calculatedPayable)}</span>
                        <span className="ml-1 text-xs text-blue-800">
                          ({formatCurrency(formData.basic_salary)}{selectedStaffType === 'monthly' ? ' ÷ 30' : ''} × {payrollCalc.payable_days} payable days)
                        </span>
                      </p>
                    </>
                  ) : payrollCalc ? (
                    <p className="text-blue-900">
                      No attendance recorded in this period — full basic salary payable.
                    </p>
                  ) : (
                    <p className="text-blue-800">Salary calculation unavailable.</p>
                  )}
                  {periodDeductions > 0 && (
                    <p className="text-xs text-blue-800">Period deductions auto-applied: {formatCurrency(periodDeductions)}</p>
                  )}
                </div>
              )}
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-600">Estimated net: </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(estimatedNet)}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {payrollCalc && payrollCalc.working_days > 0
                    ? 'Calculated salary minus deductions and advance recovery, plus bonus.'
                    : 'Basic salary minus deductions and advance recovery, plus bonus.'}
                </span>
              </div>
                </>
              )}
              {formData.payment_type === 'all_due' && (
                <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm space-y-1">
                  {dueLoading ? (
                    <p className="text-amber-800">Loading pending dues...</p>
                  ) : dueInfo ? (
                    <>
                      <p className="font-medium text-amber-900">
                        Total dues: <span className="font-semibold tabular-nums">{formatCurrency(dueInfo.balance)}</span>
                      </p>
                      <p className="text-xs text-amber-800">
                        {dueInfo.payable_from_payrolls - dueInfo.salary_paid > 0 &&
                          `Unpaid payrolls ${formatCurrency(dueInfo.payable_from_payrolls - dueInfo.salary_paid)}`}
                        {dueInfo.earned_unpaid > 0 &&
                          ` · Earned unpaid ${formatCurrency(dueInfo.earned_unpaid)} (${dueInfo.uncovered_payable_days} days)`}
                        {dueInfo.advances_pending > 0 &&
                          ` · Advances −${formatCurrency(dueInfo.advances_pending)}`}
                        {dueInfo.deductions_pending > 0 &&
                          ` · Deductions −${formatCurrency(dueInfo.deductions_pending)}`}
                      </p>
                      <p className="text-xs text-amber-800">
                        Unpaid payrolls are settled first, then a settlement payroll covers the rest.
                      </p>
                    </>
                  ) : (
                    <p className="text-amber-800">Select a staff member to load pending dues.</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(v: 'full' | 'partial' | 'later' | 'all_due') =>
                      setFormData({
                        ...formData,
                        payment_type: v,
                        amount_paid: (v === 'partial' || v === 'all_due') && !formData.amount_paid
                          ? (v === 'all_due' ? Math.max(0, dueInfo?.balance || 0) : estimatedNet)
                          : formData.amount_paid,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Pay full amount</SelectItem>
                      <SelectItem value="partial">Partial payment</SelectItem>
                      <SelectItem value="all_due">All dues</SelectItem>
                      <SelectItem value="later">Record as pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.payment_type === 'partial' && (
                  <div className="space-y-2">
                    <Label>Amount Paid Now</Label>
                    <Input
                      type="number"
                      min={0}
                      max={estimatedNet}
                      value={formData.amount_paid}
                      onChange={(e) => setFormData({ ...formData, amount_paid: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Math.max(0, estimatedNet - formData.amount_paid))} stays payable
                    </p>
                  </div>
                )}
                {formData.payment_type === 'all_due' && (
                  <div className="space-y-2">
                    <Label>Amount Paid Now</Label>
                    <Input
                      type="number"
                      min={0}
                      max={dueInfo?.balance || 0}
                      value={formData.amount_paid}
                      onChange={(e) => setFormData({ ...formData, amount_paid: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Math.max(0, (dueInfo?.balance || 0) - formData.amount_paid))} stays due
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2"><Label>Reference</Label><Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="Transaction ID, Cheque No, etc." /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={formData.payment_type === 'all_due' && (dueLoading || !formData.staff_id)}
              >
                {formData.payment_type === 'later' ? 'Save as Pending' : 'Process Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Payroll - {editingPayroll?.payment_number}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={editFormData.payment_date}
                  onChange={(e) => setEditFormData({ ...editFormData, payment_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deductions</Label>
                  <Input
                    type="number"
                    value={editFormData.deductions}
                    onChange={(e) => setEditFormData({ ...editFormData, deductions: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bonus</Label>
                  <Input
                    type="number"
                    value={editFormData.bonus}
                    onChange={(e) => setEditFormData({ ...editFormData, bonus: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              {editingPayroll && (
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm space-y-0.5">
                  <div>
                    <span className="text-gray-600">Net salary: </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(Math.max(0, editingPayroll.basic_salary - editFormData.deductions + editFormData.bonus))}
                    </span>
                  </div>
                  {(editingPayroll.paid_amount || 0) > 0 && (
                    <div className="text-xs text-gray-500">
                      Paid {formatCurrency(editingPayroll.paid_amount || 0)} · Due{' '}
                      {formatCurrency(Math.max(0, Math.max(0, editingPayroll.basic_salary - editFormData.deductions + editFormData.bonus) - (editingPayroll.paid_amount || 0)))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select
                    value={editFormData.payment_mode}
                    onValueChange={(v) => {
                      const nextPaidFrom =
                        v === 'cash'
                          ? CASH_IN_HAND_ACCOUNT
                          : defaultBankAccountSelection(bankAccounts, primaryAccount)
                      setEditFormData({ ...editFormData, payment_mode: v, paid_from: nextPaidFrom })
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paid From</Label>
                <Select
                  value={editFormData.paid_from}
                  onValueChange={(v) => setEditFormData({ ...editFormData, paid_from: v })}
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
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={editFormData.reference}
                  onChange={(e) => setEditFormData({ ...editFormData, reference: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate}>Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Payment - {payingPayroll?.payment_number}</DialogTitle>
            </DialogHeader>
            {payingPayroll && (
              <div className="grid gap-4 py-4">
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-600">{payingPayroll.staff?.name}: </span>
                  <span className="font-semibold tabular-nums">
                    Due {formatCurrency(payrollRemaining(payingPayroll))}
                  </span>
                  <span className="text-gray-500">
                    {' '}of {formatCurrency(payingPayroll.net_salary)} net
                    {(payingPayroll.paid_amount || 0) > 0 && ` (paid ${formatCurrency(payingPayroll.paid_amount)})`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      min={0}
                      max={payrollRemaining(payingPayroll)}
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select
                      value={paymentForm.payment_mode}
                      onValueChange={(v) => {
                        const nextPaidFrom =
                          v === 'cash'
                            ? CASH_IN_HAND_ACCOUNT
                            : defaultBankAccountSelection(bankAccounts, primaryAccount)
                        setPaymentForm({ ...paymentForm, payment_mode: v, paid_from: nextPaidFrom })
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Paid From</Label>
                    <Select
                      value={paymentForm.paid_from}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, paid_from: v })}
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
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="Transaction ID, Cheque No, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRecordPayment}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment History - {historyPayroll?.payment_number}</DialogTitle>
            </DialogHeader>
            {historyPayroll && (
              <div className="py-2 space-y-3">
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-600">{historyPayroll.staff?.name}: </span>
                  <span className="font-semibold tabular-nums">
                    Paid {formatCurrency(historyPayroll.paid_amount || 0)}
                  </span>
                  <span className="text-gray-500"> of {formatCurrency(historyPayroll.net_salary)} net</span>
                  {payrollRemaining(historyPayroll) > 0 && (
                    <span className="text-blue-700"> · Due {formatCurrency(payrollRemaining(historyPayroll))}</span>
                  )}
                </div>
                {paymentsLoading ? (
                  <p className="py-6 text-center text-sm text-gray-500">Loading payments...</p>
                ) : payrollPayments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No payments recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Paid From</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap font-medium">{payment.payment_number}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(payment.payment_date)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPaymentMode(payment.payment_mode)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-gray-700">
                            {payment.bank_account?.account_name || (payment.bank_account_id ? 'Bank account' : 'Cash in-hand')}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-gray-700">{payment.reference || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600"
                              onClick={() => handleDeletePayment(payment.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Close</Button>
              {historyPayroll && payrollRemaining(historyPayroll) > 0 && (
                <Button onClick={() => { setIsHistoryOpen(false); openPayDialog(historyPayroll) }}>
                  Record Payment
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkStatusConfirmOpen} onOpenChange={setIsBulkStatusConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk Status Update</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Mark {selectedPayrolls.size} payroll records as {bulkStatus}?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusConfirmOpen(false)}>Cancel</Button>
              <Button onClick={confirmBulkStatus}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
