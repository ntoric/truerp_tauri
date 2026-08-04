'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { isSuperAdmin } from '@/lib/roles'
import { ExternalLink, Globe, Loader2, Save, Users, LifeBuoy } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

interface PortalSettings {
  is_enabled: boolean
  slug: string
  welcome_message: string
  allow_support_tickets: boolean
}

interface AccessRow {
  party_id: string
  name: string
  phone: string
  email: string
  is_enabled: boolean
  has_access: boolean
  last_login_at?: string
}

interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  description: string
  status: string
  admin_notes: string
  created_at: string
  party?: { name: string; phone: string }
}

export default function CustomerPortalAdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<PortalSettings>({
    is_enabled: false,
    slug: '',
    welcome_message: '',
    allow_support_tickets: true,
  })
  const [portalUrl, setPortalUrl] = useState('')
  const [access, setAccess] = useState<AccessRow[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [pinByParty, setPinByParty] = useState<Record<string, string>>({})
  const [savingParty, setSavingParty] = useState<string | null>(null)
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin(user.role)) {
      loadAll()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, user])

  const accessPagination = usePagination(access)
  const ticketsPagination = usePagination(tickets)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [settingsRes, accessRes, ticketsRes] = await Promise.all([
        apiFetch('/customer-portal/settings'),
        apiFetch('/customer-portal/access'),
        apiFetch('/customer-portal/tickets'),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data.settings)
        if (typeof window !== 'undefined') {
          setPortalUrl(`${window.location.origin}/portal/login?slug=${encodeURIComponent(data.settings.slug)}`)
        }
      }
      if (accessRes.ok) setAccess(await accessRes.json())
      if (ticketsRes.ok) {
        const list: SupportTicket[] = await ticketsRes.json()
        setTickets(list)
        const notes: Record<string, string> = {}
        list.forEach((t) => {
          notes[t.id] = t.admin_notes || ''
        })
        setTicketNotes(notes)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await apiFetch('/customer-portal/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setSettings(data)
      if (typeof window !== 'undefined') {
        setPortalUrl(`${window.location.origin}/portal/login?slug=${encodeURIComponent(data.slug)}`)
      }
      notifySuccess('Portal settings saved')
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const saveAccess = async (partyId: string, isEnabled: boolean) => {
    const pin = pinByParty[partyId]?.trim()
    if (!pin) {
      notifyError('Enter a PIN for this customer')
      return
    }
    setSavingParty(partyId)
    try {
      const res = await apiFetch(`/customer-portal/access/${partyId}`, {
        method: 'PUT',
        body: JSON.stringify({ pin, is_enabled: isEnabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save access')
      notifySuccess('Portal access updated')
      setPinByParty((prev) => ({ ...prev, [partyId]: '' }))
      loadAll()
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Failed to update access')
    } finally {
      setSavingParty(null)
    }
  }

  const updateTicket = async (id: string, status: string) => {
    try {
      const res = await apiFetch(`/customer-portal/tickets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_notes: ticketNotes[id] || '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update ticket')
      notifySuccess('Ticket updated')
      setTickets((prev) => prev.map((t) => (t.id === id ? data : t)))
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Failed to update ticket')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
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
            <CardDescription>Only Super Admins can access Customer Portal settings.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
          <p className="text-muted-foreground">
            Let customers view invoices, payments, loyalty points, statements, and raise support tickets.
          </p>
        </div>
        {portalUrl && (
          <Button variant="outline" asChild>
            <Link href={portalUrl} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open portal login
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings" className="gap-1">
            <Globe className="h-4 w-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-1">
            <Users className="h-4 w-4" /> Customer access
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1">
            <LifeBuoy className="h-4 w-4" /> Support tickets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portal configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable customer portal</Label>
                  <p className="text-sm text-muted-foreground">Customers can sign in when access is enabled for them.</p>
                </div>
                <Switch
                  checked={settings.is_enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Portal URL slug</Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">/portal/login?slug=</span>
                  <Input
                    id="slug"
                    value={settings.slug}
                    onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcome">Welcome message</Label>
                <Textarea
                  id="welcome"
                  rows={3}
                  value={settings.welcome_message}
                  onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow support tickets</Label>
                  <p className="text-sm text-muted-foreground">Customers can raise tickets from the portal.</p>
                </div>
                <Switch
                  checked={settings.allow_support_tickets}
                  onCheckedChange={(v) => setSettings({ ...settings, allow_support_tickets: v })}
                />
              </div>
              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer login access</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Set PIN</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessPagination.paginatedItems.map((row) => (
                    <tr key={row.party_id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4">{row.phone || '—'}</td>
                      <td className="py-3 pr-4">
                        {row.has_access && row.is_enabled ? (
                          <span className="text-green-700">Active</span>
                        ) : row.has_access ? (
                          <span className="text-amber-700">Disabled</span>
                        ) : (
                          <span className="text-muted-foreground">Not set up</span>
                        )}
                        {row.last_login_at && (
                          <p className="text-xs text-muted-foreground">Last login {formatDate(row.last_login_at)}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Input
                          type="password"
                          inputMode="numeric"
                          placeholder="4–8 digit PIN"
                          className="max-w-[140px]"
                          value={pinByParty[row.party_id] || ''}
                          onChange={(e) =>
                            setPinByParty((prev) => ({ ...prev, [row.party_id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={savingParty === row.party_id}
                            onClick={() => saveAccess(row.party_id, true)}
                          >
                            {savingParty === row.party_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Enable'
                            )}
                          </Button>
                          {row.has_access && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingParty === row.party_id}
                              onClick={() =>
                                apiFetch(`/customer-portal/access/${row.party_id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ pin: '', is_enabled: false }),
                                }).then(async (res) => {
                                  if (res.ok) {
                                    notifySuccess('Portal access disabled')
                                    loadAll()
                                  } else {
                                    const data = await res.json()
                                    notifyError(data.error || 'Failed to disable')
                                  }
                                })
                              }
                            >
                              Disable
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls
                page={accessPagination.page}
                totalPages={accessPagination.totalPages}
                totalItems={accessPagination.totalItems}
                pageSize={accessPagination.pageSize}
                onPageChange={accessPagination.setPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-4">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No support tickets yet</CardContent>
            </Card>
          ) : (
            ticketsPagination.paginatedItems.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {t.ticket_number} — {t.subject}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">{formatDate(t.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.party?.name} · {t.party?.phone}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{t.description}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={t.status} onValueChange={(v) => updateTicket(t.id, v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Reply to customer</Label>
                      <Textarea
                        rows={2}
                        value={ticketNotes[t.id] ?? ''}
                        onChange={(e) =>
                          setTicketNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                      />
                      <Button size="sm" variant="secondary" onClick={() => updateTicket(t.id, t.status)}>
                        Save response
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {tickets.length > 0 && (
            <PaginationControls
              page={ticketsPagination.page}
              totalPages={ticketsPagination.totalPages}
              totalItems={ticketsPagination.totalItems}
              pageSize={ticketsPagination.pageSize}
              onPageChange={ticketsPagination.setPage}
            />
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
