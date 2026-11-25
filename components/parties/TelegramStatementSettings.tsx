'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send } from 'lucide-react'
import {
  SAMPLE_STATEMENT_VALUES,
  TELEGRAM_CAPTION_LIMIT,
  telegramMessageSegments,
  type StatementField,
} from '@/lib/partyStatement'

interface Props {
  ready: boolean
  message: string
  onMessageChange: (v: string) => void
  defaultMessage: string
  fields: StatementField[]
  storeName?: string
  testChat: string
  onTestChatChange: (v: string) => void
  testing: boolean
  onTest: () => void
  testRangeLabel: string
  /** Switches to the Telegram tab; falls back to a link when omitted. */
  onOpenChannel?: () => void
}

/** Telegram section of Messaging → Party statements: status, message, preview and test. */
export default function TelegramStatementSettings({
  ready,
  message,
  onMessageChange,
  defaultMessage,
  fields,
  storeName,
  testChat,
  onTestChatChange,
  testing,
  onTest,
  testRangeLabel,
  onOpenChannel,
}: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const keys = fields.map((f) => f.key)
  const sample = {
    ...SAMPLE_STATEMENT_VALUES,
    ...(storeName ? { store_name: storeName } : {}),
  }
  const segments = telegramMessageSegments(message || defaultMessage, sample, keys)
  const previewLength = segments.reduce((n, s) => n + s.text.length, 0)

  // Inserts {field} at the cursor.
  const insert = (key: string) => {
    const el = textRef.current
    const token = `{${key}}`
    if (!el) {
      onMessageChange(message + token)
      return
    }
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    onMessageChange(message.slice(0, start) + token + message.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {ready ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="font-medium">{ready ? 'Telegram bot connected' : 'Telegram bot not connected'}</p>
                <p className="text-sm text-muted-foreground">
                  Statements go from the store&apos;s bot to parties who have linked Telegram (share the party&apos;s
                  Telegram link from the Parties list). Parties who haven&apos;t linked are skipped.
                </p>
              </div>
            </div>
            {onOpenChannel ? (
              <Button variant="outline" size="sm" onClick={onOpenChannel}>
                Telegram settings
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/messaging?tab=telegram">Telegram settings</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Telegram message</CardTitle>
            {message.trim() !== defaultMessage.trim() && (
              <Button variant="ghost" size="sm" onClick={() => onMessageChange(defaultMessage)}>
                Reset to default
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              ref={textRef}
              id="tg-message"
              aria-label="Telegram message"
              rows={9}
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Insert a value at the cursor:</p>
              <div className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => insert(f.key)}
                    className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs hover:border-green-600 hover:bg-green-50"
                    title={`{${f.key}}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Wrap text in **double asterisks** for bold. The statement PDF is always attached. Balances show as
              amounts; an advance shows with a &quot;Cr&quot; suffix. Unlike WhatsApp, no template approval is needed.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview (sample data)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-[#d5e3ef] p-3">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <FileText className="h-4 w-4 text-red-500" /> Statement_Rahul_2026-10-01_to_2026-10-31.pdf
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-gray-900">
                  {segments.map((seg, i) => (
                    <span
                      key={i}
                      className={`${seg.bold ? 'font-semibold' : ''} ${seg.field ? 'rounded bg-blue-100 px-0.5 text-blue-900' : ''}`}
                      title={seg.field ? `{${seg.field}}` : undefined}
                    >
                      {seg.text}
                    </span>
                  ))}
                </p>
              </div>
            </div>
            {previewLength > TELEGRAM_CAPTION_LIMIT && (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Longer than Telegram&apos;s {TELEGRAM_CAPTION_LIMIT}-character caption, so it&apos;s sent as a separate
                message just before the PDF.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send a test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tg-test-chat">Telegram chat ID</Label>
              <Input
                id="tg-test-chat"
                value={testChat}
                onChange={(e) => onTestChatChange(e.target.value)}
                placeholder="e.g. 123456789"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Your own chat ID works: once you link yourself as an owner, it&apos;s listed under owner chats in
                Telegram settings.
              </p>
            </div>
            <Button className="w-full" variant="outline" onClick={onTest} disabled={testing || !ready}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send test statement
            </Button>
            <p className="text-xs text-muted-foreground">
              Uses saved settings and your most recently updated customer, for {testRangeLabel}. Save changes first.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
