'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
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
import { Plus, DollarSign, Calendar, Download, Search, MoreVertical, Pencil, Trash2, Power } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { formatDate } from '@/lib/utils'
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
  payment_mode: string
  bank_account_id?: string | null
  bank_account?: BankAccountInfo | null
  expense_id?: string | null
  reference: string
  notes: string
  status: string
  created_at?: string
  updated_at?: string
}

interface PayrollStats {
  total_payments: number
  total_payrolls: number
  this_month: number
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
] as const

const STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
] as const

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
  const [staffs, setStaffs] = useState<Staff[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [stats, setStats] = useState<PayrollStats | null>(null)
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [payrollToDelete, setPayrollToDelete] = useState<string | null>(null)
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
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
    payment_mode: 'bank_transfer',
    paid_from: CASH_IN_HAND_ACCOUNT,
    reference: '',
    notes: ''
  })
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
          payment_mode: formData.payment_mode,
          bank_account_id: bankAccountIdForApi(formData.paid_from),
          reference: formData.reference,
          notes: formData.notes,
          status: 'paid',
        })
      })
      if (res.ok) { setIsDialogOpen(false); resetForm(); refreshData(); fetchNextNumber() }
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
      payment_mode: 'bank_transfer',
      paid_from: defaultBankAccountSelection(bankAccounts, primaryAccount),
      reference: '',
      notes: ''
    })
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

  const handleDelete = (id: string) => {
    setPayrollToDelete(id)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!payrollToDelete) return
    try {
      const res = await apiFetch(`/payroll/${payrollToDelete}`, { method: 'DELETE' })
      if (res.ok) {
        setIsDeleteConfirmOpen(false)
        setPayrollToDelete(null)
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

  const handleBulkDelete = () => {
    if (selectedPayrolls.size === 0) return
    setIsBulkDeleteConfirmOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      const res = await apiFetch('/payroll/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedPayrolls) }),
      })
      if (res.ok) {
        setSelectedPayrolls(new Set())
        setIsBulkDeleteConfirmOpen(false)
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

  const handleExport = () => {
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
        formatPaymentMode(payroll.payment_mode),
        formatPaidFrom(payroll),
        payroll.reference || '',
        payroll.status,
        payroll.notes || '',
        payroll.created_at ? formatDate(payroll.created_at) : '',
        payroll.updated_at ? formatDate(payroll.updated_at) : '',
      ]),
    ]
    downloadCsv(`payroll_${accountingExportDateStamp()}.csv`, rows)
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading || filteredPayrolls.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}><Plus className="mr-2 h-4 w-4" /> Make Payment</Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(stats.total_payments)}</div>
                    <div className="text-sm text-gray-600">Total Payments</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.total_payrolls}</div>
                    <div className="text-sm text-gray-600">Total Payrolls</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(stats.this_month)}</div>
                    <div className="text-sm text-gray-600">This Month</div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <div className="overflow-x-auto">
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
                      <TableCell className="whitespace-nowrap text-right tabular-nums font-semibold">{formatCurrency(p.net_salary)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatPaymentMode(p.payment_mode)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-gray-700">{formatPaidFrom(p)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
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
            </div>
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
                <Label>Staff *</Label>
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
                  Net salary will be deducted from this account and recorded as a Payroll expense.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>End Date *</Label><Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Basic Salary</Label><Input type="number" value={formData.basic_salary} onChange={(e) => setFormData({...formData, basic_salary: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Deductions</Label><Input type="number" value={formData.deductions} onChange={(e) => setFormData({...formData, deductions: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Bonus</Label><Input type="number" value={formData.bonus} onChange={(e) => setFormData({...formData, bonus: parseFloat(e.target.value) || 0})} /></div>
              </div>
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-600">Estimated net: </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(Math.max(0, formData.basic_salary - formData.deductions + formData.bonus))}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Final net may adjust if attendance, deductions, or advances exist for the period.
                </span>
              </div>
              <div className="space-y-2"><Label>Reference</Label><Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="Transaction ID, Cheque No, etc." /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Process Payment</Button>
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
                <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-600">Net salary: </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(Math.max(0, editingPayroll.basic_salary - editFormData.deductions + editFormData.bonus))}
                  </span>
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

        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Are you sure you want to delete this payroll record? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirm Bulk Delete</DialogTitle></DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Are you sure you want to delete {selectedPayrolls.size} payroll records? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmBulkDelete}>Delete</Button>
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
      </div>
    </DashboardLayout>
  )
}
