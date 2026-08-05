'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, cn, formatDate } from '@/lib/utils'
import { mergePartyCategories } from '@/lib/partyCategories'
import {
  EMPTY_PARTY_FORM,
  firstValidationMessage,
  validatePartyForm,
} from '@/lib/partyValidation'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { Plus, Search, Phone, ArrowUp, ArrowDown, Trash2, Edit, MoreVertical, Download } from 'lucide-react'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface Party {
  id: string
  name: string
  phone: string
  email: string
  category: string
  party_type: string
  balance: number
  city: string
  state: string
  gstin: string
  address: string
  pincode: string
  credit_limit: number
  loyalty_points?: number
  tan: string
  pan: string
  notes: string
  created_at?: string
  updated_at?: string
}

interface PartyStats {
  total_parties: number
  to_collect: number
  to_pay: number
}

export default function PartiesPage() {
  const {
    fieldErrors,
    setFieldErrors,
    clearErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [parties, setParties] = useState<Party[]>([])
  const [stats, setStats] = useState<PartyStats>({ total_parties: 0, to_collect: 0, to_pay: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedParties, setSelectedParties] = useState<Set<string>>(new Set())
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingParty, setEditingParty] = useState<Party | null>(null)
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [isCategoryUpdateConfirmOpen, setIsCategoryUpdateConfirmOpen] = useState(false)
  const [formData, setFormData] = useState({ ...EMPTY_PARTY_FORM })

  const updateFormField = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    clearFieldError(field)
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetCreateForm = () => {
    clearErrors()
    setFormData({ ...EMPTY_PARTY_FORM })
  }

  const handleCreateModalChange = (open: boolean) => {
    setIsCreateModalOpen(open)
    if (!open) resetCreateForm()
  }

  useEffect(() => {
    fetchParties()
    fetchStats()
  }, [])

  const fetchParties = async () => {
    try {
      const res = await apiFetch('/parties')
      if (res.ok) setParties(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await apiFetch('/parties/stats')
      if (res.ok) setStats(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const filteredParties = parties.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || !categoryFilter || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredParties)

  useEffect(() => {
    resetPage()
  }, [search, categoryFilter])

  const categories = mergePartyCategories(parties.map((p) => p.category))

  const handleExport = () => {
    const rows: (string | number)[][] = [
      [
        'Name',
        'Category',
        'Mobile',
        'Email',
        'Party Type',
        'Balance',
        'Credit Limit',
        'Loyalty Points',
        'GSTIN',
        'PAN',
        'TAN',
        'City',
        'State',
        'Pincode',
        'Address',
        'Notes',
        'Created',
        'Last Updated',
      ],
      ...filteredParties.map((p) => [
        p.name,
        p.category || '',
        p.phone || '',
        p.email || '',
        p.party_type === 'customer' ? 'Customer' : 'Vendor',
        p.balance,
        p.credit_limit,
        p.party_type === 'customer' ? p.loyalty_points ?? 0 : '',
        p.gstin || '',
        p.pan || '',
        p.tan || '',
        p.city || '',
        p.state || '',
        p.pincode || '',
        p.address || '',
        p.notes || '',
        p.created_at ? formatDate(p.created_at) : '',
        p.updated_at ? formatDate(p.updated_at) : '',
      ]),
    ]
    downloadCsv(`parties_${accountingExportDateStamp()}.csv`, rows)
  }

  const handleSelectParty = (id: string) => {
    const newSelected = new Set(selectedParties)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedParties(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedParties.size === filteredParties.length) {
      setSelectedParties(new Set())
    } else {
      setSelectedParties(new Set(filteredParties.map(p => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedParties.size === 0) return
    if (!(await confirm({
      title: 'Delete parties?',
      description: `Are you sure you want to delete ${selectedParties.size} parties? This action cannot be undone.`,
    }))) return
    try {
      const res = await apiFetch('/parties/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedParties) })
      })
      if (res.ok) {
        setSelectedParties(new Set())
        fetchParties()
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkUpdateCategory = () => {
    if (selectedParties.size === 0 || !bulkCategory) return
    setIsCategoryUpdateConfirmOpen(true)
  }

  const confirmCategoryUpdate = async () => {
    try {
      const res = await apiFetch('/parties/bulk/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedParties), category: bulkCategory })
      })
      if (res.ok) {
        setSelectedParties(new Set())
        setBulkCategory('')
        setIsBulkCategoryModalOpen(false)
        setIsCategoryUpdateConfirmOpen(false)
        fetchParties()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateParty = async () => {
    const errors = validatePartyForm(formData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }

    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        pan: formData.pan.trim().toUpperCase(),
        tan: formData.tan.trim().toUpperCase(),
        pincode: formData.pincode.trim(),
      }
      const res = await apiFetch('/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setIsCreateModalOpen(false)
        resetCreateForm()
        fetchParties()
        fetchStats()
      } else {
        const data = await res.json().catch(() => ({}))
        showErrorToast(data.error || 'Failed to create party')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to create party')
    }
  }

  const handleEditParty = (party: Party) => {
    setEditingParty(party)
    setFormData({
      name: party.name,
      phone: party.phone,
      email: party.email,
      category: party.category,
      party_type: party.party_type,
      opening_balance: party.balance,
      credit_limit: party.credit_limit,
      gstin: party.gstin,
      address: party.address,
      city: party.city,
      state: party.state,
      pincode: party.pincode,
      tan: party.tan,
      pan: party.pan,
      notes: party.notes
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateParty = async () => {
    if (!editingParty) return
    try {
      const res = await apiFetch(`/parties/${editingParty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsEditModalOpen(false)
        setEditingParty(null)
        resetCreateForm()
        fetchParties()
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteParty = async (id: string) => {
    if (!(await confirm({
      title: 'Delete party?',
      description: 'Are you sure you want to delete this party? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/parties/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchParties()
        fetchStats()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Parties</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading || filteredParties.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Dialog open={isCreateModalOpen} onOpenChange={handleCreateModalChange}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Create Party</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Party</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      className={cn(fieldErrors.name && 'border-red-500')}
                    />
                    <FieldError message={fieldErrors.name} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="phone">Mobile</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateFormField('phone', e.target.value)}
                      className={cn(fieldErrors.phone && 'border-red-500')}
                      placeholder="10-digit mobile number"
                    />
                    <FieldError message={fieldErrors.phone} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormField('email', e.target.value)}
                      className={cn(fieldErrors.email && 'border-red-500')}
                    />
                    <FieldError message={fieldErrors.email} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category || undefined}
                      onValueChange={(v) => updateFormField('category', v)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="party_type">Party Type *</Label>
                  <Select value={formData.party_type} onValueChange={(v) => updateFormField('party_type', v)}>
                    <SelectTrigger className={cn(fieldErrors.party_type && 'border-red-500')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError message={fieldErrors.party_type} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="opening_balance">Opening Balance</Label>
                    <Input
                      id="opening_balance"
                      type="number"
                      value={formData.opening_balance}
                      onChange={(e) => updateFormField('opening_balance', parseFloat(e.target.value) || 0)}
                      className={cn(fieldErrors.opening_balance && 'border-red-500')}
                    />
                    <FieldError message={fieldErrors.opening_balance} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="credit_limit">Credit Limit</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      min={0}
                      value={formData.credit_limit}
                      onChange={(e) => updateFormField('credit_limit', parseFloat(e.target.value) || 0)}
                      className={cn(fieldErrors.credit_limit && 'border-red-500')}
                    />
                    <FieldError message={fieldErrors.credit_limit} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    onChange={(e) => updateFormField('gstin', e.target.value.toUpperCase())}
                    className={cn(fieldErrors.gstin && 'border-red-500')}
                    placeholder="15-character GSTIN"
                  />
                  <FieldError message={fieldErrors.gstin} />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={formData.address} onChange={(e) => updateFormField('address', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={formData.city} onChange={(e) => updateFormField('city', e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={formData.state} onChange={(e) => updateFormField('state', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => updateFormField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={cn(fieldErrors.pincode && 'border-red-500')}
                      placeholder="6-digit pincode"
                    />
                    <FieldError message={fieldErrors.pincode} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="tan">TAN</Label>
                    <Input
                      id="tan"
                      value={formData.tan}
                      onChange={(e) => updateFormField('tan', e.target.value.toUpperCase())}
                      className={cn(fieldErrors.tan && 'border-red-500')}
                      placeholder="ABCD12345E"
                    />
                    <FieldError message={fieldErrors.tan} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pan">PAN</Label>
                    <Input
                      id="pan"
                      value={formData.pan}
                      onChange={(e) => updateFormField('pan', e.target.value.toUpperCase())}
                      className={cn(fieldErrors.pan && 'border-red-500')}
                      placeholder="ABCDE1234F"
                    />
                    <FieldError message={fieldErrors.pan} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" value={formData.notes} onChange={(e) => updateFormField('notes', e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleCreateModalChange(false)}>Cancel</Button>
                <Button onClick={handleCreateParty}>Create Party</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>

          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Party</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_name">Name *</Label>
                    <Input id="edit_name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_phone">Mobile</Label>
                    <Input id="edit_phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_email">Email</Label>
                    <Input id="edit_email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_category">Category</Label>
                    <Input id="edit_category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit_party_type">Party Type *</Label>
                  <Select value={formData.party_type} onValueChange={v => setFormData({ ...formData, party_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_opening_balance">Opening Balance</Label>
                    <Input id="edit_opening_balance" type="number" value={formData.opening_balance} onChange={e => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_credit_limit">Credit Limit</Label>
                    <Input id="edit_credit_limit" type="number" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit_gstin">GSTIN</Label>
                  <Input id="edit_gstin" value={formData.gstin} onChange={e => setFormData({ ...formData, gstin: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="edit_address">Address</Label>
                  <Input id="edit_address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit_city">City</Label>
                    <Input id="edit_city" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_state">State</Label>
                    <Input id="edit_state" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_pincode">Pincode</Label>
                    <Input id="edit_pincode" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_tan">TAN</Label>
                    <Input id="edit_tan" value={formData.tan} onChange={e => setFormData({ ...formData, tan: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_pan">PAN</Label>
                    <Input id="edit_pan" value={formData.pan} onChange={e => setFormData({ ...formData, pan: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Input id="edit_notes" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateParty}>Update Party</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCategoryUpdateConfirmOpen} onOpenChange={setIsCategoryUpdateConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Category Update</DialogTitle>
              </DialogHeader>
              <p className="py-4 text-sm text-gray-600">
                Are you sure you want to update the category to "{bulkCategory}" for {selectedParties.size} parties?
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCategoryUpdateConfirmOpen(false)}>Cancel</Button>
                <Button onClick={confirmCategoryUpdate}>Update</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">All Parties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_parties}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">To Collect</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.to_collect)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">To Pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.to_pay)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by name, mobile, category..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedParties.size > 0 && (
                <div className="flex gap-2">
                  <Dialog open={isBulkCategoryModalOpen} onOpenChange={setIsBulkCategoryModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Update Category</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Category for {selectedParties.size} Parties</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="bulk_category">Category</Label>
                        <Input id="bulk_category" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} placeholder="Enter category name" />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkCategoryModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleBulkUpdateCategory}>Update</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete ({selectedParties.size})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium w-10">
                        <Checkbox checked={selectedParties.size === filteredParties.length && filteredParties.length > 0} onCheckedChange={handleSelectAll} />
                      </th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Mobile</th>
                      <th className="pb-3 font-medium">Party Type</th>
                      <th className="pb-3 font-medium">Loyalty Pts</th>
                      <th className="pb-3 font-medium">Balance</th>
                      <th className="pb-3 font-medium">Created</th>
                      <th className="pb-3 font-medium">Last Updated</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3">
                          <Checkbox checked={selectedParties.has(p.id)} onCheckedChange={() => handleSelectParty(p.id)} />
                        </td>
                        <td className="py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="py-3 text-gray-600">{p.category || '-'}</td>
                        <td className="py-3">
                          {p.phone && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="h-3 w-3" /> {p.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            p.party_type === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {p.party_type === 'customer' ? 'Customer' : 'Vendor'}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">
                          {p.party_type === 'customer' ? (p.loyalty_points ?? 0).toLocaleString() : '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {p.balance > 0 ? (
                              <>
                                <ArrowUp className="h-4 w-4 text-red-500" />
                                <span className="font-medium text-red-600">{formatCurrency(p.balance)}</span>
                              </>
                            ) : p.balance < 0 ? (
                              <>
                                <ArrowDown className="h-4 w-4 text-green-500" />
                                <span className="font-medium text-green-600">{formatCurrency(Math.abs(p.balance))}</span>
                              </>
                            ) : (
                              <span className="text-gray-600">{formatCurrency(0)}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 whitespace-nowrap text-gray-600">
                          {p.created_at ? formatDate(p.created_at) : '—'}
                        </td>
                        <td className="py-3 whitespace-nowrap text-gray-600">
                          {p.updated_at ? formatDate(p.updated_at) : '—'}
                        </td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditParty(p)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteParty(p.id)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                    {filteredParties.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-500">
                          No parties found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && (
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </CardContent>
        </Card>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
