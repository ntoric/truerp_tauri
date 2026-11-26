'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Building2, FileText, Hash, ImagePlus, Landmark, Loader2, Palette, Percent, Receipt, RotateCcw, Save, Signature, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notifyError, notifySuccess } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  getBillingSettings,
  previewBillingDocument,
  saveBillingSettings,
  type BillingSettings,
  type BillingSettingsResponse,
} from '@/lib/subscriptions'

const MAX_LOGO_BYTES = 300 * 1024

/** Resize an image file to fit 600x240 and return a PNG (or JPEG) data URL. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read the image'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Unsupported image'))
    i.src = src
  })
  const scale = Math.min(1, 600 / img.width, 240 / img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  let out = canvas.toDataURL('image/png')
  if (out.length > MAX_LOGO_BYTES) {
    // Fall back to JPEG on white for photographic logos.
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    out = canvas.toDataURL('image/jpeg', 0.88)
  }
  if (out.length > MAX_LOGO_BYTES) throw new Error('Logo is too large — try a smaller image')
  return out
}

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1e1b4b,#3b0764)] text-amber-300 [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
          <div>
            <h3 className="font-semibold text-heading">{title}</h3>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} className="font-mono uppercase" />
      </div>
    </Field>
  )
}

const PRESETS: { name: string; accent: string; highlight: string }[] = [
  { name: 'Midnight & gold', accent: '#1E1B4B', highlight: '#C9973F' },
  { name: 'Emerald', accent: '#064E3B', highlight: '#D4A73A' },
  { name: 'Crimson', accent: '#7F1D1D', highlight: '#E0B062' },
  { name: 'Graphite', accent: '#1F2937', highlight: '#38BDF8' },
  { name: 'Royal', accent: '#1E3A8A', highlight: '#F59E0B' },
]

export default function BillingSettingsPanel() {
  const [saved, setSaved] = useState<BillingSettingsResponse | null>(null)
  const [form, setForm] = useState<BillingSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [doc, setDoc] = useState<'invoice' | 'receipt'>('invoice')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [rendering, setRendering] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef('')

  useEffect(() => {
    getBillingSettings()
      .then((r) => {
        setSaved(r)
        setForm(r.settings)
      })
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load invoice settings'))
  }, [])

  // Live preview, debounced.
  useEffect(() => {
    if (!form) return
    let cancelled = false
    const t = setTimeout(async () => {
      setRendering(true)
      try {
        const blob = await previewBillingDocument(form, doc)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setPreviewUrl(url)
        setPreviewError('')
      } catch (e) {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : 'Preview failed')
      } finally {
        if (!cancelled) setRendering(false)
      }
    }, 700)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [form, doc])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  if (!form || !saved) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const set = <K extends keyof BillingSettings>(k: K, v: BillingSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const dirty = JSON.stringify(form) !== JSON.stringify(saved.settings)

  const save = async () => {
    setSaving(true)
    try {
      const r = await saveBillingSettings(form)
      setSaved(r)
      setForm(r.settings)
      notifySuccess('Invoice & receipt settings saved.')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      set('logo_data', await fileToLogoDataUrl(file))
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not use this image')
    }
  }

  const year = new Date().getFullYear()
  const sampleNo = (prefix: string) => `${(prefix || '').toUpperCase()}-${year}-${'1'.padStart(form.number_padding || 5, '0')}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-heading">Invoice & receipt design</h3>
          <p className="text-xs text-muted-foreground">
            Applies to every subscription invoice and payment receipt, including ones already issued. Next numbers:{' '}
            <span className="font-mono">{saved.next_numbers.invoice}</span> · <span className="font-mono">{saved.next_numbers.receipt}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setForm(saved.settings)} disabled={!dirty || saving}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Discard
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="space-y-4">
          <Section icon={<Building2 />} title="Business details" hint="Shown as “Billed by” on invoices and “Received by” on receipts.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name *" className="sm:col-span-2">
                <Input value={form.issuer_name} onChange={(e) => set('issuer_name', e.target.value)} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
              </Field>
              <Field label="State code (GST)">
                <Input value={form.state_code} onChange={(e) => set('state_code', e.target.value)} placeholder="e.g. 29" maxLength={2} />
              </Field>
              <Field label="Pincode">
                <Input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
              </Field>
              <Field label="GSTIN">
                <Input value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} />
              </Field>
              <Field label="PAN">
                <Input value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} maxLength={10} />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Website" className="sm:col-span-2">
                <Input value={form.website} onChange={(e) => set('website', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section icon={<Palette />} title="Branding" hint="Logo and colours for the header band and accents.">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-44 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2">
                {form.logo_data ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_data} alt="Logo" className="max-h-16 max-w-40 object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="mr-1.5 h-4 w-4" /> {form.logo_data ? 'Replace logo' : 'Upload logo'}
                </Button>
                {form.logo_data && (
                  <Button size="sm" variant="ghost" onClick={() => set('logo_data', '')}>
                    <Trash2 className="mr-1.5 h-4 w-4 text-rose-500" /> Remove
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">PNG or JPG, resized to fit 600×240.</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setForm((f) => (f ? { ...f, accent_color: p.accent, highlight_color: p.highlight } : f))}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2',
                    form.accent_color.toUpperCase() === p.accent && form.highlight_color.toUpperCase() === p.highlight
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border'
                  )}
                >
                  <span className="flex">
                    <span className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: p.accent }} />
                    <span className="-ml-1.5 h-4 w-4 rounded-full ring-2 ring-white" style={{ background: p.highlight }} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="Primary colour" value={form.accent_color} onChange={(v) => set('accent_color', v)} />
              <ColorField label="Highlight colour" value={form.highlight_color} onChange={(v) => set('highlight_color', v)} />
            </div>
          </Section>

          <Section icon={<Hash />} title="Numbering" hint="Numbers restart at 1 each calendar year. Changing a prefix starts a new sequence.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Invoice prefix">
                <Input value={form.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value.toUpperCase())} maxLength={12} />
              </Field>
              <Field label="Receipt prefix">
                <Input value={form.receipt_prefix} onChange={(e) => set('receipt_prefix', e.target.value.toUpperCase())} maxLength={12} />
              </Field>
              <Field label="Digits">
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={form.number_padding}
                  onChange={(e) => set('number_padding', Number(e.target.value) || 0)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Looks like <span className="font-mono">{sampleNo(form.invoice_prefix)}</span> and{' '}
              <span className="font-mono">{sampleNo(form.receipt_prefix)}</span>. Already-issued numbers never change.
            </p>
          </Section>

          <Section icon={<Percent />} title="Tax" hint="Plan prices include tax; the invoice shows the breakdown. Leave 0 for no tax lines.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tax rate (%)">
                <Input type="number" min={0} max={50} step="0.01" value={form.tax_rate} onChange={(e) => set('tax_rate', Number(e.target.value) || 0)} />
              </Field>
              <Field label="Tax label">
                <Input value={form.tax_label} onChange={(e) => set('tax_label', e.target.value)} />
              </Field>
              <Field label="SAC code">
                <Input value={form.sac_code} onChange={(e) => set('sac_code', e.target.value)} placeholder="e.g. 998314" />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Stores in the same GST state code are charged CGST + SGST; others are charged IGST.
            </p>
          </Section>

          <Section icon={<FileText />} title="Invoice" hint="One invoice is issued for every billing cycle, including renewals.">
            <Field label="Title">
              <Input
                value={form.invoice_title}
                onChange={(e) => set('invoice_title', e.target.value)}
                placeholder="Automatic — “Tax Invoice” when GSTIN and tax are set, else “Invoice”"
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle label="Amount in words" checked={form.show_amount_in_words} onChange={(v) => set('show_amount_in_words', v)} />
              <Toggle label="Payments received" checked={form.show_payment_history} onChange={(v) => set('show_payment_history', v)} />
            </div>
            <Field label="Notes">
              <Textarea rows={2} value={form.invoice_notes} onChange={(e) => set('invoice_notes', e.target.value)} />
            </Field>
            <Field label="Terms & conditions">
              <Textarea rows={3} value={form.invoice_terms} onChange={(e) => set('invoice_terms', e.target.value)} />
            </Field>
          </Section>

          <Section icon={<Landmark />} title="Bank details" hint="Printed on invoices that still have a balance due.">
            <Toggle label="Show bank details" checked={form.show_bank_details} onChange={(v) => set('show_bank_details', v)} />
            {form.show_bank_details && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bank name">
                  <Input value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
                </Field>
                <Field label="Account name">
                  <Input value={form.account_name} onChange={(e) => set('account_name', e.target.value)} />
                </Field>
                <Field label="Account number">
                  <Input value={form.account_number} onChange={(e) => set('account_number', e.target.value)} />
                </Field>
                <Field label="IFSC">
                  <Input value={form.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} />
                </Field>
                <Field label="UPI ID" className="sm:col-span-2">
                  <Input value={form.upi_id} onChange={(e) => set('upi_id', e.target.value)} />
                </Field>
              </div>
            )}
          </Section>

          <Section icon={<Receipt />} title="Receipt" hint="One receipt is issued for every payment recorded.">
            <Field label="Title">
              <Input value={form.receipt_title} onChange={(e) => set('receipt_title', e.target.value)} />
            </Field>
            <Toggle
              label="Show invoice balance"
              hint="Invoice total, paid to date and balance due after this payment."
              checked={form.show_receipt_balance}
              onChange={(v) => set('show_receipt_balance', v)}
            />
            <Field label="Notes">
              <Textarea rows={2} value={form.receipt_notes} onChange={(e) => set('receipt_notes', e.target.value)} />
            </Field>
          </Section>

          <Section icon={<Signature />} title="Signature & footer">
            <Toggle label="Authorised signatory block" checked={form.show_signature} onChange={(v) => set('show_signature', v)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Signatory name">
                <Input value={form.signatory_name} onChange={(e) => set('signatory_name', e.target.value)} placeholder="e.g. Finance Team" />
              </Field>
              <Field label="Footer text">
                <Input value={form.footer_text} onChange={(e) => set('footer_text', e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
                {(['invoice', 'receipt'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDoc(d)}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                      doc === d ? 'bg-card text-primary shadow-gr-xs' : 'text-muted-foreground hover:text-heading'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {rendering && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {dirty ? 'Unsaved preview' : 'Live preview'}
              </span>
            </div>
            <div className="bg-surface-2 p-3">
              {previewError ? (
                <div className="flex aspect-[210/297] items-center justify-center rounded-lg bg-card p-6 text-center text-sm text-rose-600">
                  {previewError}
                </div>
              ) : previewUrl ? (
                <iframe
                  title={`${doc} preview`}
                  src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                  className="aspect-[210/297] w-full rounded-lg bg-white shadow-gr-sm"
                />
              ) : (
                <div className="flex aspect-[210/297] items-center justify-center rounded-lg bg-card">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              Sample data — a partly paid {doc === 'invoice' ? 'invoice' : 'payment'} for a sample store.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
