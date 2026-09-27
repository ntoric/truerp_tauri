'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { notifyError, notifySuccess } from '@/lib/notify'
import { printHtmlDocument } from '@/lib/printDocument'
import { Plus, Search, Download, MoreVertical, Edit, Trash2, Eye, Printer, ArrowRightCircle } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import EstimateConvertDialog, { type ConvertibleEstimate } from '@/components/EstimateConvertDialog'

interface Estimate extends ConvertibleEstimate {
  party?: { name: string }
  status: string
  date: string
  valid_until?: string
  converted_to_invoice_id?: string
}

export default function EstimatesPage() {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [convertTarget, setConvertTarget] = useState<Estimate | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)

  useEffect(() => {
    fetchEstimates()
  }, [filter, dateFrom, dateTo])

  const fetchEstimates = async () => {
    try {
      let url = '/quotations'
      const params = new URLSearchParams()
      if (filter) params.append('status', filter)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) setEstimates(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredEstimates = estimates.filter(est =>
    est.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
    est.party?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredEstimates)

  useEffect(() => {
    resetPage()
  }, [search, filter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      converted: 'bg-amber-100 text-amber-800',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] || variants.draft}`}>{status}</span>
  }

  const handleExport = async () => {
    try {
      await downloadCsv(
        `estimates_${accountingExportDateStamp()}.csv`,
        [
          ['Date', 'Estimate #', 'Party Name', 'Valid Until', 'Amount', 'Status'],
          ...filteredEstimates.map((est) => [
            formatDate(est.date),
            est.quotation_number,
            est.party?.name || 'N/A',
            est.valid_until ? formatDate(est.valid_until) : '-',
            formatCurrency(est.total_amount),
            est.status,
          ]),
        ],
        { label: 'Exporting estimates' }
      )
      notifySuccess('Estimates exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export estimates')
    }
  }

  const handlePrint = async (est: Estimate) => {
    if (printingId) return
    setPrintingId(est.id)
    try {
      const res = await apiFetch(`/quotations/${est.id}/pdf`)
      if (!res.ok) throw new Error('Failed to load estimate print')
      const html = await res.text()
      await printHtmlDocument(html, { title: `Estimate ${est.quotation_number}` })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to print estimate')
    } finally {
      setPrintingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete estimate?',
      description: 'Are you sure you want to delete this estimate? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/quotations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Estimate deleted')
        fetchEstimates()
        return
      }
      const data = await res.json().catch(() => ({}))
      notifyError(data.error || 'Failed to delete estimate')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete estimate')
    }
  }

  const openConvert = (est: Estimate) => {
    setConvertTarget(est)
    setConvertOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Estimates</h1>
          <PageHeaderActions>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Link href="/estimates/create">
              <Button><Plus className="mr-2 h-4 w-4" /> New Estimate</Button>
            </Link>
          </PageHeaderActions>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search estimates..."
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
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="converted">Converted</option>
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
                      <th className="pb-3 font-medium">Estimate #</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Valid Until</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((est) => (
                      <tr
                        key={est.id}
                        className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/estimates/view?id=${est.id}`)}
                      >
                        <td className="py-3 text-gray-500">{formatDate(est.date)}</td>
                        <td className="py-3">
                          <Link
                            href={`/estimates/view?id=${est.id}`}
                            className="font-medium text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {est.quotation_number}
                          </Link>
                        </td>
                        <td className="py-3 text-gray-600">{est.party?.name || 'N/A'}</td>
                        <td className="py-3 text-gray-500">{est.valid_until ? formatDate(est.valid_until) : '-'}</td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(est.total_amount)}</td>
                        <td className="py-3">{getStatusBadge(est.status)}</td>
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/estimates/view?id=${est.id}`} className="flex items-center">
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              {est.status !== 'converted' && (
                                <DropdownMenuItem onClick={() => openConvert(est)}>
                                  <ArrowRightCircle className="mr-2 h-4 w-4" />
                                  Convert to Sale
                                </DropdownMenuItem>
                              )}
                              {est.status !== 'converted' && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/estimates/create?id=${est.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => void handlePrint(est)} disabled={printingId === est.id}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(est.id)}
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
                    {filteredEstimates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          No estimates found
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

      <EstimateConvertDialog
        estimate={convertTarget}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConverted={() => fetchEstimates()}
      />
      {confirmDialog}
    </DashboardLayout>
  )
}
