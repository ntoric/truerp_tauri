'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Shield,
  Users,
  UserCog,
  KeyRound,
  Activity,
  ScrollText,
  Loader2,
  Save,
  Trash2,
  ExternalLink,
  Copy,
  QrCode,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  assignableRolesFor,
  canManageUsers,
  isSuperAdmin,
  roleLabel,
} from '@/lib/roles'

interface AppUser {
  id: string
  name: string
  email: string
  phone: string
  role: string
  is_active: boolean
  two_factor_enabled: boolean
  must_change_password?: boolean
  store_id?: string
  store_name?: string
  created_at?: string
}

interface Overview {
  total_users: number
  super_admin_count: number
  admin_count: number
  staff_count: number
  roles_defined: number
  two_factor_enabled: number
  activity_today: number
  audit_total: number
}

interface Permission {
  id: string
  name: string
  resource: string
  action: string
  description: string
}

interface Role {
  id: string
  name: string
  description: string
  is_default: boolean
  is_active: boolean
  permissions?: Permission[]
}

interface ActivityLog {
  id: string
  user_name: string
  action: string
  entity_type: string
  entity_name: string
  description: string
  status: string
  created_at: string
}

interface AuditLogRow {
  id: string
  user_name: string
  action: string
  entity_type: string
  description: string
  status: string
  ip_address: string
  created_at: string
}

function formatSecretKey(secret: string) {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    notifySuccess(`${label} copied`)
  } catch {
    notifyError('Could not copy to clipboard')
  }
}

