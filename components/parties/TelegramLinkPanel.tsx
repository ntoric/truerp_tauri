'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, Copy, Loader2, MessageCircle, RefreshCw, Unlink } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime } from '@/lib/utils'
import { fetchPartyTelegramLink, unlinkPartyTelegram, type PartyTelegramLink } from '@/lib/telegram'

interface PanelProps {
  partyId: string
  partyName: string
  partyPhone?: string
  /** Compact: status + copy only (used inside other dialogs). */
  compact?: boolean
  onLinkedChange?: (linked: boolean) => void
}

/** A party's Telegram link status, personal bot link (copy / QR / share) and unlink. */
export function TelegramLinkPanel({ partyId, partyName, partyPhone, compact, onLinkedChange }: PanelProps) {
  const [info, setInfo] = useState<PartyTelegramLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPartyTelegramLink(partyId)
      setInfo(data)
      onLinkedChange?.(data.linked)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load Telegram link')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !info) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Telegram…
      </div>
    )
  }
  if (!info) return null

  if (!info.bot_connected) {
    return (
      <p className="text-sm text-muted-foreground">
        Telegram isn&apos;t set up for this store.{' '}
        <Link href="/settings/messaging?tab=telegram" className="font-medium text-sky-700 underline">
          Connect a bot
        </Link>
      </p>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.link)
      notifySuccess('Telegram link copied')
    } catch {
      notifyError('Could not copy. Select and copy the link manually.')
    }
  }

  const unlink = async () => {
    setBusy(true)
    try {
      await unlinkPartyTelegram(partyId)
      notifySuccess(`${partyName} unlinked from Telegram`)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to unlink')
    } finally {
      setBusy(false)
    }
  }

  const inviteText = `Get your invoices and account statements on Telegram: ${info.link}`
  const phoneDigits = (partyPhone ?? '').replace(/\D/g, '')
  const waShare = `https://wa.me/${phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits}?text=${encodeURIComponent(inviteText)}`

  const status = info.linked ? (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="flex items-center gap-1 font-medium text-green-700">
        <CheckCircle className="h-4 w-4" /> Linked on Telegram
      </span>
      {info.linked_at && <span className="text-xs text-muted-foreground">since {formatDateTime(info.linked_at)}</span>}
      {!compact && (
        <Button variant="ghost" size="sm" className="ml-auto text-red-600" onClick={() => void unlink()} disabled={busy}>
          <Unlink className="mr-1 h-4 w-4" /> Unlink
        </Button>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-amber-700">Not linked yet.</span>
      <span className="text-xs text-muted-foreground">
        Share this link; they press <span className="font-medium">Start</span> once.
      </span>
      <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => void load()} title="Check again">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )

  if (compact) {
    return (
      <div className="space-y-2 rounded-md border bg-gray-50 p-3">
        {status}
        {!info.linked && (
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            <Copy className="mr-1 h-4 w-4" /> Copy Telegram link
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {status}
      {!info.enabled && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Telegram sending is switched off for this store, so nothing will be sent until it&apos;s turned on in{' '}
          <Link href="/settings/messaging?tab=telegram" className="font-medium underline">
            Telegram settings
          </Link>
          .
        </p>
      )}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-md border bg-white p-2">
          <QRCodeSVG value={info.link} size={132} />
        </div>
        <div className="w-full min-w-0 flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">
            The customer scans this QR code or opens the link, then presses Start in @{info.bot_username}.
          </p>
          <Input readOnly value={info.link} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copy()}>
              <Copy className="mr-1 h-4 w-4" /> Copy link
            </Button>
            {phoneDigits.length >= 10 && (
              <Button variant="outline" size="sm" asChild>
                <a href={waShare} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1 h-4 w-4" /> Send link on WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Dialog wrapper around TelegramLinkPanel for party menus and the ledger page. */
export default function TelegramLinkDialog({
  open,
  onOpenChange,
  party,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  party: { id: string; name: string; phone?: string } | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Telegram — {party?.name}</DialogTitle>
          <DialogDescription>
            Link this party&apos;s Telegram to send them invoices and statements.
          </DialogDescription>
        </DialogHeader>
        {party && open && <TelegramLinkPanel partyId={party.id} partyName={party.name} partyPhone={party.phone} />}
      </DialogContent>
    </Dialog>
  )
}
