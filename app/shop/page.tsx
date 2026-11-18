'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Legacy storefront links (/shop?slug=<slug>&product=<id>) redirect to the
// shop URL (/<slug>/shop?product=<id>).
export default function LegacyShopRedirect() {
  return (
    <Suspense fallback={<Spinner />}>
      <Redirect />
    </Suspense>
  )
}

function Redirect() {
  const params = useSearchParams()
  const router = useRouter()
  const slug = (params.get('slug') || '').trim().toLowerCase()

  useEffect(() => {
    if (!slug) return
    const rest = new URLSearchParams(params.toString())
    rest.delete('slug')
    const qs = rest.toString()
    router.replace(`/${encodeURIComponent(slug)}/shop${qs ? `?${qs}` : ''}`)
  }, [slug, params, router])

  if (slug) return <Spinner />
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
      <div>
        <p className="text-lg font-semibold text-slate-800">Shop not found</p>
        <p className="mt-1 text-sm text-slate-500">Check the link you were given. Shop links look like /your-shop-name/shop.</p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  )
}
