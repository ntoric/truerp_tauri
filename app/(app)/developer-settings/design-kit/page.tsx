'use client'

import Link from 'next/link'
import DesignKitPage from '@/components/design-kit/DesignKitPage'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Globe } from 'lucide-react'

export default function DesignKitSettingsPage() {
  return (
    <div className="space-y-3">
      <div className="app-page-subheader">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label="Back to Developer Settings">
            <Link href="/developer-settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="app-page-title">Design Kit</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/design-kit" target="_blank">
            <Globe className="mr-2 h-4 w-4" />
            Open public page
          </Link>
        </Button>
      </div>
      <DesignKitPage />
    </div>
  )
}
