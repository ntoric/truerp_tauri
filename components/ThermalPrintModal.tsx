'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { printDocument } from '@/lib/printDocument'
import {
  THERMAL_PRINT_SIZE_OPTIONS,
  normalizeThermalPrintSize,
  thermalPreviewWidthPx,
  type ThermalPrintSize,
} from '@/lib/printSizes'
import { stripThermalMarkers } from '@/lib/thermalEscPos'
import { Printer, X, Eye, Loader2 } from 'lucide-react'

interface ThermalPrintModalProps {
  isOpen: boolean
  onClose: () => void
  documentType: 'invoice' | 'expense'
  documentId: string
  documentNumber: string
}

export default function ThermalPrintModal({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentNumber
}: ThermalPrintModalProps) {
  const [printSize, setPrintSize] = useState<ThermalPrintSize>('2inch')
  const [printContent, setPrintContent] = useState<string>('')
  const [printWidth, setPrintWidth] = useState<number>(58)
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    const loadDefaultSize = async () => {
      try {
        const res = await apiFetch('/settings/print')
        if (res.ok) {
          const data = await res.json()
          setPrintSize(normalizeThermalPrintSize(data.thermal_print_size))
        }
      } catch {
        /* keep default */
      }
    }
    void loadDefaultSize()
  }, [isOpen])

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/printer/thermal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentType,
          document_id: documentId,
          print_size: printSize
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPrintContent(data.content)
        setPrintWidth(data.width)
        setLogoUrl(
          typeof data.logo_base64 === 'string' && data.logo_base64
            ? data.logo_base64
            : typeof data.logo_url === 'string'
              ? data.logo_url
              : ''
        )
        setPreviewMode(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to generate thermal print')
      }
    } catch (err) {
      console.error('Failed to generate thermal print:', err)
      setError('Failed to generate thermal print')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    setPrinting(true)
    setError('')
    try {
      await printDocument({
        documentType,
        documentId,
        mode: 'thermal',
        printSize,
      })
    } catch (err) {
      console.error('Thermal print failed:', err)
      setError(err instanceof Error ? err.message : 'Print failed')
    } finally {
      setPrinting(false)
    }
  }

  if (!isOpen) return null

  const previewWidth = thermalPreviewWidthPx(printSize)
  const fontSize =
    printSize === '1inch' ? 9 : printSize === '1.5inch' ? 10 : printSize === '3inch' ? 12 : 11

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Thermal Printer
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          ) : null}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Print Size</label>
              <Select
                value={printSize}
                onValueChange={(value) => setPrintSize(normalizeThermalPrintSize(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THERMAL_PRINT_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="mt-6">
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </div>

          {previewMode && printContent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Preview ({printWidth}mm)</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Hide Preview
                  </Button>
                  <Button size="sm" onClick={() => void handlePrint()} disabled={printing}>
                    {printing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-2" />
                    )}
                    Print
                  </Button>
                </div>
              </div>
              <div
                className="bg-white border-2 border-gray-300 p-4 mx-auto overflow-auto text-black"
                style={{
                  width: previewWidth,
                  fontFamily: 'Courier New, monospace',
                  fontSize,
                  lineHeight: '1.2'
                }}
              >
                {logoUrl ? (
                  <div className="mb-2 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt=""
                      className="max-h-[48px] max-w-[70%] object-contain"
                    />
                  </div>
                ) : null}
                {printContent.split('\n').map((raw, idx) => {
                  let center = false
                  let bold = false
                  let rest = raw
                  while (true) {
                    if (rest.startsWith('@C@')) {
                      center = true
                      rest = rest.slice(3)
                      continue
                    }
                    if (rest.startsWith('@B@')) {
                      bold = true
                      rest = rest.slice(3)
                      continue
                    }
                    if (rest.startsWith('@N@')) {
                      center = false
                      bold = false
                      rest = rest.slice(3)
                      continue
                    }
                    break
                  }
                  return (
                    <div
                      key={`${idx}-${rest.slice(0, 12)}`}
                      style={{
                        textAlign: center ? 'center' : 'left',
                        fontWeight: bold ? 700 : 400,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {stripThermalMarkers(rest) || '\u00a0'}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Document: {documentNumber}. On desktop, print goes to the thermal printer configured in
                Settings when available.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
