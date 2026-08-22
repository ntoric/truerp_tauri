'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Loader2, Repeat, ArrowLeft } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

// CKEditor uses browser-only APIs (window, document), so it must be loaded
// client-side only via next/dynamic with ssr disabled.
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor'),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-md border bg-gray-50" /> }
)

interface Party {
  id: string
  name: string
  email: string
  party_type: string
}

const emptyForm = {
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
}

export default function CreateEmailCampaignPage() {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [parties, setParties] = useState<Party[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = async () => {
    try {
      const res = await apiFetch('/parties')
      if (res.ok) setParties(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const filteredParties = parties.filter(p => {
    if (form.target_audience === 'specific_customers') return p.party_type === 'customer' && p.email
    if (form.target_audience === 'specific_vendors') return p.party_type === 'vendor' && p.email
    return false
  })

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    // Rich text editor may produce empty HTML; validate a non-empty body.
    const bodyText = form.body.replace(/<[^>]*>/g, '').trim()
    if (!bodyText) {
      notifyError('Email body is required')
      return
    }
    setCreating(true)
    try {
      const { scheduled_date, recurrence_end_date, ...rest } = form
      const payload: Record<string, unknown> = {
        ...rest,
        ...(scheduled_date
          ? { scheduled_date: new Date(scheduled_date).toISOString() }
          : {}),
        ...(form.is_recurring && recurrence_end_date
          ? { recurrence_end_date: new Date(recurrence_end_date).toISOString() }
          : {}),
      }
      const res = await apiFetch('/email-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        notifySuccess('Campaign created successfully')
        router.push('/email-marketing')
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/email-marketing')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="app-page-title">Create Email Campaign</h1>
        </div>

        <form onSubmit={handleCreateCampaign}>
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name *</Label>
                <Input
                  id="campaign-name"
                  value={form.campaign_name}
                  onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
                  required
                  placeholder="e.g., Monthly Newsletter"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  required
                  placeholder="Email subject line"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-audience">Target Audience *</Label>
                <Select
                  value={form.target_audience}
                  onValueChange={(value) => setForm({ ...form, target_audience: value, party_ids: [], email_addresses: [] })}
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
              {(form.target_audience === 'specific_customers' || form.target_audience === 'specific_vendors') && (
                <div className="space-y-2">
                  <Label>Select Parties *</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                    {filteredParties.map(party => (
                      <label key={party.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.party_ids.includes(party.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, party_ids: [...form.party_ids, party.id] })
                            } else {
                              setForm({ ...form, party_ids: form.party_ids.filter(id => id !== party.id) })
                            }
                          }}
                          className="rounded"
                        />
                        <span>{party.name} ({party.email})</span>
                      </label>
                    ))}
                    {filteredParties.length === 0 && (
                      <p className="text-sm text-gray-500">No parties available</p>
                    )}
                  </div>
                </div>
              )}
              {form.target_audience === 'custom_emails' && (
                <div className="space-y-2">
                  <Label htmlFor="email-addresses">Email Addresses (comma separated) *</Label>
                  <Input
                    id="email-addresses"
                    value={form.email_addresses.join(', ')}
                    onChange={(e) => setForm({ ...form, email_addresses: e.target.value.split(',').map(e => e.trim()).filter(e => e) })}
                    placeholder="e.g., user1@example.com, user2@example.com"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="body">Email Body *</Label>
                <RichTextEditor
                  id="body"
                  value={form.body}
                  onChange={(value) => setForm({ ...form, body: value })}
                  placeholder="Enter your email content..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Schedule Date &amp; Time (Optional)</Label>
                <Input
                  id="scheduled-date"
                  type="datetime-local"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  If set, the campaign is scheduled and will be sent automatically at this time (not saved as draft).
                  Leave empty to save as draft and send manually later.
                </p>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.is_recurring}
                    onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                    className="rounded"
                  />
                  <Repeat className="h-4 w-4" />
                  Make this a recurring campaign
                </label>
                {form.is_recurring && (
                  <div className="space-y-3 pl-6">
                    <p className="text-xs text-gray-500">
                      Recurring campaigns require a schedule date above (the first send time) and will auto-send on the chosen cadence.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="recurrence-frequency">Frequency *</Label>
                        <Select
                          value={form.recurrence_frequency}
                          onValueChange={(value) => setForm({ ...form, recurrence_frequency: value })}
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
                        <Label htmlFor="recurrence-interval">Every (interval)</Label>
                        <Input
                          id="recurrence-interval"
                          type="number"
                          min={1}
                          value={form.recurrence_interval}
                          onChange={(e) => setForm({ ...form, recurrence_interval: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="recurrence-end-date">End Date (Optional)</Label>
                      <Input
                        id="recurrence-end-date"
                        type="datetime-local"
                        value={form.recurrence_end_date}
                        onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
                      />
                      <p className="text-xs text-gray-500">Leave empty to repeat indefinitely.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  )
}
