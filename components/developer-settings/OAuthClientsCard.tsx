'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Copy, KeyRound, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { API_BASE } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { notifyError, notifySuccess } from '@/lib/notify'

// Super-admin management of OAuth clients (GET/POST/PATCH/DELETE
// /oauth/clients, POST /oauth/clients/:id/rotate-secret). Secrets are hashed
// server-side and shown exactly once, after create or rotate.

interface OAuthClient {
  id: string
  client_id: string
  client_name: string
  redirect_uris: string
  grant_types: string
  scopes: string
  is_public: boolean
  user_id?: string
  store_id?: string
  has_secret: boolean
  created_at: string
}

interface StoreOption { id: string; name: string }
interface StoreUser { id: string; name: string; email: string; role: string; is_active: boolean }

type Purpose = 'staff_read' | 'staff_write' | 'customer' | 'staff_chat' | 'custom'

const PURPOSES: Record<Purpose, { label: string; help: string; scopes: string; toolset?: string; chatHeader?: boolean }> = {
  staff_read: {
    label: 'Internal bot: read only',
    help: 'Slack or private widget. Looks up invoices, stock and reports as the service user and cannot change data.',
    scopes: 'read',
    toolset: 'essentials',
  },
  staff_write: {
    label: 'Internal bot: read and write',
    help: 'Like read only, but it can also create invoices, quotations and other records. Use it only for trusted internal bots.',
    scopes: 'read write',
    toolset: 'essentials',
  },
  customer: {
    label: 'Customer bot (WhatsApp / Telegram)',
    help: 'Each verified customer sees only their own bills, payments and loyalty. The token alone cannot read staff data.',
    scopes: 'customer',
    toolset: 'customer',
  },
  staff_chat: {
    label: 'Staff chat bot (WhatsApp / Telegram)',
    help: 'Staff link their own chat from Chat access, and the bot then acts as them with their own role. The token alone cannot read anything.',
    scopes: 'staff_chat',
    toolset: 'essentials',
    chatHeader: true,
  },
  custom: {
    label: 'Custom (advanced)',
    help: 'Set the grant types, scopes and redirect URIs yourself, for example for a partner app using the authorization code flow.',
    scopes: 'read',
  },
}

function purposeOf(c: OAuthClient): Purpose {
  const s = c.scopes.trim()
  const ccOnly = c.grant_types.split(/[\s,]+/).filter(Boolean).join(',') === 'client_credentials'
  if (!ccOnly) return 'custom'
  if (s === 'read') return 'staff_read'
  if (s === 'read write' || s === 'write read') return 'staff_write'
  if (s === 'customer') return 'customer'
  if (s === 'staff_chat') return 'staff_chat'
  return 'custom'
}

const MCP_BASE = (process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:8089').replace(/\/+$/, '')

function tokenUrl(): string {
  const base = API_BASE.startsWith('http')
    ? API_BASE
    : `${typeof window !== 'undefined' ? window.location.origin : ''}${API_BASE}`
  return `${base.replace(/\/+$/, '')}/oauth/token`
}

function mcpUrl(p: Purpose): string {
  const t = PURPOSES[p].toolset
  return t ? `${MCP_BASE}/mcp?toolsets=${t}` : `${MCP_BASE}/mcp`
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string; error_description?: string }).error_description || (body as { error?: string }).error || fallback)
  return body as T
}

