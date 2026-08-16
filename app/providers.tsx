'use client'

import { type ReactNode, useEffect } from 'react'
import { AuthProvider } from '@/hooks/useAuth'
import { ColorThemeProvider } from '@/hooks/useColorTheme'
import { StoreProvider } from '@/hooks/useStore'
import { PageFeaturesProvider } from '@/hooks/usePageFeatures'
import { OfflineSyncProvider } from '@/hooks/useOfflineSync'
import { Toaster } from '@/components/ui/toaster'
import ExportProgressOverlay from '@/components/ExportProgressOverlay'

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
    window.addEventListener('mousedown', onPointer, true)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('touchstart', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointer, true)
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('touchstart', onPointer, true)
    }
  }, [])
}

/** Single client boundary for root providers (avoids Next.js layout chunk SyntaxError in dev). */
export function Providers({ children }: { children: ReactNode }) {
  useKeyboardNavFocus()

  return (
    <AuthProvider>
      <ColorThemeProvider>
        <StoreProvider>
          <PageFeaturesProvider>
            <OfflineSyncProvider>
              {children}
              <Toaster />
              <ExportProgressOverlay />
            </OfflineSyncProvider>
          </PageFeaturesProvider>
        </StoreProvider>
      </ColorThemeProvider>
    </AuthProvider>
  )
}
