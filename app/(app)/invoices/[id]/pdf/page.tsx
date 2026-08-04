'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import { fetchPrintSettings, printPdfBase64 } from '@/lib/printDocument'

export default function InvoicePDFPage() {
  const params = useParams()
  const id = params.id as string
  const [pdfUrl, setPdfUrl] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Loading invoice…')

  useEffect(() => {
    if (!id) return
    let objectUrl = ''
    let cancelled = false

    ;(async () => {
      try {
        const res = await apiFetch(`/invoices/${id}/pdf`)
        if (!res.ok) throw new Error('Failed to load invoice PDF')
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)

        setStatus('Sending to printer…')
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(reader.error || new Error('Failed to read PDF'))
          reader.readAsDataURL(blob)
        })
        const comma = dataUrl.indexOf(',')
        const pdfBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
        const settings = await fetchPrintSettings()
        if (cancelled) return
        await printPdfBase64(pdfBase64, {
          title: 'Sales Invoice',
          printerName: settings.document_printer_name || '',
          paperSize: settings.paper_size || 'a4',
        })
        if (!cancelled) setStatus('Print job sent')
      } catch {
        if (!cancelled) {
          setError('Failed to load or print invoice')
          setStatus('')
        }
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }
  if (!pdfUrl) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-600">{status}</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <iframe title="Invoice PDF" src={pdfUrl} className="h-full w-full border-0" />
      {status ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
          {status}
        </div>
      ) : null}
    </div>
  )
}
