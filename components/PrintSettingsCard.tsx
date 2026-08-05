'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ThermalInvoicePreviewSample, {
  type ThermalPreviewBusiness,
} from '@/components/ThermalInvoicePreviewSample'
import { hasNativePrinting, listDesktopPrinters, type DesktopPrinterInfo } from '@/lib/desktopBridge'
import {
  BARCODE_LABEL_SIZE_OPTIONS,
  THERMAL_PRINT_SIZE_OPTIONS,
  normalizeThermalPrintSize,
  thermalWidthMM,
  type BarcodeLabelSize,
  type ThermalPrintSize,
} from '@/lib/printSizes'
import {
  A4_LABEL_SHEET_PRESETS,
  layoutFromPresetKey,
  labelsPerSheet,
  normalizeA4SheetPreset,
  type A4LabelSheetPresetKey,
} from '@/lib/a4LabelSheets'
import { Check, Loader2, Printer, RefreshCw, Save } from 'lucide-react'

export type { BarcodeLabelSize, ThermalPrintSize }
export { BARCODE_LABEL_SIZE_OPTIONS }

export interface PrintSettings {
  invoice_print_mode: 'a4' | 'thermal'
  paper_size: string
  orientation: string
  margin_top: number
  margin_bottom: number
  margin_left: number
  margin_right: number
  font_size: number
  print_header: boolean
  print_footer: boolean
  thermal_print_size: ThermalPrintSize
  barcode_print_mode: 'label' | 'a4'
  barcode_label_size: BarcodeLabelSize
  thermal_printer_name: string
  document_printer_name: string
  auto_print_on_pos: boolean
  /** A4 barcode sheet layout (persisted on business) */
  label_paper_size: string
  label_sheet_preset: A4LabelSheetPresetKey
  label_width_mm: number
  label_height_mm: number
  label_columns: number
  label_rows: number
  label_margin_mm: number
  label_margin_top_mm: number
  label_margin_left_mm: number
  label_gap_h_mm: number
  label_gap_v_mm: number
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  invoice_print_mode: 'a4',
  paper_size: 'a4',
  orientation: 'portrait',
  margin_top: 0.5,
  margin_bottom: 0.5,
  margin_left: 0.5,
  margin_right: 0.5,
  font_size: 12,
  print_header: true,
  print_footer: true,
  thermal_print_size: '2inch',
  barcode_print_mode: 'a4',
  barcode_label_size: '2inch',
  thermal_printer_name: '',
  document_printer_name: '',
  auto_print_on_pos: true,
  label_paper_size: 'A4',
  label_sheet_preset: '48.5x25.4',
  label_width_mm: 48.5,
  label_height_mm: 25.4,
  label_columns: 4,
  label_rows: 11,
  label_margin_mm: 5,
  label_margin_top_mm: 8.8,
  label_margin_left_mm: 5,
  label_gap_h_mm: 2,
  label_gap_v_mm: 0,
}

function normalizeBarcodeLabelSize(value: unknown): BarcodeLabelSize {
  return normalizeThermalPrintSize(value)
}

