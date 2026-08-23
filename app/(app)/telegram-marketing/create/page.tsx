'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Loader2, ArrowLeft } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { TELEGRAM_AUDIENCE_OPTIONS, createTelegramCampaign } from '@/lib/telegram'

interface Party {
  id: string
  name: string
  telegram_chat_id: string
  party_type: string
}

const emptyForm = {
  campaign_name: '',
  message: '',
  media_url: '',
  target_audience: '',
  scheduled_date: '',
  party_ids: [] as string[],
  chat_targets: [] as string[],
  notes: '',
}

export default function CreateTelegramCampaignPage() {
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

  const filteredParties = parties.filter((p) => {
    if (form.target_audience === 'specific_customers') return p.party_type === 'customer' && p.telegram_chat_id
    if (form.target_audience === 'specific_vendors') return p.party_type === 'vendor' && p.telegram_chat_id
    return false
  })

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.message.trim()) {
      notifyError('Message is required')
      return
    }
    setCreating(true)
    try {
      const payload = {
        campaign_name: form.campaign_name,
        message: form.message,
        media_url: form.media_url,
        target_audience: form.target_audience,
        party_ids: form.party_ids,
        chat_targets: form.chat_targets,
        notes: form.notes,
        scheduled_date: form.scheduled_date
          ? new Date(form.scheduled_date).toISOString()
          : undefined,
      }
      await createTelegramCampaign(payload)
      notifySuccess('Campaign created successfully')
      router.push('/telegram-marketing')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/telegram-marketing')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="app-page-title">Create Telegram Campaign</h1>
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
                  placeholder="e.g., Diwali Offer Broadcast"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-audience">Target Audience *</Label>
                <Select
                  value={form.target_audience}
                  onValueChange={(value) =>
                    setForm({ ...form, target_audience: value, party_ids: [], chat_targets: [] })
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
                <p className="text-xs text-gray-500">
                  Party-based audiences use the Telegram Chat ID field on each Party. Set it on the Parties page first.
                </p>
              </div>
              {(form.target_audience === 'specific_customers' ||
                form.target_audience === 'specific_vendors') && (
                <div className="space-y-2">
                  <Label>Select Parties *</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                    {filteredParties.map((party) => (
                      <label key={party.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.party_ids.includes(party.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, party_ids: [...form.party_ids, party.id] })
                            } else {
                              setForm({
                                ...form,
                                party_ids: form.party_ids.filter((id) => id !== party.id),
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
                    {filteredParties.length === 0 && (
                      <p className="text-sm text-gray-500">No parties with a Telegram chat ID available</p>
                    )}
                  </div>
                </div>
              )}
              {form.target_audience === 'custom_chats' && (
                <div className="space-y-2">
                  <Label htmlFor="chat-targets">Chat IDs / @channels (comma separated) *</Label>
                  <Input
                    id="chat-targets"
                    value={form.chat_targets.join(', ')}
                    onChange={(e) =>
                      setForm({
                        ...form,
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
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={6}
                  required
                  placeholder="Enter the message to broadcast…"
                />
                <p className="text-xs text-gray-500">
                  Plain text. Telegram supports Markdown-style formatting (*bold*, _italic_, `code`).
                </p>
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
                  If set, the campaign is scheduled and will be sent automatically at this time. Leave empty to save as draft and send manually later.
                </p>
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
