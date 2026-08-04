'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useFormErrors } from '@/hooks/useFormErrors'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Edit, Trash2, Search, Download, MoreVertical, Power } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

interface WarehouseData {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  pincode: string
  contact_person: string
  contact_phone: string
  contact_email: string
  is_active: boolean
  is_default: boolean
  notes: string
  created_at: string
}

export default function WarehousesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { showSuccessToast, showErrorToast } = useFormErrors()
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [selectedWarehouses, setSelectedWarehouses] = useState<Set<string>>(new Set())
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
  const [isBulkStatusConfirmOpen, setIsBulkStatusConfirmOpen] = useState(false)
  const [bulkStatusAction, setBulkStatusAction] = useState<'enable' | 'disable'>('enable')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null)
  const [newWarehouse, setNewWarehouse] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    is_default: false,
    notes: ''
  })

  useEffect(() => { if (!authLoading && user) fetchWarehouses() }, [authLoading, user])
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true)
      router.replace('/warehouses', { scroll: false })
    }
  }, [searchParams, router])

  const filteredWarehouses = warehouses.filter((warehouse) => {
    const query = search.toLowerCase()
    const matchesSearch =
      !search ||
      warehouse.name.toLowerCase().includes(query) ||
      warehouse.code.toLowerCase().includes(query) ||
      warehouse.city?.toLowerCase().includes(query) ||
      warehouse.state?.toLowerCase().includes(query) ||
      warehouse.contact_person?.toLowerCase().includes(query) ||
      warehouse.contact_phone?.includes(search) ||
      warehouse.contact_email?.toLowerCase().includes(query)

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && warehouse.is_active) ||
      (statusFilter === 'inactive' && !warehouse.is_active)

    const matchesState = stateFilter === 'all' || warehouse.state === stateFilter

    return matchesSearch && matchesStatus && matchesState
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredWarehouses)

  useEffect(() => {
    resetPage()
    setSelectedWarehouses(new Set())
  }, [search, statusFilter, stateFilter])

  const states = [...new Set(warehouses.map((warehouse) => warehouse.state).filter(Boolean))].sort()

  const deletableSelectedCount = Array.from(selectedWarehouses).filter((id) => {
    const warehouse = warehouses.find((item) => item.id === id)
    return warehouse && !warehouse.is_default
  }).length

  const handleSelectWarehouse = (id: string) => {
    const next = new Set(selectedWarehouses)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedWarehouses(next)
  }

  const handleSelectAll = () => {
    if (selectedWarehouses.size === filteredWarehouses.length) {
      setSelectedWarehouses(new Set())
    } else {
      setSelectedWarehouses(new Set(filteredWarehouses.map((warehouse) => warehouse.id)))
    }
  }

  const handleBulkDelete = () => {
    if (deletableSelectedCount === 0) return
    setIsBulkDeleteConfirmOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      const res = await apiFetch('/warehouses/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedWarehouses) }),
      })
      if (res.ok) {
        setSelectedWarehouses(new Set())
        setIsBulkDeleteConfirmOpen(false)
        fetchWarehouses()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkStatus = (action: 'enable' | 'disable') => {
    if (selectedWarehouses.size === 0) return
    setBulkStatusAction(action)
    setIsBulkStatusConfirmOpen(true)
  }

  const confirmBulkStatus = async () => {
    try {
      const res = await apiFetch('/warehouses/bulk/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedWarehouses),
          is_active: bulkStatusAction === 'enable',
        }),
      })
      if (res.ok) {
        setSelectedWarehouses(new Set())
        setIsBulkStatusConfirmOpen(false)
        fetchWarehouses()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleExport = () => {
    const exportList =
      selectedWarehouses.size > 0
        ? filteredWarehouses.filter((warehouse) => selectedWarehouses.has(warehouse.id))
        : filteredWarehouses
    const rows: (string | number)[][] = [
      [
        'Code',
        'Name',
        'Address',
        'City',
        'State',
        'Pincode',
        'Contact Person',
        'Contact Phone',
        'Contact Email',
        'Status',
        'Default',
        'Notes',
        'Created',
      ],
      ...exportList.map((warehouse) => [
        warehouse.code,
        warehouse.name,
        warehouse.address || '',
        warehouse.city || '',
        warehouse.state || '',
        warehouse.pincode || '',
        warehouse.contact_person || '',
        warehouse.contact_phone || '',
        warehouse.contact_email || '',
        warehouse.is_active ? 'Active' : 'Inactive',
        warehouse.is_default ? 'Yes' : 'No',
        warehouse.notes || '',
        warehouse.created_at ? formatDate(warehouse.created_at) : '',
      ]),
    ]
    downloadCsv(`warehouses_${accountingExportDateStamp()}.csv`, rows)
  }

  const fetchWarehouses = async () => {
    try {
      const res = await apiFetch('/warehouses')
      if (res.ok) {
        const d = await res.json()
        setWarehouses(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [])
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleCreateWarehouse = async () => {
    if (!newWarehouse.name.trim() || !newWarehouse.code.trim()) {
      showErrorToast('Warehouse name and code are required')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch('/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newWarehouse,
          name: newWarehouse.name.trim(),
          code: newWarehouse.code.trim().toUpperCase(),
        }),
      })
      if (res.ok) {
        setShowCreateModal(false)
        setNewWarehouse({
          name: '',
          code: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          contact_person: '',
          contact_phone: '',
          contact_email: '',
          is_default: false,
          notes: ''
        })
        showSuccessToast('Warehouse created')
        fetchWarehouses()
      } else {
        const err = await res.json().catch(() => ({}))
        showErrorToast(err.error || 'Failed to create warehouse')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to create warehouse')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateWarehouse = async () => {
    if (!editingWarehouse) return
    if (!newWarehouse.name.trim() || !newWarehouse.code.trim()) {
      showErrorToast('Warehouse name and code are required')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch(`/warehouses/${editingWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newWarehouse,
          name: newWarehouse.name.trim(),
          code: newWarehouse.code.trim().toUpperCase(),
        }),
      })
      if (res.ok) {
        setShowEditModal(false)
        setEditingWarehouse(null)
        setNewWarehouse({
          name: '',
          code: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          contact_person: '',
          contact_phone: '',
          contact_email: '',
          is_default: false,
          notes: ''
        })
        showSuccessToast('Warehouse updated')
        fetchWarehouses()
      } else {
        const err = await res.json().catch(() => ({}))
        showErrorToast(err.error || 'Failed to update warehouse')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to update warehouse')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this warehouse?')) return
    try {
      const res = await apiFetch(`/warehouses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccessToast('Warehouse deleted')
        fetchWarehouses()
      } else {
        const err = await res.json().catch(() => ({}))
        showErrorToast(err.error || 'Failed to delete warehouse')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to delete warehouse')
    }
  }

  const handleEditClick = (warehouse: WarehouseData) => {
    setEditingWarehouse(warehouse)
    setNewWarehouse({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address,
      city: warehouse.city,
      state: warehouse.state,
      pincode: warehouse.pincode,
      contact_person: warehouse.contact_person,
      contact_phone: warehouse.contact_phone,
      contact_email: warehouse.contact_email,
      is_default: warehouse.is_default,
      notes: warehouse.notes
    })
    setShowEditModal(true)
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Warehouses / Outlets</h1>
            <p className="text-gray-500">Manage your storage locations and outlets</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || filteredWarehouses.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Warehouse
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Warehouse</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Warehouse Name *</Label>
                    <Input
                      id="name"
                      value={newWarehouse.name}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                      placeholder="Main Warehouse"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code *</Label>
                    <Input
                      id="code"
                      value={newWarehouse.code}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value.toUpperCase() })}
                      placeholder="WH01"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newWarehouse.address}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                    placeholder="123 Business Street"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newWarehouse.city}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                      placeholder="Mumbai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={newWarehouse.state}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, state: e.target.value })}
                      placeholder="Maharashtra"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={newWarehouse.pincode}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, pincode: e.target.value })}
                      placeholder="400001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={newWarehouse.contact_person}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_person: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Contact Phone</Label>
                    <Input
                      id="contact_phone"
                      value={newWarehouse.contact_phone}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_phone: e.target.value })}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Contact Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={newWarehouse.contact_email}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_email: e.target.value })}
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={newWarehouse.notes}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_default"
                    checked={newWarehouse.is_default}
                    onCheckedChange={(checked) => setNewWarehouse({ ...newWarehouse, is_default: checked })}
                  />
                  <Label htmlFor="is_default">Set as Default Warehouse</Label>
                </div>

                <Button onClick={handleCreateWarehouse} className="w-full" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Warehouse'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          {selectedWarehouses.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <span className="text-sm text-gray-600">{selectedWarehouses.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('enable')}>
                <Power className="mr-2 h-4 w-4" />
                Enable
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('disable')}>
                <Power className="mr-2 h-4 w-4" />
                Disable
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deletableSelectedCount === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete{deletableSelectedCount > 0 ? ` (${deletableSelectedCount})` : ''}
              </Button>
            </div>
          )}
          <CardHeader className="pb-4">
            <CardTitle className="mb-4">All Warehouses</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by name, code, city, contact..."
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
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedWarehouses.size === filteredWarehouses.length && filteredWarehouses.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      No warehouses found. Create your first warehouse to get started.
                    </TableCell>
                  </TableRow>
                ) : filteredWarehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      No warehouses match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedWarehouses.has(warehouse.id)}
                          onCheckedChange={() => handleSelectWarehouse(warehouse.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{warehouse.code}</TableCell>
                      <TableCell>{warehouse.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {warehouse.city && <div>{warehouse.city}</div>}
                          {warehouse.state && <div className="text-gray-500">{warehouse.state}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {warehouse.contact_person && <div>{warehouse.contact_person}</div>}
                          {warehouse.contact_phone && <div className="text-gray-500">{warehouse.contact_phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${warehouse.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {warehouse.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {warehouse.is_default && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Default
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(warehouse)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {!warehouse.is_default && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteWarehouse(warehouse.id)}
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
                  ))
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

        {/* Edit Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Warehouse</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Warehouse Name *</Label>
                  <Input
                    id="edit_name"
                    value={newWarehouse.name}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                    placeholder="Main Warehouse"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_code">Code *</Label>
                  <Input
                    id="edit_code"
                    value={newWarehouse.code}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value.toUpperCase() })}
                    placeholder="WH01"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_address">Address</Label>
                <Input
                  id="edit_address"
                  value={newWarehouse.address}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                  placeholder="123 Business Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_city">City</Label>
                  <Input
                    id="edit_city"
                    value={newWarehouse.city}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_state">State</Label>
                  <Input
                    id="edit_state"
                    value={newWarehouse.state}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, state: e.target.value })}
                    placeholder="Maharashtra"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_pincode">Pincode</Label>
                  <Input
                    id="edit_pincode"
                    value={newWarehouse.pincode}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, pincode: e.target.value })}
                    placeholder="400001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_contact_person">Contact Person</Label>
                <Input
                  id="edit_contact_person"
                  value={newWarehouse.contact_person}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_person: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_phone">Contact Phone</Label>
                  <Input
                    id="edit_contact_phone"
                    value={newWarehouse.contact_phone}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_phone: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_email">Contact Email</Label>
                  <Input
                    id="edit_contact_email"
                    type="email"
                    value={newWarehouse.contact_email}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_email: e.target.value })}
                    placeholder="contact@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_notes">Notes</Label>
                <Input
                  id="edit_notes"
                  value={newWarehouse.notes}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_default"
                  checked={newWarehouse.is_default}
                  onCheckedChange={(checked) => setNewWarehouse({ ...newWarehouse, is_default: checked })}
                />
                <Label htmlFor="edit_is_default">Set as Default Warehouse</Label>
              </div>

              <Button onClick={handleUpdateWarehouse} className="w-full" disabled={saving}>
                {saving ? 'Updating...' : 'Update Warehouse'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk Delete</DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              Delete {deletableSelectedCount} selected warehouse{deletableSelectedCount === 1 ? '' : 's'}?
              Default warehouses will be skipped and cannot be deleted.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmBulkDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkStatusConfirmOpen} onOpenChange={setIsBulkStatusConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {bulkStatusAction === 'enable' ? 'Enable Warehouses' : 'Disable Warehouses'}
              </DialogTitle>
            </DialogHeader>
            <p className="py-4 text-sm text-gray-600">
              {bulkStatusAction === 'enable'
                ? `Enable ${selectedWarehouses.size} selected warehouse${selectedWarehouses.size === 1 ? '' : 's'}?`
                : `Disable ${selectedWarehouses.size} selected warehouse${selectedWarehouses.size === 1 ? '' : 's'}?`}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkStatusConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmBulkStatus}>
                {bulkStatusAction === 'enable' ? 'Enable' : 'Disable'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
