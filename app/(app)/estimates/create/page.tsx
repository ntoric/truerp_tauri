'use client'

import { Suspense } from 'react'
import SaleForm from '@/components/SaleForm'
import BrandLoader from '@/components/BrandLoader'

export default function CreateEstimatePage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><BrandLoader /></div>}>
      <SaleForm mode="estimate" />
    </Suspense>
  )
}
