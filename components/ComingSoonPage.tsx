'use client'

import { Construction } from 'lucide-react'

export default function ComingSoonPage({
  title = 'Coming Soon',
  description = 'This feature is not available yet. Please check back later.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
        <Construction className="h-8 w-8 text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 max-w-md text-gray-600">{description}</p>
      <p className="mt-6 text-sm text-gray-400">Coming Soon</p>
    </div>
  )
}
