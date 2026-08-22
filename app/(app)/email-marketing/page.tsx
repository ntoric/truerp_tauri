'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { Plus, Send, Calendar, Users, Mail, Loader2, Clock, CheckCircle, XCircle, AlertCircle, Eye, MousePointerClick, Pencil, RefreshCw, Repeat } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import dynamic from 'next/dynamic'

// CKEditor uses browser-only APIs (window, document), so it must be loaded
// client-side only via next/dynamic with ssr disabled.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor'),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-md border bg-gray-50" /> }
)

interface EmailCampaign {
  id: string
  campaign_name: string
  subject: string
  body: string
  target_audience: string
  scheduled_date: string | null
  sent_date: string | null
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  opened_count: number
  clicked_count: number
  is_recurring: boolean
  recurrence_frequency: string
  recurrence_interval: number
  recurrence_end_date: string | null
  last_sent_at: string | null
  notes: string
  created_at: string
  recipients?: EmailRecipient[]
}

interface EmailRecipient {
  id: string
  party_id: string | null
  email_address: string
  status: string
  error_message: string
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
}

interface Party {
  id: string
  name: string
  email: string
  party_type: string
}

interface EmailStats {
  total_campaigns: number
  sent_campaigns: number
  scheduled_campaigns: number
  total_sent: number
  total_failed: number
  total_opened: number
  total_clicked: number
}

