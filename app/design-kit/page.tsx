'use client'

import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import DesignKitPage from '@/components/design-kit/DesignKitPage'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useThemeMode } from '@/hooks/useThemeMode'
import { Moon, Sun } from 'lucide-react'

/**
 * Public brand & design kit — no authentication required.
 * The same content lives inside the app at /developer-settings/design-kit.
 */
export default function PublicDesignKitPage() {
  const { resolvedMode, setMode } = useThemeMode()

  return (
    <div className="min-h-screen bg-[#f6f7fb] dark:bg-background">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-border/70 dark:bg-background/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo
              iconClassName="h-8 w-8"
              wordmarkClassName="text-xl dark:text-white"
            />
            <StatusBadge tone="brand">Design Kit</StatusBadge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle dark mode"
              onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
            >
              {resolvedMode === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button asChild>
              <Link href="/">Open app</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <DesignKitPage />
      </main>
    </div>
  )
}
