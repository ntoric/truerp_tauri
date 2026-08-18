'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getAuthToken } from '@/lib/authToken'

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
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )
}
