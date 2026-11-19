'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import BrandLoader from '@/components/BrandLoader'

// Old storefront links (/shop/<slug>?product=<id>) redirect to the
// shop URL (/<slug>/shop?product=<id>).
export default function LegacyShopSlugRedirect() {
  const routeParams = useParams<{ slug: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const slug = decodeURIComponent(routeParams?.slug ?? '').trim().toLowerCase()

  useEffect(() => {
    if (!slug) return
    const qs = params.toString()
    router.replace(`/${encodeURIComponent(slug)}/shop${qs ? `?${qs}` : ''}`)
  }, [slug, params, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <BrandLoader />
    </div>
  )
}