function mergePrintSettings(raw: Partial<PrintSettings>): PrintSettings {
  return {
    ...DEFAULT_PRINT_SETTINGS,
    ...raw,
    invoice_print_mode:
      raw.invoice_print_mode === 'thermal' ? 'thermal' : DEFAULT_PRINT_SETTINGS.invoice_print_mode,
    thermal_print_size: normalizeThermalPrintSize(raw.thermal_print_size),
    barcode_print_mode:
      raw.barcode_print_mode === 'label' ? 'label' : DEFAULT_PRINT_SETTINGS.barcode_print_mode,
    barcode_label_size: normalizeBarcodeLabelSize(raw.barcode_label_size),
    thermal_printer_name: raw.thermal_printer_name || '',
    document_printer_name: raw.document_printer_name || '',
    auto_print_on_pos: raw.auto_print_on_pos !== false,
    label_paper_size: raw.label_paper_size || DEFAULT_PRINT_SETTINGS.label_paper_size,
    label_sheet_preset: normalizeA4SheetPreset(raw.label_sheet_preset),
    label_width_mm: Number(raw.label_width_mm) > 0 ? Number(raw.label_width_mm) : DEFAULT_PRINT_SETTINGS.label_width_mm,
    label_height_mm: Number(raw.label_height_mm) > 0 ? Number(raw.label_height_mm) : DEFAULT_PRINT_SETTINGS.label_height_mm,
    label_columns: Number(raw.label_columns) > 0 ? Number(raw.label_columns) : DEFAULT_PRINT_SETTINGS.label_columns,
    label_rows: Number(raw.label_rows) > 0 ? Number(raw.label_rows) : DEFAULT_PRINT_SETTINGS.label_rows,
    label_margin_mm:
      raw.label_margin_mm !== undefined && raw.label_margin_mm !== null && !Number.isNaN(Number(raw.label_margin_mm))
        ? Number(raw.label_margin_mm)
        : DEFAULT_PRINT_SETTINGS.label_margin_mm,
    label_margin_top_mm:
      raw.label_margin_top_mm !== undefined && !Number.isNaN(Number(raw.label_margin_top_mm))
        ? Number(raw.label_margin_top_mm)
        : DEFAULT_PRINT_SETTINGS.label_margin_top_mm,
    label_margin_left_mm:
      raw.label_margin_left_mm !== undefined && !Number.isNaN(Number(raw.label_margin_left_mm))
        ? Number(raw.label_margin_left_mm)
        : DEFAULT_PRINT_SETTINGS.label_margin_left_mm,
    label_gap_h_mm:
      raw.label_gap_h_mm !== undefined && !Number.isNaN(Number(raw.label_gap_h_mm))
        ? Number(raw.label_gap_h_mm)
        : DEFAULT_PRINT_SETTINGS.label_gap_h_mm,
    label_gap_v_mm:
      raw.label_gap_v_mm !== undefined && !Number.isNaN(Number(raw.label_gap_v_mm))
        ? Number(raw.label_gap_v_mm)
        : DEFAULT_PRINT_SETTINGS.label_gap_v_mm,
  }
}

function applyA4PresetToSettings(
  preset: A4LabelSheetPresetKey,
  prev: PrintSettings
): PrintSettings {
  if (preset === 'custom') {
    return { ...prev, label_sheet_preset: 'custom' }
  }
  const layout = layoutFromPresetKey(preset)
  return {
    ...prev,
    label_sheet_preset: preset,
    label_paper_size: layout.paperSize,
    label_width_mm: layout.labelWidthMm,
    label_height_mm: layout.labelHeightMm,
    label_columns: layout.columns,
    label_rows: layout.rows,
    label_margin_mm: layout.marginLeftMm,
    label_margin_top_mm: layout.marginTopMm,
    label_margin_left_mm: layout.marginLeftMm,
    label_gap_h_mm: layout.gapHMm,
    label_gap_v_mm: layout.gapVMm,
  }
}

