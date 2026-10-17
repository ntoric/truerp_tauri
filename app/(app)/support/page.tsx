'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SupportRequestThread from '@/components/support/SupportRequestThread'
import {
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_WHATSAPP,
  SUPPORT_REQUEST_CATEGORIES,
  supportCategoryLabel,
  supportStatusBadgeClass,
  supportStatusLabel,
  supportWhatsAppLink,
  type SupportContactSettings,
  type SupportRequest,
} from '@/lib/supportRequests'
import {
  Mail, Copy, Check, ArrowRight, Loader2, Send, ChevronDown, Inbox,
} from 'lucide-react'
import { WhatsappLogo } from '@phosphor-icons/react'

type ChannelKey = 'email' | 'whatsapp'

function SupportChannelCard({
  icon,
  iconClass,
  title,
  description,
  value,
  copied,
  onCopy,
  actionLabel,
  onAction,
}: {
  icon: ReactNode
  iconClass: string
  title: string
  description: string
  value: string
  copied: boolean
  onCopy: () => void
  actionLabel: string
  onAction: () => void
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            {icon}
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-gray-50 px-3 py-2">
          <span className="truncate text-sm font-medium text-gray-800">{value}</span>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
            aria-label={`Copy ${title}`}
            title="Copy"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={onAction} className="w-full">
          {actionLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SupportPage() {
  const [copied, setCopied] = useState<ChannelKey | null>(null)
  const [contact, setContact] = useState<SupportContactSettings | null>(null)
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'general', message: '' })
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replySending, setReplySending] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  const supportEmail = contact?.support_email || DEFAULT_SUPPORT_EMAIL
  const supportWhatsApp = contact?.whatsapp_number || DEFAULT_SUPPORT_WHATSAPP

  useEffect(() => {
    void loadRequests()
    void loadContact()
  }, [])

  const loadRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await apiFetch('/support-requests')
      if (res.ok) {
        setRequests(await res.json())
      }
    } finally {
      setRequestsLoading(false)
    }
  }

  const loadContact = async () => {
    try {
      const res = await apiFetch('/support-settings')
      if (res.ok) {
        setContact(await res.json())
      }
    } catch {
      // Fall back to the built-in defaults.
    }
  }

  const copyValue = async (key: ChannelKey, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000)
    } catch {
      // Clipboard access may be unavailable in some webviews.
    }
  }

  const openEmail = () => {
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent('Support request')}`
  }

  const openWhatsApp = () => {
    window.open(supportWhatsAppLink(supportWhatsApp), '_blank', 'noopener,noreferrer')
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setSubmitting(true)
    try {
      const res = await apiFetch('/support-requests', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setForm({ subject: '', category: 'general', message: '' })
        setMessage('Your request was sent. Our team will get back to you soon.')
        await loadRequests()
      } else {
        const data = await res.json().catch(() => null)
        setMessage(data?.error || 'Failed to send your request.')
      }
    } catch {
      setMessage('An error occurred while sending your request.')
    } finally {
      setSubmitting(false)
    }
  }

  const replaceRequest = (updated: SupportRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  const refreshRequest = async (id: string) => {
    const res = await apiFetch(`/support-requests/${id}`)
    if (res.ok) {
      replaceRequest(await res.json())
    }
  }

  const sendReply = async (id: string) => {
    const text = (replyDrafts[id] || '').trim()
    if (!text) return
    setReplySending(id)
    try {
      const res = await apiFetch(`/support-requests/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      if (res.ok) {
        setReplyDrafts((prev) => ({ ...prev, [id]: '' }))
        await refreshRequest(id)
      }
    } finally {
      setReplySending(null)
    }
  }

  const closeRequest = async (id: string) => {
    setClosingId(id)
    try {
      const res = await apiFetch(`/support-requests/${id}/close`, { method: 'PUT' })
      if (res.ok) {
        replaceRequest(await res.json())
      }
    } finally {
      setClosingId(null)
    }
  }

  const errorish = (msg: string) => {
    const lower = msg.toLowerCase()
    return lower.includes('fail') || lower.includes('error')
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="app-page-title">Help &amp; Support</h1>
          <p className="mt-1 text-sm text-gray-500">
            Need help with billing, your data, or your account? Reach our team on any channel below.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="order-2 space-y-4 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Send us a message</CardTitle>
                <CardDescription>
                  Create a support request — you can track replies right here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {message && (
                  <div
                    className={`mb-4 rounded-lg p-3 text-sm ${
                      errorish(message) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {message}
                  </div>
                )}
                <form onSubmit={submitRequest} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                    <div className="space-y-2">
                      <Label htmlFor="support-subject">Subject</Label>
                      <Input
                        id="support-subject"
                        placeholder="What do you need help with?"
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="support-category">Category</Label>
                      <Select
                        value={form.category}
                        onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                      >
                        <SelectTrigger id="support-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORT_REQUEST_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support-message">Message</Label>
                    <Textarea
                      id="support-message"
                      rows={4}
                      placeholder="Describe your issue or question in detail."
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Submit request
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">My requests</h2>
              {requestsLoading ? (
                <Card>
                  <CardContent className="flex items-center gap-2 py-6 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
                  </CardContent>
                </Card>
              ) : requests.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                    <Inbox className="h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">No support requests yet.</p>
                  </CardContent>
                </Card>
              ) : (
                requests.map((req) => {
                  const expanded = expandedId === req.id
                  const closed = req.status === 'closed'
                  return (
                    <Card key={req.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : req.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-gray-400">{req.request_number}</span>
                            <Badge variant="outline" className={supportStatusBadgeClass(req.status)}>
                              {supportStatusLabel(req.status)}
                            </Badge>
                            <Badge variant="outline">{supportCategoryLabel(req.category)}</Badge>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-gray-900">{req.subject}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(req.created_at).toLocaleString()}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {expanded && (
                        <CardContent className="space-y-4 border-t pt-4">
                          <SupportRequestThread request={req} />
                          {!closed && (
                            <div className="space-y-2">
                              <Textarea
                                rows={3}
                                placeholder="Write a reply…"
                                value={replyDrafts[req.id] || ''}
                                onChange={(e) =>
                                  setReplyDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))
                                }
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  disabled={replySending === req.id || !(replyDrafts[req.id] || '').trim()}
                                  onClick={() => sendReply(req.id)}
                                >
                                  {replySending === req.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="mr-2 h-4 w-4" />
                                  )}
                                  Send reply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={closingId === req.id}
                                  onClick={() => closeRequest(req.id)}
                                >
                                  {closingId === req.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Close request
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          </div>

          <div className="order-1 space-y-4 lg:order-2">
            <SupportChannelCard
              icon={<Mail className="h-5 w-5" />}
              iconClass="bg-blue-50 text-blue-600"
              title="Email support"
              description="Write to us and we'll get back to you."
              value={supportEmail}
              copied={copied === 'email'}
              onCopy={() => copyValue('email', supportEmail)}
              actionLabel="Email us"
              onAction={openEmail}
            />
            <SupportChannelCard
              icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
              iconClass="bg-green-50 text-green-600"
              title="WhatsApp support"
              description="Chat with us directly on WhatsApp."
              value={supportWhatsApp}
              copied={copied === 'whatsapp'}
              onCopy={() => copyValue('whatsapp', supportWhatsApp)}
              actionLabel="Chat on WhatsApp"
              onAction={openWhatsApp}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