function copy(text: string, what: string) {
  navigator.clipboard?.writeText(text).then(
    () => notifySuccess(`${what} copied`),
    () => notifyError('Could not copy, select the text and copy it manually'),
  )
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className={`min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-2 py-1.5 text-xs ${secret ? 'font-semibold' : ''}`}>
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(value, label)} aria-label={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

interface FormState {
  purpose: Purpose
  client_id: string
  client_name: string
  store_id: string
  user_id: string
  grant_types: string
  scopes: string
  redirect_uris: string
}

const EMPTY_FORM: FormState = {
  purpose: 'staff_read',
  client_id: '',
  client_name: '',
  store_id: '',
  user_id: '',
  grant_types: 'client_credentials',
  scopes: 'read',
  redirect_uris: '',
}

export default function OAuthClientsCard() {
  const [clients, setClients] = useState<OAuthClient[] | null>(null)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [usersByStore, setUsersByStore] = useState<Record<string, StoreUser[]>>({})

  const [editing, setEditing] = useState<OAuthClient | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [revealed, setRevealed] = useState<{ client: OAuthClient; secret: string; rotated: boolean } | null>(null)
  const [rotating, setRotating] = useState<OAuthClient | null>(null)
  const [deleting, setDeleting] = useState<OAuthClient | null>(null)

  const loadClients = useCallback(async () => {
    try {
      setClients(await jsonOrThrow<OAuthClient[]>(await apiFetch('/oauth/clients'), 'Failed to load OAuth clients'))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load OAuth clients')
      setClients([])
    }
  }, [])

  // Stores whose users were requested; avoids duplicate in-flight fetches.
  const requestedStores = useRef(new Set<string>())
  const loadUsers = useCallback(async (storeId: string) => {
    if (!storeId || requestedStores.current.has(storeId)) return
    requestedStores.current.add(storeId)
    try {
      const users = await jsonOrThrow<StoreUser[]>(await apiFetch(`/stores/${storeId}/users`), 'Failed to load users')
      setUsersByStore((m) => ({ ...m, [storeId]: users }))
    } catch (e) {
      requestedStores.current.delete(storeId)
      notifyError(e instanceof Error ? e.message : 'Failed to load users')
    }
  }, [])

  useEffect(() => {
    void loadClients()
    apiFetch('/stores')
      .then((res) => jsonOrThrow<StoreOption[]>(res, 'Failed to load stores'))
      .then((s) => setStores(s.map(({ id, name }) => ({ id, name }))))
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load stores'))
  }, [loadClients])

  // Resolve user names for the stores clients are bound to.
  useEffect(() => {
    clients?.forEach((c) => { if (c.store_id) void loadUsers(c.store_id) })
  }, [clients, loadUsers])

  const storeName = (id?: string) => (id ? stores.find((s) => s.id === id)?.name ?? 'Unknown store' : 'All stores')
  const userLabel = (c: OAuthClient) => {
    if (!c.user_id) return null
    const u = Object.values(usersByStore).flat().find((x) => x.id === c.user_id)
    return u ? `${u.name || u.email} (${u.role})` : `${c.user_id.slice(0, 8)}…`
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (c: OAuthClient) => {
    setEditing(c)
    setForm({
      purpose: purposeOf(c),
      client_id: c.client_id,
      client_name: c.client_name,
      store_id: c.store_id ?? '',
      user_id: c.user_id ?? '',
      grant_types: c.grant_types,
      scopes: c.scopes,
      redirect_uris: c.redirect_uris,
    })
    if (c.store_id) void loadUsers(c.store_id)
    setFormOpen(true)
  }

  const setPurpose = (p: Purpose) =>
    setForm((f) => ({
      ...f,
      purpose: p,
      scopes: p === 'custom' ? f.scopes : PURPOSES[p].scopes,
      grant_types: p === 'custom' ? f.grant_types : 'client_credentials',
    }))

  const formUsers = form.store_id ? usersByStore[form.store_id] ?? [] : []
  const selectedUser = formUsers.find((u) => u.id === form.user_id)
  const needsUser = form.grant_types.split(/[\s,]+/).includes('client_credentials')
  const privilegedUser = selectedUser && ['owner', 'super_admin', 'admin'].includes(selectedUser.role)

  const save = async () => {
    if (!form.client_name.trim()) return notifyError('Enter a name')
    if (needsUser && !form.user_id) return notifyError('Pick the service user this client acts as')
    const body: Record<string, unknown> = {
      client_name: form.client_name.trim(),
      grant_types: form.grant_types,
      scopes: form.scopes,
      redirect_uris: form.redirect_uris,
      user_id: form.user_id,
      store_id: form.store_id,
    }
    setSaving(true)
    try {
      if (editing) {
        const updated = await jsonOrThrow<OAuthClient>(
          await apiFetch(`/oauth/clients/${editing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          }),
          'Failed to update client',
        )
        setClients((list) => list?.map((c) => (c.id === updated.id ? updated : c)) ?? null)
        notifySuccess('OAuth client updated')
      } else {
        if (form.client_id.trim()) body.client_id = form.client_id.trim()
        const res = await jsonOrThrow<{ client: OAuthClient; client_secret?: string }>(
          await apiFetch('/oauth/clients', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          }),
          'Failed to create client',
        )
        setClients((list) => [res.client, ...(list ?? [])])
        if (res.client_secret) setRevealed({ client: res.client, secret: res.client_secret, rotated: false })
        else notifySuccess('OAuth client created')
      }
      setFormOpen(false)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  const rotate = async (c: OAuthClient) => {
    const res = await jsonOrThrow<{ client_secret: string }>(
      await apiFetch(`/oauth/clients/${c.id}/rotate-secret`, { method: 'POST' }),
      'Failed to rotate secret',
    )
    setRevealed({ client: c, secret: res.client_secret, rotated: true })
  }

  const remove = async (c: OAuthClient) => {
    await jsonOrThrow(await apiFetch(`/oauth/clients/${c.id}`, { method: 'DELETE' }), 'Failed to delete client')
    setClients((list) => list?.filter((x) => x.id !== c.id) ?? null)
    notifySuccess('OAuth client deleted')
  }

  const sortedStores = useMemo(() => [...stores].sort((a, b) => a.name.localeCompare(b.name)), [stores])

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            OAuth clients
          </CardTitle>
          <CardDescription>
            Credentials for bots and apps that connect to the TruERP MCP server or API, such as Goosebot. Each
            client acts as one service user, so it can only do what that user can.
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New client
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
          <CopyRow label="Token URL" value={tokenUrl()} />
          <CopyRow label="MCP server URL" value={`${MCP_BASE}/mcp`} />
        </div>

        {clients === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : clients.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No OAuth clients yet. Create one to connect a bot.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {clients.map((c) => {
              const p = purposeOf(c)
              const user = userLabel(c)
              return (
                <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.client_name}</span>
                      <Badge variant="secondary">{PURPOSES[p].label}</Badge>
                      {c.is_public && <Badge variant="outline">Public</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <code>{c.client_id}</code> · scope <code>{c.scopes}</code> · {storeName(c.store_id)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user ? <>Acts as {user}</> : (
                        c.grant_types.includes('client_credentials')
                          ? <span className="text-destructive">No service user: client credentials will be refused</span>
                          : <>Signs in as the user who authorises it</>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    {!c.is_public && (
                      <Button variant="outline" size="sm" onClick={() => setRotating(c)}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Rotate secret
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDeleting(c)} aria-label={`Delete ${c.client_name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={(o) => !saving && setFormOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit OAuth client' : 'New OAuth client'}</DialogTitle>
            <DialogDescription>
              {editing ? <code>{editing.client_id}</code> : 'The secret is shown once, right after you create the client.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={form.purpose} onValueChange={(v) => setPurpose(v as Purpose)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PURPOSES) as Purpose[]).map((k) => (
                    <SelectItem key={k} value={k}>{PURPOSES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PURPOSES[form.purpose].help}</p>
            </div>

            <div className="grid gap-4 min-[420px]:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  placeholder="Goosebot"
                />
              </div>
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={form.client_id}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value.replace(/\s/g, '') }))}
                  placeholder="goosebot (blank = generated)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Store</Label>
              <Select
                value={form.store_id || '__none'}
                onValueChange={(v) => {
                  const id = v === '__none' ? '' : v
                  setForm((f) => ({ ...f, store_id: id, user_id: '' }))
                  if (id) void loadUsers(id)
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pick a store" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No store (use the user&apos;s default)</SelectItem>
                  {sortedStores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service user {needsUser ? '' : '(optional)'}</Label>
              <Select
                value={form.user_id || '__none'}
                onValueChange={(v) => setForm((f) => ({ ...f, user_id: v === '__none' ? '' : v }))}
                disabled={!form.store_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.store_id ? 'Pick a user' : 'Pick a store first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {formUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} disabled={!u.is_active}>
                      {u.name || u.email} · {u.role}{u.is_active ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Create a dedicated user for the bot (Users page) with only the permissions it needs.
              </p>
              {privilegedUser && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This user is {selectedUser.role}. Anyone who can chat with the bot could reach everything they
                  can. Prefer a low-privilege service user.
                </p>
              )}
            </div>

            {form.purpose === 'custom' && (
              <>
                <div className="grid gap-4 min-[420px]:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Grant types</Label>
                    <Input
                      value={form.grant_types}
                      onChange={(e) => setForm((f) => ({ ...f, grant_types: e.target.value }))}
                      placeholder="authorization_code,refresh_token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scopes</Label>
                    <Input
                      value={form.scopes}
                      onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))}
                      placeholder="read write"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Redirect URIs</Label>
                  <Textarea
                    rows={2}
                    value={form.redirect_uris}
                    onChange={(e) => setForm((f) => ({ ...f, redirect_uris: e.target.value }))}
                    placeholder="https://partner.example.com/oauth/callback"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma separated. Needed for authorization_code. Scopes: read, write, admin, erp, customer, staff_chat.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time secret + Goosebot settings */}
      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {revealed && (() => {
            const p = purposeOf(revealed.client)
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{revealed.rotated ? 'New client secret' : 'Client created'}</DialogTitle>
                  <DialogDescription>
                    Copy the secret now. It can&apos;t be shown again
                    {revealed.rotated ? ', and the old secret has stopped working.' : '.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <CopyRow label="Client ID" value={revealed.client.client_id} />
                  <CopyRow label="Client secret" value={revealed.secret} secret />
                  {p !== 'custom' && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      <p className="text-sm font-medium">
                        Goosebot → Settings → MCP servers → Add, with OAuth 2.0 client credentials:
                      </p>
                      <CopyRow label="Server URL" value={mcpUrl(p)} />
                      <CopyRow label="Token URL" value={tokenUrl()} />
                      <CopyRow label="Scope" value={revealed.client.scopes} />
                      {PURPOSES[p].chatHeader && (
                        <CopyRow label="Custom header" value="X-Chat-Identity: {{contact.verified_identity}}" />
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => setRevealed(null)}>I&apos;ve saved it</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title="Rotate client secret?"
        description={`The current secret for "${rotating?.client_name}" stops working immediately. Update it in Goosebot (or wherever it is used) right after.`}
        confirmLabel="Rotate secret"
        onConfirm={async () => {
          const c = rotating
          setRotating(null)
          if (!c) return
          try { await rotate(c) } catch (e) { notifyError(e instanceof Error ? e.message : 'Failed to rotate secret') }
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete OAuth client?"
        description={`Bots using "${deleting?.client_name}" will stop working, and its refresh tokens are revoked.`}
        confirmText={deleting?.client_id}
        confirmTextLabel="Type the client ID to confirm"
        onConfirm={async () => {
          const c = deleting
          setDeleting(null)
          if (!c) return
          try { await remove(c) } catch (e) { notifyError(e instanceof Error ? e.message : 'Failed to delete client') }
        }}
      />
    </Card>
  )
}
