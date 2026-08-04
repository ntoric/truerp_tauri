'use client'

import { type ReactNode } from 'react'
import { AuthProvider } from '@/hooks/useAuth'
import { StoreProvider } from '@/hooks/useStore'
import { PageFeaturesProvider } from '@/hooks/usePageFeatures'
import { Toaster } from '@/components/ui/toaster'

/** Single client boundary for root providers (avoids Next.js layout chunk SyntaxError in dev). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        <PageFeaturesProvider>
          {children}
          <Toaster />
        </PageFeaturesProvider>
      </StoreProvider>
    </AuthProvider>
  )
}
