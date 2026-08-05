'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Send, Calendar, Users, MessageSquare, Loader2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface SMSCampaign {
  id: string
  campaign_name: string
  message: string
  target_audience: string
  scheduled_date: string | null
  sent_date: string | null
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  notes: string
  created_at: string
  recipients?: SMSRecipient[]
}

interface SMSRecipient {
  id: string
  phone_number: string
  status: string
  error_message: string
  sent_at: string | null
}

interface Party {
  id: string
  name: string
  phone: string
  party_type: string
}

interface SMSStats {
  total_campaigns: number
  sent_campaigns: number
  scheduled_campaigns: number
  total_sent: number
  total_failed: number
}

export default function SMSMarketingPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([])
  const { page, setPage, totalPages, totalItems, paginatedItems, pageSize } = usePagination(campaigns)
  const [stats, setStats] = useState<SMSStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<SMSCampaign | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  
  const [newCampaign, setNewCampaign] = useState({
    campaign_name: '',
    message: '',
    target_audience: '',
    scheduled_date: '',
    party_ids: [] as string[],
    phone_numbers: [] as string[],
    notes: ''
  })

  const [parties, setParties] = useState<Party[]>([])

  useEffect(() => {
    fetchCampaigns()
    fetchStats()
    fetchParties()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await apiFetch('/sms-marketing')
      if (res.ok) setCampaigns(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await apiFetch('/sms-marketing/stats')
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

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await apiFetch('/sms-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCampaign)
      })
      if (res.ok) {
        setNewCampaign({
          campaign_name: '',
          message: '',
          target_audience: '',
          scheduled_date: '',
          party_ids: [],
          phone_numbers: [],
          notes: ''
        })
        setShowCreateDialog(false)
        fetchCampaigns()
        fetchStats()
      } else {
        const data = await res.json()
        notifyError(data.error || 'Failed to create campaign')
      }
    } catch (err) {
      notifyError('An error occurred')
    } finally {
      setCreating(false)
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
      const res = await apiFetch(`/sms-marketing/${id}/send`, {
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

  const handleDeleteCampaign = async (id: string) => {
    if (!(await confirm({
      title: 'Delete campaign?',
      description: 'Are you sure you want to delete this campaign? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/sms-marketing/${id}`, {
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

  const handleViewDetails = async (campaign: SMSCampaign) => {
    try {
      const res = await apiFetch(`/sms-marketing/${campaign.id}`)
      if (res.ok) {
        setSelectedCampaign(await res.json())
        setShowDetailsDialog(true)
      }
    } catch (err) {
      console.error(err)
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
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700'
    }
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const filteredParties = parties.filter(p => {
    if (newCampaign.target_audience === 'specific_customers') return p.party_type === 'customer' && p.phone
    if (newCampaign.target_audience === 'specific_vendors') return p.party_type === 'vendor' && p.phone
    return false
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SMS Marketing</h1>
            <p className="text-sm text-gray-500">Manage your SMS campaigns</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Campaign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create SMS Campaign</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign Name *</Label>
                  <Input
                    id="campaign-name"
                    value={newCampaign.campaign_name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, campaign_name: e.target.value })}
                    required
                    placeholder="e.g., Summer Sale Promotion"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-audience">Target Audience *</Label>
                  <Select
                    value={newCampaign.target_audience}
                    onValueChange={(value) => setNewCampaign({ ...newCampaign, target_audience: value, party_ids: [], phone_numbers: [] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_customers">All Customers</SelectItem>
                      <SelectItem value="all_vendors">All Vendors</SelectItem>
                      <SelectItem value="specific_customers">Specific Customers</SelectItem>
                      <SelectItem value="specific_vendors">Specific Vendors</SelectItem>
                      <SelectItem value="custom_numbers">Custom Phone Numbers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(newCampaign.target_audience === 'specific_customers' || newCampaign.target_audience === 'specific_vendors') && (
                  <div className="space-y-2">
                    <Label>Select Parties *</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                      {filteredParties.map(party => (
                        <label key={party.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newCampaign.party_ids.includes(party.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCampaign({ ...newCampaign, party_ids: [...newCampaign.party_ids, party.id] })
                              } else {
                                setNewCampaign({ ...newCampaign, party_ids: newCampaign.party_ids.filter(id => id !== party.id) })
                              }
                            }}
                            className="rounded"
                          />
                          <span>{party.name} ({party.phone})</span>
                        </label>
                      ))}
                      {filteredParties.length === 0 && (
                        <p className="text-sm text-gray-500">No parties available</p>
                      )}
                    </div>
                  </div>
                )}
                {newCampaign.target_audience === 'custom_numbers' && (
                  <div className="space-y-2">
                    <Label htmlFor="phone-numbers">Phone Numbers (comma separated) *</Label>
                    <Input
                      id="phone-numbers"
                      value={newCampaign.phone_numbers.join(', ')}
                      onChange={(e) => setNewCampaign({ ...newCampaign, phone_numbers: e.target.value.split(',').map(p => p.trim()).filter(p => p) })}
                      placeholder="e.g., 9876543210, 9123456789"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={newCampaign.message}
                    onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                    required
                    placeholder="Enter your SMS message..."
                    rows={4}
                    maxLength={160}
                  />
                  <p className="text-xs text-gray-500">{newCampaign.message.length}/160 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Schedule Date (Optional)</Label>
                  <Input
                    id="scheduled-date"
                    type="datetime-local"
                    value={newCampaign.scheduled_date}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newCampaign.notes}
                    onChange={(e) => setNewCampaign({ ...newCampaign, notes: e.target.value })}
                    placeholder="Add any notes..."
                    rows={2}
                  />
                </div>
                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create Campaign
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
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
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Campaign Name</th>
                      <th className="pb-3 font-medium">Target Audience</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Recipients</th>
                      <th className="pb-3 font-medium">Sent/Failed</th>
                      <th className="pb-3 font-medium">Created</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((campaign) => (
                      <tr key={campaign.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{campaign.campaign_name}</td>
                        <td className="py-3 text-gray-600 capitalize">{campaign.target_audience.replace('_', ' ')}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(campaign.status)}
                            {getStatusBadge(campaign.status)}
                          </div>
                        </td>
                        <td className="py-3 text-gray-600">{campaign.total_recipients}</td>
                        <td className="py-3 text-gray-600">
                          <span className="text-green-600">{campaign.sent_count}</span>
                          {campaign.failed_count > 0 && <span className="text-red-600"> / {campaign.failed_count}</span>}
                        </td>
                        <td className="py-3 text-gray-600">{formatDate(campaign.created_at)}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(campaign)}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendCampaign(campaign.id)}
                                disabled={sending}
                              >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              </Button>
                            )}
                            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
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
                          No SMS campaigns created yet
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
                <Label>Message</Label>
                <p className="text-sm bg-gray-50 p-3 rounded-md">{selectedCampaign.message}</p>
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
                  <Label>Sent/Failed</Label>
                  <p className="text-sm">
                    <span className="text-green-600">{selectedCampaign.sent_count}</span>
                    {selectedCampaign.failed_count > 0 && <span className="text-red-600"> / {selectedCampaign.failed_count}</span>}
                  </p>
                </div>
              </div>
              {selectedCampaign.scheduled_date && (
                <div>
                  <Label>Scheduled Date</Label>
                  <p className="text-sm">{formatDate(selectedCampaign.scheduled_date)}</p>
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
                  <div className="mt-2 max-h-60 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Phone Number</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Sent At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCampaign.recipients.map((recipient) => (
                          <tr key={recipient.id} className="border-t">
                            <td className="px-3 py-2">{recipient.phone_number}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                recipient.status === 'sent' ? 'bg-green-100 text-green-700' :
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
      {confirmDialog}
    </DashboardLayout>
  )
}
