'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Eye, Pencil, Trash2, MoreVertical, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface Party {
  id: string
  name: string
}

interface Invoice {
  id: string
  invoice_number: string
}

interface CreditNote {
  id: string
  credit_note_number: string
  party: Party
  invoice: Invoice
  status: string
  date: string
  total_amount: number
  reason: string
}

export default function CreditNotesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { if (!authLoading && user) fetchData() }, [authLoading, user, filter, dateFrom, dateTo])

  const filteredCreditNotes = creditNotes.filter(note => {
    const query = search.toLowerCase()
    return (
      note.credit_note_number.toLowerCase().includes(query) ||
      note.party?.name?.toLowerCase().includes(query) ||
      note.invoice?.invoice_number?.toLowerCase().includes(query) ||
      note.reason?.toLowerCase().includes(query)
    )
  })

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredCreditNotes)

  useEffect(() => {
    resetPage()
    setSelectedNotes(new Set())
  }, [search, filter, dateFrom, dateTo])

  const fetchData = async () => {
    try {
      let url = '/credit-notes'
      const params = new URLSearchParams()
      if (filter) params.append('status', filter)
      if (dateFrom) params.append('from_date', dateFrom)
      if (dateTo) params.append('to_date', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        setCreditNotes(data.data || data)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const clearFilters = () => {
    setSearch('')
    setFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = search !== '' || filter !== '' || dateFrom !== '' || dateTo !== ''

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      issued: 'bg-green-100 text-green-700',
    }
    return <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-100'}`}>{status}</span>
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete credit note?',
      description: 'Are you sure you want to delete this credit note? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/credit-notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      } else {
        notifyError('Failed to delete credit note')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const toggleSelectNote = (id: string) => {
    setSelectedNotes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllNotes = () => {
    if (selectedNotes.size === filteredCreditNotes.length) {
      setSelectedNotes(new Set())
    } else {
      setSelectedNotes(new Set(filteredCreditNotes.map(note => note.id)))
    }
  }

  const handleBulkDeleteNotes = async () => {
    const eligible = filteredCreditNotes.filter(note => selectedNotes.has(note.id) && note.status === 'draft')
    if (eligible.length === 0) {
      notifyError('Only draft credit notes can be deleted')
      return
    }
    if (!(await confirm({
      title: 'Delete credit notes?',
      description: `Are you sure you want to delete ${eligible.length} credit note(s)? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        eligible.map(note => apiFetch(`/credit-notes/${note.id}`, { method: 'DELETE' }))
      )
      setSelectedNotes(new Set())
      fetchData()
    } catch (err) {
      notifyError('An error occurred')
    }
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
          <h1 className="app-page-title">Credit Notes</h1>
          <Button onClick={() => router.push('/credit-notes/create')}>
            <Plus className="mr-2 h-4 w-4" /> New Credit Note
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search credit notes..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
              </select>
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
            {selectedNotes.size > 0 && (
              <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-2">
                <span className="text-sm text-gray-600">{selectedNotes.size} selected</span>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteNotes}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredCreditNotes.length > 0 && selectedNotes.size === filteredCreditNotes.length}
                      onCheckedChange={toggleSelectAllNotes}
                    />
                  </TableHead>
                  <TableHead>Note #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedNotes.has(note.id)}
                        onCheckedChange={() => toggleSelectNote(note.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{note.credit_note_number}</TableCell>
                    <TableCell>{note.party?.name}</TableCell>
                    <TableCell>{note.invoice?.invoice_number}</TableCell>
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
                          <DropdownMenuItem onClick={() => router.push(`/credit-notes/${note.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          {note.status === 'draft' && (
                            <>
                              <DropdownMenuItem onClick={() => router.push(`/credit-notes/${note.id}/edit`)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
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
                ))}
                {filteredCreditNotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      {hasActiveFilters ? 'No credit notes match your filters' : 'No credit notes found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
