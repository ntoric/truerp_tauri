'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PaginationControls from '@/components/ui/pagination-controls'
import { Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  MARKETING_CHANNELS,
  campaignChannels,
  campaignTypeLabel,
  channelLabel,
  marketingApi,
  type DeliveriesResponse,
  type MarketingCampaign,
} from '@/lib/marketing'
import { CHANNEL_ICONS } from './ChannelStatusPanel'

const PER_PAGE = 50

export default function CampaignDetailsDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: MarketingCampaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [data, setData] = useState<DeliveriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [channel, setChannel] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!campaign) return
    setLoading(true)
    try {
      setData(
        await marketingApi.deliveries(campaign.id, {
          page,
          status: status === 'all' ? '' : status,
          channel: channel === 'all' ? '' : channel,
          search,
        })
      )
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [campaign, page, status, channel, search])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    setPage(1)
  }, [status, channel, search, campaign?.id])

  if (!campaign) return null
  const channels = campaignChannels(campaign)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {campaign.name} <StatusBadge status={campaign.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Type</div>
            <div>{campaignTypeLabel(campaign.type)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{campaign.sent_at ? 'Sent' : campaign.scheduled_at ? 'Scheduled for' : 'Created'}</div>
            <div>{formatDate(campaign.sent_at || campaign.scheduled_at || campaign.created_at)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Audience</div>
            <div>{campaign.total_recipients} parties</div>
          </div>
        </div>

        {campaign.last_error && (
          <div className="whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{campaign.last_error}</div>
        )}

        {/* Per-channel summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((ch) => {
            const s = data?.summary?.[ch] || {}
            const meta = CHANNEL_ICONS[ch]
            const Icon = meta.icon
            return (
              <div key={ch} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Icon className={`h-4 w-4 ${meta.color}`} /> {channelLabel(ch)}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="text-emerald-700">{s.sent ?? 0} sent</span> · <span className="text-rose-700">{s.failed ?? 0} failed</span> ·{' '}
                  {s.skipped ?? 0} skipped
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party or address" className="h-9 max-w-xs" />
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {MARKETING_CHANNELS.filter((c) => channels.includes(c.value)).map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Party</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && (data?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {campaign.status === 'draft' || campaign.status === 'scheduled' ? 'Not sent yet.' : 'No deliveries match.'}
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">{d.party_name || '—'}</td>
                    <td className="px-3 py-2">{channelLabel(d.channel)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.recipient || '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={d.status} tone={d.status === 'skipped' ? 'neutral' : undefined} />
                    </td>
                    <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">{d.error}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {data && data.total > PER_PAGE && (
          <PaginationControls page={page} totalPages={totalPages} totalItems={data.total} pageSize={PER_PAGE} onPageChange={setPage} />
        )}
      </DialogContent>
    </Dialog>
  )
}
