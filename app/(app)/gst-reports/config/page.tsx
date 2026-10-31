'use client'

import { useCallback, useEffect, useState } from 'react'
import GstReportShell, { useGstScope } from '@/components/gst/GstReportShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import {
  gstGet, gstSend, GST_COMPOSITION_CATEGORIES, GST_PERIOD_STATUS_COLORS,
  type GstRegistration, type GstReturnPeriod,
} from '@/lib/gstComposition'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Pencil, Plus, Trash2 } from 'lucide-react'

const EMPTY_FORM = {
  gstin: '', legal_name: '', trade_name: '', state_code: '',
  registration_type: 'composition', composition_category: 'trader',
  composition_rate: '', effective_from: '', effective_to: '',
  filing_frequency: 'quarterly', status: 'active', notes: '',
}

export default function GstConfigPage() {
  const gst = useGstScope()
  const [periods, setPeriods] = useState<GstReturnPeriod[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GstRegistration | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const loadPeriods = useCallback(async () => {
    try {
      const data = await gstGet<GstReturnPeriod[]>('/periods')
      setPeriods(data || [])
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => { loadPeriods() }, [loadPeriods, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  const openEdit = (r: GstRegistration) => {
    setEditing(r)
    setForm({
      gstin: r.gstin, legal_name: r.legal_name, trade_name: r.trade_name,
      state_code: r.state_code, registration_type: r.registration_type,
      composition_category: r.composition_category || 'trader',
      composition_rate: r.composition_rate ? String(r.composition_rate) : '',
      effective_from: r.effective_from?.slice(0, 10) || '',
      effective_to: r.effective_to?.slice(0, 10) || '',
      filing_frequency: r.filing_frequency || 'quarterly',
      status: r.status, notes: r.notes || '',
    })
    setOpen(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      const payload = {
        ...form,
        composition_rate: form.composition_rate ? parseFloat(form.composition_rate) : 0,
        effective_to: form.effective_to || '',
      }
      if (editing) {
        await gstSend(`/registrations/${editing.id}`, 'PUT', payload)
        notifySuccess('Registration updated')
      } else {
        await gstSend('/registrations', 'POST', payload)
        notifySuccess('Registration created')
      }
      setOpen(false)
      await gst.reloadRegistrations()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: GstRegistration) => {
    if (!confirm(`Delete/deactivate registration ${r.gstin}?`)) return
    try {
      await gstSend(`/registrations/${r.id}`, 'DELETE')
      notifySuccess('Done')
      await gst.reloadRegistrations()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <GstReportShell
      gst={gst}
      title="GST Configuration"
      description="GST registrations, their composition category and effective dates, plus all filing periods."
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add registration
        </Button>
      }
    >
      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="periods">Return Periods</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>Legal / Trade Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gst.registrations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{r.gstin}</TableCell>
                      <TableCell>
                        <div>{r.legal_name}</div>
                        {r.trade_name && <div className="text-xs text-muted-foreground">{r.trade_name}</div>}
                      </TableCell>
                      <TableCell>{r.registration_type}</TableCell>
                      <TableCell>{r.composition_category || '—'}</TableCell>
                      <TableCell>{r.composition_rate ? `${r.composition_rate}%` : '—'}</TableCell>
                      <TableCell>{r.state || r.state_code}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.effective_from ? formatDate(r.effective_from) : '—'}
                        {r.effective_to ? ` → ${formatDate(r.effective_to)}` : ' →'}
                      </TableCell>
                      <TableCell>
                        <Badge className={r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {gst.registrations.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No GST registrations configured</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periods">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FY</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed</TableHead>
                    <TableHead>ARN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.financial_year}</TableCell>
                      <TableCell>{p.period_type === 'quarterly' ? `Q${p.quarter}` : 'Annual'}</TableCell>
                      <TableCell>{p.return_type}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDate(p.period_start)} – {formatDate(p.period_end)}</TableCell>
                      <TableCell><Badge className={GST_PERIOD_STATUS_COLORS[p.status] || 'bg-slate-100'}>{p.status}</Badge></TableCell>
                      <TableCell className="text-xs">{p.filed_at ? formatDate(p.filed_at) : '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{p.portal_reference || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {periods.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No return periods yet — create one from the CMP-08 / GSTR-4 pages</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} GST registration</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>GSTIN *</Label>
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="33ABCDE1234F1Z5" maxLength={15} />
            </div>
            <div>
              <Label>State code</Label>
              <Input value={form.state_code} onChange={(e) => setForm({ ...form, state_code: e.target.value })} placeholder="Auto from GSTIN" />
            </div>
            <div>
              <Label>Legal name *</Label>
              <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            </div>
            <div>
              <Label>Trade name</Label>
              <Input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
            </div>
            <div>
              <Label>Registration type</Label>
              <Select value={form.registration_type} onValueChange={(v) => setForm({ ...form, registration_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="composition">Composition</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.registration_type === 'composition' && (
              <>
                <div>
                  <Label>Composition category *</Label>
                  <Select value={form.composition_category} onValueChange={(v) => setForm({ ...form, composition_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GST_COMPOSITION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rate override (%)</Label>
                  <Input type="number" step="0.01" value={form.composition_rate} onChange={(e) => setForm({ ...form, composition_rate: e.target.value })} placeholder="Leave empty for category default" />
                </div>
              </>
            )}
            <div>
              <Label>Effective from</Label>
              <Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
            </div>
            <div>
              <Label>Effective to</Label>
              <Input type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} />
            </div>
            <div>
              <Label>Filing frequency</Label>
              <Select value={form.filing_frequency} onValueChange={(v) => setForm({ ...form, filing_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarterly">Quarterly (CMP-08)</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !form.gstin.trim() || !form.legal_name.trim()} onClick={save}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GstReportShell>
  )
}
