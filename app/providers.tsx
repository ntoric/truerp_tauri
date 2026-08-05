'use client'

import { type ReactNode, useEffect } from 'react'
import { AuthProvider } from '@/hooks/useAuth'
import { StoreProvider } from '@/hooks/useStore'
import { PageFeaturesProvider } from '@/hooks/usePageFeatures'
import { Toaster } from '@/components/ui/toaster'

/** Enable keyboard focus outlines only after Tab; pointer clicks stay ring-free. */
function useKeyboardNavFocus() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        document.body.setAttribute('data-keyboard-nav', 'true')
      }
    }
    const onPointer = () => {
      document.body.removeAttribute('data-keyboard-nav')
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [])
}

/** Single client boundary for root providers (avoids Next.js layout chunk SyntaxError in dev). */
export function Providers({ children }: { children: ReactNode }) {
  useKeyboardNavFocus()

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
