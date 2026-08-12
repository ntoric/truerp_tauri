'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { ArrowLeft, Clock, History, ShoppingCart } from 'lucide-react'

interface POSSession {
  id: string
  status: 'open' | 'closed'
  opening_cash: number
  closing_cash: number
  total_sales: number
  total_invoices: number
  opened_at: string
  closed_at?: string | null
  notes?: string
}

export default function POSSessionHistoryPage() {
  const [sessions, setSessions] = useState<POSSession[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateFrom) params.set('from_date', dateFrom)
      if (dateTo) params.set('to_date', dateTo)

      const query = params.toString()
      const res = await apiFetch(`/pos/sessions${query ? `?${query}` : ''}`)
      if (res.ok) {
        setSessions(await res.json())
      } else {
        setSessions([])
      }
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } =
    usePagination(sessions)

  useEffect(() => {
    resetPage()
  }, [statusFilter, dateFrom, dateTo, resetPage])

  const summary = sessions.reduce(
    (acc, session) => {
      acc.totalSales += session.total_sales || 0
      acc.totalOpening += session.opening_cash || 0
      if (session.status === 'closed') {
        acc.closedCount += 1
        acc.totalClosing += session.closing_cash || 0
      } else {
        acc.openCount += 1
      }
      return acc
    },
    { totalSales: 0, totalOpening: 0, totalClosing: 0, openCount: 0, closedCount: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/pos" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to POS
            </Link>
          </div>
          <h1 className="app-page-title flex items-center gap-2">
            <History className="h-5 w-5" />
            POS Session History
          </h1>
        </div>
        <Button asChild>
          <Link href="/pos">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Open POS
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.openCount} open · {summary.closedCount} closed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Opening Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalOpening)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closing Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalClosing)}</p>
            <p className="text-xs text-muted-foreground mt-1">Closed sessions only</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'open' | 'closed') => setStatusFilter(value)}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-from">From date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No POS sessions found for the selected filters.
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Started</th>
                      <th className="pb-3 pr-4 font-medium">Ended</th>
                      <th className="pb-3 pr-4 font-medium text-right">Opening Balance</th>
                      <th className="pb-3 pr-4 font-medium text-right">Closing Balance</th>
                      <th className="pb-3 pr-4 font-medium text-right">Sales</th>
                      <th className="pb-3 pr-4 font-medium text-right">Invoices</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((session) => (
                      <tr key={session.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {formatDateTime(session.opened_at)}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {session.closed_at ? formatDateTime(session.closed_at) : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          {formatCurrency(session.opening_cash)}
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          {session.status === 'closed'
                            ? formatCurrency(session.closing_cash)
                            : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">
                          {formatCurrency(session.total_sales)}
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          {session.total_invoices ?? 0}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              session.status === 'open'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {session.status === 'open' ? 'Open' : 'Closed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
