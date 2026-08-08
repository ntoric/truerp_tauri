'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DEFAULT_WEIGHING_SCALE_SETTINGS,
  isWebSerialSupported,
  mergeWeighingScaleSettings,
  type WeighingScaleSettings,
} from '@/lib/weighingScale'
import { SCALE_CSV_EXTRA_FIELD_OPTIONS } from '@/lib/weighingScaleCsv'
import { Loader2, Save, Scale } from 'lucide-react'
import WeighingScaleCatalogExport from '@/components/WeighingScaleCatalogExport'

export default function WeighingScaleSettingsCard() {
  const [settings, setSettings] = useState<WeighingScaleSettings>(DEFAULT_WEIGHING_SCALE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/settings/weighing-scale')
        if (res.ok) {
          setSettings(mergeWeighingScaleSettings(await res.json()))
        }
      } catch {
        /* defaults */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const update = <K extends keyof WeighingScaleSettings>(
    key: K,
    value: WeighingScaleSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/settings/weighing-scale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSettings(mergeWeighingScaleSettings(await res.json()))
        setMessage('Weighing scale settings saved successfully')
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(data.error || 'Failed to save weighing scale settings')
      }
    } catch {
      setMessage('Failed to save weighing scale settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Scale className="h-5 w-5 text-blue-600" />
        <CardTitle>Electronic Weighing Scale</CardTitle>
      </CardHeader>
      <CardContent>
        {message && (
          <div
            className={`mb-4 rounded-lg p-3 text-sm ${
              message.includes('success') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="scale_enabled">Enable weighing scale integration</Label>
              <p className="text-xs text-muted-foreground">
                Connect USB/serial scales on POS and invoice screens (Chrome or Edge recommended).
              </p>
            </div>
            <Switch
              id="scale_enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => update('enabled', checked)}
            />
          </div>

          {!isWebSerialSupported() && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Web Serial API is not available in this browser. Use Chrome/Edge for direct USB serial
              scales, or choose Keyboard (HID) mode if your scale types weight like a barcode scanner.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Connection type</Label>
              <Select
                value={settings.connection}
                onValueChange={(value) =>
                  update('connection', value as WeighingScaleSettings['connection'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serial">USB / Serial (Web Serial)</SelectItem>
                  <SelectItem value="keyboard">Keyboard wedge (HID)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Protocol / parser</Label>
              <Select
                value={settings.protocol}
                onValueChange={(value) =>
                  update('protocol', value as WeighingScaleSettings['protocol'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Generic (auto-detect number)</SelectItem>
                  <SelectItem value="cas">CAS / common retail scales</SelectItem>
                  <SelectItem value="toledo">Mettler Toledo style</SelectItem>
                  <SelectItem value="legacy_fixed">Legacy 7-digit fixed decimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {settings.connection === 'serial' && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="baud_rate">Baud rate</Label>
                <Input
                  id="baud_rate"
                  type="number"
                  value={settings.baud_rate}
                  onChange={(e) => update('baud_rate', parseInt(e.target.value, 10) || 9600)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data bits</Label>
                <Select
                  value={String(settings.data_bits)}
                  onValueChange={(value) => update('data_bits', parseInt(value, 10) as 7 | 8)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="7">7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stop bits</Label>
                <Select
                  value={String(settings.stop_bits)}
                  onValueChange={(value) => update('stop_bits', parseInt(value, 10) as 1 | 2)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parity</Label>
                <Select
                  value={settings.parity}
                  onValueChange={(value) =>
                    update('parity', value as WeighingScaleSettings['parity'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="even">Even</SelectItem>
                    <SelectItem value="odd">Odd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Scale output unit</Label>
              <Select
                value={settings.scale_weight_unit}
                onValueChange={(value) =>
                  update('scale_weight_unit', value as WeighingScaleSettings['scale_weight_unit'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="g">Gram (g)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="decimal_places">Decimal places</Label>
              <Input
                id="decimal_places"
                type="number"
                min={0}
                max={4}
                value={settings.decimal_places}
                onChange={(e) => update('decimal_places', parseInt(e.target.value, 10) || 3)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_weight">Minimum weight</Label>
              <Input
                id="min_weight"
                type="number"
                step="0.001"
                value={settings.min_weight}
                onChange={(e) => update('min_weight', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tare_weight">Tare offset (kg)</Label>
              <Input
                id="tare_weight"
                type="number"
                step="0.001"
                value={settings.tare_weight}
                onChange={(e) => update('tare_weight', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="require_stable">Require stable reading before capture</Label>
              <Switch
                id="require_stable"
                checked={settings.require_stable_weight}
                onCheckedChange={(checked) => update('require_stable_weight', checked)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stable_readings">Stable samples required</Label>
              <Input
                id="stable_readings"
                type="number"
                min={1}
                max={10}
                value={settings.stable_readings_required}
                onChange={(e) =>
                  update('stable_readings_required', parseInt(e.target.value, 10) || 3)
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="auto_pos">Auto-fill quantity on POS (KG/GM items)</Label>
              <Switch
                id="auto_pos"
                checked={settings.auto_apply_on_pos}
                onCheckedChange={(checked) => update('auto_apply_on_pos', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="auto_invoice">Auto-fill quantity on sales invoice</Label>
              <Switch
                id="auto_invoice"
                checked={settings.auto_apply_on_invoice}
                onCheckedChange={(checked) => update('auto_apply_on_invoice', checked)}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Scale barcode (POS &amp; sales invoice)</p>
                <p className="text-xs text-muted-foreground">
                  Works independently of live scale connection. Format: prefix + PLU + weight — e.g.{' '}
                  <span className="font-mono">w0000112500</span> (prefix <span className="font-mono">w</span>,
                  PLU <span className="font-mono">00001</span>, weight <span className="font-mono">12500</span> g
                  = 12.5 kg). Scan adds item with quantity automatically.
                </p>
              </div>
              <Switch
                id="barcode_scan_enabled"
                checked={settings.barcode_scan_enabled}
                onCheckedChange={(checked) => update('barcode_scan_enabled', checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="barcode_prefix">Prefix character</Label>
                <Input
                  id="barcode_prefix"
                  value={settings.barcode_prefix}
                  maxLength={4}
                  className="font-mono"
                  onChange={(e) => update('barcode_prefix', e.target.value || 'w')}
                  placeholder="w"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode_plu_digits">PLU digits</Label>
                <Input
                  id="barcode_plu_digits"
                  type="number"
                  min={3}
                  max={5}
                  value={settings.barcode_plu_digits}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10) || 5
                    update('barcode_plu_digits', Math.min(5, Math.max(3, n)))
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode_payload_digits">Weight digits</Label>
                <Input
                  id="barcode_payload_digits"
                  type="number"
                  min={3}
                  max={8}
                  value={settings.barcode_payload_digits}
                  onChange={(e) =>
                    update('barcode_payload_digits', parseInt(e.target.value, 10) || 5)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Example barcode</Label>
                <p className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
                  {`${(settings.barcode_prefix || 'w').trim() || 'w'}${'1'.padStart(settings.barcode_plu_digits, '0')}${'1250'.padStart(settings.barcode_payload_digits, '0').slice(-settings.barcode_payload_digits)}`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Embedded value in barcode</Label>
              <Select
                value={settings.barcode_payload_type}
                onValueChange={(value) =>
                  update('barcode_payload_type', value as WeighingScaleSettings['barcode_payload_type'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight_grams">Weight in grams (e.g. 01250 = 1.250 kg)</SelectItem>
                  <SelectItem value="weight_kg_thousandths">Weight × 1000 in field</SelectItem>
                  <SelectItem value="price_paise">Selling price in paise (qty from price ÷ rate)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <details className="rounded-md border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-800">
                Legacy EAN prefix range (optional)
              </summary>
              <p className="mt-2 text-xs text-muted-foreground mb-3">
                Also accept numeric EAN-style labels (prefix 20–29) if your machine prints those instead of a
                letter prefix.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode_prefix_start">EAN prefix from</Label>
                  <Input
                    id="barcode_prefix_start"
                    type="number"
                    min={0}
                    max={99}
                    value={settings.barcode_prefix_start}
                    onChange={(e) =>
                      update('barcode_prefix_start', parseInt(e.target.value, 10) || 20)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode_prefix_end">EAN prefix to</Label>
                  <Input
                    id="barcode_prefix_end"
                    type="number"
                    min={0}
                    max={99}
                    value={settings.barcode_prefix_end}
                    onChange={(e) =>
                      update('barcode_prefix_end', parseInt(e.target.value, 10) || 29)
                    }
                  />
                </div>
              </div>
            </details>

            <p className="text-xs text-muted-foreground">
              Scale PLU is matched to the product PLU when set, otherwise to barcode (item code).
              Export the catalog, import it on the weighing machine, then scan printed labels on POS
              or sales invoices.
            </p>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">CSV catalog for scale import</p>
                <p className="text-xs text-muted-foreground">
                  Generate a product file to import on the weighing machine (not uploaded from the scale).
                  Default columns: item_code, plu, name, price (sale price).
                </p>
              </div>
              <Switch
                id="csv_import_enabled"
                checked={settings.csv_import_enabled}
                onCheckedChange={(checked) => update('csv_import_enabled', checked)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Match scale PLU to product by</Label>
                <Select
                  value={settings.csv_item_match_field}
                  onValueChange={(value) =>
                    update('csv_item_match_field', value as WeighingScaleSettings['csv_item_match_field'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plu">PLU</SelectItem>
                    <SelectItem value="item_code">Barcode (item code)</SelectItem>
                    <SelectItem value="auto">Auto (PLU, barcode, then slug/SKU)</SelectItem>
                    <SelectItem value="sku">Slug (SKU) only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CSV delimiter</Label>
                <Select
                  value={settings.csv_delimiter}
                  onValueChange={(value) =>
                    update('csv_delimiter', value as WeighingScaleSettings['csv_delimiter'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="tab">Tab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv_item_code_column">Item code column header</Label>
                <Input
                  id="csv_item_code_column"
                  value={settings.csv_item_code_column}
                  onChange={(e) => update('csv_item_code_column', e.target.value)}
                  placeholder="Default: item_code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv_plu_column">PLU column header</Label>
                <Input
                  id="csv_plu_column"
                  value={settings.csv_plu_column}
                  onChange={(e) => update('csv_plu_column', e.target.value)}
                  placeholder="Default: plu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv_name_column">Name column header</Label>
                <Input
                  id="csv_name_column"
                  value={settings.csv_name_column}
                  onChange={(e) => update('csv_name_column', e.target.value)}
                  placeholder="Default: name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv_price_column">Sale price column header</Label>
                <Input
                  id="csv_price_column"
                  value={settings.csv_price_column}
                  onChange={(e) => update('csv_price_column', e.target.value)}
                  placeholder="Default: price"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <Label>Additional product fields</Label>
              <p className="text-xs text-muted-foreground">
                Optional columns appended after item_code, plu, name, and price.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SCALE_CSV_EXTRA_FIELD_OPTIONS.map(({ key, label }) => {
                  const checked = settings.csv_extra_fields.includes(key)
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-800"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const next = value
                            ? [...settings.csv_extra_fields, key]
                            : settings.csv_extra_fields.filter((f) => f !== key)
                          update('csv_extra_fields', next)
                        }}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="csv_has_header">Include header row</Label>
              <Switch
                id="csv_has_header"
                checked={settings.csv_has_header}
                onCheckedChange={(checked) => update('csv_has_header', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="csv_export_weight_items_only">Only KG / GM products</Label>
              <Switch
                id="csv_export_weight_items_only"
                checked={settings.csv_export_weight_items_only}
                onCheckedChange={(checked) => update('csv_export_weight_items_only', checked)}
              />
            </div>

            <WeighingScaleCatalogExport settings={settings} onUpdate={update} />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-gray-800">Setup tips</p>
            <p>1. Set product unit to KG or GM for weight-priced items.</p>
            <p>2. On POS or invoice, click Connect and select your scale when prompted.</p>
            <p>3. For scales that print weight into any field, use Keyboard wedge mode.</p>
            <p>4. Download the product catalog CSV here and import it on the weighing machine.</p>
            <p>5. Enable scale barcode below (no live scale needed), then scan labels (e.g. w0000112500) on POS or sales invoice.</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Weighing Scale Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
