'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PremiumEmpty from '@/components/ui/premium-empty'
import { History, MessageCircle, RefreshCw, Settings2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isSuperAdmin } from '@/lib/roles'
import { formatDateTime } from '@/lib/utils'
import { fetchWhatsAppInvoiceLogs, fetchWhatsAppInvoiceSettings } from '@/lib/whatsappInvoice'
import { fetchTelegramLogs, fetchTelegramSettings } from '@/lib/telegram'
import ChannelSwitch, { type MessagingChannel } from './ChannelSwitch'
import WhatsAppInvoicePanel, { whatsAppGatewayConnected } from './WhatsAppInvoicePanel'
import TelegramInvoicePanel, { telegramReady } from './TelegramInvoicePanel'

const STATUS_CLASS: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-700',
}

interface SentRow {
  id: string
  channel: MessagingChannel
  created_at: string
  invoice_id?: string
  invoice_number: string
  party_name: string
  recipient: string
  trigger: string
  status: string
  error: string
}

/** Messaging → Invoices: per-channel setup plus one log of invoices sent on WhatsApp and Telegram. */
export default function InvoiceMessagesPanel({
  channel,
  onChannelChange,
  onOpenChannel,
}: {
  channel: MessagingChannel
  onChannelChange: (c: MessagingChannel) => void
  onOpenChannel: (c: MessagingChannel) => void
}) {
  const { user } = useAuth()
  const superAdmin = !!user && isSuperAdmin(user.role)
  const [tab, setTab] = useState<'setup' | 'sent'>('setup')
  const [ready, setReady] = useState<Partial<Record<MessagingChannel, boolean>>>({})
  const [rows, setRows] = useState<SentRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

  useEffect(() => {
    fetchWhatsAppInvoiceSettings()
      .then((s) => setReady((r) => ({ ...r, whatsapp: whatsAppGatewayConnected(s, superAdmin) })))
      .catch(() => {})
    fetchTelegramSettings()
      .then((s) => setReady((r) => ({ ...r, telegram: telegramReady(s) })))
      .catch(() => {})
  }, [superAdmin])

  const loadRows = useCallback(async () => {
    setRowsLoading(true)
    const [wa, tg] = await Promise.all([
      fetchWhatsAppInvoiceLogs(50).catch(() => []),
      fetchTelegramLogs().catch(() => []),
    ])
    const merged: SentRow[] = [
      ...wa.map((l) => ({
        id: `wa-${l.id}`,
        channel: 'whatsapp' as const,
        created_at: l.created_at,
        invoice_id: l.invoice_id,
        invoice_number: l.invoice_number,
        party_name: l.party_name,
        recipient: l.phone,
        trigger: l.trigger,
        status: l.status,
        error: l.error,
      })),
      ...tg
        .filter((l) => l.kind === 'invoice_customer')
        .map((l) => ({
          id: `tg-${l.id}`,
          channel: 'telegram' as const,
          created_at: l.created_at,
          invoice_number: l.reference,
          party_name: l.party_name,
          recipient: l.chat_id,
          trigger: l.trigger,
          status: l.status,
          error: l.error,
        })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    setRows(merged)
    setRowsLoading(false)
  }, [])

  const toolbar = <ChannelSwitch value={channel} onChange={onChannelChange} ready={ready} />

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as 'setup' | 'sent')
        if (v === 'sent') void loadRows()
      }}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="setup" className="gap-1.5">
          <Settings2 className="h-4 w-4" /> Setup
        </TabsTrigger>
        <TabsTrigger value="sent" className="gap-1.5">
          <History className="h-4 w-4" /> Sent messages
        </TabsTrigger>
      </TabsList>

      <TabsContent value="setup" className="mt-0">
        {channel === 'telegram' ? (
          <TelegramInvoicePanel toolbar={toolbar} onOpenChannel={() => onOpenChannel('telegram')} />
        ) : (
          <WhatsAppInvoicePanel toolbar={toolbar} onOpenChannel={() => onOpenChannel('whatsapp')} />
        )}
      </TabsContent>

      <TabsContent value="sent" className="mt-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Invoices sent to customers</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void loadRows()} disabled={rowsLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${rowsLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <PremiumEmpty
                compact
                icon={MessageCircle}
                title={rowsLoading ? 'Loading…' : 'No messages yet'}
                hint="Invoices sent on WhatsApp or Telegram will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Time</th>
                      <th className="py-2 pr-3 font-medium">Invoice</th>
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 pr-3 font-medium">Sent to</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={l.id} className="border-b align-top last:border-0">
                        <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(l.created_at)}</td>
                        <td className="py-2 pr-3">
                          {l.invoice_id ? (
                            <Link className="text-blue-600 hover:underline" href={`/invoices/view?id=${l.invoice_id}`}>
                              {l.invoice_number || '—'}
                            </Link>
                          ) : (
                            l.invoice_number || '—'
                          )}
                        </td>
                        <td className="py-2 pr-3">{l.party_name || '—'}</td>
                        <td className="py-2 pr-3 text-xs">
                          <span className={l.channel === 'telegram' ? 'text-sky-700' : 'text-green-700'}>
                            {l.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}
                          </span>
                          <span className="block font-mono text-muted-foreground">{l.recipient || '—'}</span>
                        </td>
                        <td className="py-2 pr-3 capitalize">{l.trigger}</td>
                        <td className="py-2 pr-3">
                          <Badge className={STATUS_CLASS[l.status] ?? ''}>{l.status}</Badge>
                          {l.error && <p className="mt-1 max-w-xs text-xs text-red-600">{l.error}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
