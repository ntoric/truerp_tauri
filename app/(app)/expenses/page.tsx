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
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { Plus, Search, Tags, Printer as ThermalPrinter, MoreVertical, Trash2, Download, Eye, X, Loader2 } from 'lucide-react'
import ThermalPrintModal from '@/components/ThermalPrintModal'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import PageHeaderActions from '@/components/layout/PageHeaderActions'

interface ExpenseItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  total: number
}

interface Expense {
  id: string
  expense_number: string
  original_invoice_num?: string
  category: string
  description: string
  amount: number
  sub_total?: number
  tax_total?: number
  with_gst?: boolean
  tax_rate?: number
  date: string
  vendor: string
  payment_mode: string
  bank_account?: { account_name: string } | null
  notes?: string
  receipt_url?: string
  items?: ExpenseItem[]
}

function formatPaymentMode(mode?: string) {
  if (!mode) return '—'
  if (mode === 'bank_transfer') return 'Bank Transfer'
  if (mode === 'cash') return 'Cash'
  return mode.replace(/_/g, ' ')
}

interface Category {
  id: string
  name: string
  description: string
}

export default function ExpensesPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [thermalPrintOpen, setThermalPrintOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<Expense | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    fetchExpenses()
    fetchCategories()
  }, [categoryFilter, dateFrom, dateTo])

  useEffect(() => {
    if (previewId) {
      fetchPreview(previewId)
    } else {
      setPreviewData(null)
    }
  }, [previewId])

  const fetchExpenses = async () => {
    try {
      let url = '/expenses'
      const params = new URLSearchParams()
      if (categoryFilter) params.append('category', categoryFilter)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)
      if (search) params.append('search', search)
      if (params.toString()) url += `?${params.toString()}`
      const res = await apiFetch(url)
      if (res.ok) setExpenses(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/expense-categories')
      if (res.ok) setCategories(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchPreview = async (id: string) => {
    try {
      setPreviewLoading(true)
      const res = await apiFetch(`/expenses/${id}`)
      if (res.ok) {
        setPreviewData(await res.json())
      } else {
        setPreviewData(null)
      }
    } catch (err) {
      console.error(err)
      setPreviewData(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewId(null)
    setPreviewData(null)
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(expenses)

  useEffect(() => {
    resetPage()
    setSelectedExpenses(new Set())
  }, [search, categoryFilter, dateFrom, dateTo])

  const uniqueCategories = Array.from(new Set(expenses.map(e => e.category)))

  const toggleSelectExpense = (id: string) => {
    setSelectedExpenses(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllExpenses = () => {
    if (selectedExpenses.size === expenses.length) {
      setSelectedExpenses(new Set())
    } else {
      setSelectedExpenses(new Set(expenses.map(e => e.id)))
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!(await confirm({
      title: 'Delete expense?',
      description: 'Are you sure you want to delete this expense? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchExpenses()
      } else {
        notifyError('Failed to delete expense')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const handleBulkExportExpenses = async () => {
    const selected = expenses.filter((e) => selectedExpenses.has(e.id))
    try {
      await downloadCsv(
        `selected-expenses_${accountingExportDateStamp()}.csv`,
        [
          ['Date', 'Expense Number', 'Party Name', 'Category', 'Amount'],
          ...selected.map((expense) => [
            formatDate(expense.date),
            expense.expense_number,
            expense.vendor || '-',
            expense.category,
            formatCurrency(expense.amount),
          ]),
        ],
        { label: 'Exporting expenses' }
      )
      notifySuccess('Selected expenses exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export expenses')
    }
  }

  const handleBulkDeleteExpenses = async () => {
    if (!(await confirm({
      title: `Delete ${selectedExpenses.size} expense(s)?`,
      description: `Are you sure you want to delete ${selectedExpenses.size} expense(s)? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        Array.from(selectedExpenses).map(id => apiFetch(`/expenses/${id}`, { method: 'DELETE' }))
      )
      setSelectedExpenses(new Set())
      fetchExpenses()
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const openThermalPrint = (expense: Expense) => {
    setSelectedExpense(expense)
    setThermalPrintOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Expenses</h1>
          </div>
          <PageHeaderActions>
            <Link href="/expense-categories">
              <Button variant="outline"><Tags className="mr-2 h-4 w-4" /> Expense Categories</Button>
            </Link>
            <Link href="/expenses/create">
              <Button><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
            </Link>
          </PageHeaderActions>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search expenses..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); fetchExpenses() }}
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Expense Categories</option>
                {(categories.length > 0
                  ? categories.map(c => c.name)
                  : uniqueCategories
                ).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
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
                {selectedExpenses.size > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-600">{selectedExpenses.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExportExpenses}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteExpenses}>
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
                          checked={expenses.length > 0 && selectedExpenses.size === expenses.length}
                          onChange={toggleSelectAllExpenses}
                        />
                      </th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Expense Number</th>
                      <th className="pb-3 font-medium">Party Name</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((e) => (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedExpenses.has(e.id)}
                            onChange={() => toggleSelectExpense(e.id)}
                          />
                        </td>
                        <td className="py-3 text-gray-600">{formatDate(e.date)}</td>
                        <td className="py-3 font-medium text-gray-900">
                          <button
                            type="button"
                            onClick={() => setPreviewId(e.id)}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {e.expense_number}
                          </button>
                        </td>
                        <td className="py-3 text-gray-600">{e.vendor || '-'}</td>
                        <td className="py-3">
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {e.category}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-gray-900">{formatCurrency(e.amount)}</td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setPreviewId(e.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openThermalPrint(e)}>
                                <ThermalPrinter className="mr-2 h-4 w-4" />
                                Print
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteExpense(e.id)}
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
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          No expenses recorded yet
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

        {selectedExpense && (
          <ThermalPrintModal
            isOpen={thermalPrintOpen}
            onClose={() => setThermalPrintOpen(false)}
            documentType="expense"
            documentId={selectedExpense.id}
            documentNumber={selectedExpense.expense_number}
          />
        )}

        {previewId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative max-h-[min(90vh,calc(100dvh-var(--app-bottom-nav-offset)-2rem))] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {previewData?.expense_number || 'Expense Preview'}
                </h2>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {previewLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : previewData ? (
                <div className="space-y-6 p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium">{formatDate(previewData.date)}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="font-medium">{previewData.category || '—'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Party</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{previewData.vendor || 'N/A'}</p>
                    {previewData.description && (
                      <p className="mt-1 text-sm text-gray-600">{previewData.description}</p>
                    )}
                    {previewData.original_invoice_num && (
                      <p className="mt-1 text-sm text-gray-600">
                        Original Invoice: {previewData.original_invoice_num}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {previewData.with_gst && (
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        GST {previewData.tax_rate || 0}%
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      Paid from: {previewData.bank_account?.account_name || formatPaymentMode(previewData.payment_mode)}
                    </span>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-700">Items</p>
                    <div className="table-scroll rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-gray-600">
                            <th className="px-3 py-2 font-medium">Description</th>
                            <th className="px-3 py-2 font-medium text-right">Qty</th>
                            <th className="px-3 py-2 font-medium text-right">Rate</th>
                            <th className="px-3 py-2 font-medium text-right">Tax%</th>
                            <th className="px-3 py-2 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(previewData.items || []).map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="px-3 py-2">{item.description || '—'}</td>
                              <td className="px-3 py-2 text-right">{item.quantity}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                              <td className="px-3 py-2 text-right">{item.tax_rate || 0}%</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                          {(previewData.items || []).length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-gray-500">No items</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="w-full space-y-2 rounded-lg border bg-gray-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sub Total</span>
                      <span className="font-medium">{formatCurrency(previewData.sub_total || 0)}</span>
                    </div>
                    {(previewData.tax_total || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="font-medium">{formatCurrency(previewData.tax_total || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 text-base font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(previewData.amount)}</span>
                    </div>
                  </div>

                  {(previewData.notes || previewData.receipt_url) && (
                    <div className="space-y-2 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                      {previewData.notes && (
                        <p><span className="font-medium">Notes:</span> {previewData.notes}</p>
                      )}
                      {previewData.receipt_url && (
                        <p>
                          <span className="font-medium">Receipt:</span>{' '}
                          <a
                            href={previewData.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View receipt
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-gray-500">Failed to load preview</div>
              )}
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
