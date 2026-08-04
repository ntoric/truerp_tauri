'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'

export default function InvoicePDFPage() {
  const params = useParams()
  const id = params.id as string
  const [pdfUrl, setPdfUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let objectUrl = ''
    let cancelled = false

    apiFetch(`/invoices/${id}/pdf`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load invoice PDF')
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load invoice')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  useEffect(() => {
    if (!pdfUrl) return
    // Auto-print once the PDF page is ready.
    const timer = setTimeout(() => {
      try {
        window.print()
      } catch {
        /* ignore */
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [pdfUrl])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }
  if (!pdfUrl) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <iframe
      title="Invoice PDF"
      src={pdfUrl}
      className="h-screen w-screen border-0"
    />
  )
}
