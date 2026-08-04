'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

export default function InvoicePDFPage() {
  const params = useParams()
  const id = params.id as string
  const [pdfUrl, setPdfUrl] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Loading invoice…')
  const [downloading, setDownloading] = useState(false)

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
        setStatus('')
      } catch {
        if (!cancelled) {
          setError('Failed to load invoice PDF')
          setStatus('')
        }
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  const handleDownload = async () => {
    if (!pdfUrl || downloading) return
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = pdfUrl
      a.download = `Invoice_${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setDownloading(false)
    }
  }

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
      <div className="absolute right-4 top-4 z-10">
        <Button variant="outline" size="sm" onClick={() => void handleDownload()} disabled={downloading}>
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
      </div>
      <iframe title="Invoice PDF" src={pdfUrl} className="h-full w-full border-0" />
    </div>
  )
}
