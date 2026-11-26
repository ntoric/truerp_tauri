'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Send, Trash2, Copy, ShieldCheck } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { notifyError, notifySuccess } from '@/lib/notify'
import { isSuperAdmin } from '@/lib/roles'

type Access = 'read' | 'write' | 'admin'

interface ChatLink {
  id: string
  channel: 'telegram' | 'phone'
  identity: string
  access: Access
  created_at: string
  last_used_at?: string
  user_id: string
  user_name: string
  user_email: string
  user_role: string
}

interface LinkCode {
  code: string
  access: Access
  expires_at: string
}

const ACCESS_LABEL: Record<Access, string> = {
  read: 'View only',
  write: 'View and make changes',
  admin: 'Full admin',
}

function formatDate(v?: string) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Settings → Chat access: link your WhatsApp or Telegram chat to your TruERP
 * account so the business's assistant can act as you, with your role and
 * permissions. See backend/controllers/staff_chat.go.
 */
export default function ChatAccessPage() {
  const { user } = useAuth()
  const admin = isSuperAdmin(user?.role)
  const [access, setAccess] = useState<Access>('read')
  const [code, setCode] = useState<LinkCode | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [creating, setCreating] = useState(false)
  const [links, setLinks] = useState<ChatLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [removing, setRemoving] = useState<ChatLink | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/chat-access/links${showAll ? '?all=true' : ''}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load linked chats')
      setLinks(data.links || [])
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not load linked chats')
    } finally {
      setLoading(false)
    }
  }, [showAll])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!code) return
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(code.expires_at).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        setCode(null)
        load() // the code may have been used
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [code, load])

  const createCode = async () => {
    setCreating(true)
    try {
      const res = await apiFetch('/chat-access/codes', { method: 'POST', body: JSON.stringify({ access }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not create a code')
      setCode({ code: data.code, access: data.access, expires_at: data.expires_at })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not create a code')
    } finally {
      setCreating(false)
    }
  }

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(`link ${code.code}`)
      notifySuccess('Copied')
    } catch {
      /* clipboard may be blocked; the code is on screen */
    }
  }

  const unlink = async () => {
    if (!removing) return
    const res = await apiFetch(`/chat-access/links/${removing.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      notifyError(data.error || 'Could not unlink')
      return
    }
    notifySuccess(data.message || 'Chat unlinked')
    setRemoving(null)
    load()
  }

  const mm = String(Math.floor(secondsLeft / 60))
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader title="Chat access" backHref="/settings" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Use TruERP from WhatsApp or Telegram
            </CardTitle>
            <CardDescription>
              Link your own chat to your account once. The business assistant then answers as you — with your role,
              your store and your permissions — for things like today&apos;s sales, stock checks or a new invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="chat-access-level">What can the chat do?</Label>
                <Select value={access} onValueChange={(v) => setAccess(v as Access)}>
                  <SelectTrigger id="chat-access-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">{ACCESS_LABEL.read}</SelectItem>
                    <SelectItem value="write">{ACCESS_LABEL.write}</SelectItem>
                    {admin && <SelectItem value="admin">{ACCESS_LABEL.admin}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createCode} disabled={creating} className="sm:w-fit">
                {creating ? 'Creating…' : code ? 'Create a new code' : 'Create link code'}
              </Button>
            </div>

            {code && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-900">
                  Send this message to the business&apos;s WhatsApp or Telegram assistant from <b>your own</b> phone:
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="rounded bg-white px-3 py-2 font-mono text-lg font-semibold tracking-wider text-slate-900 shadow-sm">
                    link {code.code}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    <Copy className="mr-1 h-4 w-4" /> Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs text-emerald-800">
                  {ACCESS_LABEL[code.access]} · works once · expires in {mm}:{ss}
                </p>
              </div>
            )}

            <ul className="space-y-1 text-xs text-slate-500">
              <li className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Only you can create a code for your account, and only the chat that sends it gets linked. Never share it.
              </li>
              <li className="flex gap-2">
                <Send className="h-4 w-4 shrink-0" />
                To stop, unlink below or send &ldquo;unlink me&rdquo; to the assistant. Access ends within 15 minutes.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">{showAll ? 'All linked chats in this store' : 'Your linked chats'}</CardTitle>
              <CardDescription>Chats that can use TruERP as {showAll ? 'a team member' : 'you'}.</CardDescription>
            </div>
            {admin && (
              <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show mine' : 'Show everyone'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-slate-500">No chats are linked.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      {showAll && <th className="py-2 pr-3 font-medium">User</th>}
                      <th className="py-2 pr-3 font-medium">Chat</th>
                      <th className="py-2 pr-3 font-medium">Access</th>
                      <th className="py-2 pr-3 font-medium">Linked</th>
                      <th className="py-2 pr-3 font-medium">Last used</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        {showAll && (
                          <td className="py-2 pr-3">
                            <div className="font-medium text-slate-900">{l.user_name}</div>
                            <div className="text-xs capitalize text-slate-500">{l.user_role}</div>
                          </td>
                        )}
                        <td className="py-2 pr-3">
                          {l.channel === 'telegram' ? 'Telegram' : 'WhatsApp / phone'}
                          <div className="font-mono text-xs text-slate-500">{l.identity}</div>
                        </td>
                        <td className="py-2 pr-3">{ACCESS_LABEL[l.access] ?? l.access}</td>
                        <td className="py-2 pr-3 text-slate-600">{formatDate(l.created_at)}</td>
                        <td className="py-2 pr-3 text-slate-600">{formatDate(l.last_used_at)}</td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(l)} aria-label="Unlink chat">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Unlink this chat?"
        description="The assistant will stop acting for this account from that chat within 15 minutes."
        confirmLabel="Unlink"
        onConfirm={unlink}
      />
    </DashboardLayout>
  )
}
