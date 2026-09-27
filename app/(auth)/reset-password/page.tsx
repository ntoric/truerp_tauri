'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/forgot-password')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  )
}
