'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getAuthToken } from '@/lib/authToken'
import BrandLoader from '@/components/BrandLoader'

export default function Home() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user || getAuthToken()) {
        window.location.href = '/dashboard'
      } else {
        window.location.href = '/login'
      }
    }
  }, [user, loading])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <BrandLoader />
    </div>
  )
}
