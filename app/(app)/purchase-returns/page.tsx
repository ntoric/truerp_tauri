'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { Plus, Search, MoreVertical, Edit, Trash2, CheckCircle, Download } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import PageHeaderActions from '@/components/layout/PageHeaderActions'

interface PurchaseReturn {
  id: string
  return_number: string
  party?: { name: string }
  vendor?: { name: string }
  purchase_bill?: { bill_number: string }
  date: string
  amount: number
  status: string
}

export default function PurchaseReturnsPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchReturns()
  }, [filter, dateFrom, dateTo])

  const fetchReturns = async () => {
    try {
      let url = '/purchase-returns'
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
    ret.vendor?.name?.toLowerCase().includes(search.toLowerCase()) ||
    ret.purchase_bill?.bill_number?.toLowerCase().includes(search.toLowerCase())
  )

  const getVendorName = (ret: PurchaseReturn) =>
    ret.party?.name || ret.vendor?.name || 'N/A'

  const handleExport = async () => {
    const rows: (string | number)[][] = [
      ['Date', 'Purchase Return #', 'Vendor Name', 'Bill #', 'Amount', 'Status'],
      ...filteredReturns.map((ret) => [
        formatDate(ret.date),
        ret.return_number,
        getVendorName(ret),
        ret.purchase_bill?.bill_number || '',
        ret.amount,
        ret.status,
      ]),
    ]
    await downloadCsv(`purchase_returns_${accountingExportDateStamp()}.csv`, rows, { label: 'Exporting purchase returns' })
  }

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredReturns)

  useEffect(() => {
    resetPage()
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
      const res = await apiFetch(`/purchase-returns/${id}/process`, { method: 'POST' })
      if (res.ok) {
        fetchReturns()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteReturn = async (id: string) => {
    if (!(await confirm({
      title: 'Delete purchase return?',
      description: 'Are you sure you want to delete this purchase return? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/purchase-returns/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchReturns()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Purchase Returns</h1>
          <PageHeaderActions>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || filteredReturns.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Link href="/purchase-returns/create">
              <Button><Plus className="mr-2 h-4 w-4" /> New Purchase Return</Button>
            </Link>
          </PageHeaderActions>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search purchase returns..."
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
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Purchase Return #</th>
                      <th className="pb-3 font-medium">Vendor Name</th>
                      <th className="pb-3 font-medium">Bill #</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((ret) => (
                      <tr key={ret.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 text-gray-500">{formatDate(ret.date)}</td>
                        <td className="py-3">
                          <Link href={`/purchase-returns/view?id=${ret.id}`} className="font-medium text-blue-600 hover:underline">
                            {ret.return_number}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-600">{getVendorName(ret)}</td>
                        <td className="py-3 text-gray-500">{ret.purchase_bill?.bill_number || '-'}</td>
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
                                <Link href={`/purchase-returns/create?id=${ret.id}`} className="flex items-center">
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
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          No purchase returns found
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
