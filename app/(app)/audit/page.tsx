'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Download, Trash2, Settings, Archive, BarChart3, Activity, Users, Clock, ArrowLeft, Loader2 } from 'lucide-react'
import { notifySuccess, notifyError } from '@/lib/notify'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { isSuperAdmin } from '@/lib/roles'
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface AuditLog {
  id: string
  user_name: string
  action: string
  entity_type: string
  entity_id?: string
  entity_name: string
  description: string
  ip_address: string
  user_agent: string
  status: string
  created_at: string
}

interface AuditStats {
  total_logs: number
  today_logs: number
  success_count: number
  failed_count: number
  top_actions: { action: string; count: number }[]
  top_users: { user_name: string; count: number }[]
}

export default function AuditDashboard() {
  const { user, loading: authLoading } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [retentionDays, setRetentionDays] = useState(90)

  useEffect(() => {
    if (authLoading) return
    if (!user || !isSuperAdmin(user.role)) {
      setLoading(false)
      return
    }
    fetchStats()
    fetchLogs()
  }, [page, actionFilter, entityFilter, statusFilter, dateFilter, authLoading, user])

  const fetchStats = async () => {
    try {
      const response = await apiFetch('/audit/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: DEFAULT_PAGE_SIZE.toString(),
      })

      if (search) params.append('search', search)
      if (actionFilter !== 'all') params.append('action', actionFilter)
      if (entityFilter !== 'all') params.append('entity_type', entityFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (dateFilter !== 'all') params.append('date_filter', dateFilter)

      const response = await apiFetch(`/audit/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.data || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (actionFilter !== 'all') params.append('action', actionFilter)
      if (entityFilter !== 'all') params.append('entity_type', entityFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await apiFetch(`/audit/logs/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        notifySuccess('Audit logs exported')
      } else {
        notifyError('Failed to export logs')
      }
    } catch (error) {
      console.error('Failed to export logs:', error)
      notifyError('Failed to export logs')
    }
  }

  const deleteLogs = async () => {
    if (!(await confirm({
      title: 'Delete filtered audit logs?',
      description: 'Are you sure you want to delete all filtered audit logs? This action cannot be undone.',
    }))) return

    try {
      const params = new URLSearchParams()
      if (actionFilter !== 'all') params.append('action', actionFilter)
      if (entityFilter !== 'all') params.append('entity_type', entityFilter)

      const response = await apiFetch(`/audit/logs?${params}`, { method: 'DELETE' })
      if (response.ok) {
        notifySuccess('Audit logs deleted')
        fetchLogs()
        fetchStats()
      } else {
        notifyError('Failed to delete logs')
      }
    } catch (error) {
      console.error('Failed to delete logs:', error)
      notifyError('Failed to delete logs')
    }
  }

  const archiveLogs = async () => {
    const fromDate = prompt('Enter from date (YYYY-MM-DD):')
    const toDate = prompt('Enter to date (YYYY-MM-DD):')

    if (!fromDate || !toDate) return

    try {
      const response = await apiFetch('/audit/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_date: fromDate, to_date: toDate }),
      })
      if (response.ok) {
        const data = await response.json()
        notifySuccess(`Archived ${data.count} logs successfully`)
      } else {
        notifyError('Failed to archive logs')
      }
    } catch (error) {
      console.error('Failed to archive logs:', error)
      notifyError('Failed to archive logs')
    }
  }

  const updateRetention = async () => {
    const days = prompt('Enter retention days (7-365):', retentionDays.toString())
    if (!days) return

    try {
      const response = await apiFetch('/audit/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: parseInt(days) }),
      })
      if (response.ok) {
        setRetentionDays(parseInt(days))
        notifySuccess('Retention settings updated')
      } else {
        notifyError('Failed to update retention')
      }
    } catch (error) {
      console.error('Failed to update retention:', error)
      notifyError('Failed to update retention')
    }
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 text-green-800 border-green-200',
      update: 'bg-blue-100 text-blue-800 border-blue-200',
      delete: 'bg-red-100 text-red-800 border-red-200',
      login: 'bg-purple-100 text-purple-800 border-purple-200',
      logout: 'bg-gray-100 text-gray-800 border-gray-200',
      view: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      export: 'bg-orange-100 text-orange-800 border-orange-200',
    }
    return colors[action] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!user || !isSuperAdmin(user.role)) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only Super Admins can access Audit Trails.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 h-8 px-2 text-gray-500">
              <Link href="/user-management">
                <ArrowLeft className="mr-1 h-4 w-4" />
                User management
              </Link>
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-sm text-gray-500">Track and monitor all user activities</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportLogs} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={archiveLogs} variant="outline" size="sm">
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button onClick={updateRetention} variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Retention ({retentionDays}d)
            </Button>
            <Button onClick={deleteLogs} variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_logs}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Logs</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today_logs}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.total_logs > 0 ? Math.round((stats.success_count / stats.total_logs) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.success_count} success, {stats.failed_count} failed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.top_users.length}</div>
                <p className="text-xs text-muted-foreground">Unique users</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPage(1)
                      fetchLogs()
                    }
                  }}
                />
              </div>
              <Select
                value={actionFilter}
                onValueChange={(v) => {
                  setPage(1)
                  setActionFilter(v)
                }}
              >
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={entityFilter}
                onValueChange={(v) => {
                  setPage(1)
                  setEntityFilter(v)
                }}
              >
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setPage(1)
                  setStatusFilter(v)
                }}
              >
                <SelectTrigger className="w-full lg:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={dateFilter}
                onValueChange={(v) => {
                  setPage(1)
                  setDateFilter(v)
                }}
              >
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue placeholder="Date Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  setPage(1)
                  fetchLogs()
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
            <CardDescription>
              Showing {logs.length} of {total} entries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No audit logs found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-gray-600">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getActionColor(log.action)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium capitalize">{log.entity_type}</div>
                            {log.entity_name && (
                              <div className="text-xs text-muted-foreground">{log.entity_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate text-sm text-gray-600">
                          {log.description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.ip_address || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'success' ? 'secondary' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>

        {stats && (stats.top_actions.length > 0 || stats.top_users.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.top_actions.length === 0 ? (
                  <p className="text-sm text-gray-500">No action data yet</p>
                ) : (
                  <div className="space-y-2">
                    {stats.top_actions.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="capitalize text-sm">{item.action}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Users</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.top_users.length === 0 ? (
                  <p className="text-sm text-gray-500">No user data yet</p>
                ) : (
                  <div className="space-y-2">
                    {stats.top_users.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm">{item.user_name}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