function ThemeOption({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string
  description?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full flex-col items-start rounded-lg border-2 px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-blue-600 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {selected ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </button>
  )
}

export default function PrintSettingsCard() {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS)
  const [businessPreview, setBusinessPreview] = useState<ThermalPreviewBusiness>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [barcodePreviewHtml, setBarcodePreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [printTab, setPrintTab] = useState<'mode' | 'thermal' | 'document' | 'barcode'>('mode')
  const [nativePrinting, setNativePrinting] = useState(false)
  const [printers, setPrinters] = useState<DesktopPrinterInfo[]>([])
  const [printersLoading, setPrintersLoading] = useState(false)

  const update = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const refreshPrinters = useCallback(async () => {
    setPrintersLoading(true)
    try {
      const available = await hasNativePrinting()
      setNativePrinting(available)
      if (available) {
        setPrinters(await listDesktopPrinters())
      }
    } catch {
      setNativePrinting(false)
      setPrinters([])
    } finally {
      setPrintersLoading(false)
    }
  }, [])

  const loadBarcodePreview = useCallback(
    async (mode: PrintSettings['barcode_print_mode'], size: BarcodeLabelSize) => {
      try {
        const res = await apiFetch(
          `/printer/barcode/preview?mode=${encodeURIComponent(mode)}&size=${encodeURIComponent(size)}`
        )
        if (res.ok) {
          const data = await res.json()
          setBarcodePreviewHtml(data.html || '')
        }
      } catch {
        setBarcodePreviewHtml('')
      }
    },
    []
  )

  useEffect(() => {
    const load = async () => {
      try {
        const [printRes, businessRes] = await Promise.all([
          apiFetch('/settings/print'),
          apiFetch('/business'),
        ])
        if (businessRes.ok) {
          const biz = await businessRes.json()
          setBusinessPreview({
            name: biz.name,
            address: biz.address,
            city: biz.city,
            state: biz.state,
            pincode: biz.pincode,
            phone: biz.phone,
            logo_url: biz.logo_url,
          })
        }
        if (printRes.ok) {
          const merged = mergePrintSettings(await printRes.json())
          setSettings(merged)
          setPreviewLoading(true)
          await loadBarcodePreview(merged.barcode_print_mode, merged.barcode_label_size)
          setPreviewLoading(false)
        }
        await refreshPrinters()
      } catch {
        /* defaults */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [loadBarcodePreview, refreshPrinters])

  useEffect(() => {
    if (loading) return
    void loadBarcodePreview(settings.barcode_print_mode, settings.barcode_label_size)
  }, [loading, loadBarcodePreview, settings.barcode_print_mode, settings.barcode_label_size])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/settings/print', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        const merged = mergePrintSettings(await res.json())
        setSettings(merged)
        setMessage('Print settings saved successfully')
        setPreviewLoading(true)
        await loadBarcodePreview(merged.barcode_print_mode, merged.barcode_label_size)
        setPreviewLoading(false)
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(data.error || 'Failed to update print settings')
      }
    } catch {
      setMessage('Failed to update print settings')
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

  const thermalWidthLabel = `${thermalWidthMM(settings.thermal_print_size)}mm (${
    THERMAL_PRINT_SIZE_OPTIONS.find((o) => o.value === settings.thermal_print_size)?.label ??
    settings.thermal_print_size
  })`
  const printerOptions = [
    { value: '__default__', label: 'System default printer' },
    ...printers.map((p) => ({
      value: p.name,
      label: p.is_default ? `${p.name} (default)` : p.name,
    })),
  ]

  const printerSelectValue = (name: string) => (name ? name : '__default__')
  const onPrinterChange = (key: 'thermal_printer_name', value: string) => {
    update(key, value === '__default__' ? '' : value)
  }

  const invoicePaperSelectValue =
    settings.invoice_print_mode === 'thermal' ? settings.thermal_print_size : settings.paper_size

  const onInvoicePaperSizeChange = (value: string) => {
    if (
      value === '1inch' ||
      value === '1.5inch' ||
      value === '2inch' ||
      value === '3inch'
    ) {
      setSettings((prev) => ({
        ...prev,
        invoice_print_mode: 'thermal',
        thermal_print_size: value as ThermalPrintSize,
      }))
      return
    }
    setSettings((prev) => ({
      ...prev,
      invoice_print_mode: 'a4',
      paper_size: value,
    }))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Printer className="h-5 w-5 text-blue-600" />
        <CardTitle>Print Settings</CardTitle>
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
          <Tabs value={printTab} onValueChange={(v) => setPrintTab(v as typeof printTab)}>
            <TabsList className="mb-4 h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="mode"
                className="rounded-none border-b-2 border-transparent px-1 pb-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Invoice Printer
              </TabsTrigger>
              <TabsTrigger
                value="thermal"
                className="rounded-none border-b-2 border-transparent px-1 pb-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Thermal
              </TabsTrigger>
              <TabsTrigger
                value="document"
                className="rounded-none border-b-2 border-transparent px-1 pb-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                A4 / PDF
              </TabsTrigger>
              <TabsTrigger
                value="barcode"
                className="rounded-none border-b-2 border-transparent px-1 pb-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Barcode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mode" className="mt-0 space-y-6">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-900">
                  Default printer type for invoices &amp; POS
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ThemeOption
                    label="A4 / PDF"
                    description="Download full tax invoice as PDF (A4, Letter, or Legal)"
                    selected={settings.invoice_print_mode === 'a4'}
                    onSelect={() => update('invoice_print_mode', 'a4')}
                  />
                  <ThemeOption
                    label="Thermal printer"
                    description="Compact receipt for 25–80mm thermal printers (1″ / 1.5″ / 2″ / 3″)"
                    selected={settings.invoice_print_mode === 'thermal'}
                    onSelect={() => update('invoice_print_mode', 'thermal')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_paper_size">Paper Size</Label>
                <Select value={invoicePaperSelectValue} onValueChange={onInvoicePaperSizeChange}>
                  <SelectTrigger id="invoice_paper_size">
                    <SelectValue placeholder="Select paper size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="letter">Letter (216 × 279 mm)</SelectItem>
                    <SelectItem value="legal">Legal (216 × 356 mm)</SelectItem>
                    {THERMAL_PRINT_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        Thermal · {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {settings.invoice_print_mode === 'thermal'
                    ? `POS & invoice bills print on ${thermalWidthLabel} thermal paper.`
                    : 'POS & invoice actions download a full tax invoice PDF in the selected sheet size.'}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <Label htmlFor="auto_print_on_pos">Auto-print after POS sale</Label>
                  <p className="text-xs text-muted-foreground">
                    Thermal prints the receipt; A4 / PDF downloads the invoice PDF
                  </p>
                </div>
                <Switch
                  id="auto_print_on_pos"
                  checked={settings.auto_print_on_pos}
                  onCheckedChange={(checked) => update('auto_print_on_pos', checked)}
                />
              </div>

              {nativePrinting ? (
                <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Desktop printers</p>
                      <p className="text-xs text-muted-foreground">
                        Optional: send jobs directly to a named OS printer (silent when possible)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={printersLoading}
                      onClick={() => void refreshPrinters()}
                    >
                      {printersLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Thermal printer</Label>
                    <Select
                      value={printerSelectValue(settings.thermal_printer_name)}
                      onValueChange={(v) => onPrinterChange('thermal_printer_name', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="System default" />
                      </SelectTrigger>
                      <SelectContent>
                        {printerOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {printers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No printers detected. Install a printer in system settings, then refresh.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Thermal jobs print silently via ESC/POS (no Windows print dialog). Set Thermal
                      printer for instant Checkout &amp; Print. A4 invoices are downloaded as PDF
                      only.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                  Running in browser: thermal print uses the system print dialog. In the TruERP
                  desktop app you can pick a specific thermal printer here. A4 invoices are
                  downloaded as PDF only.
                </div>
              )}
            </TabsContent>

            <TabsContent value="thermal" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
                <div className="space-y-6 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="mb-3 text-sm font-semibold text-gray-900">Thermal paper width</p>
                    <div className="space-y-2">
                      {THERMAL_PRINT_SIZE_OPTIONS.map((option) => (
                        <ThemeOption
                          key={option.value}
                          label={option.label}
                          description={option.description}
                          selected={
                            settings.invoice_print_mode === 'thermal' &&
                            settings.thermal_print_size === option.value
                          }
                          onSelect={() =>
                            setSettings((prev) => ({
                              ...prev,
                              invoice_print_mode: 'thermal',
                              thermal_print_size: option.value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-900">Business Logo</p>
                    <div className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-center text-xs text-muted-foreground">
                      {businessPreview.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={businessPreview.logo_url}
                          alt="Business logo"
                          className="mx-auto mb-2 max-h-[70px] max-w-[210px] object-contain grayscale"
                        />
                      ) : (
                        <p className="py-4">Upload logo in Business settings</p>
                      )}
                      <p className="text-left leading-relaxed">
                        For best thermal results use a monochrome logo (max 210×70 px). Color logos are
                        shown in preview as grayscale.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Preview of the thermal receipt layout. Sample line items are for layout only.
                  </p>
                  <div className="flex justify-center overflow-auto rounded-lg border bg-gray-100 p-4 lg:justify-start">
                    <ThermalInvoicePreviewSample
                      printSize={settings.thermal_print_size}
                      business={businessPreview}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Receipt width: {thermalWidthLabel}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="document" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Paper size, margins, and header/footer apply when downloading invoices as PDF. For
                POS thermal bills, pick a thermal size under Invoice Printer or Thermal.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paper_size">Paper Size</Label>
                  <Select value={invoicePaperSelectValue} onValueChange={onInvoicePaperSizeChange}>
                    <SelectTrigger id="paper_size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="letter">Letter (216 × 279 mm)</SelectItem>
                      <SelectItem value="legal">Legal (216 × 356 mm)</SelectItem>
                      {THERMAL_PRINT_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          Thermal · {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {settings.invoice_print_mode === 'thermal' ? (
                    <p className="text-xs text-muted-foreground">
                      Thermal · {thermalWidthLabel} selected. Margins below apply only to A4 PDF
                      downloads.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orientation">Orientation</Label>
                  <Select
                    value={settings.orientation}
                    onValueChange={(value) => update('orientation', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font_size">Font Size</Label>
                  <Input
                    id="font_size"
                    type="number"
                    value={settings.font_size}
                    onChange={(e) => update('font_size', parseInt(e.target.value, 10) || 12)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="margin_top">Margin Top (inches)</Label>
                  <Input
                    id="margin_top"
                    type="number"
                    step="0.1"
                    value={settings.margin_top}
                    onChange={(e) => update('margin_top', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin_bottom">Margin Bottom (inches)</Label>
                  <Input
                    id="margin_bottom"
                    type="number"
                    step="0.1"
                    value={settings.margin_bottom}
                    onChange={(e) => update('margin_bottom', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin_left">Margin Left (inches)</Label>
                  <Input
                    id="margin_left"
                    type="number"
                    step="0.1"
                    value={settings.margin_left}
                    onChange={(e) => update('margin_left', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin_right">Margin Right (inches)</Label>
                  <Input
                    id="margin_right"
                    type="number"
                    step="0.1"
                    value={settings.margin_right}
                    onChange={(e) => update('margin_right', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="print_header">Print Header / Logo</Label>
                  <Switch
                    id="print_header"
                    checked={settings.print_header}
                    onCheckedChange={(checked) => update('print_header', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="print_footer">Print Footer</Label>
                  <Switch
                    id="print_footer"
                    checked={settings.print_footer}
                    onCheckedChange={(checked) => update('print_footer', checked)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="barcode" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-[minmax(240px,300px)_1fr]">
                <div className="space-y-6 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="mb-3 text-sm font-semibold text-gray-900">Barcode print mode</p>
                    <div className="space-y-2">
                      <ThemeOption
                        label="Thermal Label Print"
                        description="Single labels for barcode / thermal printers"
                        selected={settings.barcode_print_mode === 'label'}
                        onSelect={() => update('barcode_print_mode', 'label')}
                      />
                      <ThemeOption
                        label="A4 Sheet Print"
                        description="Multi-label grid on office paper"
                        selected={settings.barcode_print_mode === 'a4'}
                        onSelect={() => update('barcode_print_mode', 'a4')}
                      />
                    </div>
                  </div>

                  {settings.barcode_print_mode === 'label' ? (
                    <div>
                      <p className="mb-3 text-sm font-semibold text-gray-900">Thermal paper size</p>
                      <div className="space-y-2">
                        {BARCODE_LABEL_SIZE_OPTIONS.map((option) => (
                          <ThemeOption
                            key={option.value}
                            label={option.label}
                            description={option.description}
                            selected={settings.barcode_label_size === option.value}
                            onSelect={() => update('barcode_label_size', option.value)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-gray-900">A4 sheet layout</p>
                      <div className="space-y-2">
                        <Label htmlFor="label_sheet_preset">Sticker sheet preset</Label>
                        <Select
                          value={settings.label_sheet_preset}
                          onValueChange={(value) =>
                            setSettings((prev) => applyA4PresetToSettings(value as A4LabelSheetPresetKey, prev))
                          }
                        >
                          <SelectTrigger id="label_sheet_preset">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {A4_LABEL_SHEET_PRESETS.map((preset) => (
                              <SelectItem key={preset.key} value={preset.key}>
                                {preset.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom layout</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {A4_LABEL_SHEET_PRESETS.find((p) => p.key === settings.label_sheet_preset)?.description ??
                            `${labelsPerSheet(settings)} labels per sheet · adjust fields below`}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="label_paper_size">Paper Size</Label>
                        <Select
                          value={settings.label_paper_size}
                          onValueChange={(value) => update('label_paper_size', value)}
                        >
                          <SelectTrigger id="label_paper_size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A4">A4</SelectItem>
                            <SelectItem value="Letter">Letter</SelectItem>
                            <SelectItem value="Legal">Legal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="label_columns">Columns</Label>
                          <Input
                            id="label_columns"
                            type="number"
                            min={1}
                            max={6}
                            value={settings.label_columns}
                            onChange={(e) =>
                              update('label_columns', parseInt(e.target.value) || 4)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label_rows">Rows</Label>
                          <Input
                            id="label_rows"
                            type="number"
                            min={1}
                            max={20}
                            value={settings.label_rows}
                            onChange={(e) => update('label_rows', parseInt(e.target.value) || 11)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label_width_mm">Width (mm)</Label>
                          <Input
                            id="label_width_mm"
                            type="number"
                            min={10}
                            max={200}
                            step={0.1}
                            value={settings.label_width_mm}
                            onChange={(e) =>
                              update('label_width_mm', parseFloat(e.target.value) || 48.5)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label_height_mm">Height (mm)</Label>
                          <Input
                            id="label_height_mm"
                            type="number"
                            min={10}
                            max={200}
                            step={0.1}
                            value={settings.label_height_mm}
                            onChange={(e) =>
                              update('label_height_mm', parseFloat(e.target.value) || 25.4)
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="label_margin_left_mm">Side margin (mm)</Label>
                          <Input
                            id="label_margin_left_mm"
                            type="number"
                            min={0}
                            max={50}
                            step={0.1}
                            value={settings.label_margin_left_mm}
                            onChange={(e) =>
                              update('label_margin_left_mm', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label_margin_top_mm">Top/bottom margin (mm)</Label>
                          <Input
                            id="label_margin_top_mm"
                            type="number"
                            min={0}
                            max={50}
                            step={0.1}
                            value={settings.label_margin_top_mm}
                            onChange={(e) =>
                              update('label_margin_top_mm', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label_gap_h_mm">Horizontal gap (mm)</Label>
                          <Input
                            id="label_gap_h_mm"
                            type="number"
                            min={0}
                            max={20}
                            step={0.1}
                            value={settings.label_gap_h_mm}
                            onChange={(e) =>
                              update('label_gap_h_mm', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="label_gap_v_mm">Vertical gap (mm)</Label>
                          <Input
                            id="label_gap_v_mm"
                            type="number"
                            min={0}
                            max={20}
                            step={0.1}
                            value={settings.label_gap_v_mm}
                            onChange={(e) =>
                              update('label_gap_v_mm', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {labelsPerSheet(settings)} stickers per sheet · Save print settings to refresh preview.
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {settings.barcode_print_mode === 'label'
                        ? `Label preview · ${
                            BARCODE_LABEL_SIZE_OPTIONS.find(
                              (o) => o.value === settings.barcode_label_size
                            )?.label ?? settings.barcode_label_size
                          }`
                        : 'A4 sheet preview'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={previewLoading}
                      onClick={() => {
                        setPreviewLoading(true)
                        void loadBarcodePreview(
                          settings.barcode_print_mode,
                          settings.barcode_label_size
                        ).finally(() => setPreviewLoading(false))
                      }}
                    >
                      {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                  {barcodePreviewHtml ? (
                    <iframe
                      title="Barcode print preview"
                      srcDoc={barcodePreviewHtml}
                      className="h-[420px] w-full rounded border bg-white"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Preview unavailable</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Print Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
