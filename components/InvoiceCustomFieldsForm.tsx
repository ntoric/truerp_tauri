'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface InvoiceCustomFieldDefinition {
  id: string
  label: string
  field_key: string
  field_type: 'text' | 'number' | 'date' | 'boolean'
  is_required: boolean
  show_on_pdf: boolean
  sort_order: number
}

interface InvoiceCustomFieldsFormProps {
  definitions: InvoiceCustomFieldDefinition[]
  values: Record<string, string | number | boolean>
  onChange: (fieldKey: string, value: string | number | boolean) => void
}

export default function InvoiceCustomFieldsForm({
  definitions,
  values,
  onChange,
}: InvoiceCustomFieldsFormProps) {
  if (definitions.length === 0) return null

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-900">Custom fields</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {definitions.map((def) => (
          <div key={def.id} className="space-y-2">
            <Label>
              {def.label}
              {def.is_required && <span className="text-red-500"> *</span>}
            </Label>
            {def.field_type === 'boolean' ? (
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={Boolean(values[def.field_key])}
                  onCheckedChange={(checked) => onChange(def.field_key, checked)}
                />
                <span className="text-sm text-muted-foreground">{values[def.field_key] ? 'Yes' : 'No'}</span>
              </div>
            ) : (
              <Input
                type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'}
                value={values[def.field_key] != null ? String(values[def.field_key]) : ''}
                onChange={(e) => {
                  if (def.field_type === 'number') {
                    onChange(def.field_key, e.target.value === '' ? '' : Number(e.target.value))
                  } else {
                    onChange(def.field_key, e.target.value)
                  }
                }}
                required={def.is_required}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function parseCustomFieldsFromInvoice(raw: string | Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, string | number | boolean>
  try {
    return JSON.parse(raw) as Record<string, string | number | boolean>
  } catch {
    return {}
  }
}

export function displayCustomFields(
  definitions: InvoiceCustomFieldDefinition[],
  values: Record<string, string | number | boolean>
) {
  const rows = definitions
    .map((d) => {
      const v = values[d.field_key]
      if (v === undefined || v === null || v === '') return null
      return { label: d.label, value: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) }
    })
    .filter(Boolean) as { label: string; value: string }[]

  if (rows.length === 0) return null

  return (
    <div className="mt-6 border-t pt-4">
      <p className="text-sm font-medium text-gray-500 mb-2">Additional information</p>
      <dl className="grid gap-2 sm:grid-cols-2 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-gray-500">{r.label}</dt>
            <dd className="font-medium text-gray-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
