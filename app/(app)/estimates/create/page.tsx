'use client'

import { Suspense } from 'react'
import SaleForm from '@/components/SaleForm'

export default function CreateEstimatePage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <SaleForm mode="estimate" />
    </Suspense>
  )
}
