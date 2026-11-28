'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Mail, MessageCircle, MessageSquareText, Send, XCircle, type LucideIcon } from 'lucide-react'
import type { ChannelStatus, MarketingChannel, MarketingStats } from '@/lib/marketing'

export const CHANNEL_ICONS: Record<MarketingChannel, { icon: LucideIcon; color: string; bg: string }> = {
  whatsapp: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50' },
  telegram: { icon: Send, color: 'text-sky-600', bg: 'bg-sky-50' },
  email: { icon: Mail, color: 'text-violet-600', bg: 'bg-violet-50' },
  sms: { icon: MessageSquareText, color: 'text-amber-600', bg: 'bg-amber-50' },
}

const CHANNEL_NOTES: Record<MarketingChannel, string> = {
  whatsapp: 'Uses the store’s WhatsApp gateway (the same connection as invoice messages). Needs an approved template per campaign.',
  telegram: 'Uses the store’s Telegram bot. Reaches customers who opened the bot from their party link and pressed Start.',
  email: 'Uses the store’s SMTP connection from Developer Settings → Integrations.',
  sms: 'Uses the store’s SMS provider (Twilio, MSG91 or TextLocal). DLT-registered templates may be required in India.',
}

export default function ChannelStatusPanel({
  channels,
  stats,
}: {
  channels: ChannelStatus[]
  stats: MarketingStats | null
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {channels.map((ch) => {
        const meta = CHANNEL_ICONS[ch.key]
        const Icon = meta.icon
        const counts = stats?.by_channel?.[ch.key]
        return (
          <Card key={ch.key}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.bg}`}>
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </span>
                  <div>
                    <div className="font-semibold">{ch.label}</div>
                    <div className="text-xs text-muted-foreground">{ch.provider || 'Not connected'}</div>
                  </div>
                </div>
                {ch.ready ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-rose-700">
                    <XCircle className="h-4 w-4" /> Not ready
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{CHANNEL_NOTES[ch.key]}</p>
              {!ch.ready && ch.reason && <p className="text-sm text-rose-700">{ch.reason}.</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {counts ? `${counts.sent ?? 0} sent · ${counts.failed ?? 0} failed · ${counts.skipped ?? 0} skipped` : 'No messages yet'}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link href={ch.setup_url}>{ch.ready ? 'Manage connection' : 'Connect'}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
