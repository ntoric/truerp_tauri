'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Search, Download, MoreVertical, Edit, Trash2, Eye, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface Party {
  id: string
  name: string
}

interface PurchaseBill {
  id: string
  bill_number: string
}

interface DebitNote {
  id: string
  debit_note_number: string
  party?: Party
  purchase_bill?: PurchaseBill
  status: string
  date: string
  total_amount: number
  reason: string
}

export default function DebitNotesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([])
  const [vendors, setVendors] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      fetchVendors()
      fetchData()
    }
  }, [authLoading, user, statusFilter, vendorFilter, dateFrom, dateTo])

  const filteredDebitNotes = debitNotes.filter((note) => {
    const query = search.toLowerCase()
    const matchesSearch =
      !search ||
      note.debit_note_number.toLowerCase().includes(query) ||
      note.party?.name?.toLowerCase().includes(query) ||
      note.purchase_bill?.bill_number?.toLowerCase().includes(query) ||
      note.reason?.toLowerCase().includes(query)

    return matchesSearch
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } =
    usePagination(filteredDebitNotes)

  useEffect(() => {
    resetPage()
  }, [search, statusFilter, vendorFilter, dateFrom, dateTo])

  const fetchVendors = async () => {
    try {
      const res = await apiFetch('/vendors')
      if (res.ok) setVendors(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchData = async () => {
    try {
      let url = '/debit-notes'
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (vendorFilter !== 'all') params.append('party_id', vendorFilter)
      if (dateFrom) params.append('from_date', dateFrom)
      if (dateTo) params.append('to_date', dateTo)
      if (params.toString()) url += `?${params.toString()}`

      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        setDebitNotes(data.data || data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      issued: 'bg-green-100 text-green-700',
    }
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    )
  }

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ['Note #', 'Vendor', 'Purchase Bill', 'Date', 'Status', 'Amount', 'Reason'],
      ...filteredDebitNotes.map((note) => [
        note.debit_note_number,
        note.party?.name || '',
        note.purchase_bill?.bill_number || '',
        formatDate(note.date),
        note.status,
        note.total_amount,
        note.reason || '',
      ]),
    ]
    downloadCsv(`debit_notes_${accountingExportDateStamp()}.csv`, rows)
  }

  const hasActiveFilters =
    search !== '' ||
    statusFilter !== 'all' ||
    vendorFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setVendorFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const handleIssue = async (id: string) => {
    try {
      const res = await apiFetch(`/debit-notes/${id}/issue`, { method: 'POST' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to issue debit note')
      }
    } catch {
      notifyError('An error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete debit note?',
      description: 'Are you sure you want to delete this debit note? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/debit-notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to delete debit note')
      }
    } catch {
      notifyError('An error occurred')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Debit Notes</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || filteredDebitNotes.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => router.push('/debit-notes/create')}>
              <Plus className="mr-2 h-4 w-4" />
              New Debit Note
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search debit notes..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                </SelectContent>
              </Select>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
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
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Note #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Purchase Bill</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debitNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                      No debit notes found
                    </TableCell>
                  </TableRow>
                ) : filteredDebitNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                      No debit notes match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="font-medium">{note.debit_note_number}</TableCell>
                      <TableCell>{note.party?.name || 'N/A'}</TableCell>
                      <TableCell>{note.purchase_bill?.bill_number || '-'}</TableCell>
                      <TableCell>{formatDate(note.date)}</TableCell>
                      <TableCell>{getStatusBadge(note.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(note.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/debit-notes/${note.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {note.status === 'draft' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/debit-notes/${note.id}/edit`)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleIssue(note.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Issue
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(note.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
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
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
