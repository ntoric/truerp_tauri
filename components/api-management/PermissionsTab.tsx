'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { notifyError, notifySuccess } from '@/lib/notify'
import { RESOURCE_LABELS, groupScopes, listPolicies, updatePolicy, type ScopeInfo, type StorePolicy } from '@/lib/apiManagement'
import { ScopeMatrix } from './shared'

/** Per-store API policy: the outer limit for every key and OAuth token of a store. */
export default function PermissionsTab({ catalog }: { catalog: ScopeInfo[] }) {
  const [policies, setPolicies] = useState<StorePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<StorePolicy | null>(null)
  const [form, setForm] = useState({ api_enabled: true, webhooks_enabled: true, rate: '120', ips: '', scopes: [] as string[] })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setPolicies(await listPolicies())
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const quickToggle = async (p: StorePolicy, field: 'api_enabled' | 'webhooks_enabled', value: boolean) => {
    try {
      await updatePolicy(p.store_id, { [field]: value })
      notifySuccess(`${field === 'api_enabled' ? 'API access' : 'Webhooks'} ${value ? 'enabled' : 'disabled'} for ${p.store_name}.`)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  const openEdit = (p: StorePolicy) => {
    setEditing(p)
    setForm({
      api_enabled: p.api_enabled,
      webhooks_enabled: p.webhooks_enabled,
      rate: String(p.rate_limit_per_minute),
      ips: p.allowed_ips,
      scopes: p.scope_list,
    })
  }

  const save = async () => {
    if (!editing) return
    const rate = Number(form.rate)
    if (!Number.isInteger(rate) || rate < 1 || rate > 6000) return notifyError('Rate limit must be a whole number between 1 and 6000')
    setSaving(true)
    try {
      await updatePolicy(editing.store_id, {
        api_enabled: form.api_enabled,
        webhooks_enabled: form.webhooks_enabled,
        rate_limit_per_minute: rate,
        allowed_ips: form.ips,
        allowed_scopes: form.scopes,
      })
      notifySuccess(`API permissions saved for ${editing.store_name}.`)
      setEditing(null)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const resources = groupScopes(catalog)
  const summary = (p: StorePolicy) => {
    const set = new Set(p.scope_list)
    return resources.map((r) => {
      const read = r.read ? set.has(r.read.scope) : false
      const write = r.write ? set.has(r.write.scope) : false
      const level = write ? (r.write?.access === 'manage' ? 'manage' : 'read/write') : read ? 'read' : 'none'
      return { resource: r.resource, level }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Store permissions are the outer limit for every API key and OAuth app acting on that store. Turning API access off
        blocks all integrations for the store immediately, without revoking their keys.
      </p>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>API access</TableHead>
                    <TableHead>Webhooks</TableHead>
                    <TableHead>Allowed resources</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Credentials</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => (
                    <TableRow key={p.store_id}>
                      <TableCell>
                        <div className="font-medium">{p.store_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.store_code}
                          {!p.store_active && ' · store inactive'}
                          {p.is_default && ' · default permissions'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.api_enabled} onCheckedChange={(v) => quickToggle(p, 'api_enabled', v)} aria-label="API access" />
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.webhooks_enabled} disabled={!p.api_enabled} onCheckedChange={(v) => quickToggle(p, 'webhooks_enabled', v)} aria-label="Webhooks" />
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-md flex-wrap gap-1">
                          {summary(p).map((s) => (
                            <span
                              key={s.resource}
                              className={
                                s.level === 'none'
                                  ? 'rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/60 line-through'
                                  : s.level === 'read'
                                    ? 'rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700'
                                    : 'rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700'
                              }
                              title={s.level}
                            >
                              {RESOURCE_LABELS[s.resource] ?? s.resource}
                              {s.level !== 'none' && s.level !== 'read' ? ' ✎' : ''}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.rate_limit_per_minute}/min
                        <div className="text-muted-foreground">{p.allowed_ips ? `IPs: ${p.allowed_ips}` : 'Any IP'}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.active_api_keys} keys · {p.oauth_clients} apps · {p.webhooks} webhooks
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">Read</span>
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">Read &amp; write ✎</span>
        <span className="line-through">Blocked</span>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> API permissions · {editing?.store_name}
            </DialogTitle>
            <DialogDescription>Changes apply immediately to every key, OAuth token and webhook of this store.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">API access</div>
                  <div className="text-xs text-muted-foreground">Allow integrations to call the public API</div>
                </div>
                <Switch checked={form.api_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, api_enabled: v }))} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Webhooks</div>
                  <div className="text-xs text-muted-foreground">Send change notifications</div>
                </div>
                <Switch checked={form.webhooks_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, webhooks_enabled: v }))} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pol-rate">Rate limit (requests per minute, per credential)</Label>
                <Input id="pol-rate" inputMode="numeric" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pol-ips">Allowed IPs for API keys (optional)</Label>
                <Input id="pol-ips" value={form.ips} placeholder="203.0.113.7, 198.51.100.0/24" onChange={(e) => setForm((f) => ({ ...f, ips: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Comma-separated IPs or CIDR ranges. Leave empty to allow any address.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Allowed resources</Label>
              <ScopeMatrix catalog={catalog} value={form.scopes} onChange={(scopes) => setForm((f) => ({ ...f, scopes }))} />
              {form.scopes.length === 0 && (
                <p className="text-xs text-amber-700">With nothing allowed, integrations can only call <code>/me</code>.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

