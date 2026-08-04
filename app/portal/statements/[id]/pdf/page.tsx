'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { portalFetch } from '@/lib/portalApi'

export default function PortalStatementPDFPage() {
  const params = useParams()
  const id = params.id as string
  const [htmlContent, setHtmlContent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    portalFetch(`/statements/${id}/pdf`)
      .then(async (res) => {
        if (res.ok) setHtmlContent(await res.text())
        else setError('Failed to load statement')
      })
      .catch(() => setError('Failed to load statement'))
  }, [id])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
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
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
}
