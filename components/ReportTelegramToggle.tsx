'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { fetchTelegramSettings, type TelegramSettings } from '@/lib/telegram'

/** "Also send to Telegram" switch for scheduled report emails, with readiness hints. */
export default function ReportTelegramToggle({
  id,
  checked,
  onChange,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const [tg, setTg] = useState<TelegramSettings | null>(null)

  useEffect(() => {
    fetchTelegramSettings()
      .then(setTg)
      .catch(() => setTg(null))
  }, [])

  const problem = !tg
    ? ''
    : !tg.has_bot_token
      ? 'No Telegram bot is connected yet.'
      : !tg.enabled
        ? 'Telegram sending is switched off.'
        : tg.owner_chats.length === 0
          ? 'No owner chat is linked yet. Open the owner link in Telegram first.'
          : ''

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
        <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
          <span className="text-sm text-gray-900">Also send to Telegram</span>
          <span className="block text-xs text-gray-500">
            Delivers the PDF to the store owner&apos;s linked Telegram chats
            {tg && tg.owner_chats.length > 0 ? ` (${tg.owner_chats.length})` : ''}. Emails become optional.
          </span>
        </Label>
      </div>
      {checked && problem && (
        <p className="ml-12 text-xs text-amber-700">
          {problem}{' '}
          <Link href="/settings/messaging?tab=telegram" className="font-medium underline">
            Telegram settings
          </Link>
        </p>
      )}
    </div>
  )
}