export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const { stores, activeStore } = useStore()
  const { confirm, confirmDialog } = useConfirmDialog()
  const isSA = !!user && isSuperAdmin(user.role)
  const assignableRoles = useMemo(() => assignableRolesFor(user?.role), [user?.role])

  const [activeTab, setActiveTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'staff',
    store_id: '',
  })
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissionIds: [] as string[] })
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [twoFa, setTwoFa] = useState({
    enabled: false,
    pending: false,
    secret: '',
    otpauthUrl: '',
    code: '',
    disablePassword: '',
    setupView: 'qr' as 'qr' | 'key',
  })
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{
    open: boolean
    userName: string
    userEmail: string
    password: string
  }>({ open: false, userName: '', userEmail: '', password: '' })
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)

  const superAdmins = useMemo(
    () => users.filter((u) => isSuperAdmin(u.role)),
    [users]
  )
  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users])
  const staffUsers = useMemo(
    () => users.filter((u) => !isSuperAdmin(u.role) && u.role !== 'admin'),
    [users]
  )
  const manageableUsers = useMemo(
    () => users.filter((u) => !isSuperAdmin(u.role)),
    [users]
  )

  const fetchCore = useCallback(async () => {
    if (!user || !canManageUsers(user.role)) return
    setLoading(true)
    try {
      const usersPath = isSuperAdmin(user.role) ? '/settings/users?all=true' : '/settings/users'
      const requests: Promise<Response | null>[] = [
        apiFetch(`/user-management/overview${isSuperAdmin(user.role) ? '?all=true' : ''}`),
        apiFetch(usersPath),
        apiFetch('/user-management/2fa/status'),
      ]

      if (isSuperAdmin(user.role)) {
        requests.push(
          apiFetch('/compliance/roles'),
          apiFetch('/compliance/permissions'),
          apiFetch('/user-management/activity-logs'),
          apiFetch('/audit/logs?per_page=25')
        )
      }

      const [overviewRes, usersRes, twoFaRes, rolesRes, permsRes, activityRes, auditRes] =
        await Promise.all(requests)

      if (overviewRes?.ok) setOverview(await overviewRes.json())
      if (usersRes?.ok) setUsers(await usersRes.json())
      if (twoFaRes?.ok) {
        const data = await twoFaRes.json()
        setTwoFa((prev) => ({
          ...prev,
          enabled: data.two_factor_enabled,
          pending: data.has_pending_secret,
          secret: data.secret || '',
          otpauthUrl: data.otpauth_url || '',
        }))
      }

      if (isSuperAdmin(user.role)) {
        if (rolesRes?.ok) setRoles(await rolesRes.json())
        if (permsRes?.ok) setPermissions(await permsRes.json())
        if (activityRes?.ok) setActivityLogs(await activityRes.json())
        if (auditRes?.ok) {
          const data = await auditRes.json()
          setAuditLogs(data.data || [])
        } else {
          setAuditLogs([])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user && canManageUsers(user.role)) {
      fetchCore()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, user, fetchCore])

  useEffect(() => {
    if (isSA && activeStore?.id && !newUser.store_id) {
      setNewUser((prev) => ({ ...prev, store_id: activeStore.id }))
    }
  }, [isSA, activeStore?.id, newUser.store_id])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        phone: newUser.phone,
        role: newUser.role,
      }
      if (isSA && newUser.store_id) {
        payload.store_id = newUser.store_id
      }
      const res = await apiFetch('/settings/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        notifySuccess('User created')
        setNewUser({
          name: '',
          email: '',
          password: '',
          phone: '',
          role: 'staff',
          store_id: isSA ? activeStore?.id || '' : '',
        })
        fetchCore()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to create user')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateUser = async (u: AppUser, patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await apiFetch(`/settings/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        notifySuccess('User updated')
        fetchCore()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to update user')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleUserActive = async (u: AppUser, checked: boolean) => {
    if (!(await confirm({
      title: checked ? 'Enable user?' : 'Disable user?',
      description: checked
        ? `Enable ${u.name || u.email}? They will be able to sign in again.`
        : `Disable ${u.name || u.email}? They will not be able to sign in.`,
      confirmLabel: checked ? 'Enable' : 'Disable',
      variant: 'default',
    }))) return
    await handleUpdateUser(u, { is_active: checked })
  }

  const handleDeleteUser = async (id: string) => {
    if (!(await confirm({
      title: 'Delete user?',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
    }))) return
    const res = await apiFetch(`/settings/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      notifySuccess('User deleted')
      fetchCore()
    } else {
      const err = await res.json()
      notifyError(err.error || 'Failed to delete user')
    }
  }

  const handleResetPassword = async (u: AppUser) => {
    if (!(await confirm({
      title: 'Generate temporary password?',
      description: `Generate a new temporary password for ${u.name || u.email}? They will be required to set a new password on next login.`,
      confirmLabel: 'Generate password',
    }))) return

    setResettingUserId(u.id)
    try {
      const res = await apiFetch(`/settings/users/${u.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        notifyError(data.error || 'Failed to reset password')
        return
      }
      setTempPasswordDialog({
        open: true,
        userName: u.name,
        userEmail: u.email,
        password: data.temporary_password || '',
      })
      notifySuccess('Temporary password generated')
      fetchCore()
    } finally {
      setResettingUserId(null)
    }
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: roleForm.name,
        description: roleForm.description,
        permissions: roleForm.permissionIds,
      }
      const res = editingRoleId
        ? await apiFetch(`/compliance/roles/${editingRoleId}`, {
            method: 'PUT',
            body: JSON.stringify({ ...payload, is_active: true }),
          })
        : await apiFetch('/compliance/roles', { method: 'POST', body: JSON.stringify(payload) })
      if (res.ok) {
        notifySuccess(editingRoleId ? 'Role updated' : 'Role created')
        setRoleForm({ name: '', description: '', permissionIds: [] })
        setEditingRoleId(null)
        fetchCore()
      } else {
        const err = await res.json()
        notifyError(err.error || 'Failed to save role')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (id: string) => {
    if (!(await confirm({
      title: 'Delete role?',
      description: 'Are you sure you want to delete this role? This action cannot be undone.',
    }))) return
    const res = await apiFetch(`/compliance/roles/${id}`, { method: 'DELETE' })
    if (res.ok) {
      notifySuccess('Role deleted')
      fetchCore()
    } else {
      const err = await res.json()
      notifyError(err.error || 'Failed to delete role')
    }
  }

  const startEditRole = (role: Role) => {
    setEditingRoleId(role.id)
    setRoleForm({
      name: role.name,
      description: role.description,
      permissionIds: role.permissions?.map((p) => p.id) || [],
    })
  }

  const togglePermission = (id: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((p) => p !== id)
        : [...prev.permissionIds, id],
    }))
  }

  const setup2FA = async () => {
    const res = await apiFetch('/user-management/2fa/setup', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setTwoFa((prev) => ({
        ...prev,
        secret: data.secret,
        otpauthUrl: data.otpauth_url,
        pending: true,
        setupView: 'qr',
      }))
      notifySuccess('Scan the QR code or enter the key in your authenticator app')
    } else {
      notifyError('Failed to start 2FA setup')
    }
  }

  const enable2FA = async () => {
    const res = await apiFetch('/user-management/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code: twoFa.code }),
    })
    if (res.ok) {
      notifySuccess('Two-factor authentication enabled')
      setTwoFa((prev) => ({ ...prev, enabled: true, pending: false, code: '', secret: '' }))
    } else {
      const err = await res.json()
      notifyError(err.error || 'Invalid code')
    }
  }

  const disable2FA = async () => {
    const res = await apiFetch('/user-management/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password: twoFa.disablePassword, code: twoFa.code || undefined }),
    })
    if (res.ok) {
      notifySuccess('Two-factor authentication disabled')
      setTwoFa({
        enabled: false,
        pending: false,
        secret: '',
        otpauthUrl: '',
        code: '',
        disablePassword: '',
        setupView: 'qr',
      })
    } else {
      const err = await res.json()
      notifyError(err.error || 'Failed to disable 2FA')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!user || !canManageUsers(user.role)) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              Only Super Admins and store Admins can manage users.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  const UserTable = ({
    rows,
    allowRoleEdit,
    showStore,
    showResetPassword,
  }: {
    rows: AppUser[]
    allowRoleEdit?: boolean
    showStore?: boolean
    showResetPassword?: boolean
  }) => {
    const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(rows)
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {showStore && <TableHead>Store</TableHead>}
              <TableHead>2FA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {allowRoleEdit && !isSuperAdmin(u.role) ? (
                    <Select
                      value={u.role}
                      onValueChange={(value) => handleUpdateUser(u, { role: value })}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!assignableRoles.some((r) => r.value === u.role) && (
                          <SelectItem value={u.role}>{roleLabel(u.role)}</SelectItem>
                        )}
                        {assignableRoles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                  )}
                </TableCell>
                {showStore && (
                  <TableCell>
                    {isSA && !isSuperAdmin(u.role) ? (
                      <Select
                        value={u.store_id || ''}
                        onValueChange={(value) => handleUpdateUser(u, { store_id: value })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select store" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {u.store_name || '—'}
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {u.two_factor_enabled ? (
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  ) : (
                    <Badge variant="outline">Off</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Switch
                      checked={u.is_active}
                      disabled={isSuperAdmin(u.role) || saving}
                      onCheckedChange={(checked) => handleToggleUserActive(u, checked)}
                    />
                    {u.must_change_password && (
                      <Badge className="w-fit bg-amber-100 text-amber-900">Temp login</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {showResetPassword && !isSuperAdmin(u.role) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resettingUserId === u.id || saving}
                        onClick={() => handleResetPassword(u)}
                      >
                        {resettingUserId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {!isSuperAdmin(u.role) && (
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(u.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">
            {isSA
              ? 'Manage all users, assign stores, roles, permissions, and security settings.'
              : 'Create and manage staff for your store. Enable or disable accounts and assign admin or staff roles.'}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="users">Users</TabsTrigger>
            {isSA && <TabsTrigger value="overview">Overview</TabsTrigger>}
            {isSA && <TabsTrigger value="super-admin">Super Admin</TabsTrigger>}
            {isSA && <TabsTrigger value="admins">Admin users</TabsTrigger>}
            {isSA && <TabsTrigger value="staff">Staff users</TabsTrigger>}
            {isSA && <TabsTrigger value="roles">Role permissions</TabsTrigger>}
            {isSA && <TabsTrigger value="activity">Activity logs</TabsTrigger>}
            {isSA && <TabsTrigger value="audit">Audit trails</TabsTrigger>}
            <TabsTrigger value="2fa">Two-factor auth</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isSA ? 'All users' : 'Store users'}
                </CardTitle>
                <CardDescription>
                  {isSA
                    ? 'Create users for any store, change store assignments, roles, and active status.'
                    : 'Users you create are locked to your store. You can enable/disable accounts and set admin or staff roles.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isSA ? (
                    <div className="space-y-2">
                      <Label>Store</Label>
                      <Select
                        value={newUser.store_id || activeStore?.id || ''}
                        onValueChange={(value) => setNewUser({ ...newUser, store_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select store" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores
                            .filter((s) => s.is_active)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Store</Label>
                      <Input
                        value={activeStore?.name || 'Your store'}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        New users are assigned to your store automatically.
                      </p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Add user
                    </Button>
                  </div>
                </form>
                <UserTable rows={manageableUsers} allowRoleEdit showStore={isSA} showResetPassword={isSA} />
                {manageableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No users yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isSA && (
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {overview?.total_users ?? 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Roles defined
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {overview?.roles_defined ?? 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Activity today
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {overview?.activity_today ?? 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      2FA enabled
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {overview?.two_factor_enabled ?? 0}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Summary
                  </CardTitle>
                  <CardDescription>
                    {overview?.super_admin_count ?? 0} super admin, {overview?.admin_count ?? 0} admin,{' '}
                    {overview?.staff_count ?? 0} staff.
                  </CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          )}

          {isSA && (
            <TabsContent value="super-admin">
              <Card>
                <CardHeader>
                  <CardTitle>Super Admin accounts</CardTitle>
                  <CardDescription>
                    Full platform access including user management and audit settings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserTable rows={superAdmins} showStore />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSA && (
            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    Admin users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UserTable rows={admins} allowRoleEdit showStore showResetPassword />
                  {admins.length === 0 && (
                    <p className="text-sm text-muted-foreground">No admin users yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSA && (
            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Staff users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UserTable rows={staffUsers} allowRoleEdit showStore showResetPassword />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSA && (
            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Role permissions</CardTitle>
                  <CardDescription>
                    Define custom roles and assign granular permissions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSaveRole} className="space-y-4 rounded-lg border p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Role name</Label>
                        <Input
                          value={roleForm.name}
                          onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={roleForm.description}
                          onChange={(e) =>
                            setRoleForm({ ...roleForm, description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                      {permissions.map((p) => (
                        <label key={p.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={roleForm.permissionIds.includes(p.id)}
                            onCheckedChange={() => togglePermission(p.id)}
                          />
                          <span>
                            <span className="font-medium">{p.name}</span>
                            <span className="block text-muted-foreground">{p.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving}>
                        {editingRoleId ? 'Update role' : 'Create role'}
                      </Button>
                      {editingRoleId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingRoleId(null)
                            setRoleForm({ name: '', description: '', permissionIds: [] })
                          }}
                        >
                          Cancel edit
                        </Button>
                      )}
                    </div>
                  </form>
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-start justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {role.name}
                            {role.is_default && <Badge className="ml-2">Default</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">{role.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {role.permissions?.length ?? 0} permissions
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditRole(role)}>
                            Edit
                          </Button>
                          {!role.is_default && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRole(role.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSA && (
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Activity logs
                  </CardTitle>
                  <CardDescription>Recent user actions across the application.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.user_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>{log.entity_type}</TableCell>
                          <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSA && (
            <TabsContent value="audit">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ScrollText className="h-5 w-5" />
                      Audit trails
                    </CardTitle>
                    <CardDescription>
                      Immutable record of changes ({overview?.audit_total ?? 0} total). Export and
                      retention on the full audit dashboard.
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/audit">
                      Open audit dashboard
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.user_name}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.ip_address}</TableCell>
                          <TableCell>
                            <Badge
                              variant={log.status === 'success' ? 'secondary' : 'destructive'}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="2fa">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Two-factor authentication
                </CardTitle>
                <CardDescription>
                  Protect your account with an authenticator app (TOTP).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                <p className="text-sm">
                  Status:{' '}
                  {twoFa.enabled ? (
                    <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                  ) : (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                </p>
                {!twoFa.enabled && (
                  <>
                    {!twoFa.secret && <Button onClick={setup2FA}>Start 2FA setup</Button>}
                    {twoFa.secret && twoFa.otpauthUrl && (
                      <div className="space-y-4 rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">
                          Add this account in your authenticator app using a QR scan or the manual
                          setup key.
                        </p>
                        <Tabs
                          value={twoFa.setupView}
                          onValueChange={(v) =>
                            setTwoFa({ ...twoFa, setupView: v as 'qr' | 'key' })
                          }
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="qr" className="gap-2">
                              <QrCode className="h-4 w-4" />
                              QR code
                            </TabsTrigger>
                            <TabsTrigger value="key" className="gap-2">
                              <KeyRound className="h-4 w-4" />
                              Manual key
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="qr" className="space-y-3">
                            <div className="flex justify-center rounded-lg bg-white p-4">
                              <QRCodeSVG
                                value={twoFa.otpauthUrl}
                                size={200}
                                level="M"
                                includeMargin
                              />
                            </div>
                            <p className="text-center text-xs text-muted-foreground">
                              Scan with Google Authenticator, Authy, 1Password, etc.
                            </p>
                          </TabsContent>
                          <TabsContent value="key" className="space-y-3">
                            <Label>Setup key</Label>
                            <div className="flex items-start gap-2">
                              <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                                {formatSecretKey(twoFa.secret)}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => copyText(twoFa.secret, 'Setup key')}
                                aria-label="Copy setup key"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Choose &quot;Enter a setup key&quot; in your app and paste this value.
                              Time-based (TOTP), 6 digits.
                            </p>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                    {(twoFa.pending || twoFa.secret) && (
                      <div className="space-y-2">
                        <Label>Verification code</Label>
                        <Input
                          value={twoFa.code}
                          onChange={(e) => setTwoFa({ ...twoFa, code: e.target.value })}
                          placeholder="6-digit code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                        <Button onClick={enable2FA}>Enable 2FA</Button>
                      </div>
                    )}
                  </>
                )}
                {twoFa.enabled && (
                  <div className="space-y-2">
                    <Label>Password to disable</Label>
                    <Input
                      type="password"
                      value={twoFa.disablePassword}
                      onChange={(e) => setTwoFa({ ...twoFa, disablePassword: e.target.value })}
                    />
                    <Label>Optional current 2FA code</Label>
                    <Input
                      value={twoFa.code}
                      onChange={(e) => setTwoFa({ ...twoFa, code: e.target.value })}
                    />
                    <Button variant="destructive" onClick={disable2FA}>
                      Disable 2FA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Dialog
          open={tempPasswordDialog.open}
          onOpenChange={(open) => setTempPasswordDialog((prev) => ({ ...prev, open }))}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Temporary password generated</DialogTitle>
              <DialogDescription>
                Share this password securely with {tempPasswordDialog.userName || tempPasswordDialog.userEmail}.
                They must set a new password when they sign in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Temporary password</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                  {tempPasswordDialog.password}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(tempPasswordDialog.password, 'Temporary password')}
                  aria-label="Copy temporary password"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This password is shown only once. The user can sign in with it at any time until they change it.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setTempPasswordDialog((prev) => ({ ...prev, open: false }))}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
