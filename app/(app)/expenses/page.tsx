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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, PlusCircle, Loader2, Printer as ThermalPrinter, MoreVertical, Trash2, Download } from 'lucide-react'
import ThermalPrintModal from '@/components/ThermalPrintModal'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

interface Expense {
  id: string
  expense_number: string
  category: string
  description: string
  amount: number
  date: string
  vendor: string
  payment_mode: string
}

interface Category {
  id: string
  name: string
  description: string
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [thermalPrintOpen, setThermalPrintOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchExpenses()
    fetchCategories()
  }, [categoryFilter, dateFrom, dateTo])

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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingCategory(true)
    try {
      const res = await apiFetch('/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      })
      if (res.ok) {
        setNewCategory({ name: '', description: '' })
        setShowCategoryDialog(false)
        fetchCategories()
      } else {
        const data = await res.json()
        notifyError(data.error || 'Failed to create expense category')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setCreatingCategory(false)
    }
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
    if (!confirm('Are you sure you want to delete this expense?')) return
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

  const handleBulkExportExpenses = () => {
    const selected = expenses.filter(e => selectedExpenses.has(e.id))
    const headers = ['Date', 'Expense Number', 'Party Name', 'Category', 'Amount']
    const rows = selected.map(expense => [
      formatDate(expense.date),
      expense.expense_number,
      expense.vendor || '-',
      expense.category,
      formatCurrency(expense.amount),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'selected-expenses.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkDeleteExpenses = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedExpenses.size} expense(s)?`)) return
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500">Total: {formatCurrency(totalExpenses)}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Add Expense Category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Expense Category</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCategory} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cat-name">Expense Category Name *</Label>
                    <Input
                      id="cat-name"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-desc">Description</Label>
                    <Input
                      id="cat-desc"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={creatingCategory} className="w-full">
                    {creatingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Create Expense Category
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Link href="/expenses/create">
              <Button><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
            </Link>
          </div>
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
              <div className="overflow-x-auto">
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
                        <td className="py-3 font-medium text-gray-900">{e.expense_number}</td>
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
      </div>
    </DashboardLayout>
  )
}
