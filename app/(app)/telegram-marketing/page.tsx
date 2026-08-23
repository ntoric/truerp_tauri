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
import { Plus, Send, Loader2, Clock, CheckCircle, XCircle, AlertCircle, Eye, Pencil, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  type TelegramCampaign,
  type TelegramCampaignStats,
  type TelegramRecipient,
  TELEGRAM_AUDIENCE_OPTIONS,
  getTelegramCampaigns,
  getTelegramStats,
  sendTelegramCampaign,
  deleteTelegramCampaign,
  updateTelegramCampaign,
} from '@/lib/telegram'

interface Party {
  id: string
  name: string
  telegram_chat_id: string
  party_type: string
}

const emptyEditForm = {
  campaign_name: '',
  message: '',
  media_url: '',
  target_audience: '',
  scheduled_date: '',
  party_ids: [] as string[],
  chat_targets: [] as string[],
  notes: '',
}

export default function TelegramMarketingPage() {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [campaigns, setCampaigns] = useState<TelegramCampaign[]>([])
  const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(campaigns)
  const [stats, setStats] = useState<TelegramCampaignStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<TelegramCampaign | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [sending, setSending] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCampaign, setEditCampaign] = useState<TelegramCampaign | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [parties, setParties] = useState<Party[]>([])

  useEffect(() => {
    fetchCampaigns()
    fetchStats()
    fetchParties()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setCampaigns(await getTelegramCampaigns())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      setStats(await getTelegramStats())
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
      description: 'Are you sure you want to send this Telegram campaign to all recipients?',
      confirmLabel: 'Send',
      variant: 'default',
    }))) return
    setSending(true)
    try {
      await sendTelegramCampaign(id)
      notifySuccess('Campaign sent successfully')
      fetchCampaigns()
      fetchStats()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to send campaign')
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
      await deleteTelegramCampaign(id)
      notifySuccess('Campaign deleted')
      fetchCampaigns()
      fetchStats()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete campaign')
    }
  }

  const handleViewDetails = async (campaign: TelegramCampaign) => {
    setSelectedCampaign(campaign)
    setShowDetailsDialog(true)
  }

  const isoToLocalInput = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleOpenEdit = (campaign: TelegramCampaign) => {
    setEditCampaign(campaign)
    const partyIds = (campaign.recipients || [])
      .map((r) => r.party_id)
      .filter((p): p is string => !!p)
    const chats = (campaign.recipients || [])
      .filter((r) => !r.party_id)
      .map((r) => r.chat_target)
    setEditForm({
      campaign_name: campaign.campaign_name,
      message: campaign.message,
      media_url: campaign.media_url || '',
      target_audience: campaign.target_audience,
      scheduled_date: isoToLocalInput(campaign.scheduled_date),
      party_ids: partyIds,
      chat_targets: chats,
      notes: campaign.notes || '',
    })
    setShowEditDialog(true)
  }

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCampaign) return
    if (!editForm.message.trim()) {
      notifyError('Message is required')
      return
    }
    setEditing(true)
    try {
      const payload: Record<string, unknown> = {
        campaign_name: editForm.campaign_name,
        message: editForm.message,
        media_url: editForm.media_url,
        target_audience: editForm.target_audience,
        party_ids: editForm.party_ids,
        chat_targets: editForm.chat_targets,
        notes: editForm.notes,
      }
      if (editForm.scheduled_date) {
        payload.scheduled_date = new Date(editForm.scheduled_date).toISOString()
      }
      await updateTelegramCampaign(editCampaign.id, payload)
      notifySuccess('Campaign updated successfully')
      setShowEditDialog(false)
      setEditCampaign(null)
      fetchCampaigns()
      fetchStats()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to update campaign')
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
    }
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const audienceLabel = (value: string) =>
    TELEGRAM_AUDIENCE_OPTIONS.find((o) => o.value === value)?.label || value

  const filteredEditParties = parties.filter((p) => {
    if (editForm.target_audience === 'specific_customers') return p.party_type === 'customer' && p.telegram_chat_id
    if (editForm.target_audience === 'specific_vendors') return p.party_type === 'vendor' && p.telegram_chat_id
    return false
  })

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Telegram Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Broadcast messages to Telegram chats and channels via your configured bot.
            </p>
          </div>
          <Button onClick={() => router.push('/telegram-marketing/create')}>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <CardTitle className="text-sm font-medium text-gray-600">Total Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.total_failed}</div>
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
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-gray-500">
                No Telegram campaigns yet. Click “New Campaign” to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedItems.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(campaign.status)}
                        <span className="font-medium">{campaign.campaign_name}</span>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {audienceLabel(campaign.target_audience)} · {campaign.total_recipients} recipient(s)
                        {campaign.sent_count > 0 && ` · sent ${campaign.sent_count}`}
                        {campaign.failed_count > 0 && ` · failed ${campaign.failed_count}`}
                      </div>
                      {campaign.scheduled_date && (
                        <div className="text-xs text-gray-500">
                          Scheduled: {formatDate(campaign.scheduled_date)}{' '}
                          {new Date(campaign.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {campaign.sent_date && (
                        <div className="text-xs text-gray-500">
                          Sent: {formatDate(campaign.sent_date)}{' '}
                          {new Date(campaign.sent_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(campaign)}>
                        <Eye className="mr-2 h-4 w-4" /> Details
                      </Button>
                      {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(campaign)}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Button>
                      )}
                      {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <Button
                          size="sm"
                          onClick={() => handleSendCampaign(campaign.id)}
                          disabled={sending}
                        >
                          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          Send
                        </Button>
                      )}
                      {campaign.status !== 'sent' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
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

      {confirmDialog}

      {/* Details dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.campaign_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <pre className="mt-1 whitespace-pre-wrap rounded-md border bg-gray-50 p-3 text-sm">
                {selectedCampaign?.message}
              </pre>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label>Audience</Label>
                <div className="mt-1">{selectedCampaign && audienceLabel(selectedCampaign.target_audience)}</div>
              </div>
              <div>
                <Label>Status</Label>
                <div className="mt-1">{selectedCampaign && getStatusBadge(selectedCampaign.status)}</div>
              </div>
              <div>
                <Label>Recipients</Label>
                <div className="mt-1">{selectedCampaign?.total_recipients}</div>
              </div>
              <div>
                <Label>Sent / Failed</Label>
                <div className="mt-1">
                  {selectedCampaign?.sent_count} / {selectedCampaign?.failed_count}
                </div>
              </div>
            </div>
            <div>
              <Label>Recipient results</Label>
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="p-2">Chat target</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedCampaign?.recipients || []).map((r: TelegramRecipient) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{r.chat_target}</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2 text-xs text-red-600">{r.error_message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
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
              <Label htmlFor="edit-target-audience">Target Audience *</Label>
              <Select
                value={editForm.target_audience}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, target_audience: value, party_ids: [], chat_targets: [] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target audience" />
                </SelectTrigger>
                <SelectContent>
                  {TELEGRAM_AUDIENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(editForm.target_audience === 'specific_customers' ||
              editForm.target_audience === 'specific_vendors') && (
              <div className="space-y-2">
                <Label>Select Parties *</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                  {filteredEditParties.map((party) => (
                    <label key={party.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.party_ids.includes(party.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({ ...editForm, party_ids: [...editForm.party_ids, party.id] })
                          } else {
                            setEditForm({
                              ...editForm,
                              party_ids: editForm.party_ids.filter((id) => id !== party.id),
                            })
                          }
                        }}
                        className="rounded"
                      />
                      <span>
                        {party.name} ({party.telegram_chat_id})
                      </span>
                    </label>
                  ))}
                  {filteredEditParties.length === 0 && (
                    <p className="text-sm text-gray-500">No parties with a Telegram chat ID available</p>
                  )}
                </div>
              </div>
            )}
            {editForm.target_audience === 'custom_chats' && (
              <div className="space-y-2">
                <Label htmlFor="edit-chat-targets">Chat IDs / @channels (comma separated) *</Label>
                <Input
                  id="edit-chat-targets"
                  value={editForm.chat_targets.join(', ')}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      chat_targets: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="e.g., 123456789, @mychannel"
                  required
                />
                <p className="text-xs text-gray-500">
                  Numeric chat IDs for private chats/groups, or @channelusername for channels. The bot must be a member with send permission.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-message">Message *</Label>
              <Textarea
                id="edit-message"
                value={editForm.message}
                onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                rows={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-scheduled-date">Schedule Date &amp; Time (Optional)</Label>
              <Input
                id="edit-scheduled-date"
                type="datetime-local"
                value={editForm.scheduled_date}
                onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
              />
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
    </DashboardLayout>
  )
}
