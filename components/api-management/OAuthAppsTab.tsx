'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppWindow, KeyRound, Loader2, LogOut, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import PremiumEmpty from '@/components/ui/premium-empty'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  GRANT_TYPE_LABELS,
  backendOrigin,
  createOAuthClient,
  deleteOAuthClient,
  formatDateTime,
  listOAuthClients,
  revokeOAuthTokens,
  rotateOAuthSecret,
  updateOAuthClient,
  type OAuthClient,
  type ScopeInfo,
  type StoreOption,
} from '@/lib/apiManagement'
import { CopyButton, ScopeMatrix, SecretDialog, StatusDot, StoreSelect } from './shared'

interface FormState {
  client_name: string
  description: string
  redirect_uris: string
  grant_types: string[]
  scopes: string[]
  is_public: boolean
  is_active: boolean
  store_id: string
}

const emptyForm: FormState = {
  client_name: '',
  description: '',
  redirect_uris: '',
  grant_types: ['authorization_code', 'refresh_token'],
  scopes: [],
  is_public: false,
  is_active: true,
  store_id: '',
}

export default function OAuthAppsTab({ catalog, stores, grantTypes }: { catalog: ScopeInfo[]; stores: StoreOption[]; grantTypes: string[] }) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [clients, setClients] = useState<OAuthClient[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<OAuthClient | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [secrets, setSecrets] = useState<{ label: string; value: string }[] | null>(null)

  const load = useCallback(async () => {
    try {
      setClients(await listOAuthClients())
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, scopes: catalog.filter((s) => s.access === 'read').map((s) => s.scope) })
    setDialogOpen(true)
  }

  const openEdit = (cl: OAuthClient) => {
    setEditing(cl)
    setForm({
      client_name: cl.client_name,
      description: cl.description,
      redirect_uris: cl.redirect_uri_list.join('\n'),
      grant_types: cl.grant_type_list,
      // Legacy alias scopes (read/write/erp) are kept as-is when present.
      scopes: cl.scope_list,
      is_public: cl.is_public,
      is_active: cl.is_active,
      store_id: cl.store_id ?? '',
    })
    setDialogOpen(true)
  }

  const toggleGrant = (g: string, on: boolean) =>
    setForm((f) => ({ ...f, grant_types: on ? Array.from(new Set([...f.grant_types, g])) : f.grant_types.filter((x) => x !== g) }))

  const save = async () => {
    if (!form.client_name.trim()) return notifyError('Application name is required')
    if (form.grant_types.length === 0) return notifyError('Select at least one grant type')
    if (form.scopes.length === 0) return notifyError('Select at least one permission')
    setSaving(true)
    const payload = {
      client_name: form.client_name.trim(),
      description: form.description.trim(),
      redirect_uris: form.redirect_uris,
      grant_types: form.grant_types,
      scopes: form.scopes,
      is_public: form.is_public,
      is_active: form.is_active,
      store_id: form.store_id,
    }
    try {
      if (editing) {
        const res = await updateOAuthClient(editing.id, payload)
        if (res.client_secret) setSecrets([{ label: 'Client secret', value: res.client_secret }])
        notifySuccess('Application updated.')
      } else {
        const res = await createOAuthClient(payload)
        const list = [{ label: 'Client ID', value: res.client.client_id }]
        if (res.client_secret) list.push({ label: 'Client secret', value: res.client_secret })
        setSecrets(list)
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save application')
    } finally {
      setSaving(false)
    }
  }

  const rotate = async (cl: OAuthClient) => {
    if (!(await confirm({ title: `Rotate secret for ${cl.client_name}?`, description: 'The current secret stops working immediately.', variant: 'destructive' }))) return
    try {
      const res = await rotateOAuthSecret(cl.id)
      setSecrets([{ label: 'New client secret', value: res.client_secret }])
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to rotate')
    }
  }

  const revokeTokens = async (cl: OAuthClient) => {
    if (!(await confirm({ title: `Sign out all users of ${cl.client_name}?`, description: 'Refresh tokens are revoked now; issued access tokens expire within an hour. Users must authorize again.', variant: 'destructive' }))) return
    try {
      const res = await revokeOAuthTokens(cl.id)
      notifySuccess(`${res.revoked} token(s) revoked.`)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to revoke tokens')
    }
  }

  const remove = async (cl: OAuthClient) => {
    if (!(await confirm({ title: `Delete ${cl.client_name}?`, description: 'All its tokens are revoked and it can no longer authenticate.', variant: 'destructive' }))) return
    try {
      await deleteOAuthClient(cl.id)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const origin = backendOrigin()
  const knownScopes = new Set(catalog.map((s) => s.scope))
  const legacyScopes = form.scopes.filter((s) => !knownScopes.has(s))

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Endpoints: <code className="text-xs">{origin}/api/v1/oauth/authorize</code> · <code className="text-xs">{origin}/api/v1/oauth/token</code>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Register application
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : clients.length === 0 ? (
        <Card><CardContent className="p-4">
          <PremiumEmpty
            icon={AppWindow}
            title="No OAuth applications"
            hint="Register a third-party app so stores can connect it by signing in and approving access, without sharing API keys."
            action={<Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Register application</Button>}
          />
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {clients.map((cl) => (
            <Card key={cl.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{cl.client_name}</span>
                      {cl.is_active ? <StatusDot tone="green">Active</StatusDot> : <StatusDot tone="slate">Disabled</StatusDot>}
                      <StatusDot tone={cl.is_public ? 'amber' : 'slate'}>{cl.is_public ? 'Public (PKCE)' : 'Confidential'}</StatusDot>
                    </div>
                    {cl.description && <p className="mt-1 text-sm text-muted-foreground">{cl.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEdit(cl)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => remove(cl)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted/60 px-2 py-1 font-mono text-xs">{cl.client_id}</code>
                  <CopyButton value={cl.client_id} label="Copy ID" />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Store</dt>
                  <dd>{cl.store_name || 'Any store the signing-in user belongs to'}</dd>
                  <dt className="text-muted-foreground">Grants</dt>
                  <dd>{cl.grant_type_list.join(', ')}</dd>
                  <dt className="text-muted-foreground">Scopes</dt>
                  <dd className="flex flex-wrap gap-1">
                    {cl.scope_list.map((s) => <span key={s} className="rounded bg-muted px-1.5 font-mono text-[11px]">{s}</span>)}
                  </dd>
                  <dt className="text-muted-foreground">Redirects</dt>
                  <dd className="break-all">{cl.redirect_uri_list.join(', ') || '—'}</dd>
                  <dt className="text-muted-foreground">Signed-in</dt>
                  <dd>{cl.active_tokens} active grant(s) · created {formatDateTime(cl.created_at)}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {!cl.is_public && (
                    <Button variant="outline" size="sm" onClick={() => rotate(cl)}><KeyRound className="mr-1 h-3.5 w-3.5" /> Rotate secret</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => revokeTokens(cl)} disabled={cl.active_tokens === 0}>
                    <LogOut className="mr-1 h-3.5 w-3.5" /> Revoke all tokens
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.client_name}` : 'Register OAuth application'}</DialogTitle>
            <DialogDescription>Applications obtain tokens limited to these scopes and to each store&apos;s API permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="app-name">Application name *</Label>
                <Input id="app-name" value={form.client_name} placeholder="Shown on the consent screen" onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Restrict to store</Label>
                <StoreSelect
                  stores={stores}
                  value={form.store_id}
                  allowAll
                  allLabel="No restriction"
                  onChange={(v) => setForm((f) => ({ ...f, store_id: v }))}
                  className="sm:w-full"
                />
                <p className="text-xs text-muted-foreground">Required for client credentials.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-desc">Description</Label>
              <Input id="app-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Public client</div>
                  <div className="text-xs text-muted-foreground">SPA or mobile app without a secret; PKCE required</div>
                </div>
                <Switch checked={form.is_public} onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v, grant_types: v ? f.grant_types.filter((g) => g === 'authorization_code' || g === 'refresh_token') : f.grant_types }))} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Disabling revokes all its tokens</div>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Grant types *</Label>
              <div className="grid gap-2">
                {grantTypes.map((g) => {
                  const blocked = form.is_public && (g === 'client_credentials' || g === 'password')
                  return (
                    <label key={g} className={`flex items-center gap-2 text-sm ${blocked ? 'opacity-50' : ''}`}>
                      <Checkbox checked={form.grant_types.includes(g)} disabled={blocked} onCheckedChange={(c) => toggleGrant(g, c === true)} />
                      <span>{GRANT_TYPE_LABELS[g] ?? g}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-redirects">Redirect URIs {form.grant_types.includes('authorization_code') && '*'}</Label>
              <Textarea
                id="app-redirects"
                rows={3}
                value={form.redirect_uris}
                placeholder={'https://partner.example.com/oauth/callback\nhttp://localhost:3000/callback'}
                onChange={(e) => setForm((f) => ({ ...f, redirect_uris: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">One per line. Must match exactly; https required (http only for localhost).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Permissions *</Label>
              {legacyScopes.length > 0 && (
                <p className="text-xs text-amber-700">
                  Also granted legacy scopes: {legacyScopes.join(', ')}
                  {legacyScopes.includes('erp') && ' — "erp" gives full access to the internal API (used by the MCP server).'}
                </p>
              )}
              <ScopeMatrix
                catalog={catalog}
                value={form.scopes.filter((s) => knownScopes.has(s))}
                onChange={(next) => setForm((f) => ({ ...f, scopes: [...next, ...legacyScopes] }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecretDialog
        open={secrets !== null}
        onClose={() => setSecrets(null)}
        title="Application credentials"
        description="Give these to the application's developer over a secure channel."
        secrets={secrets ?? []}
      />
      {confirmDialog}
    </div>
  )
}
