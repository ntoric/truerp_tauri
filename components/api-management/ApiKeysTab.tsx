'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2, Pencil, Plus, ShieldOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PremiumEmpty from '@/components/ui/premium-empty'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  createApiKey,
  deleteApiKey,
  formatDateTime,
  listApiKeys,
  listPolicies,
  revokeApiKey,
  updateApiKey,
  type ApiKey,
  type ScopeInfo,
  type StoreOption,
  type StorePolicy,
} from '@/lib/apiManagement'
import { ScopeMatrix, SecretDialog, StatusDot, StoreSelect } from './shared'

interface Props {
  catalog: ScopeInfo[]
  stores: StoreOption[]
}

export default function ApiKeysTab({ catalog, stores }: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [storeFilter, setStoreFilter] = useState('')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [policies, setPolicies] = useState<StorePolicy[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ApiKey | null>(null)
  const [form, setForm] = useState({ store_id: '', name: '', scopes: [] as string[], expires_at: '' })
  const [saving, setSaving] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [k, p] = await Promise.all([listApiKeys(storeFilter || undefined), listPolicies()])
      setKeys(k)
      setPolicies(p)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }, [storeFilter])

  useEffect(() => {
    load()
  }, [load])

  const policyFor = useMemo(() => new Map(policies.map((p) => [p.store_id, p])), [policies])
  const formPolicy = policyFor.get(form.store_id)

  const openCreate = () => {
    setEditing(null)
    const store = storeFilter || stores[0]?.id || ''
    setForm({ store_id: store, name: '', scopes: catalog.filter((s) => s.access === 'read').map((s) => s.scope), expires_at: '' })
    setDialogOpen(true)
  }

  const openEdit = (k: ApiKey) => {
    setEditing(k)
    setForm({ store_id: k.store_id, name: k.name, scopes: k.scope_list, expires_at: k.expires_at ? k.expires_at.slice(0, 10) : '' })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.store_id) return notifyError('Select a store')
    if (!form.name.trim()) return notifyError('Give the key a name, e.g. the platform it is for')
    if (form.scopes.length === 0) return notifyError('Select at least one permission')
    const expires = form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null
    setSaving(true)
    try {
      if (editing) {
        await updateApiKey(editing.id, {
          name: form.name.trim(),
          scopes: form.scopes,
          ...(expires ? { expires_at: expires } : { clear_expiry: true }),
        })
        notifySuccess('API key updated.')
      } else {
        const res = await createApiKey({ store_id: form.store_id, name: form.name.trim(), scopes: form.scopes, expires_at: expires })
        setSecret(res.secret)
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const revoke = async (k: ApiKey) => {
    const ok = await confirm({
      title: `Revoke "${k.name}"?`,
      description: 'Integrations using this key stop working immediately. This cannot be undone.',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      await revokeApiKey(k.id)
      notifySuccess('API key revoked.')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to revoke')
    }
  }

  const remove = async (k: ApiKey) => {
    const ok = await confirm({ title: `Delete "${k.name}"?`, description: 'The key and its history are removed.', variant: 'destructive' })
    if (!ok) return
    try {
      await deleteApiKey(k.id)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StoreSelect stores={stores} value={storeFilter} onChange={setStoreFilter} allowAll />
        <Button onClick={openCreate} disabled={stores.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> New API key
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : keys.length === 0 ? (
            <div className="p-4">
              <PremiumEmpty
                icon={KeyRound}
                title="No API keys yet"
                hint="Create a key to let an e-commerce site, accounting tool or custom app read and write this store's data."
                action={<Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New API key</Button>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="font-medium">{k.name}</div>
                        <div className="text-xs text-muted-foreground">by {k.created_by_name || '—'} · {formatDateTime(k.created_at)}</div>
                      </TableCell>
                      <TableCell>{k.store_name || '—'}</TableCell>
                      <TableCell><code className="font-mono text-xs">{k.prefix}…</code></TableCell>
                      <TableCell>
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {k.scope_list.map((s) => (
                            <span key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(k.last_used_at)}
                        {k.last_used_ip && <div className="text-muted-foreground">{k.last_used_ip}</div>}
                      </TableCell>
                      <TableCell>
                        {k.status === 'active' ? (
                          <StatusDot tone="green">Active{k.expires_at ? ` · until ${new Date(k.expires_at).toLocaleDateString('en-IN')}` : ''}</StatusDot>
                        ) : k.status === 'expired' ? (
                          <StatusDot tone="amber">Expired</StatusDot>
                        ) : (
                          <StatusDot tone="slate">Revoked</StatusDot>
                        )}
                        {policyFor.get(k.store_id)?.api_enabled === false && (
                          <div className="mt-1 text-xs text-red-600">Store API disabled</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {k.status !== 'revoked' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEdit(k)} aria-label="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => revoke(k)}>
                                <ShieldOff className="mr-1 h-3.5 w-3.5 text-red-500" /> Revoke
                              </Button>
                            </>
                          )}
                          {k.status === 'revoked' && (
                            <Button variant="outline" size="sm" onClick={() => remove(k)} aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit API key' : 'New API key'}</DialogTitle>
            <DialogDescription>
              The key acts on one store, limited to the permissions you choose and to that store&apos;s API permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Store *</Label>
                <StoreSelect stores={stores} value={form.store_id} onChange={(v) => setForm((f) => ({ ...f, store_id: v }))} className="sm:w-full" />
                {editing && <p className="text-xs text-muted-foreground">A key&apos;s store cannot be changed.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name *</Label>
                <Input id="key-name" value={form.name} placeholder="e.g. Shopify sync" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5 sm:w-1/2">
              <Label htmlFor="key-exp">Expires on (optional)</Label>
              <Input id="key-exp" type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Permissions *</Label>
              {formPolicy && !formPolicy.api_enabled && (
                <p className="text-sm text-red-600">API access is disabled for this store — the key will not work until it is enabled on the Permissions tab.</p>
              )}
              <ScopeMatrix
                catalog={catalog}
                value={form.scopes}
                onChange={(scopes) => setForm((f) => ({ ...f, scopes }))}
                limitTo={formPolicy?.scope_list}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || (editing === null && !form.store_id)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SecretDialog
        open={secret !== null}
        onClose={() => setSecret(null)}
        title="API key created"
        description="Send it as 'Authorization: Bearer <key>' to the public API."
        secrets={secret ? [{ label: 'API key', value: secret }] : []}
      />
      {confirmDialog}
    </div>
  )
}
