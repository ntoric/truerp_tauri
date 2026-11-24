'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, Plus, RotateCw, Send, Trash2, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PremiumEmpty from '@/components/ui/premium-empty'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  createWebhook,
  deleteWebhook,
  formatDateTime,
  listWebhookDeliveries,
  listWebhooks,
  retryWebhookDelivery,
  testWebhook,
  updateWebhook,
  type AdminWebhook,
  type EventTypeInfo,
  type StoreOption,
  type WebhookDelivery,
} from '@/lib/apiManagement'
import { SecretDialog, StatusDot, StoreSelect } from './shared'

export default function WebhooksTab({ stores, eventTypes }: { stores: StoreOption[]; eventTypes: EventTypeInfo[] }) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [storeFilter, setStoreFilter] = useState('')
  const [hooks, setHooks] = useState<AdminWebhook[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ store_id: '', url: '', description: '', all: true, events: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deliveriesFor, setDeliveriesFor] = useState<AdminWebhook | null>(null)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])

  const load = useCallback(async () => {
    try {
      setHooks(await listWebhooks(storeFilter || undefined))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }, [storeFilter])

  useEffect(() => {
    load()
  }, [load])

  const groups = eventTypes.reduce<Record<string, EventTypeInfo[]>>((acc, e) => {
    const g = e.type.split('.')[0]
    ;(acc[g] ||= []).push(e)
    return acc
  }, {})

  const openCreate = () => {
    setForm({ store_id: storeFilter || stores[0]?.id || '', url: '', description: '', all: true, events: [] })
    setCreateOpen(true)
  }

  const create = async () => {
    if (!form.store_id) return notifyError('Select a store')
    if (!form.url.trim().startsWith('https://')) return notifyError('The URL must start with https://')
    if (!form.all && form.events.length === 0) return notifyError('Select at least one event')
    setSaving(true)
    try {
      const res = await createWebhook({ store_id: form.store_id, url: form.url.trim(), description: form.description.trim(), events: form.all ? ['*'] : form.events })
      setSecret(res.secret)
      setCreateOpen(false)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to create webhook')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (w: AdminWebhook, active: boolean) => {
    try {
      await updateWebhook(w.id, { is_active: active })
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update webhook')
    }
  }

  const sendTest = async (w: AdminWebhook) => {
    setTesting(w.id)
    try {
      const res = await testWebhook(w.id)
      if (res.succeeded) notifySuccess(`Endpoint responded with HTTP ${res.response_status}.`)
      else notifyError(res.error || `Endpoint responded with HTTP ${res.response_status}`)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(null)
    }
  }

  const remove = async (w: AdminWebhook) => {
    if (!(await confirm({ title: 'Delete webhook?', description: w.url, variant: 'destructive' }))) return
    try {
      await deleteWebhook(w.id)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const openDeliveries = async (w: AdminWebhook) => {
    setDeliveriesFor(w)
    setDeliveries([])
    try {
      setDeliveries(await listWebhookDeliveries(w.id))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load deliveries')
    }
  }

  const retry = async (d: WebhookDelivery) => {
    if (!deliveriesFor) return
    try {
      await retryWebhookDelivery(deliveriesFor.id, d.id)
      notifySuccess('Queued for redelivery.')
      setDeliveries(await listWebhookDeliveries(deliveriesFor.id))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to retry')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StoreSelect stores={stores} value={storeFilter} onChange={setStoreFilter} allowAll />
        <Button onClick={openCreate} disabled={stores.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Add endpoint
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : hooks.length === 0 ? (
            <div className="p-4">
              <PremiumEmpty
                icon={Webhook}
                title="No webhook endpoints"
                hint="Endpoints receive signed notifications when invoices, payments, stock and other records change. Integrations can also register their own through the API."
                action={<Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add endpoint</Button>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hooks.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-mono text-xs" title={w.url}>{w.url}</div>
                        <div className="text-xs text-muted-foreground">
                          {w.description || '—'} · via {w.created_via === 'api' ? 'API' : 'admin'}
                        </div>
                      </TableCell>
                      <TableCell>{w.store_name}</TableCell>
                      <TableCell className="max-w-[14rem] text-xs">{w.events.includes('*') ? 'All events' : w.events.join(', ')}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {w.disabled_reason ? (
                          <StatusDot tone="red">Auto-disabled</StatusDot>
                        ) : w.failure_count > 0 ? (
                          <StatusDot tone="amber">{w.failure_count} failing</StatusDot>
                        ) : (
                          <StatusDot tone="green">Healthy</StatusDot>
                        )}
                        <div className="mt-1 text-muted-foreground">
                          Last: {formatDateTime(w.last_delivery_at)}
                          {w.pending_deliveries > 0 && ` · ${w.pending_deliveries} queued`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={w.is_active} onCheckedChange={(v) => toggle(w, v)} aria-label="Active" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => sendTest(w)} disabled={testing === w.id}>
                            {testing === w.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />} Test
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openDeliveries(w)} aria-label="Deliveries">
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => remove(w)} aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add webhook endpoint</DialogTitle>
            <DialogDescription>TruERP POSTs a signed JSON event to this URL whenever a subscribed change happens in the store.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Store *</Label>
                <StoreSelect stores={stores} value={form.store_id} onChange={(v) => setForm((f) => ({ ...f, store_id: v }))} className="sm:w-full" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-desc">Description</Label>
                <Input id="wh-desc" value={form.description} placeholder="e.g. Warehouse system" onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL *</Label>
              <Input id="wh-url" value={form.url} placeholder="https://partner.example.com/webhooks/truerp" onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch checked={form.all} onCheckedChange={(v) => setForm((f) => ({ ...f, all: v }))} /> Send all events
              </label>
              {!form.all && (
                <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                  {Object.entries(groups).map(([group, events]) => (
                    <div key={group} className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.replace('_', ' ')}</div>
                      {events.map((e) => (
                        <label key={e.type} className="flex items-center gap-2 text-sm" title={e.description}>
                          <Checkbox
                            checked={form.events.includes(e.type)}
                            onCheckedChange={(c) =>
                              setForm((f) => ({ ...f, events: c === true ? [...f.events, e.type] : f.events.filter((x) => x !== e.type) }))
                            }
                          />
                          <code className="text-xs">{e.type}</code>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveriesFor !== null} onOpenChange={(o) => !o && setDeliveriesFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent deliveries</DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">{deliveriesFor?.url}</DialogDescription>
          </DialogHeader>
          {deliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No deliveries in the last 30 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                      <TableCell>
                        {d.status === 'succeeded' ? <StatusDot tone="green">Delivered</StatusDot> : d.status === 'pending' ? <StatusDot tone="amber">Retrying</StatusDot> : <StatusDot tone="red">Failed</StatusDot>}
                      </TableCell>
                      <TableCell>{d.attempts}</TableCell>
                      <TableCell className="max-w-[14rem] text-xs">
                        {d.response_status ? `HTTP ${d.response_status}` : '—'}
                        {d.last_error && <div className="truncate text-red-600" title={d.last_error}>{d.last_error}</div>}
                        {d.status === 'pending' && d.next_attempt_at && <div className="text-muted-foreground">next {formatDateTime(d.next_attempt_at)}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(d.created_at)}</TableCell>
                      <TableCell>
                        {d.status === 'failed' && (
                          <Button variant="outline" size="sm" onClick={() => retry(d)}><RotateCw className="mr-1 h-3.5 w-3.5" /> Retry</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SecretDialog
        open={secret !== null}
        onClose={() => setSecret(null)}
        title="Webhook signing secret"
        description="Use it to verify the TruERP-Signature header on each delivery (see the API docs)."
        secrets={secret ? [{ label: 'Signing secret', value: secret }] : []}
      />
      {confirmDialog}
    </div>
  )
}
