'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import BrandLoader from '@/components/BrandLoader'

export default function ResetPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/forgot-password')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <BrandLoader />
    </div>
  )
}
