'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, FileText, MessageCircle, MessagesSquare, Receipt, Send } from 'lucide-react'
import InvoiceMessagesPanel from '@/components/messaging/InvoiceMessagesPanel'
import PartyStatementPanel from '@/components/messaging/PartyStatementPanel'
import WhatsAppChannelPanel from '@/components/messaging/WhatsAppChannelPanel'
import TelegramChannelPanel from '@/components/messaging/TelegramChannelPanel'
import type { MessagingChannel } from '@/components/messaging/ChannelSwitch'

const TABS = ['invoices', 'statements', 'whatsapp', 'telegram'] as const
type MessagingTab = (typeof TABS)[number]

/**
 * Settings → Messaging. Organised by what is sent (invoices, party
 * statements), each with a WhatsApp / Telegram switch, plus one tab per
 * channel for its connection and shared options.
 *
 * Deep links: ?tab=invoices|statements|whatsapp|telegram, &channel=whatsapp|telegram.
 */
export default function MessagingSettingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const rawTab = params.get('tab')
  const tab: MessagingTab = (TABS as readonly string[]).includes(rawTab ?? '') ? (rawTab as MessagingTab) : 'invoices'
  const channel: MessagingChannel = params.get('channel') === 'telegram' ? 'telegram' : 'whatsapp'

  const setQuery = useCallback(
    (next: { tab?: MessagingTab; channel?: MessagingChannel }) => {
      const q = new URLSearchParams(params.toString())
      if (next.tab) q.set('tab', next.tab)
      if (next.channel) q.set('channel', next.channel)
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    },
    [params, pathname, router]
  )

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/settings?tab=invoice">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <MessagesSquare className="h-5 w-5 text-primary" /> Customer Messaging
            </h1>
            <p className="text-sm text-muted-foreground">
              Send invoices and party statements to customers on WhatsApp and Telegram. Applies to the current store.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setQuery({ tab: v as MessagingTab })} className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="invoices" className="gap-1.5">
              <Receipt className="h-4 w-4" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="statements" className="gap-1.5">
              <FileText className="h-4 w-4" /> Party statements
            </TabsTrigger>
            <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden />
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-1.5">
              <Send className="h-4 w-4 text-sky-600" /> Telegram
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-0">
            <InvoiceMessagesPanel
              channel={channel}
              onChannelChange={(c) => setQuery({ channel: c })}
              onOpenChannel={(c) => setQuery({ tab: c })}
            />
          </TabsContent>
          <TabsContent value="statements" className="mt-0">
            <PartyStatementPanel
              channel={channel}
              onChannelChange={(c) => setQuery({ channel: c })}
              onOpenChannel={(c) => setQuery({ tab: c })}
            />
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-0">
            <WhatsAppChannelPanel />
          </TabsContent>
          <TabsContent value="telegram" className="mt-0">
            <TelegramChannelPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
