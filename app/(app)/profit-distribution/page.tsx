'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { Plus, Search, Download, Trash2, UserPlus, HandCoins } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import {
  CASH_IN_HAND_ACCOUNT,
  bankAccountIdForApi,
  useBankAccounts,
} from '@/hooks/useBankAccounts'

interface Partner {
  id: string
  name: string
  phone: string
  email: string
  address: string
  pan: string
  notes: string
  is_active: boolean
}

interface BankAccount {
  id: string
  account_name: string
  bank_name: string
}

interface ProfitDistribution {
  id: string
  partner_id: string
  partner?: Partner | null
  distribution_number: string
  amount: number
  date: string
  account_id: string | null
  account?: BankAccount | null
  description: string
  reference: string
  notes: string
}

const emptyDistributionForm = () => ({
  partner_id: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  account_id: CASH_IN_HAND_ACCOUNT,
  description: '',
  reference: '',
  notes: '',
})

const emptyPartnerForm = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  pan: '',
  notes: '',
})

export default function ProfitDistributionPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const {
    fieldErrors,
    clearErrors,
    clearFieldError,
    setError,
    validateRequired,
    handleApiError,
    showErrorToast,
    showSuccessToast,
  } = useFormErrors()

  const [distributions, setDistributions] = useState<ProfitDistribution[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const { accounts } = useBankAccounts()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [partnerFilter, setPartnerFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeTab, setActiveTab] = useState<'distributions' | 'partners'>('distributions')
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false)
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false)
  const [distributionForm, setDistributionForm] = useState(emptyDistributionForm)
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm)

  useEffect(() => {
    fetchDistributions()
    fetchPartners()
  }, [])

  const fetchDistributions = async () => {
    try {
      const res = await apiFetch('/profit-distributions')
      if (res.ok) {
        const data = await res.json()
        setDistributions(Array.isArray(data) ? data : [])
      } else {
        showErrorToast('Unable to load profit distributions', 'Load failed')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load profit distributions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchPartners = async () => {
    try {
      const res = await apiFetch('/partners')
      if (res.ok) {
        const data = await res.json()
        setPartners(Array.isArray(data) ? data : [])
      } else {
        showErrorToast('Unable to load partners', 'Load failed')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to load partners. Please try again.')
    }
  }

  const filteredDistributions = distributions.filter((d) => {
    const query = search.toLowerCase()
    const distDate = d.date.split('T')[0]
    const accountName = d.account?.account_name || 'cash in-hand'

    const matchesSearch =
      !search ||
      d.distribution_number?.toLowerCase().includes(query) ||
      d.partner?.name?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query) ||
      d.reference?.toLowerCase().includes(query) ||
      accountName.includes(query)

    const matchesPartner = partnerFilter === 'all' || d.partner_id === partnerFilter
    const matchesDateFrom = !dateFrom || distDate >= dateFrom
    const matchesDateTo = !dateTo || distDate <= dateTo

    return matchesSearch && matchesPartner && matchesDateFrom && matchesDateTo
  })

  const filteredPartners = partners.filter((p) => {
    const query = search.toLowerCase()
    return (
      !search ||
      p.name.toLowerCase().includes(query) ||
      p.phone?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query)
    )
  })

  const distPagination = usePagination(filteredDistributions)
  const partnerPagination = usePagination(filteredPartners)
  const activePagination = activeTab === 'distributions' ? distPagination : partnerPagination

  useEffect(() => {
    distPagination.resetPage()
    partnerPagination.resetPage()
  }, [search, partnerFilter, dateFrom, dateTo, activeTab])

  const resetDistributionForm = () => {
    setDistributionForm(emptyDistributionForm())
    clearErrors()
  }

  const resetPartnerForm = () => {
    setPartnerForm(emptyPartnerForm())
    clearErrors()
  }

  const handleDistributionDialogChange = (open: boolean) => {
    setDistributionDialogOpen(open)
    if (!open) resetDistributionForm()
  }

  const handlePartnerDialogChange = (open: boolean) => {
    setPartnerDialogOpen(open)
    if (!open) resetPartnerForm()
  }

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateRequired(partnerForm, { name: 'Partner name' })) {
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/partners', {
        method: 'POST',
        body: JSON.stringify(partnerForm),
      })
      if (res.ok) {
        const created: Partner = await res.json()
        showSuccessToast('Partner added successfully')
        handlePartnerDialogChange(false)
        fetchPartners()
        setDistributionForm((prev) => ({ ...prev, partner_id: created.id }))
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to add partner. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePartner = async (id: string) => {
    if (
      !(await confirm({
        title: 'Delete partner?',
        description: 'Are you sure you want to delete this partner? This action cannot be undone.',
      }))
    )
      return
    try {
      const res = await apiFetch(`/partners/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccessToast('Partner deleted')
        fetchPartners()
      } else {
        await handleApiError(res, { toastTitle: 'Unable to delete' })
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to delete partner. Please try again.')
    }
  }

  const handleCreateDistribution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !validateRequired(distributionForm, {
        partner_id: 'Partner',
        amount: 'Amount',
        account_id: 'Pay from account',
        date: 'Date',
      })
    ) {
      return
    }

    const amount = parseFloat(distributionForm.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      setError('amount', 'Amount must be greater than 0')
      showErrorToast('Amount must be greater than 0', 'Invalid amount')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/profit-distributions', {
        method: 'POST',
        body: JSON.stringify({
          partner_id: distributionForm.partner_id,
          amount,
          date: new Date(distributionForm.date).toISOString(),
          account_id: bankAccountIdForApi(distributionForm.account_id),
          description: distributionForm.description,
          reference: distributionForm.reference,
          notes: distributionForm.notes,
        }),
      })
      if (res.ok) {
        showSuccessToast('Profit distribution created successfully')
        handleDistributionDialogChange(false)
        fetchDistributions()
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to create profit distribution. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteDistribution = async (id: string) => {
    if (
      !(await confirm({
        title: 'Delete profit distribution?',
        description:
          'Are you sure you want to delete this profit distribution? The amount will be restored to the account.',
      }))
    )
      return
    try {
      const res = await apiFetch(`/profit-distributions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccessToast('Profit distribution deleted')
        fetchDistributions()
      } else {
        await handleApiError(res, { toastTitle: 'Unable to delete' })
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to delete profit distribution. Please try again.')
    }
  }

  const handleExport = async () => {
    const rows: (string | number)[][] = [
      ['Date', 'Distribution #', 'Partner', 'Amount', 'Paid From', 'Reference', 'Description', 'Notes'],
      ...filteredDistributions.map((d) => [
        formatDate(d.date),
        d.distribution_number || '',
        d.partner?.name || '',
        d.amount,
        d.account ? `${d.account.account_name} - ${d.account.bank_name}` : 'Cash in-hand',
        d.reference || '',
        d.description || '',
        d.notes || '',
      ]),
    ]
    await downloadCsv(`profit_distributions_${accountingExportDateStamp()}.csv`, rows, {
      label: 'Exporting profit distributions',
    })
  }

  const hasActiveFilters = search !== '' || partnerFilter !== 'all' || dateFrom !== '' || dateTo !== ''

  const clearFilters = () => {
    setSearch('')
    setPartnerFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const paidFromLabel = (d: ProfitDistribution) =>
    d.account ? `${d.account.account_name} - ${d.account.bank_name}` : 'Cash in-hand'

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Profit Distribution</h1>
          <PageHeaderActions>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || filteredDistributions.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={partnerDialogOpen} onOpenChange={handlePartnerDialogChange}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Partner</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePartner} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="partner_name">Name *</Label>
                      <Input
                        id="partner_name"
                        value={partnerForm.name}
                        onChange={(e) => {
                          clearFieldError('name')
                          setPartnerForm({ ...partnerForm, name: e.target.value })
                        }}
                        className={cn(fieldErrors.name && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.name} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="partner_phone">Phone</Label>
                      <Input
                        id="partner_phone"
                        value={partnerForm.phone}
                        onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="partner_email">Email</Label>
                      <Input
                        id="partner_email"
                        type="email"
                        value={partnerForm.email}
                        onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="partner_pan">PAN</Label>
                      <Input
                        id="partner_pan"
                        value={partnerForm.pan}
                        onChange={(e) => setPartnerForm({ ...partnerForm, pan: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="partner_address">Address</Label>
                      <Input
                        id="partner_address"
                        value={partnerForm.address}
                        onChange={(e) => setPartnerForm({ ...partnerForm, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="partner_notes">Notes</Label>
                      <Textarea
                        id="partner_notes"
                        value={partnerForm.notes}
                        onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Add Partner'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={distributionDialogOpen} onOpenChange={handleDistributionDialogChange}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <HandCoins className="h-4 w-4" />
                  New Distribution
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Profit Distribution</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateDistribution} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="partner">Partner *</Label>
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => setPartnerDialogOpen(true)}
                        >
                          + Add partner
                        </button>
                      </div>
                      <Select
                        value={distributionForm.partner_id || undefined}
                        onValueChange={(value) => {
                          clearFieldError('partner_id')
                          setDistributionForm({ ...distributionForm, partner_id: value })
                        }}
                      >
                        <SelectTrigger
                          className={cn(fieldErrors.partner_id && 'border-red-500 focus:ring-red-500')}
                        >
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                        <SelectContent>
                          {partners.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-gray-500">
                              No partners found — add one first
                            </div>
                          ) : (
                            partners
                              .filter((p) => p.is_active)
                              .map((partner) => (
                                <SelectItem key={partner.id} value={partner.id}>
                                  {partner.name}
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                      <FieldError message={fieldErrors.partner_id || fieldErrors.PartnerID} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={distributionForm.amount}
                        onChange={(e) => {
                          clearFieldError('amount')
                          setDistributionForm({ ...distributionForm, amount: e.target.value })
                        }}
                        className={cn(fieldErrors.amount && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.amount} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="account_id">Pay From Account *</Label>
                      <Select
                        value={distributionForm.account_id}
                        onValueChange={(value) => {
                          clearFieldError('account_id')
                          setDistributionForm({ ...distributionForm, account_id: value })
                        }}
                      >
                        <SelectTrigger
                          className={cn(fieldErrors.account_id && 'border-red-500 focus:ring-red-500')}
                        >
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CASH_IN_HAND_ACCOUNT}>Cash in-hand</SelectItem>
                          {accounts
                            .filter((a) => a.is_active)
                            .map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.account_name} - {acc.bank_name} ({formatCurrency(acc.balance)})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={fieldErrors.account_id} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={distributionForm.date}
                        onChange={(e) => {
                          clearFieldError('date')
                          setDistributionForm({ ...distributionForm, date: e.target.value })
                        }}
                        className={cn(fieldErrors.date && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.date} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reference">Reference</Label>
                      <Input
                        id="reference"
                        value={distributionForm.reference}
                        onChange={(e) =>
                          setDistributionForm({ ...distributionForm, reference: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="Profit distribution"
                        value={distributionForm.description}
                        onChange={(e) =>
                          setDistributionForm({ ...distributionForm, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={distributionForm.notes}
                        onChange={(e) =>
                          setDistributionForm({ ...distributionForm, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Create Distribution'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </PageHeaderActions>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={
                    activeTab === 'distributions'
                      ? 'Search by number, partner, reference...'
                      : 'Search partners...'
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {activeTab === 'distributions' && (
                <>
                  <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All partners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All partners</SelectItem>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </>
              )}
            </div>
            {hasActiveFilters && (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'distributions' | 'partners')}>
          <TabsList>
            <TabsTrigger value="distributions">Distributions</TabsTrigger>
            <TabsTrigger value="partners">Partners</TabsTrigger>
          </TabsList>

          <TabsContent value="distributions">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
                ) : distPagination.paginatedItems.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    {hasActiveFilters
                      ? 'No profit distributions match the current filters.'
                      : 'No profit distributions yet. Click "New Distribution" to create one.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">Distribution #</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Partner</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3">Paid From</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {distPagination.paginatedItems.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{d.distribution_number}</td>
                            <td className="px-4 py-3">{formatDate(d.date)}</td>
                            <td className="px-4 py-3">{d.partner?.name || '-'}</td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums">
                              {formatCurrency(d.amount)}
                            </td>
                            <td className="px-4 py-3">{paidFromLabel(d)}</td>
                            <td className="px-4 py-3">{d.reference || '-'}</td>
                            <td className="px-4 py-3">{d.description || '-'}</td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDistribution(d.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partners">
            <Card>
              <CardContent className="p-0">
                {partnerPagination.paginatedItems.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    {search
                      ? 'No partners match the search.'
                      : 'No partners yet. Click "Add Partner" to create one.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">PAN</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {partnerPagination.paginatedItems.map((p) => (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{p.name}</td>
                            <td className="px-4 py-3">{p.phone || '-'}</td>
                            <td className="px-4 py-3">{p.email || '-'}</td>
                            <td className="px-4 py-3">{p.pan || '-'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                  p.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                )}
                              >
                                {p.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePartner(p.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {activePagination.totalPages > 1 && (
          <PaginationControls
            page={activePagination.page}
            totalPages={activePagination.totalPages}
            totalItems={activePagination.totalItems}
            pageSize={activePagination.pageSize}
            onPageChange={activePagination.setPage}
          />
        )}
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
