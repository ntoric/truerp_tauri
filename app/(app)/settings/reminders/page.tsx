'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import BrandLoader from '@/components/BrandLoader'

/** Route key for page-features gating; redirects to Settings when enabled. */
export default function SettingsRemindersPage() {
  const router = useRouter()
  const { isPageEnabled, loading } = usePageFeatures()

  useEffect(() => {
    if (loading) return
    if (isPageEnabled('/settings/reminders')) {
      router.replace('/settings?tab=reminders')
    }
  }, [loading, isPageEnabled, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <BrandLoader />
    </div>
  )
}
