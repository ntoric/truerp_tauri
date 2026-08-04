'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import InvoiceTemplateSettingsEditor from '@/components/InvoiceTemplateSettingsEditor'

export default function InvoiceTemplateSettingsPage() {
  return (
    <DashboardLayout>
      <div className="-m-4 flex min-h-[calc(100vh-4rem)] flex-col lg:-m-6">
        <InvoiceTemplateSettingsEditor backHref="/settings?tab=invoice" />
      </div>
    </DashboardLayout>
  )
}
