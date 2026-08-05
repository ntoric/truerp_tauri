'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
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
import { Plus, Pencil, Trash2, Search, MoreVertical, Power, Download } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

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
  aadhar_number?: string
  pan_number?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export default function StaffPage() {
  const { user, loading: authLoading } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [staffs, setStaffs] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [designationFilter, setDesignationFilter] = useState('all')
  const [salaryTypeFilter, setSalaryTypeFilter] = useState('all')
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [isBulkStatusConfirmOpen, setIsBulkStatusConfirmOpen] = useState(false)
  const [bulkStatusAction, setBulkStatusAction] = useState<'enable' | 'disable'>('disable')
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false)
  const [staffToToggle, setStaffToToggle] = useState<Staff | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    designation: '',
    department: '',
    joining_date: '',
    salary: 0,
    salary_type: 'monthly',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    aadhar_number: '',
    pan_number: '',
    notes: ''
  })

  useEffect(() => { if (!authLoading && user) fetchStaffs() }, [authLoading, user])

  const fetchStaffs = async () => {
    try {
      const res = await apiFetch('/staff')
      if (res.ok) setStaffs(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      notifyError('Staff name is required')
      return
    }
    try {
      const url = editingStaff ? `/staff/${editingStaff.id}` : '/staff'
      const method = editingStaff ? 'PUT' : 'POST'
      const payload = {
        ...formData,
        name: formData.name.trim(),
        joining_date: formData.joining_date
          ? new Date(formData.joining_date).toISOString()
          : null,
        is_active: editingStaff ? editingStaff.is_active : true,
      }
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setIsDialogOpen(false)
        setEditingStaff(null)
        resetForm()
        fetchStaffs()
        notifySuccess(editingStaff ? 'Staff updated successfully' : 'Staff created successfully')
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to save staff')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to save staff')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      designation: '',
      department: '',
      joining_date: '',
      salary: 0,
      salary_type: 'monthly',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      aadhar_number: '',
      pan_number: '',
      notes: ''
    })
  }

  const handleEdit = (s: Staff) => {
    setEditingStaff(s)
    setFormData({
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: '',
      designation: s.designation,
      department: s.department,
      joining_date: s.joining_date?.split('T')[0] || '',
      salary: s.salary,
      salary_type: s.salary_type,
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      aadhar_number: '',
      pan_number: '',
      notes: ''
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete staff member?',
      description: 'Are you sure you want to delete this staff member? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/staff/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchStaffs()
      }
    } catch (err) { console.error(err) }
  }

  const handleToggleActive = (s: Staff) => {
    setStaffToToggle(s)
    setIsStatusConfirmOpen(true)
  }

  const confirmToggleActive = async () => {
    if (!staffToToggle) return
    try {
      const res = await apiFetch('/staff/bulk/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [staffToToggle.id],
          is_active: !staffToToggle.is_active,
        }),
      })
      if (res.ok) {
        setIsStatusConfirmOpen(false)
        setStaffToToggle(null)
        fetchStaffs()
      }
    } catch (err) { console.error(err) }
  }

  const handleSelectStaff = (id: string) => {
    const next = new Set(selectedStaff)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStaff(next)
  }

  const handleSelectAll = () => {
    if (selectedStaff.size === filteredStaffs.length) {
      setSelectedStaff(new Set())
    } else {
      setSelectedStaff(new Set(filteredStaffs.map((s) => s.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedStaff.size === 0) return
    if (!(await confirm({
      title: 'Delete staff members?',
      description: `Are you sure you want to delete ${selectedStaff.size} staff members? This action cannot be undone.`,
    }))) return
    try {
      const res = await apiFetch('/staff/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedStaff) }),
      })
      if (res.ok) {
        setSelectedStaff(new Set())
        fetchStaffs()
      }
    } catch (err) { console.error(err) }
  }

  const handleBulkStatus = (action: 'enable' | 'disable') => {
    if (selectedStaff.size === 0) return
    setBulkStatusAction(action)
    setIsBulkStatusConfirmOpen(true)
  }

  const confirmBulkStatus = async () => {
    try {
      const res = await apiFetch('/staff/bulk/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedStaff),
          is_active: bulkStatusAction === 'enable',
        }),
      })
      if (res.ok) {
        setSelectedStaff(new Set())
        setIsBulkStatusConfirmOpen(false)
        fetchStaffs()
      }
    } catch (err) { console.error(err) }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  const formatSalaryType = (salaryType: string) => {
    if (salaryType === 'daily') return 'Daily'
    if (salaryType === 'hourly') return 'Hourly'
    return 'Monthly'
  }

  const filteredStaffs = staffs.filter((s) => {
    const query = search.toLowerCase()
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(query) ||
      s.phone?.includes(search) ||
      s.email?.toLowerCase().includes(query) ||
      s.designation?.toLowerCase().includes(query) ||
      s.department?.toLowerCase().includes(query)

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.is_active) ||
      (statusFilter === 'inactive' && !s.is_active)

    const matchesDepartment =
      departmentFilter === 'all' || s.department === departmentFilter

    const matchesDesignation =
      designationFilter === 'all' || s.designation === designationFilter

    const matchesSalaryType =
      salaryTypeFilter === 'all' || s.salary_type === salaryTypeFilter

    return matchesSearch && matchesStatus && matchesDepartment && matchesDesignation && matchesSalaryType
  })

  const departments = [...new Set(staffs.map((s) => s.department).filter(Boolean))].sort()
  const designations = [...new Set(staffs.map((s) => s.designation).filter(Boolean))].sort()

  const handleExport = () => {
    const exportList =
      selectedStaff.size > 0
        ? filteredStaffs.filter((s) => selectedStaff.has(s.id))
        : filteredStaffs

    const rows: (string | number)[][] = [
      [
        'Name',
        'Phone',
        'Email',
        'Designation',
        'Department',
        'Joining Date',
        'Salary',
        'Salary Type',
        'Status',
        'Address',
        'Bank Name',
        'Account Number',
        'IFSC Code',
        'Aadhar Number',
        'PAN Number',
        'Notes',
        'Created',
        'Last Updated',
      ],
      ...exportList.map((s) => [
        s.name,
        s.phone || '',
        s.email || '',
        s.designation || '',
        s.department || '',
        s.joining_date ? formatDate(s.joining_date) : '',
        s.salary,
        formatSalaryType(s.salary_type),
        s.is_active ? 'Active' : 'Inactive',
        s.address || '',
        s.bank_name || '',
        s.account_number || '',
        s.ifsc_code || '',
        s.aadhar_number || '',
        s.pan_number || '',
        s.notes || '',
        s.created_at ? formatDate(s.created_at) : '',
        s.updated_at ? formatDate(s.updated_at) : '',
      ]),
    ]
    downloadCsv(`staff_${accountingExportDateStamp()}.csv`, rows)
  }

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredStaffs)

  useEffect(() => {
    resetPage()
    setSelectedStaff(new Set())
  }, [search, statusFilter, departmentFilter, designationFilter, salaryTypeFilter])

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading || filteredStaffs.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button onClick={() => { setEditingStaff(null); resetForm(); setIsDialogOpen(true) }}><Plus className="mr-2 h-4 w-4" /> Add Staff</Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, email..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
              <Select value={salaryTypeFilter} onValueChange={setSalaryTypeFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Salary Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Salary Types</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          {selectedStaff.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <span className="text-sm text-gray-600">{selectedStaff.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('enable')}>
                <Power className="mr-2 h-4 w-4" /> Enable
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('disable')}>
                <Power className="mr-2 h-4 w-4" /> Disable
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          )}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedStaff.size === filteredStaffs.length && filteredStaffs.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added Date</TableHead>
                  <TableHead>Updated Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStaff.has(s.id)}
                        onCheckedChange={() => handleSelectStaff(s.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.phone}</TableCell>
                    <TableCell>{s.designation}</TableCell>
                    <TableCell>{s.department}</TableCell>
                    <TableCell>{formatCurrency(s.salary)}/{s.salary_type === 'monthly' ? 'mo' : s.salary_type === 'daily' ? 'day' : 'hr'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {s.created_at ? formatDate(s.created_at) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {s.updated_at ? formatDate(s.updated_at) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(s)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(s)}>
                            <Power className="mr-2 h-4 w-4" />
                            {s.is_active ? 'Disable' : 'Enable'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(s.id)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStaffs.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">No staff found</TableCell></TableRow>}
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
            <DialogHeader><DialogTitle>{editingStaff ? 'Edit Staff' : 'Add Staff'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                <div className="space-y-2"><Label>Designation</Label><Input value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} /></div>
                <div className="space-y-2"><Label>Department</Label><Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} /></div>
                <div className="space-y-2"><Label>Joining Date</Label><Input type="date" value={formData.joining_date} onChange={(e) => setFormData({...formData, joining_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>Salary</Label><Input type="number" value={formData.salary} onChange={(e) => setFormData({...formData, salary: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Salary Type</Label>
                  <Select value={formData.salary_type} onValueChange={(v) => setFormData({...formData, salary_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="hourly">Hourly</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Bank Name</Label><Input value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Account Number</Label><Input value={formData.account_number} onChange={(e) => setFormData({...formData, account_number: e.target.value})} /></div>
                <div className="space-y-2"><Label>IFSC Code</Label><Input value={formData.ifsc_code} onChange={(e) => setFormData({...formData, ifsc_code: e.target.value})} /></div>
                <div className="space-y-2"><Label>Aadhar Number</Label><Input value={formData.aadhar_number} onChange={(e) => setFormData({...formData, aadhar_number: e.target.value})} /></div>
                <div className="space-y-2"><Label>PAN Number</Label><Input value={formData.pan_number} onChange={(e) => setFormData({...formData, pan_number: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingStaff ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkStatusConfirmOpen} onOpenChange={setIsBulkStatusConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk {bulkStatusAction === 'enable' ? 'Enable' : 'Disable'}</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Are you sure you want to {bulkStatusAction} {selectedStaff.size} staff members?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusConfirmOpen(false)}>Cancel</Button>
              <Button onClick={confirmBulkStatus}>{bulkStatusAction === 'enable' ? 'Enable' : 'Disable'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isStatusConfirmOpen} onOpenChange={setIsStatusConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm {staffToToggle?.is_active ? 'Disable' : 'Enable'}</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Are you sure you want to {staffToToggle?.is_active ? 'disable' : 'enable'} {staffToToggle?.name}?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStatusConfirmOpen(false)}>Cancel</Button>
              <Button onClick={confirmToggleActive}>{staffToToggle?.is_active ? 'Disable' : 'Enable'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
