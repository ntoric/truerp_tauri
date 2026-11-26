'use client'

import { Suspense } from 'react'
import SaleForm from '@/components/SaleForm'
import BrandLoader from '@/components/BrandLoader'

export default function CreateInvoicePage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><BrandLoader /></div>}>
      <SaleForm mode="invoice" />
    </Suspense>
  )
}
