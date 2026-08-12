'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, MoreVertical, Edit, Trash2, CheckCircle } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface SalesReturn {
  id: string
  return_number: string
  party: { name: string }
  invoice?: { invoice_number: string }
  date: string
  amount: number
  status: string
}

export default function SalesReturnsPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedReturns, setSelectedReturns] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchReturns()
  }, [filter, dateFrom, dateTo])

  const fetchReturns = async () => {
    try {
      let url = '/sales-returns'
      const params = new URLSearchParams()
      if (filter) params.append('status', filter)
      if (dateFrom) params.append('from_date', dateFrom)
      if (dateTo) params.append('to_date', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        setReturns(data.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredReturns = returns.filter(ret =>
    ret.return_number.toLowerCase().includes(search.toLowerCase()) ||
    ret.party?.name?.toLowerCase().includes(search.toLowerCase()) ||
    ret.invoice?.invoice_number?.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredReturns)

  useEffect(() => {
    resetPage()
    setSelectedReturns(new Set())
  }, [search, filter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      processed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || variants.draft}`}>{status}</span>
  }

  const handleProcessReturn = async (id: string) => {
    try {
      const res = await apiFetch(`/sales-returns/${id}/process`, { method: 'POST' })
      if (res.ok) {
        fetchReturns()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteReturn = async (id: string) => {
    if (!(await confirm({
      title: 'Delete sales return?',
      description: 'Are you sure you want to delete this sales return? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/sales-returns/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchReturns()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSelectReturn = (id: string) => {
    setSelectedReturns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllReturns = () => {
    if (selectedReturns.size === filteredReturns.length) {
      setSelectedReturns(new Set())
    } else {
      setSelectedReturns(new Set(filteredReturns.map(ret => ret.id)))
    }
  }

  const handleBulkProcessReturns = async () => {
    const eligible = filteredReturns.filter(ret => selectedReturns.has(ret.id) && ret.status === 'draft')
    if (eligible.length === 0) return
    try {
      await Promise.all(
        eligible.map(ret => apiFetch(`/sales-returns/${ret.id}/process`, { method: 'POST' }))
      )
      setSelectedReturns(new Set())
      fetchReturns()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDeleteReturns = async () => {
    if (!(await confirm({
      title: `Delete ${selectedReturns.size} sales return(s)?`,
      description: `Are you sure you want to delete ${selectedReturns.size} sales return(s)? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        Array.from(selectedReturns).map(id => apiFetch(`/sales-returns/${id}`, { method: 'DELETE' }))
      )
      setSelectedReturns(new Set())
      fetchReturns()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Sales Returns</h1>
          <Link href="/sales-returns/create">
            <Button><Plus className="mr-2 h-4 w-4" /> New Sales Return</Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search sales returns..."
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
                <option value="processed">Processed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                type="date"
                className="h-10 w-auto"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <>
                {selectedReturns.size > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedReturns.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkProcessReturns}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Process
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteReturns}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
                <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={filteredReturns.length > 0 && selectedReturns.size === filteredReturns.length}
                          onChange={toggleSelectAllReturns}
                        />
                      </th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Sales Return #</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Invoice #</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((ret) => (
                      <tr key={ret.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedReturns.has(ret.id)}
                            onChange={() => toggleSelectReturn(ret.id)}
                          />
                        </td>
                        <td className="py-3 text-gray-500">{formatDate(ret.date)}</td>
                        <td className="py-3">
                          <Link href={`/sales-returns/view?id=${ret.id}`} className="font-medium text-blue-600 hover:underline">
                            {ret.return_number}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-600">{ret.party?.name || 'N/A'}</td>
                        <td className="py-3 text-gray-500">{ret.invoice?.invoice_number || '-'}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(ret.amount)}</td>
                        <td className="py-3">{getStatusBadge(ret.status)}</td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/sales-returns/create?id=${ret.id}`} className="flex items-center">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {ret.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleProcessReturn(ret.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Process
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteReturn(ret.id)}
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
                    {filteredReturns.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No sales returns found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </>
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
