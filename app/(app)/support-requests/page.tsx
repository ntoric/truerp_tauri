'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import SupportRequestThread from '@/components/support/SupportRequestThread'
import PaginationControls from '@/components/ui/pagination-controls'
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
import { isSuperAdmin } from '@/lib/roles'
import {
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_WHATSAPP,
  SUPPORT_REQUEST_STATUSES,
  supportCategoryLabel,
  supportStatusBadgeClass,
  supportStatusLabel,
  type SupportRequest,
} from '@/lib/supportRequests'
import { cn } from '@/lib/utils'
import { Inbox, Loader2, Save, Search, Send, Settings2 } from 'lucide-react'

export default function SupportRequestsPage() {
  const { user, loading: authLoading } = useAuth()
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [message, setMessage] = useState('')
  const [contactForm, setContactForm] = useState({ support_email: '', whatsapp_number: '' })
  const [savingContact, setSavingContact] = useState(false)

  // Debounce the search box so each keystroke doesn't hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (authLoading || !user) return
    if (!isSuperAdmin(user.role)) {
      setLoading(false)
      return
    }
    void loadRequests()
  }, [authLoading, user, page, statusFilter, debouncedSearch])

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin(user.role)) {
      void loadContact()
    }
  }, [authLoading, user])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
      })
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (debouncedSearch) params.append('search', debouncedSearch)

      const res = await apiFetch(`/admin/support-requests?${params}`)
      if (res.ok) {
        const data = await res.json()
        const rows = Array.isArray(data) ? data : data.data ?? []
        const totalCount = Array.isArray(data) ? data.length : data.total ?? 0
        // The current page may no longer exist after filters change.
        const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
        if (page > maxPage) {
          setPage(maxPage)
          return
        }
        setRequests(rows)
        setTotal(totalCount)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadContact = async () => {
    const res = await apiFetch('/support-settings')
    if (res.ok) {
      const data = await res.json()
      setContactForm({
        support_email: data.support_email || DEFAULT_SUPPORT_EMAIL,
        whatsapp_number: data.whatsapp_number || DEFAULT_SUPPORT_WHATSAPP,
      })
    }
  }

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingContact(true)
    setMessage('')
    try {
      const res = await apiFetch('/support-settings', {
        method: 'PUT',
        body: JSON.stringify(contactForm),
      })
      if (res.ok) {
        setMessage('Support contact details saved.')
      } else {
        const data = await res.json().catch(() => null)
        setMessage(data?.error || 'Failed to save contact details.')
      }
    } finally {
      setSavingContact(false)
    }
  }

  const selected = requests.find((r) => r.id === selectedId) ?? null

  const replaceRequest = (updated: SupportRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  const selectRequest = (req: SupportRequest) => {
    setSelectedId(req.id)
    setReplyText('')
    setNotesDraft(req.admin_notes || '')
    setMessage('')
  }

  const updateWorkflow = async (status: string) => {
    if (!selected) return
    setSavingWorkflow(true)
    try {
      const res = await apiFetch(`/admin/support-requests/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        replaceRequest(await res.json())
      } else {
        setMessage('Failed to update status.')
      }
    } finally {
      setSavingWorkflow(false)
    }
  }

  const saveNotes = async () => {
    if (!selected) return
    setSavingNotes(true)
    try {
      const res = await apiFetch(`/admin/support-requests/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ admin_notes: notesDraft }),
      })
      if (res.ok) {
        replaceRequest(await res.json())
        setMessage('Notes saved.')
      }
    } finally {
      setSavingNotes(false)
    }
  }

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return
    setSending(true)
    setMessage('')
    try {
      const res = await apiFetch(`/admin/support-requests/${selected.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText.trim() }),
      })
      if (res.ok) {
        setReplyText('')
        const detail = await apiFetch(`/admin/support-requests/${selected.id}`)
        if (detail.ok) {
          replaceRequest(await detail.json())
        }
      } else {
        setMessage('Failed to send reply.')
      }
    } finally {
      setSending(false)
    }
  }

  // Skeleton only on first load — later page/filter changes keep the list
  // visible and show an inline spinner instead of unmounting the page.
  if (authLoading || (loading && requests.length === 0)) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  if (!user || !isSuperAdmin(user.role)) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only super admins can manage support requests.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="app-page-title">Support Requests</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review and reply to help requests submitted by users.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search subject, user, store…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 sm:w-64"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SUPPORT_REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Contact settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Support contact details</DialogTitle>
                  <DialogDescription>
                    Shown to all users on the Help &amp; Support page.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={saveContact} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Support email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="support@example.com"
                      value={contactForm.support_email}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, support_email: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-whatsapp">WhatsApp number</Label>
                    <Input
                      id="contact-whatsapp"
                      placeholder="+91 86064 90227"
                      value={contactForm.whatsapp_number}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, whatsapp_number: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <Button type="submit" disabled={savingContact} className="w-full">
                    {savingContact ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.toLowerCase().includes('fail')
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}
          >
            {message}
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <Card className="flex flex-col overflow-hidden lg:h-[calc(100dvh-14rem-var(--app-bottom-nav-offset))]">
            {loading && (
              <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            )}
            <div className="flex-1 divide-y overflow-y-auto">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Inbox className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">No support requests found.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => selectRequest(req)}
                    className={cn(
                      'block w-full px-4 py-3 text-left transition-colors hover:bg-gray-50',
                      selectedId === req.id && 'bg-blue-50/60 hover:bg-blue-50/60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-400">{req.request_number}</span>
                      <Badge variant="outline" className={supportStatusBadgeClass(req.status)}>
                        {supportStatusLabel(req.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-gray-900">{req.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {req.requester?.name || 'Unknown user'}
                      {req.store?.name ? ` · ${req.store.name}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {new Date(req.last_reply_at || req.created_at).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>
            <PaginationControls
              className="gap-1 py-1"
              page={page}
              totalPages={Math.max(1, Math.ceil(total / pageSize))}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </Card>

          {selected ? (
            <Card className="min-w-0">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-400">
                        {selected.request_number}
                      </span>
                      <Badge variant="outline">{supportCategoryLabel(selected.category)}</Badge>
                    </div>
                    <CardTitle className="mt-1 text-lg">{selected.subject}</CardTitle>
                    <CardDescription>
                      {selected.requester?.name} &lt;{selected.requester?.email}&gt;
                      {selected.store?.name ? ` · ${selected.store.name}` : ''} ·{' '}
                      {new Date(selected.created_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="req-status" className="text-xs text-gray-500">
                      Status
                    </Label>
                    <Select
                      value={selected.status}
                      onValueChange={updateWorkflow}
                      disabled={savingWorkflow}
                    >
                      <SelectTrigger id="req-status" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_REQUEST_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingWorkflow && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <SupportRequestThread request={selected} />

                <div className="space-y-2">
                  <Label htmlFor="admin-reply">Reply to {selected.requester?.name || 'user'}</Label>
                  <Textarea
                    id="admin-reply"
                    rows={3}
                    placeholder="Write a reply — the user sees it on their Support page and gets notified."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={sending || !replyText.trim()}
                    onClick={sendReply}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send reply
                  </Button>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="admin-notes" className="text-xs uppercase tracking-wide text-gray-400">
                    Internal notes (not visible to the user)
                  </Label>
                  <Textarea
                    id="admin-notes"
                    rows={2}
                    placeholder="Private notes about this request…"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingNotes}
                    onClick={saveNotes}
                  >
                    {savingNotes ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="hidden min-w-0 lg:block">
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                <Inbox className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">Select a request to view the conversation.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
