'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import { printPurchaseBill } from '@/lib/printDocument'

export default function PurchaseBillPDFPage() {
  const params = useParams()
  const id = params.id as string
  const [status, setStatus] = useState('Preparing purchase invoice…')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    ;(async () => {
      try {
        setStatus('Sending to printer…')
        await printPurchaseBill(id)
        if (!cancelled) setStatus('Print job sent. You can close this tab.')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to print purchase invoice')
          setStatus('')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <p className="text-sm text-gray-600">{status}</p>
    </div>
  )
}
