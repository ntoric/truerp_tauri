'use client'

import { FormEvent, useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore, type StoreSummary } from '@/hooks/useStore'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { notifySuccess } from '@/lib/notify'
import { isSuperAdmin } from '@/lib/roles'
import { cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateStoreForm,
  type StoreFormValues,
} from '@/lib/storeValidation'
import { ExternalLink, Loader2, Plus, RotateCcw, Store, Trash2, Users } from 'lucide-react'

const emptyStoreForm: StoreFormValues = {
  name: '',
  code: '',
  description: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
}

type FormScope = 'create' | 'edit'

function scopedField(scope: FormScope, field: string) {
  return `${scope}.${field}`
}

function readScopedErrors(
  fieldErrors: Record<string, string>,
  scope: FormScope
): Record<string, string> {
  const prefix = `${scope}.`
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (key.startsWith(prefix)) {
      out[key.slice(prefix.length)] = value
    } else if (scope === 'create' && !key.includes('.')) {
      out[key] = value
    }
  }
  return out
}

export default function StoresPage() {
  const { user, loading: authLoading } = useAuth()
  const { refreshStores } = useStore()
  const {
    fieldErrors,
    setFieldErrors,
    clearErrors,
    clearFieldError,
    handleApiError,
    showErrorToast,
  } = useFormErrors()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [storeForm, setStoreForm] = useState(emptyStoreForm)
  const [editForm, setEditForm] = useState(emptyStoreForm)
  const [editActive, setEditActive] = useState(true)
  const [activeTab, setActiveTab] = useState('manage')

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || null
  const createErrors = readScopedErrors(fieldErrors, 'create')
  const editErrors = readScopedErrors(fieldErrors, 'edit')

  const setScopedErrors = (scope: FormScope, errors: Record<string, string>) => {
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(errors)) {
      next[scopedField(scope, key)] = value
    }
    setFieldErrors(next)
  }

  const clearScopedField = (scope: FormScope, field: string) => {
    clearFieldError(scopedField(scope, field))
    clearFieldError(field)
  }

  const loadStores = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/stores')
      if (!res.ok) {
        await handleApiError(res, { toastTitle: 'Unable to load stores' })
        return
      }
      const data = (await res.json()) as StoreSummary[]
      setStores(data)
      if (!selectedStoreId && data.length > 0) {
        setSelectedStoreId(data[0].id)
      } else if (selectedStoreId && !data.find((s) => s.id === selectedStoreId) && data.length > 0) {
        setSelectedStoreId(data[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedStoreId, handleApiError])

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin(user.role)) {
      loadStores()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, user, loadStores])

  useEffect(() => {
    if (selectedStore) {
      setEditForm({
        name: selectedStore.name || '',
        code: selectedStore.code || '',
        description: selectedStore.description || '',
        address: selectedStore.address || '',
        city: selectedStore.city || '',
        state: selectedStore.state || '',
        pincode: selectedStore.pincode || '',
        phone: selectedStore.phone || '',
        email: selectedStore.email || '',
      })
      setEditActive(selectedStore.is_active)
      clearErrors()
    }
  }, [selectedStore, clearErrors])

  const handleCreateStore = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validateStoreForm(storeForm)
    if (Object.keys(errors).length > 0) {
      setScopedErrors('create', errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setSaving(true)
    clearErrors()
    try {
      const res = await apiFetch('/stores', {
        method: 'POST',
        body: JSON.stringify(storeForm),
      })
      if (!res.ok) {
        const { fields } = await handleApiError(res, { toastTitle: 'Unable to create store' })
        setScopedErrors('create', fields)
        return
      }
      const data = await res.json()
      notifySuccess('Store created')
      setStoreForm(emptyStoreForm)
      clearErrors()
      await loadStores()
      await refreshStores()
      if (data.id) {
        setSelectedStoreId(data.id)
        setActiveTab('manage')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStore = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedStore) return
    const errors = validateStoreForm(editForm)
    if (Object.keys(errors).length > 0) {
      setScopedErrors('edit', errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setSaving(true)
    clearErrors()
    try {
      const res = await apiFetch(`/stores/${selectedStore.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, is_active: editActive }),
      })
      if (!res.ok) {
        const { fields } = await handleApiError(res, { toastTitle: 'Unable to update store' })
        setScopedErrors('edit', fields)
        return
      }
      notifySuccess('Store updated')
      clearErrors()
      await loadStores()
      await refreshStores()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStore = async () => {
    if (!selectedStore) return
    if (!confirm(`Delete store "${selectedStore.name}"? Remove all store users first.`)) return
    const res = await apiFetch(`/stores/${selectedStore.id}`, { method: 'DELETE' })
    if (!res.ok) {
      await handleApiError(res, { toastTitle: 'Unable to delete store' })
      return
    }
    notifySuccess('Store deleted')
    setSelectedStoreId('')
    clearErrors()
    await loadStores()
    await refreshStores()
  }

  const handleResetStore = async () => {
    if (!selectedStore) return
    if (
      !confirm(
        `Reset all operational data for "${selectedStore.name}"?\n\nThis permanently deletes invoices, products, parties, inventory, payments, expenses, and related records.\n\nStore users and the business profile are kept.`
      )
    ) {
      return
    }
    const typed = window.prompt(
      `Type the store code "${selectedStore.code}" to confirm the reset:`
    )
    if (typed === null) return
    if (typed.trim() !== selectedStore.code) {
      showErrorToast('Store code did not match. Reset cancelled.')
      return
    }
    setResetting(true)
    try {
      const res = await apiFetch(`/stores/${selectedStore.id}/reset`, { method: 'POST' })
      if (!res.ok) {
        await handleApiError(res, { toastTitle: 'Unable to reset store' })
        return
      }
      notifySuccess('Store data reset')
    } finally {
      setResetting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading stores...
        </div>
      </DashboardLayout>
    )
  }

  if (!user || !isSuperAdmin(user.role)) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only super admins can manage stores.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  const renderStoreFields = (
    scope: 'create' | 'edit',
    values: StoreFormValues,
    setValues: Dispatch<SetStateAction<StoreFormValues>>,
    errors: Record<string, string>
  ) => (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-name`}>Name</Label>
        <Input
          id={`${scope}-name`}
          value={values.name}
          onChange={(e) => {
            clearScopedField(scope, 'name')
            setValues((f) => ({ ...f, name: e.target.value }))
          }}
          className={cn(errors.name && 'border-red-500')}
          aria-invalid={!!errors.name}
        />
        <FieldError message={errors.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-code`}>
          Code {scope === 'create' ? '(optional)' : ''}
        </Label>
        <Input
          id={`${scope}-code`}
          value={values.code}
          onChange={(e) => {
            clearScopedField(scope, 'code')
            setValues((f) => ({ ...f, code: e.target.value }))
          }}
          placeholder={scope === 'create' ? 'auto-generated if empty' : undefined}
          className={cn(errors.code && 'border-red-500')}
          aria-invalid={!!errors.code}
        />
        <FieldError message={errors.code} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${scope}-description`}>Description</Label>
        <Input
          id={`${scope}-description`}
          value={values.description}
          onChange={(e) => {
            clearScopedField(scope, 'description')
            setValues((f) => ({ ...f, description: e.target.value }))
          }}
          className={cn(errors.description && 'border-red-500')}
          aria-invalid={!!errors.description}
        />
        <FieldError message={errors.description} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${scope}-address`}>Address</Label>
        <Input
          id={`${scope}-address`}
          value={values.address}
          onChange={(e) => {
            clearScopedField(scope, 'address')
            setValues((f) => ({ ...f, address: e.target.value }))
          }}
          className={cn(errors.address && 'border-red-500')}
          aria-invalid={!!errors.address}
        />
        <FieldError message={errors.address} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-city`}>City</Label>
        <Input
          id={`${scope}-city`}
          value={values.city}
          onChange={(e) => {
            clearScopedField(scope, 'city')
            setValues((f) => ({ ...f, city: e.target.value }))
          }}
          className={cn(errors.city && 'border-red-500')}
          aria-invalid={!!errors.city}
        />
        <FieldError message={errors.city} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-state`}>State</Label>
        <Input
          id={`${scope}-state`}
          value={values.state}
          onChange={(e) => {
            clearScopedField(scope, 'state')
            setValues((f) => ({ ...f, state: e.target.value }))
          }}
          className={cn(errors.state && 'border-red-500')}
          aria-invalid={!!errors.state}
        />
        <FieldError message={errors.state} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-pincode`}>Pincode</Label>
        <Input
          id={`${scope}-pincode`}
          value={values.pincode}
          onChange={(e) => {
            clearScopedField(scope, 'pincode')
            setValues((f) => ({ ...f, pincode: e.target.value }))
          }}
          className={cn(errors.pincode && 'border-red-500')}
          aria-invalid={!!errors.pincode}
        />
        <FieldError message={errors.pincode} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-phone`}>Phone</Label>
        <Input
          id={`${scope}-phone`}
          value={values.phone}
          onChange={(e) => {
            clearScopedField(scope, 'phone')
            setValues((f) => ({ ...f, phone: e.target.value }))
          }}
          className={cn(errors.phone && 'border-red-500')}
          aria-invalid={!!errors.phone}
        />
        <FieldError message={errors.phone} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${scope}-email`}>Email</Label>
        <Input
          id={`${scope}-email`}
          type="email"
          value={values.email}
          onChange={(e) => {
            clearScopedField(scope, 'email')
            setValues((f) => ({ ...f, email: e.target.value }))
          }}
          className={cn(errors.email && 'border-red-500')}
          aria-invalid={!!errors.email}
        />
        <FieldError message={errors.email} />
      </div>
    </>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
          <p className="text-sm text-slate-500">
            Create stores and switch the active backoffice context from the header. Manage users in{' '}
            <Link href="/user-management" className="text-blue-600 hover:underline">
              User Management
            </Link>
            .
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All stores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stores.length === 0 && (
                <p className="text-sm text-slate-500">No stores yet. Create one to get started.</p>
              )}
              {stores.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => setSelectedStoreId(store.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left transition',
                    selectedStoreId === store.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{store.name}</span>
                    {!store.is_active && (
                      <span className="text-xs text-slate-500">Inactive</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span className="truncate">{store.code}</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {store.user_count ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Tabs
            value={activeTab}
            onValueChange={(tab) => {
              setActiveTab(tab)
              clearErrors()
            }}
          >
            <TabsList>
              <TabsTrigger value="manage">Manage store</TabsTrigger>
              <TabsTrigger value="users">Store users</TabsTrigger>
              <TabsTrigger value="create">Create store</TabsTrigger>
            </TabsList>

            <TabsContent value="manage" className="mt-4">
              {!selectedStore ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-slate-500">
                    Select a store to edit its details.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      {selectedStore.name}
                    </CardTitle>
                    <CardDescription>Update store profile and availability.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateStore} className="grid gap-4 md:grid-cols-2" noValidate>
                      {renderStoreFields('edit', editForm, setEditForm, editErrors)}
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Active</p>
                          <p className="text-xs text-slate-500">Inactive stores cannot be selected</p>
                        </div>
                        <Switch checked={editActive} onCheckedChange={setEditActive} />
                      </div>
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button type="submit" disabled={saving || resetting}>
                          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Save changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving || resetting}
                          onClick={handleResetStore}
                          className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
                        >
                          {resetting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          Reset store data
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={saving || resetting}
                          onClick={handleDeleteStore}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete store
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 md:col-span-2">
                        Reset clears invoices, products, parties, inventory, and other operational
                        data for this store only. Users and the business profile are kept.
                      </p>
                    </form>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Store users
                  </CardTitle>
                  <CardDescription>
                    User accounts are managed in one place. Super admins can assign users to any
                    store; store admins manage only their own store staff.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedStore && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{selectedStore.name}</span> currently has{' '}
                      {selectedStore.user_count ?? 0} user
                      {(selectedStore.user_count ?? 0) === 1 ? '' : 's'}.
                    </p>
                  )}
                  <Button asChild>
                    <Link href="/user-management">
                      Open User Management
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create store</CardTitle>
                  <CardDescription>
                    Each store gets isolated business data, settings, and users.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateStore} className="grid gap-4 md:grid-cols-2" noValidate>
                    {renderStoreFields('create', storeForm, setStoreForm, createErrors)}
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Create store
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  )
}
