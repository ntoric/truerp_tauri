'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, Pencil, Trash2, FileText, Power, MoreVertical, Download } from 'lucide-react'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { Checkbox } from '@/components/ui/checkbox'
import { notifyError, notifySuccess } from '@/lib/notify'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn, formatDate } from '@/lib/utils'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PageHeaderActions from '@/components/layout/PageHeaderActions'

interface Category {
  id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    fieldErrors,
    clearFieldError,
    validateRequired,
    handleApiError,
  } = useFormErrors()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true })

  useEffect(() => {
    if (!authLoading && user) fetchCategories()
  }, [authLoading, user])
  useEffect(() => { if (showDraftsModal && user) fetchDrafts() }, [showDraftsModal, user])

  const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(categories)

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories')
      if (res.ok) setCategories(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!validateRequired(formData, { name: 'Name' })) return
    if (
      editingCategory &&
      formData.is_active !== editingCategory.is_active
    ) {
      const enabling = formData.is_active
      if (!(await confirm({
        title: enabling ? 'Enable category?' : 'Disable category?',
        description: enabling
          ? 'Enable this category? This will also enable all products in this category.'
          : 'Disable this category? This will also disable all products in this category.',
        confirmLabel: enabling ? 'Enable' : 'Disable',
        variant: 'default',
      }))) return
    }
    try {
      const url = editingCategory ? `/categories/${editingCategory.id}` : '/categories'
      const method = editingCategory ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsDialogOpen(false)
        setEditingCategory(null)
        setFormData({ name: '', description: '', is_active: true })
        fetchCategories()
      } else {
        await handleApiError(res)
      }
    } catch (err) { console.error(err) }
  }

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat)
    setFormData({ name: cat.name, description: cat.description, is_active: cat.is_active })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete category?',
      description: 'Are you sure you want to delete this category? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCategories()
      }
    } catch (err) { console.error(err) }
  }

  const fetchDrafts = async () => {
    try {
      setLoadingDraft(true)
      const res = await apiFetch('/drafts?entity_type=category')
      if (res.ok) {
        const d = await res.json()
        setDrafts(Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [])
      }
    } catch (err) { console.error(err) }
    finally { setLoadingDraft(false) }
  }

  const handleSaveDraft = async () => {
    try {
      const title = formData.name || 'Untitled Category'
      const res = await apiFetch('/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'category',
          title: title,
          data: JSON.stringify(formData)
        })
      })
      if (res.ok) {
        notifySuccess('Draft saved successfully')
      }
    } catch (err) { console.error(err) }
  }

  const handleLoadDraft = async (draftId: string) => {
    try {
      const res = await apiFetch(`/drafts/${draftId}`)
      if (res.ok) {
        const d = await res.json()
        const draftData = JSON.parse(d.data)
        setFormData(draftData)
        setShowDraftsModal(false)
        setIsDialogOpen(true)
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteDraft = async (draftId: string) => {
    if (!(await confirm({
      title: 'Delete draft?',
      description: 'Are you sure you want to delete this draft? This action cannot be undone.',
    }))) return
    try {
      await apiFetch(`/drafts/${draftId}`, { method: 'DELETE' })
      fetchDrafts()
    } catch (err) { console.error(err) }
  }

  const handleToggleActive = async (categoryId: string, currentStatus: boolean) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return
    const enabling = category.is_active
    if (!(await confirm({
      title: enabling ? 'Disable category?' : 'Enable category?',
      description: enabling
        ? 'Are you sure you want to disable this category? This will also disable all products in this category.'
        : 'Are you sure you want to enable this category? This will also enable all products in this category.',
      confirmLabel: enabling ? 'Disable' : 'Enable',
      variant: 'default',
    }))) return
    try {
      const res = await apiFetch(`/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: category.name,
          description: category.description,
          is_active: !category.is_active
        })
      })
      if (res.ok) {
        fetchCategories()
      }
    } catch (err) { console.error(err) }
  }

  const handleExport = async () => {
    const exportList =
      selectedCategories.size > 0
        ? categories.filter((cat) => selectedCategories.has(cat.id))
        : categories
    if (exportList.length === 0) {
      notifyError('No categories to export')
      return
    }
    const rows: (string | number)[][] = [
      ['Name', 'Description', 'Status', 'Created', 'Last Modified'],
      ...exportList.map((cat) => [
        cat.name,
        cat.description || '',
        cat.is_active ? 'Active' : 'Inactive',
        cat.created_at ? formatDate(cat.created_at) : '',
        cat.updated_at ? formatDate(cat.updated_at) : '',
      ]),
    ]
    try {
      await downloadCsv(`categories_${accountingExportDateStamp()}.csv`, rows, {
        label: 'Exporting categories',
      })
      notifySuccess(
        selectedCategories.size > 0
          ? `Exported ${exportList.length} selected categories`
          : `Exported ${exportList.length} categories`
      )
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'Failed to export categories')
    }
  }

  const handleSelectCategory = (id: string) => {
    const next = new Set(selectedCategories)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedCategories(next)
  }

  const handleSelectAll = () => {
    if (selectedCategories.size === categories.length) {
      setSelectedCategories(new Set())
    } else {
      setSelectedCategories(new Set(categories.map((cat) => cat.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCategories.size === 0) return
    if (!(await confirm({
      title: 'Delete categories?',
      description: `Are you sure you want to delete ${selectedCategories.size} categories? This action cannot be undone.`,
    }))) return
    try {
      const res = await apiFetch('/categories/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedCategories) }),
      })
      if (res.ok) {
        setSelectedCategories(new Set())
        fetchCategories()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkStatus = async (action: 'enable' | 'disable') => {
    if (selectedCategories.size === 0) return
    const count = selectedCategories.size
    if (!(await confirm({
      title: action === 'enable' ? 'Enable categories?' : 'Disable categories?',
      description: action === 'enable'
        ? `Enable ${count} selected categor${count === 1 ? 'y' : 'ies'} and their products?`
        : `Disable ${count} selected categor${count === 1 ? 'y' : 'ies'} and their products?`,
      confirmLabel: action === 'enable' ? 'Enable' : 'Disable',
      variant: 'default',
    }))) return
    try {
      const res = await apiFetch('/categories/bulk/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedCategories),
          is_active: action === 'enable',
        }),
      })
      if (res.ok) {
        setSelectedCategories(new Set())
        fetchCategories()
      }
    } catch (err) {
      console.error(err)
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
          <h1 className="app-page-title">Product Categories</h1>
          <PageHeaderActions>
            <Button variant="outline" onClick={handleExport} disabled={categories.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => setShowDraftsModal(true)}>
              <FileText className="mr-2 h-4 w-4" /> Drafts
            </Button>
            <Button onClick={() => { setEditingCategory(null); setFormData({ name: '', description: '', is_active: true }); setIsDialogOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
          </PageHeaderActions>
        </div>

        <Card>
          {selectedCategories.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <span className="text-sm text-gray-600">{selectedCategories.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('enable')}>
                <Power className="mr-2 h-4 w-4" /> Enable
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('disable')}>
                <Power className="mr-2 h-4 w-4" /> Disable
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          )}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedCategories.size === categories.length && categories.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
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
                    <TableCell>
                      <Checkbox
                        checked={selectedCategories.has(cat.id)}
                        onCheckedChange={() => handleSelectCategory(cat.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{cat.description}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
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
                          <DropdownMenuItem onClick={() => handleToggleActive(cat.id, cat.is_active)}>
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
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No categories found</TableCell></TableRow>
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
            <DialogHeader><DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
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
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description" />
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
              {!editingCategory && <Button variant="outline" onClick={handleSaveDraft}>Save as Draft</Button>}
              <Button onClick={handleSubmit}>{editingCategory ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDraftsModal} onOpenChange={setShowDraftsModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Saved Drafts</DialogTitle>
            </DialogHeader>
            {loadingDraft ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No drafts saved</div>
            ) : (
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div key={draft.id} className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                      <div className="font-medium">{draft.title}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(draft.updated_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleLoadDraft(draft.id)}>Load</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteDraft(draft.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {confirmDialog}
      </div>
    </DashboardLayout>
  )
}