export default function EmailMarketingPage() {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(campaigns)
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [sending, setSending] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCampaign, setEditCampaign] = useState<EmailCampaign | null>(null)
  const [editForm, setEditForm] = useState({
    campaign_name: '',
    subject: '',
    body: '',
    target_audience: '',
    scheduled_date: '',
    party_ids: [] as string[],
    email_addresses: [] as string[],
    notes: '',
    is_recurring: false,
    recurrence_frequency: '',
    recurrence_interval: 1,
    recurrence_end_date: ''
  })

  const [parties, setParties] = useState<Party[]>([])

  useEffect(() => {
    fetchCampaigns()
    fetchStats()
    fetchParties()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await apiFetch('/email-marketing')
      if (res.ok) setCampaigns(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await apiFetch('/email-marketing/stats')
      if (res.ok) setStats(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchParties = async () => {
    try {
      const res = await apiFetch('/parties')
      if (res.ok) setParties(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const handleSendCampaign = async (id: string) => {
    if (!(await confirm({
      title: 'Send campaign?',
      description: 'Are you sure you want to send this campaign?',
      confirmLabel: 'Send',
      variant: 'default',
    }))) return
    setSending(true)
    try {
      const res = await apiFetch(`/email-marketing/${id}/send`, {
        method: 'POST'
      })
      if (res.ok) {
        fetchCampaigns()
        fetchStats()
      } else {
        const data = await res.json()
        notifyError(data.error || 'Failed to send campaign')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setSending(false)
    }
  }

  const handleResendCampaign = async (id: string) => {
    if (!(await confirm({
      title: 'Re-send campaign?',
      description: 'This will re-send the campaign to all its recipients. Recipient statuses and send stats will be reset and recomputed for the new send.',
      confirmLabel: 'Re-send',
      variant: 'default',
    }))) return
    setSending(true)
    try {
      const res = await apiFetch(`/email-marketing/${id}/resend`, {
        method: 'POST'
      })
      if (res.ok) {
        notifySuccess('Campaign re-sent successfully')
        fetchCampaigns()
        fetchStats()
      } else {
        const data = await res.json()
        notifyError(data.error || 'Failed to re-send campaign')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setSending(false)
    }
  }

  const handleDeleteCampaign = async (id: string) => {
    if (!(await confirm({
      title: 'Delete campaign?',
      description: 'Are you sure you want to delete this campaign? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/email-marketing/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchCampaigns()
        fetchStats()
      } else {
        const data = await res.json()
        notifyError(data.error || 'Failed to delete campaign')
      }
    } catch (err) {
      notifyError('An error occurred')
    }
  }

  const handleViewDetails = async (campaign: EmailCampaign) => {
    try {
      const res = await apiFetch(`/email-marketing/${campaign.id}`)
      if (res.ok) {
        setSelectedCampaign(await res.json())
        setShowDetailsDialog(true)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Convert an ISO datetime string to the value format expected by an
  // <input type="datetime-local"> control (yyyy-MM-ddTHH:mm, local time).
  const isoToLocalInput = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleOpenEdit = async (campaign: EmailCampaign) => {
    try {
      const res = await apiFetch(`/email-marketing/${campaign.id}`)
      if (!res.ok) return
      const full: EmailCampaign = await res.json()
      setEditCampaign(full)
      const partyIds = (full.recipients || [])
        .map(r => r.party_id)
        .filter((p): p is string => !!p)
      const emails = (full.recipients || [])
        .filter(r => !r.party_id)
        .map(r => r.email_address)
      setEditForm({
        campaign_name: full.campaign_name,
        subject: full.subject,
        body: full.body,
        target_audience: full.target_audience,
        scheduled_date: isoToLocalInput(full.scheduled_date),
        party_ids: partyIds,
        email_addresses: emails,
        notes: full.notes || '',
        is_recurring: full.is_recurring,
        recurrence_frequency: full.recurrence_frequency || '',
        recurrence_interval: full.recurrence_interval || 1,
        recurrence_end_date: isoToLocalInput(full.recurrence_end_date)
      })
      setShowEditDialog(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCampaign) return
    // Rich text editor may produce empty HTML; validate a non-empty body.
    const bodyText = editForm.body.replace(/<[^>]*>/g, '').trim()
    if (!bodyText) {
      notifyError('Email body is required')
      return
    }
    setEditing(true)
    try {
      const { scheduled_date, recurrence_end_date, ...rest } = editForm
      const payload: Record<string, unknown> = {
        ...rest,
        is_recurring: editForm.is_recurring,
        recurrence_interval: editForm.recurrence_interval,
      }
      if (scheduled_date) {
        payload.scheduled_date = new Date(scheduled_date).toISOString()
      }
      if (editForm.is_recurring && recurrence_end_date) {
        payload.recurrence_end_date = new Date(recurrence_end_date).toISOString()
      }
      const res = await apiFetch(`/email-marketing/${editCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        notifySuccess('Campaign updated successfully')
        setShowEditDialog(false)
        setEditCampaign(null)
        fetchCampaigns()
        fetchStats()
      } else {
        const data = await res.json()
        notifyError(data.error || 'Failed to update campaign')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setEditing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-purple-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      completed: 'bg-purple-100 text-purple-700'
    }
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const formatRecurrence = (campaign: EmailCampaign) => {
    if (!campaign.is_recurring) return null
    const freq = campaign.recurrence_frequency
    const interval = campaign.recurrence_interval || 1
    const label = freq === 'daily' ? 'day(s)' : freq === 'weekly' ? 'week(s)' : freq === 'monthly' ? 'month(s)' : ''
    if (!label) return null
    return `Every ${interval > 1 ? interval + ' ' : ''}${label}`
  }

  const filteredEditParties = parties.filter(p => {
    if (editForm.target_audience === 'specific_customers') return p.party_type === 'customer' && p.email
    if (editForm.target_audience === 'specific_vendors') return p.party_type === 'vendor' && p.email
    return false
  })

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Email Marketing</h1>
          </div>
          <Button onClick={() => router.push('/email-marketing/create')}>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stats.total_campaigns}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.sent_campaigns}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Scheduled</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.scheduled_campaigns}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stats.total_sent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Opened</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.total_opened}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Clicked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.total_clicked}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
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
                      <th className="pb-3 font-medium">Campaign Name</th>
                      <th className="pb-3 font-medium">Subject</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Recipients</th>
                      <th className="pb-3 font-medium">Sent/Opened/Clicked</th>
                      <th className="pb-3 font-medium">Created</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((campaign) => (
                      <tr key={campaign.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{campaign.campaign_name}</td>
                        <td className="py-3 text-gray-600">{campaign.subject}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(campaign.status)}
                            {getStatusBadge(campaign.status)}
                            {campaign.is_recurring && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600" title={formatRecurrence(campaign) || ''}>
                                <Repeat className="h-3 w-3" />
                                Recurring
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-gray-600">{campaign.total_recipients}</td>
                        <td className="py-3 text-gray-600">
                          <span className="text-green-600">{campaign.sent_count}</span>
                          {campaign.opened_count > 0 && <span className="text-purple-600"> / {campaign.opened_count}</span>}
                          {campaign.clicked_count > 0 && <span className="text-orange-600"> / {campaign.clicked_count}</span>}
                        </td>
                        <td className="py-3 text-gray-600">{formatDate(campaign.created_at)}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(campaign)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'completed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(campaign)}
                                title="Edit campaign"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendCampaign(campaign.id)}
                                disabled={sending}
                                title="Send campaign"
                              >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              </Button>
                            )}
                            {(campaign.status === 'sent' || campaign.status === 'failed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendCampaign(campaign.id)}
                                disabled={sending}
                                title="Re-send campaign"
                              >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              </Button>
                            )}
                            {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'completed' || campaign.status === 'failed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {campaigns.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          No email campaigns created yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <p className="text-sm font-medium">{selectedCampaign.campaign_name}</p>
              </div>
              <div>
                <Label>Subject</Label>
                <p className="text-sm font-medium">{selectedCampaign.subject}</p>
              </div>
              <div>
                <Label>Email Body</Label>
                <p className="text-sm bg-gray-50 p-3 rounded-md whitespace-pre-wrap">{selectedCampaign.body}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedCampaign.status)}
                    {getStatusBadge(selectedCampaign.status)}
                  </div>
                </div>
                <div>
                  <Label>Target Audience</Label>
                  <p className="text-sm capitalize">{selectedCampaign.target_audience.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label>Total Recipients</Label>
                  <p className="text-sm">{selectedCampaign.total_recipients}</p>
                </div>
                <div>
                  <Label>Sent/Opened/Clicked</Label>
                  <p className="text-sm">
                    <span className="text-green-600">{selectedCampaign.sent_count}</span>
                    {selectedCampaign.opened_count > 0 && <span className="text-purple-600"> / {selectedCampaign.opened_count}</span>}
                    {selectedCampaign.clicked_count > 0 && <span className="text-orange-600"> / {selectedCampaign.clicked_count}</span>}
                  </p>
                </div>
              </div>
              {selectedCampaign.scheduled_date && (
                <div>
                  <Label>Scheduled Date</Label>
                  <p className="text-sm">{formatDate(selectedCampaign.scheduled_date)}</p>
                </div>
              )}
              {selectedCampaign.is_recurring && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <Repeat className="h-4 w-4" />
                    Recurring Campaign
                  </div>
                  <p className="text-sm text-blue-800">{formatRecurrence(selectedCampaign)}</p>
                  {selectedCampaign.recurrence_end_date && (
                    <p className="text-xs text-blue-600">Until: {formatDate(selectedCampaign.recurrence_end_date)}</p>
                  )}
                  {selectedCampaign.last_sent_at && (
                    <p className="text-xs text-blue-600">Last sent: {formatDate(selectedCampaign.last_sent_at)}</p>
                  )}
                </div>
              )}
              {selectedCampaign.sent_date && (
                <div>
                  <Label>Sent Date</Label>
                  <p className="text-sm">{formatDate(selectedCampaign.sent_date)}</p>
                </div>
              )}
              {selectedCampaign.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm">{selectedCampaign.notes}</p>
                </div>
              )}
              {selectedCampaign.recipients && selectedCampaign.recipients.length > 0 && (
                <div>
                  <Label>Recipients</Label>
                  <div className="table-scroll mt-2 max-h-60 border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Email Address</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Sent At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCampaign.recipients.map((recipient) => (
                          <tr key={recipient.id} className="border-t">
                            <td className="px-3 py-2">{recipient.email_address}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                recipient.status === 'sent' ? 'bg-green-100 text-green-700' :
                                recipient.status === 'opened' ? 'bg-purple-100 text-purple-700' :
                                recipient.status === 'clicked' ? 'bg-orange-100 text-orange-700' :
                                recipient.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {recipient.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">{recipient.sent_at ? formatDate(recipient.sent_at) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCampaign} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-name">Campaign Name *</Label>
              <Input
                id="edit-campaign-name"
                value={editForm.campaign_name}
                onChange={(e) => setEditForm({ ...editForm, campaign_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject *</Label>
              <Input
                id="edit-subject"
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-target-audience">Target Audience *</Label>
              <Select
                value={editForm.target_audience}
                onValueChange={(value) => setEditForm({ ...editForm, target_audience: value, party_ids: [], email_addresses: [] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_customers">All Customers</SelectItem>
                  <SelectItem value="all_vendors">All Vendors</SelectItem>
                  <SelectItem value="specific_customers">Specific Customers</SelectItem>
                  <SelectItem value="specific_vendors">Specific Vendors</SelectItem>
                  <SelectItem value="custom_emails">Custom Email Addresses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(editForm.target_audience === 'specific_customers' || editForm.target_audience === 'specific_vendors') && (
              <div className="space-y-2">
                <Label>Select Parties *</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                  {filteredEditParties.map(party => (
                    <label key={party.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.party_ids.includes(party.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({ ...editForm, party_ids: [...editForm.party_ids, party.id] })
                          } else {
                            setEditForm({ ...editForm, party_ids: editForm.party_ids.filter(id => id !== party.id) })
                          }
                        }}
                        className="rounded"
                      />
                      <span>{party.name} ({party.email})</span>
                    </label>
                  ))}
                  {filteredEditParties.length === 0 && (
                    <p className="text-sm text-gray-500">No parties available</p>
                  )}
                </div>
              </div>
            )}
            {editForm.target_audience === 'custom_emails' && (
              <div className="space-y-2">
                <Label htmlFor="edit-email-addresses">Email Addresses (comma separated) *</Label>
                <Input
                  id="edit-email-addresses"
                  value={editForm.email_addresses.join(', ')}
                  onChange={(e) => setEditForm({ ...editForm, email_addresses: e.target.value.split(',').map(e => e.trim()).filter(e => e) })}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-body">Email Body *</Label>
              <RichTextEditor
                id="edit-body"
                value={editForm.body}
                onChange={(value) => setEditForm({ ...editForm, body: value })}
                placeholder="Enter your email content..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scheduled-date">Schedule Date &amp; Time</Label>
              <Input
                id="edit-scheduled-date"
                type="datetime-local"
                value={editForm.scheduled_date}
                onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Update the scheduled time. A past date sends the campaign immediately. Leave as-is to keep the existing schedule.
              </p>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={editForm.is_recurring}
                  onChange={(e) => setEditForm({ ...editForm, is_recurring: e.target.checked })}
                  className="rounded"
                />
                <Repeat className="h-4 w-4" />
                Make this a recurring campaign
              </label>
              {editForm.is_recurring && (
                <div className="space-y-3 pl-6">
                  <p className="text-xs text-gray-500">
                    The campaign will auto-send on the chosen cadence starting from the scheduled date.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-recurrence-frequency">Frequency *</Label>
                      <Select
                        value={editForm.recurrence_frequency}
                        onValueChange={(value) => setEditForm({ ...editForm, recurrence_frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-recurrence-interval">Every (interval)</Label>
                      <Input
                        id="edit-recurrence-interval"
                        type="number"
                        min={1}
                        value={editForm.recurrence_interval}
                        onChange={(e) => setEditForm({ ...editForm, recurrence_interval: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-recurrence-end-date">End Date (Optional)</Label>
                    <Input
                      id="edit-recurrence-end-date"
                      type="datetime-local"
                      value={editForm.recurrence_end_date}
                      onChange={(e) => setEditForm({ ...editForm, recurrence_end_date: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Leave empty to repeat indefinitely.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>
            <Button type="submit" disabled={editing} className="w-full">
              {editing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </DashboardLayout>
  )
}
