'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface SavedTemplate {
  id: string
  name: string
  description: string
  payload: string
  is_default: boolean
}

export default function InvoiceTemplatesPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', payload: '{\n  "payment_terms": 30,\n  "terms": "",\n  "notes": "",\n  "items": []\n}', is_default: false })

  const load = async () => {
    const res = await apiFetch('/invoice-templates')
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      JSON.parse(form.payload)
    } catch {
      notifyError('Payload must be valid JSON')
      setSaving(false)
      return
    }
    const res = await apiFetch('/invoice-templates', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res.ok) {
      notifySuccess('Template created')
      setForm({ name: '', description: '', payload: form.payload, is_default: false })
      await load()
    } else {
      notifyError('Failed to create template')
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!(await confirm({
      title: 'Delete template?',
      description: 'Are you sure you want to delete this template? This action cannot be undone.',
    }))) return
    const res = await apiFetch(`/invoice-templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      notifySuccess('Template deleted')
      await load()
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/invoices">
            <Button variant="outline" size="sm" className="h-7">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Invoices
            </Button>
          </Link>
          <h1 className="app-page-title">Invoice templates</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New template</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createTemplate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payload (JSON)</Label>
                <Textarea
                  value={form.payload}
                  onChange={(e) => setForm({ ...form, payload: e.target.value })}
                  rows={10}
                  className="font-mono text-xs"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Default template</Label>
                <Switch checked={form.is_default} onCheckedChange={(c) => setForm({ ...form, is_default: c })} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Save template
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              <ul className="space-y-3">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {t.name}
                        {t.is_default && <span className="ml-2 text-xs text-blue-600">Default</span>}
                      </p>
                      {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
