'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BrandLoader from '@/components/BrandLoader'

/** Moved to Settings → Customer Messaging. */
export default function TelegramSettingsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/settings/messaging?tab=telegram')
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <BrandLoader />
    </div>
  )
}
