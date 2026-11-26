'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import BrandLoader from '@/components/BrandLoader'
import PremiumEmpty from '@/components/ui/premium-empty'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  CalendarClock,
  Copy,
  Eye,
  Loader2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import WhatsAppTemplateLibrary from '@/components/marketing/WhatsAppTemplateLibrary'
import ChannelStatusPanel, { CHANNEL_ICONS } from '@/components/marketing/ChannelStatusPanel'
import CampaignDetailsDialog from '@/components/marketing/CampaignDetailsDialog'
import {
  campaignChannels,
  campaignTypeLabel,
  marketingApi,
  MarketingApiError,
  type ChannelsResponse,
  type MarketingCampaign,
  type MarketingStats,
} from '@/lib/marketing'

const TABS = ['campaigns', 'templates', 'channels'] as const
type Tab = (typeof TABS)[number]

function MarketingHub() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const rawTab = params.get('tab')
  // Sub-tabs can be switched off in Developer Settings → Pages & Menus.
  const { isPageEnabled } = usePageFeatures()
  const templatesEnabled = isPageEnabled('/marketing/whatsapp-templates')
  const channelsEnabled = isPageEnabled('/marketing/channels')
  const tabEnabled = (t: string) => (t === 'templates' ? templatesEnabled : t === 'channels' ? channelsEnabled : true)
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? '') && tabEnabled(rawTab!) ? (rawTab as Tab) : 'campaigns'
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false })

  const { confirm, confirmDialog } = useConfirmDialog()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [stats, setStats] = useState<MarketingStats | null>(null)
  const [channels, setChannels] = useState<ChannelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [details, setDetails] = useState<MarketingCampaign | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, st, ch] = await Promise.all([marketingApi.list(), marketingApi.stats(), marketingApi.channels()])
      setCampaigns(list)
      setStats(st)
      setChannels(ch)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Poll while any campaign is sending so progress and results appear.
  const sending = campaigns.some((c) => c.status === 'sending')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!sending) return
    pollRef.current = setInterval(load, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [sending, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return campaigns.filter(
      (c) => (statusFilter === 'all' || c.status === statusFilter) && (!q || c.name.toLowerCase().includes(q) || (c.offer_code || '').toLowerCase().includes(q))
    )
  }, [campaigns, search, statusFilter])

  const readyCount = channels?.channels.filter((c) => c.ready).length ?? 0

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id)
    try {
      await fn()
      notifySuccess(ok)
      await load()
    } catch (e) {
      const err = e as MarketingApiError
      notifyError(err.errors?.length ? err.errors.join('\n') : err.message)
    } finally {
      setBusyId(null)
    }
  }

  const sendNow = async (c: MarketingCampaign) => {
    const ok = await confirm({
      title: `Send "${c.name}" now?`,
      description: `It goes to the whole audience on ${campaignChannels(c).length} channel(s). Messages can't be recalled.`,
      confirmLabel: 'Send now',
    })
    if (ok) run(c.id, () => marketingApi.send(c.id), 'Campaign is sending. Results appear as messages go out.')
  }

  const remove = async (c: MarketingCampaign) => {
    const ok = await confirm({ title: `Delete "${c.name}"?`, description: 'The campaign and its delivery log are removed.', variant: 'destructive', confirmLabel: 'Delete' })
    if (ok) run(c.id, () => marketingApi.remove(c.id), 'Campaign deleted')
  }

  const duplicate = async (c: MarketingCampaign) => {
    setBusyId(c.id)
    try {
      const copy = await marketingApi.duplicate(c.id)
      router.push(`/marketing/editor?id=${copy.id}`)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to duplicate')
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoader />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Megaphone className="h-5 w-5 text-amber-600" /> Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Offers, promotions and announcements for {channels?.store_name ? <b>{channels.store_name}</b> : 'this store'} on WhatsApp, Telegram,
            email and SMS. Uses the store&apos;s existing connections.
          </p>
        </div>
        <Button asChild>
          <Link href="/marketing/editor">
            <Plus className="mr-1.5 h-4 w-4" /> New campaign
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Campaigns" value={stats?.total_campaigns ?? 0} icon={Megaphone} />
        <SummaryStat label="Scheduled" value={stats?.scheduled_campaigns ?? 0} icon={CalendarClock} tone="warning" />
        <SummaryStat label="Messages sent" value={stats?.messages.sent ?? 0} icon={Send} tone="success" hint={`${stats?.messages.failed ?? 0} failed`} />
        <SummaryStat label="Channels ready" value={`${readyCount} / 4`} icon={Plug} tone={readyCount ? 'default' : 'danger'} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Megaphone className="h-4 w-4" /> Campaigns
          </TabsTrigger>
          {templatesEnabled && (
            <TabsTrigger value="templates" className="gap-1.5">
              <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp templates
            </TabsTrigger>
          )}
          {channelsEnabled && (
            <TabsTrigger value="channels" className="gap-1.5">
              <Plug className="h-4 w-4" /> Channels
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="campaigns" className="mt-0 space-y-4">
          {campaigns.length === 0 ? (
            <PremiumEmpty
              icon={Megaphone}
              tone="amber"
              title="No campaigns yet"
              hint="Create a festival sale, coupon offer or announcement and send it to your customers on every channel you have connected."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/marketing/editor">
                      <Plus className="mr-1.5 h-4 w-4" /> New campaign
                    </Link>
                  </Button>
                  {templatesEnabled && (
                    <Button variant="outline" onClick={() => setTab('templates')}>
                      Browse WhatsApp templates
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code" className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {['draft', 'scheduled', 'sending', 'sent', 'partial', 'failed'].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {filtered.map((c) => {
                  const chs = campaignChannels(c)
                  const editable = c.status === 'draft' || c.status === 'scheduled'
                  const busy = busyId === c.id
                  return (
                    <Card key={c.id} className="transition-shadow hover:shadow-md">
                      <CardContent className="flex flex-wrap items-center gap-4 py-4">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetails(c)}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{c.name}</span>
                            <StatusBadge status={c.status} tone={c.status === 'sending' ? 'info' : undefined} />
                            {c.offer_code && (
                              <span className="rounded border border-dashed border-amber-500 px-1.5 font-mono text-[11px] text-amber-800">{c.offer_code}</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{campaignTypeLabel(c.type)}</span>
                            <span className="flex items-center gap-1">
                              {chs.map((ch) => {
                                const Icon = CHANNEL_ICONS[ch]?.icon
                                return Icon ? <Icon key={ch} className={`h-3.5 w-3.5 ${CHANNEL_ICONS[ch].color}`} /> : null
                              })}
                            </span>
                            {c.status === 'scheduled' && c.scheduled_at && <span>Sends {new Date(c.scheduled_at).toLocaleString()}</span>}
                            {c.sent_at && <span>Sent {formatDate(c.sent_at)}</span>}
                            {!c.sent_at && c.status === 'draft' && <span>Created {formatDate(c.created_at)}</span>}
                          </div>
                        </button>

                        {(c.status === 'sent' || c.status === 'partial' || c.status === 'failed' || c.status === 'sending') && (
                          <div className="flex gap-4 text-center text-xs">
                            <div>
                              <div className="text-base font-semibold text-emerald-700">{c.sent_count}</div>sent
                            </div>
                            <div>
                              <div className="text-base font-semibold text-rose-700">{c.failed_count}</div>failed
                            </div>
                            <div>
                              <div className="text-base font-semibold text-muted-foreground">{c.skipped_count}</div>skipped
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {editable && (
                            <Button size="sm" onClick={() => sendNow(c)} disabled={busy}>
                              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Send now
                            </Button>
                          )}
                          {c.status === 'sending' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Campaign actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetails(c)}>
                                <Eye className="mr-2 h-4 w-4" /> Delivery report
                              </DropdownMenuItem>
                              {editable && (
                                <DropdownMenuItem onClick={() => router.push(`/marketing/editor?id=${c.id}`)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                              {c.status === 'scheduled' && (
                                <DropdownMenuItem onClick={() => run(c.id, () => marketingApi.cancelSchedule(c.id), 'Schedule cancelled; campaign is a draft again')}>
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel schedule
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => duplicate(c)}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                              </DropdownMenuItem>
                              {c.status !== 'sending' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => remove(c)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {filtered.length === 0 && <p className="text-sm text-muted-foreground">No campaign matches the filters.</p>}
              </div>
            </>
          )}
        </TabsContent>

        {templatesEnabled && (
          <TabsContent value="templates" className="mt-0">
            <WhatsAppTemplateLibrary />
          </TabsContent>
        )}

        {channelsEnabled && (
          <TabsContent value="channels" className="mt-0">
            <ChannelStatusPanel channels={channels?.channels ?? []} stats={stats} />
          </TabsContent>
        )}
      </Tabs>

      <CampaignDetailsDialog campaign={details} open={details != null} onOpenChange={(o) => !o && setDetails(null)} />
      {confirmDialog}
    </div>
  )
}

export default function MarketingPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <BrandLoader />
          </div>
        }
      >
        <MarketingHub />
      </Suspense>
    </DashboardLayout>
  )
}
