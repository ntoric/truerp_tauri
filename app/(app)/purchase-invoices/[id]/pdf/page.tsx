'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'

export default function PurchaseBillPDFPage() {
  const params = useParams()
  const id = params.id as string
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!id) return

    const fetchPDF = async () => {
      try {
        const res = await apiFetch(`/purchase/bills/${id}/pdf`)
        if (res.ok) {
          const html = await res.text()
          setHtmlContent(html)
        } else {
          setError('Failed to load purchase invoice PDF')
        }
      } catch (err) {
        setError('An error occurred while loading the PDF')
        console.error(err)
      }
    }

    fetchPDF()
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

  if (!htmlContent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
