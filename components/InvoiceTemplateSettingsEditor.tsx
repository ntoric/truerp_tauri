'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import GstInvoicePreviewSample, { type GstPreviewBusiness } from '@/components/GstInvoicePreviewSample'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  INVOICE_COLOR_SWATCHES,
  INVOICE_THEME_PRESETS,
  THEME_STYLE_TAG_OPTIONS,
  defaultInvoiceSettingsRecord,
  normalizeInvoiceSettingsFromApi,
  parseCustomization,
  serializeInvoiceSettingsForApi,
  swatchIdForColor,
  type InvoiceSettingsRecord,
  type InvoiceTemplateCustomization,
} from '@/lib/invoiceTemplateSettings'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Info, Loader2, Save } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

function SettingsSection({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string
  badge?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-gray-900"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              {badge}
            </Badge>
          ) : null}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {open ? <div className="space-y-3 pb-4">{children}</div> : null}
    </div>
  )
}

function ThemeToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
  hint,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  hint?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <Label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-1 text-sm font-normal leading-snug">
        {label}
        {hint ? <Info className="h-3.5 w-3.5 text-gray-400" /> : null}
      </Label>
    </div>
  )
}

export default function InvoiceTemplateSettingsEditor({ backHref = '/settings' }: { backHref?: string }) {
  const [settings, setSettings] = useState<InvoiceSettingsRecord>(defaultInvoiceSettingsRecord())
  const [business, setBusiness] = useState<GstPreviewBusiness>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [selectedSwatch, setSelectedSwatch] = useState('black')

  const customization = parseCustomization(settings.customization)

  const patchCustomization = (patch: Partial<InvoiceTemplateCustomization>) => {
    setSettings((prev) => ({
      ...prev,
      customization: {
        ...parseCustomization(prev.customization),
        ...patch,
      },
    }))
  }

  const patchThemeSettings = (key: keyof InvoiceTemplateCustomization['theme_settings'], value: boolean) => {
    const c = parseCustomization(settings.customization)
    patchCustomization({
      theme_settings: { ...c.theme_settings, [key]: value },
    })
  }

  const patchNested = <
    K extends 'invoice_details' | 'party_details' | 'item_columns' | 'miscellaneous',
    F extends keyof InvoiceTemplateCustomization[K],
  >(
    section: K,
    key: F,
    value: InvoiceTemplateCustomization[K][F]
  ) => {
    const c = parseCustomization(settings.customization)
    patchCustomization({
      [section]: { ...c[section], [key]: value },
    } as Partial<InvoiceTemplateCustomization>)
  }

  const load = useCallback(async () => {
    try {
      const [settingsRes, businessRes] = await Promise.all([apiFetch('/settings/invoice'), apiFetch('/business')])
      if (settingsRes.ok) {
        const normalized = normalizeInvoiceSettingsFromApi(await settingsRes.json())
        setSettings(normalized)
        setSelectedSwatch(swatchIdForColor(normalized.primary_color))
      }
      if (businessRes.ok) {
        const b = await businessRes.json()
        setBusiness({
          name: b.name,
          address: b.address,
          city: b.city,
          state: b.state,
          pincode: b.pincode,
          phone: b.phone,
          gstin: b.gstin,
          logo_url: b.logo_url,
        })
      }
    } catch {
      notifyError('Failed to load invoice template settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const payload = serializeInvoiceSettingsForApi({
        ...settings,
        show_bank_details: customization.miscellaneous.show_bank_details,
        show_signature: customization.miscellaneous.show_signature,
      })
      const res = await apiFetch('/settings/invoice', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        notifyError('Failed to save invoice template settings')
        return
      }
      const saved = normalizeInvoiceSettingsFromApi(await res.json())
      setSettings(saved)
      notifySuccess('Invoice template settings saved')
    } catch {
      notifyError('Failed to save invoice template settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleStyleTag = (tagId: string) => {
    const c = parseCustomization(settings.customization)
    const tags = c.theme_style_tags.includes(tagId)
      ? c.theme_style_tags.filter((t) => t !== tagId)
      : [...c.theme_style_tags, tagId]
    patchCustomization({ theme_style_tags: tags })
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-100 p-4 lg:p-8">
        <div className="mb-4 flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <GstInvoicePreviewSample settings={settings} customization={customization} business={business} />
      </div>

      <aside className="flex w-full shrink-0 flex-col border-l border-gray-200 bg-white lg:w-[380px] xl:w-[420px]">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h2 className="text-base font-semibold text-gray-900">Invoice template</h2>
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Themes</p>
              <button type="button" className="text-xs font-medium text-blue-600">
                See All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {INVOICE_THEME_PRESETS.slice(0, 3).map((theme) => {
                const selected = settings.template === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, template: theme.id }))}
                    className={`rounded-lg border-2 p-2 text-left transition-colors ${
                      selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="mb-2 h-14 rounded border border-gray-100 bg-gradient-to-br from-white to-gray-50"
                      style={{ boxShadow: selected ? `inset 0 0 0 2px ${settings.primary_color}` : undefined }}
                    />
                    <p className="text-[11px] font-medium leading-tight">{theme.label}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-sm font-semibold text-gray-900">Theme styling</p>
            <div className="flex flex-wrap gap-2">
              {THEME_STYLE_TAG_OPTIONS.map((tag) => {
                const active = customization.theme_style_tags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleStyleTag(tag.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-2 text-sm font-semibold text-gray-900">Create custom theme</p>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="custom-theme"
                checked={customization.use_custom_theme}
                onChange={() => patchCustomization({ use_custom_theme: true, theme_style_tags: [] })}
              />
              Use my own layout
            </label>
            <Button
              type="button"
              variant={customization.use_custom_theme ? 'default' : 'outline'}
              className="w-full bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                patchCustomization({ use_custom_theme: true })
                setSettings((s) => ({ ...s, template: 'custom' }))
              }}
            >
              Create your own theme
            </Button>
          </div>

          <div className="mb-6">
            <p className="mb-3 text-sm font-semibold text-gray-900">Select color</p>
            <div className="flex flex-wrap gap-2">
              {INVOICE_COLOR_SWATCHES.map((swatch) => {
                const selected = selectedSwatch === swatch.id
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    title={swatch.label}
                    onClick={() => {
                      setSelectedSwatch(swatch.id)
                      setSettings((s) => ({
                        ...s,
                        primary_color: swatch.primary,
                        secondary_color: swatch.secondary,
                      }))
                    }}
                    className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200"
                    style={{ backgroundColor: swatch.primary }}
                  >
                    {selected ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
                        <Check className="h-3 w-3 text-gray-900" />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">Theme settings</p>
            <div className="space-y-3">
              <ThemeToggleRow
                id="show_party_balance"
                label="Show party balance in invoice"
                checked={customization.theme_settings.show_party_balance}
                onCheckedChange={(v) => patchThemeSettings('show_party_balance', v)}
              />
              <ThemeToggleRow
                id="enable_free_item_quantity"
                label="Enable free item quantity"
                checked={customization.theme_settings.enable_free_item_quantity}
                onCheckedChange={(v) => patchThemeSettings('enable_free_item_quantity', v)}
              />
              <ThemeToggleRow
                id="show_item_description"
                label="Show item description in invoice"
                checked={customization.theme_settings.show_item_description}
                onCheckedChange={(v) => patchThemeSettings('show_item_description', v)}
              />
              <ThemeToggleRow
                id="show_alternate_unit"
                label="Show Alternate Unit in Invoice"
                checked={customization.theme_settings.show_alternate_unit}
                onCheckedChange={(v) => patchThemeSettings('show_alternate_unit', v)}
              />
              <ThemeToggleRow
                id="show_phone_on_invoice"
                label="Show phone number on invoice"
                checked={customization.theme_settings.show_phone_on_invoice}
                onCheckedChange={(v) => patchThemeSettings('show_phone_on_invoice', v)}
              />
              <ThemeToggleRow
                id="show_time_on_invoice"
                label="Show time on Invoices"
                checked={customization.theme_settings.show_time_on_invoice}
                onCheckedChange={(v) => patchThemeSettings('show_time_on_invoice', v)}
                hint
              />
              <ThemeToggleRow
                id="price_history"
                label="Price History"
                checked={customization.theme_settings.price_history}
                onCheckedChange={(v) => patchThemeSettings('price_history', v)}
                hint
              />
              <ThemeToggleRow
                id="auto_apply_luxury"
                label="Auto-apply luxury theme for sharing"
                checked={customization.theme_settings.auto_apply_luxury_theme_for_sharing}
                onCheckedChange={(v) => patchThemeSettings('auto_apply_luxury_theme_for_sharing', v)}
              />
            </div>
          </div>

          <SettingsSection
            title="Invoice Details"
            open={openSection === 'invoice'}
            onToggle={() => setOpenSection(openSection === 'invoice' ? null : 'invoice')}
          >
            {(Object.keys(customization.invoice_details) as (keyof typeof customization.invoice_details)[]).map(
              (key) => (
                <ThemeToggleRow
                  key={key}
                  id={`inv_${key}`}
                  label={key.replace(/show_/g, 'Show ').replace(/_/g, ' ')}
                  checked={customization.invoice_details[key]}
                  onCheckedChange={(v) => patchNested('invoice_details', key, v)}
                />
              )
            )}
          </SettingsSection>

          <SettingsSection
            title="Party Details"
            open={openSection === 'party'}
            onToggle={() => setOpenSection(openSection === 'party' ? null : 'party')}
          >
            {(Object.keys(customization.party_details) as (keyof typeof customization.party_details)[]).map(
              (key) => (
                <ThemeToggleRow
                  key={key}
                  id={`party_${key}`}
                  label={key.replace(/show_/g, 'Show ').replace(/_/g, ' ')}
                  checked={customization.party_details[key]}
                  onCheckedChange={(v) => patchNested('party_details', key, v)}
                />
              )
            )}
          </SettingsSection>

          <SettingsSection
            title="Item Table Columns"
            open={openSection === 'columns'}
            onToggle={() => setOpenSection(openSection === 'columns' ? null : 'columns')}
          >
            {(Object.keys(customization.item_columns) as (keyof typeof customization.item_columns)[]).map((key) => (
              <ThemeToggleRow
                key={key}
                id={`col_${key}`}
                label={key.toUpperCase()}
                checked={customization.item_columns[key]}
                onCheckedChange={(v) => patchNested('item_columns', key, v)}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            title="Miscellaneous Details"
            badge="New"
            open={openSection === 'misc'}
            onToggle={() => setOpenSection(openSection === 'misc' ? null : 'misc')}
          >
            {(Object.keys(customization.miscellaneous) as (keyof typeof customization.miscellaneous)[]).map(
              (key) => (
                <ThemeToggleRow
                  key={key}
                  id={`misc_${key}`}
                  label={key.replace(/show_/g, 'Show ').replace(/_/g, ' ')}
                  checked={customization.miscellaneous[key]}
                  onCheckedChange={(v) => patchNested('miscellaneous', key, v)}
                />
              )
            )}
            <ThemeToggleRow
              id="show_logo"
              label="Show company logo"
              checked={settings.show_logo}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, show_logo: v }))}
            />
          </SettingsSection>
        </div>
      </aside>
    </div>
  )
}
