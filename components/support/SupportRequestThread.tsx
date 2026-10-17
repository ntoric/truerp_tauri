'use client'

import type { SupportRequest } from '@/lib/supportRequests'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ShieldCheck } from 'lucide-react'

function formatTime(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function AuthorLine({
  name,
  isAdmin,
  time,
}: {
  name: string
  isAdmin: boolean
  time?: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-800">{name}</span>
      {isAdmin && (
        <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-[10px] text-blue-700">
          <ShieldCheck className="h-3 w-3" />
          Support team
        </Badge>
      )}
      {time && <span className="text-[11px] text-gray-400">{formatTime(time)}</span>}
    </div>
  )
}

/** Conversation view for a support request: the original message plus replies. */
export default function SupportRequestThread({ request }: { request: SupportRequest }) {
  const requesterName = request.requester?.name || 'You'
  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-white p-3">
        <AuthorLine name={requesterName} isAdmin={false} time={request.created_at} />
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">{request.message}</p>
      </div>
      {(request.replies ?? []).map((reply) => (
        <div
          key={reply.id}
          className={cn(
            'rounded-lg border p-3',
            reply.is_admin ? 'border-blue-100 bg-blue-50/60' : 'bg-white'
          )}
        >
          <AuthorLine
            name={reply.is_admin ? 'Support team' : reply.author?.name || requesterName}
            isAdmin={reply.is_admin}
            time={reply.created_at}
          />
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">{reply.message}</p>
        </div>
      ))}
    </div>
  )
}
