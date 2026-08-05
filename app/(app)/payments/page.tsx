'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, CreditCard, MoreVertical, Trash2, Search } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface Payment {
  id: string
  amount_received: number
  payment_in_discount: number
  payment_in_number: string
  mode: string
  date: string
  reference: string
  notes: string
  customer?: {
    id: string
    name: string
  }
  party?: {
    id: string
    name: string
  }
}

interface Party {
  id: string
  name: string
  party_type: string
}

export default function PaymentsPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [payments, setPayments] = useState<Payment[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    party_id: '',
    amount_received: '',
    payment_in_discount: '0',
    payment_in_number: '',
    mode: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [partyFilter, setPartyFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchPayments()
    fetchParties()
  }, [])

  const getPartyName = (payment: Payment) => {
    if (payment.party) return payment.party.name
    if (payment.customer) return payment.customer.name
    return '-'
  }

  const filteredPayments = payments.filter((payment) => {
    const query = search.toLowerCase()
    const partyName = getPartyName(payment).toLowerCase()
    const paymentDate = payment.date.split('T')[0]

    const matchesSearch =
      !search ||
      partyName.includes(query) ||
      payment.payment_in_number?.toLowerCase().includes(query) ||
      payment.reference?.toLowerCase().includes(query) ||
      payment.notes?.toLowerCase().includes(query) ||
      payment.id.toLowerCase().includes(query)

    const matchesParty =
      partyFilter === 'all' ||
      payment.party?.id === partyFilter ||
      payment.customer?.id === partyFilter
    const matchesMode = modeFilter === 'all' || payment.mode === modeFilter
    const matchesDateFrom = !dateFrom || paymentDate >= dateFrom
    const matchesDateTo = !dateTo || paymentDate <= dateTo

    return matchesSearch && matchesParty && matchesMode && matchesDateFrom && matchesDateTo
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredPayments)

  useEffect(() => {
    resetPage()
    setSelectedPayments(new Set())
  }, [search, partyFilter, modeFilter, dateFrom, dateTo])

  const fetchPayments = async () => {
    try {
      const res = await apiFetch('/payments')
      if (res.ok) setPayments(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchParties = async () => {
    try {
      const res = await apiFetch('/parties')
      if (res.ok) {
        const data = await res.json()
        setParties(data.filter((p: Party) => p.party_type === 'customer'))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          party_id: formData.party_id || null,
          amount_received: parseFloat(formData.amount_received),
          payment_in_discount: parseFloat(formData.payment_in_discount),
          payment_in_number: formData.payment_in_number,
          mode: formData.mode,
          date: formData.date,
          notes: formData.notes
        })
      })
      if (res.ok) {
        setDialogOpen(false)
        setFormData({
          party_id: '',
          amount_received: '',
          payment_in_discount: '0',
          payment_in_number: '',
          mode: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        })
        fetchPayments()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const getModeIcon = (mode: string) => {
    const colors: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      upi: 'bg-blue-100 text-blue-700',
      bank_transfer: 'bg-purple-100 text-purple-700',
      cheque: 'bg-orange-100 text-orange-700',
      card: 'bg-pink-100 text-pink-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[mode] || 'bg-gray-100 text-gray-700'}`}>{mode.replace('_', ' ')}</span>
  }

  const handleDeletePayment = async (id: string) => {
    if (!(await confirm({
      title: 'Delete payment?',
      description: 'Are you sure you want to delete this payment? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/payments/${id}`, { method: 'DELETE' })
      if (res.ok) fetchPayments()
    } catch (err) {
      console.error(err)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setPartyFilter('all')
    setModeFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    search !== '' ||
    partyFilter !== 'all' ||
    modeFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  const toggleSelectPayment = (id: string) => {
    setSelectedPayments(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPayments = () => {
    if (selectedPayments.size === filteredPayments.length) {
      setSelectedPayments(new Set())
    } else {
      setSelectedPayments(new Set(filteredPayments.map(p => p.id)))
    }
  }

  const handleBulkDeletePayments = async () => {
    if (!(await confirm({
      title: 'Delete payments?',
      description: `Are you sure you want to delete ${selectedPayments.size} payment(s)? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        Array.from(selectedPayments).map(id => apiFetch(`/payments/${id}`, { method: 'DELETE' }))
      )
      setSelectedPayments(new Set())
      fetchPayments()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Payments In</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Payment In
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Payment In</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="party">Party Name</Label>
                  <Select value={formData.party_id} onValueChange={(value) => setFormData({ ...formData, party_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.map((party) => (
                        <SelectItem key={party.id} value={party.id}>
                          {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="amount_received">Amount Received</Label>
                  <Input
                    id="amount_received"
                    type="number"
                    step="0.01"
                    value={formData.amount_received}
                    onChange={(e) => setFormData({ ...formData, amount_received: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="payment_in_discount">Payment In Discount</Label>
                  <Input
                    id="payment_in_discount"
                    type="number"
                    step="0.01"
                    value={formData.payment_in_discount}
                    onChange={(e) => setFormData({ ...formData, payment_in_discount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="payment_in_number">Payment In Number</Label>
                  <Input
                    id="payment_in_number"
                    value={formData.payment_in_number}
                    onChange={(e) => setFormData({ ...formData, payment_in_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="mode">Payment Mode</Label>
                  <Select value={formData.mode} onValueChange={(value) => setFormData({ ...formData, mode: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date">Payment Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Payment</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="mb-4">Payment In History</CardTitle>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search payments..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={partyFilter} onValueChange={setPartyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parties</SelectItem>
                  {parties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Payment mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
              />
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
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
                {selectedPayments.size > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedPayments.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeletePayments}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={filteredPayments.length > 0 && selectedPayments.size === filteredPayments.length}
                          onChange={toggleSelectAllPayments}
                        />
                      </th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Payment ID</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Amount Received</th>
                      <th className="pb-3 font-medium">Payment In Discount</th>
                      <th className="pb-3 font-medium">Payment Mode</th>
                      <th className="pb-3 font-medium">Payment In Number</th>
                      <th className="pb-3 font-medium">Notes</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedPayments.has(p.id)}
                            onChange={() => toggleSelectPayment(p.id)}
                          />
                        </td>
                        <td className="py-3 text-gray-600">{formatDate(p.date)}</td>
                        <td className="py-3 text-gray-600 font-mono text-xs">{p.id.slice(0, 8)}...</td>
                        <td className="py-3 font-medium text-gray-900">{getPartyName(p)}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(p.amount_received)}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(p.payment_in_discount)}</td>
                        <td className="py-3">{getModeIcon(p.mode)}</td>
                        <td className="py-3 text-gray-600">{p.payment_in_number || '-'}</td>
                        <td className="py-3 text-gray-600">{p.notes || '-'}</td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDeletePayment(p.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                    {filteredPayments.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-gray-500">
                          {hasActiveFilters ? 'No payments match your filters' : 'No payments recorded yet'}
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
