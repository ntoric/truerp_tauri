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
import { Plus, Search, FileText, Download, MoreVertical, Edit, X, Trash2, Truck } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'

interface DeliveryChallan {
  id: string
  challan_number: string
  party: { name: string }
  total_quantity: number
  sub_total: number
  status: string
  date: string
  due_date?: string
}

export default function DeliveryChallansPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [challans, setChallans] = useState<DeliveryChallan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedChallans, setSelectedChallans] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchChallans()
  }, [filter, dateFrom, dateTo])

  const fetchChallans = async () => {
    try {
      let url = '/delivery-challans'
      const params = new URLSearchParams()
      if (filter) params.append('status', filter)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) setChallans(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredChallans = challans.filter(challan =>
    challan.challan_number.toLowerCase().includes(search.toLowerCase()) ||
    challan.party?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredChallans)

  useEffect(() => {
    resetPage()
    setSelectedChallans(new Set())
  }, [search, filter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      delivered: 'bg-green-100 text-green-700',
      draft: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || variants.draft}`}>{status}</span>
  }

  const handleExport = () => {
    const headers = ['Date', 'Challan #', 'Party Name', 'Quantity', 'Amount', 'Status']
    const rows = filteredChallans.map(challan => [
      formatDate(challan.date),
      challan.challan_number,
      challan.party?.name || 'N/A',
      challan.total_quantity.toString(),
      formatCurrency(challan.sub_total),
      challan.status
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'delivery-challans.csv'
    a.click()
  }

  const handleCancelChallan = async (id: string) => {
    try {
      const res = await apiFetch(`/delivery-challans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      if (res.ok) {
        fetchChallans()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteChallan = async (id: string) => {
    if (!(await confirm({
      title: 'Delete delivery challan?',
      description: 'Are you sure you want to delete this delivery challan? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/delivery-challans/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchChallans()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSelectChallan = (id: string) => {
    setSelectedChallans(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllChallans = () => {
    if (selectedChallans.size === filteredChallans.length) {
      setSelectedChallans(new Set())
    } else {
      setSelectedChallans(new Set(filteredChallans.map(ch => ch.id)))
    }
  }

  const handleBulkExportChallans = () => {
    const selected = filteredChallans.filter(ch => selectedChallans.has(ch.id))
    const headers = ['Date', 'Challan #', 'Party Name', 'Quantity', 'Amount', 'Status']
    const rows = selected.map(challan => [
      formatDate(challan.date),
      challan.challan_number,
      challan.party?.name || 'N/A',
      challan.total_quantity.toString(),
      formatCurrency(challan.sub_total),
      challan.status
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'selected-delivery-challans.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkCancelChallans = async () => {
    const eligible = filteredChallans.filter(
      ch => selectedChallans.has(ch.id) && ch.status !== 'cancelled' && ch.status !== 'delivered'
    )
    if (eligible.length === 0) return
    try {
      await Promise.all(
        eligible.map(ch =>
          apiFetch(`/delivery-challans/${ch.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
          })
        )
      )
      setSelectedChallans(new Set())
      fetchChallans()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDeleteChallans = async () => {
    if (!(await confirm({
      title: 'Delete delivery challans?',
      description: `Are you sure you want to delete ${selectedChallans.size} delivery challan(s)? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        Array.from(selectedChallans).map(id => apiFetch(`/delivery-challans/${id}`, { method: 'DELETE' }))
      )
      setSelectedChallans(new Set())
      fetchChallans()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Delivery Challans</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Link href="/delivery-challans/create">
              <Button><Plus className="mr-2 h-4 w-4" /> New Delivery Challan</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search challans..."
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
                <option value="delivered">Delivered</option>
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
              <div className="overflow-x-auto">
                {selectedChallans.size > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedChallans.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExportChallans}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkCancelChallans}>
                        Cancel
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteChallans}>
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
                          checked={filteredChallans.length > 0 && selectedChallans.size === filteredChallans.length}
                          onChange={toggleSelectAllChallans}
                        />
                      </th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Challan #</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Quantity</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((challan) => (
                      <tr key={challan.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedChallans.has(challan.id)}
                            onChange={() => toggleSelectChallan(challan.id)}
                          />
                        </td>
                        <td className="py-3 text-gray-500">{formatDate(challan.date)}</td>
                        <td className="py-3">
                          <Link href={`/delivery-challans/view?id=${challan.id}`} className="font-medium text-blue-600 hover:underline">
                            {challan.challan_number}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-600">{challan.party?.name || 'N/A'}</td>
                        <td className="py-3 text-gray-500">{challan.total_quantity}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(challan.sub_total)}</td>
                        <td className="py-3">{getStatusBadge(challan.status)}</td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/delivery-challans/create?id=${challan.id}`} className="flex items-center">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {challan.status !== 'cancelled' && challan.status !== 'delivered' && (
                                <DropdownMenuItem onClick={() => handleCancelChallan(challan.id)}>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteChallan(challan.id)}
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
                    {filteredChallans.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No delivery challans found
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
