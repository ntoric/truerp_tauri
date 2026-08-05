'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePageFeatures } from '@/hooks/usePageFeatures'

/** Route key for page-features gating; redirects to Settings when enabled. */
export default function SettingsCaSharePage() {
  const router = useRouter()
  const { isPageEnabled, loading } = usePageFeatures()

  useEffect(() => {
    if (loading) return
    if (isPageEnabled('/settings/ca-share')) {
      router.replace('/settings?tab=ca')
    }
  }, [loading, isPageEnabled, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )
}
