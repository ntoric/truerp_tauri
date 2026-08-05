'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Pencil, Trash2, Power, MoreVertical, ArrowLeft } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn, formatDate } from '@/lib/utils'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess } from '@/lib/notify'

interface ExpenseCategory {
  id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ExpenseCategoriesPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    fieldErrors,
    clearFieldError,
    validateRequired,
    handleApiError,
  } = useFormErrors()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true })

  useEffect(() => {
    if (!authLoading && user) fetchCategories()
  }, [authLoading, user])

  const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(categories)

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/expense-categories')
      if (res.ok) setCategories(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingCategory(null)
    setFormData({ name: '', description: '', is_active: true })
    setIsDialogOpen(true)
  }

  const handleEdit = (cat: ExpenseCategory) => {
    setEditingCategory(cat)
    setFormData({ name: cat.name, description: cat.description || '', is_active: cat.is_active })
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!validateRequired(formData, { name: 'Name' })) return
    setSaving(true)
    try {
      const url = editingCategory
        ? `/expense-categories/${editingCategory.id}`
        : '/expense-categories'
      const method = editingCategory ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setIsDialogOpen(false)
        setEditingCategory(null)
        setFormData({ name: '', description: '', is_active: true })
        notifySuccess(editingCategory ? 'Expense category updated' : 'Expense category created')
        fetchCategories()
      } else {
        await handleApiError(res)
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete expense category?',
      description: 'Are you sure you want to delete this expense category? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/expense-categories/${id}`, { method: 'DELETE' })
      if (res.ok) {
        notifySuccess('Expense category deleted')
        fetchCategories()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to delete expense category')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const handleToggleActive = async (cat: ExpenseCategory) => {
    const enabling = !cat.is_active
    if (!(await confirm({
      title: enabling ? 'Enable expense category?' : 'Disable expense category?',
      description: enabling
        ? 'Enable this expense category so it can be selected for new expenses?'
        : 'Disable this expense category? It will no longer appear when creating expenses.',
      confirmLabel: enabling ? 'Enable' : 'Disable',
      variant: 'default',
    }))) return
    try {
      const res = await apiFetch(`/expense-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cat.name,
          description: cat.description || '',
          is_active: enabling,
        }),
      })
      if (res.ok) {
        notifySuccess(enabling ? 'Expense category enabled' : 'Expense category disabled')
        fetchCategories()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to update expense category')
      }
    } catch (err) {
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
          <div>
            <Link
              href="/expenses"
              className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Expenses
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Expense Categories</h1>
            <p className="text-sm text-gray-500">Create and manage categories used on expenses</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{cat.description || '—'}</TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-1 text-xs ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {cat.created_at ? formatDate(cat.created_at) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {cat.updated_at ? formatDate(cat.updated_at) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(cat)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(cat)}>
                            <Power className="mr-2 h-4 w-4" />
                            {cat.is_active ? 'Disable' : 'Enable'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(cat.id)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                      No expense categories found
                    </TableCell>
                  </TableRow>
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Expense Category' : 'Add Expense Category'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    clearFieldError('name')
                    setFormData({ ...formData, name: e.target.value })
                  }}
                  placeholder="Category name"
                  className={cn(fieldErrors.name && 'border-red-500')}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
