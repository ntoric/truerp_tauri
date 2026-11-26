'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import AppearanceSettings from '@/components/appearance/AppearanceSettings'

export default function AppearancePage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader title="Appearance" backHref="/settings" />
        <AppearanceSettings />
      </div>
    </DashboardLayout>
  )
}
