'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchActiveAnnouncements,
  resolveMediaUrl,
  type Announcement,
  type AnnouncementType,
} from '@/lib/announcements'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BellRing,
  Megaphone,
  Rocket,
  StickyNote,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'

const POLL_MS = 60_000
const MAX_COLLAPSED = 3

const TYPE_STYLE: Record<
  AnnouncementType,
  { icon: LucideIcon; label: string; bar: string; chip: string; iconBox: string }
> = {
  announcement: {
    icon: Megaphone,
    label: 'Announcement',
    bar: 'before:bg-indigo-500',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20',
    iconBox: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  reminder: {
    icon: BellRing,
    label: 'Reminder',
    bar: 'before:bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20',
    iconBox: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  release_note: {
    icon: Rocket,
    label: 'Release Notes',
    bar: 'before:bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20',
    iconBox: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  maintenance: {
    icon: Wrench,
    label: 'Maintenance',
    bar: 'before:bg-orange-500',
    chip: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/20',
    iconBox: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  urgent: {
    icon: AlertTriangle,
    label: 'Urgent',
    bar: 'before:bg-red-500',
    chip: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/20',
    iconBox: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  note: {
    icon: StickyNote,
    label: 'Note',
    bar: 'before:bg-slate-400',
    chip: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/20',
    iconBox: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
}

function styleFor(type: Announcement['type']) {
  return TYPE_STYLE[type] ?? TYPE_STYLE.announcement
}

function dismissalsKey(userId: string) {
  return `announcement-dismissals:${userId}`
}

function readDismissals(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(dismissalsKey(userId))
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/**
 * Shows platform announcements (published by the super admin) as tall toast
 * cards pinned to the top-right of the app shell. Card height grows with the
 * content — long bodies scroll inside the card and attached images make the
 * card taller; the accent/icon is driven by the announcement type.
 * Dismissals are remembered per user until the announcement is edited.
 */
export default function AnnouncementToaster() {
  const { user } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (user?.id) setDismissed(readDismissals(user.id))
  }, [user?.id])

  const load = useCallback(async () => {
    try {
      setItems(await fetchActiveAnnouncements())
    } catch {
      // Announcements are non-critical; keep the last known list on failure.
    }
  }, [])

  useEffect(() => {
    if (!user) return
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [user, load])

  const visible = useMemo(
    () => items.filter((a) => dismissed[a.id] !== a.updated_at),
    [items, dismissed]
  )

  const dismiss = useCallback(
    (a: Announcement) => {
      if (!user?.id) return
      const next = { ...readDismissals(user.id), [a.id]: a.updated_at }
      try {
        localStorage.setItem(dismissalsKey(user.id), JSON.stringify(next))
      } catch {
        // Storage may be unavailable (private mode); dismiss for this session.
      }
      setDismissed(next)
    },
    [user?.id]
  )

  const dismissAll = useCallback(() => {
    if (!user?.id) return
    const next = { ...readDismissals(user.id) }
    for (const a of visible) next[a.id] = a.updated_at
    try {
      localStorage.setItem(dismissalsKey(user.id), JSON.stringify(next))
    } catch {
      // ignore
    }
    setDismissed(next)
  }, [user?.id, visible])

  if (visible.length === 0) return null

  const shown = expanded ? visible : visible.slice(0, MAX_COLLAPSED)
  const hiddenCount = visible.length - shown.length

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(400px,calc(100vw-2rem))] flex-col gap-3">
      {shown.map((a) => {
        const style = styleFor(a.type)
        const Icon = style.icon
        return (
          <section
            key={a.id}
            className={cn(
              'group pointer-events-auto relative flex w-full flex-col gap-2 overflow-hidden rounded-xl',
              'border border-white/70 bg-white/90 p-4 pr-9 text-foreground',
              'shadow-[0_1px_1px_rgba(0,0,0,0.06),0_4px_8px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.14),0_24px_48px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.75)]',
              'ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150',
              "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
              'animate-in fade-in slide-in-from-top-4 duration-300',
              'dark:border-white/15 dark:bg-slate-900/85 dark:ring-white/10',
              'max-h-[70vh]',
              style.bar
            )}
          >
            <button
              type="button"
              onClick={() => dismiss(a)}
              aria-label="Dismiss announcement"
              className="absolute right-2 top-2 rounded-md p-1 text-foreground/40 transition-colors hover:text-foreground focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', style.iconBox)}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                  style.chip
                )}
              >
                {style.label}
              </span>
              <span className="ml-auto pr-5 text-[11px] font-medium text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>

            <h3 className="text-sm font-semibold leading-snug tracking-tight">{a.title}</h3>

            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMediaUrl(a.image_url)}
                alt={a.title}
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: 200 }}
              />
            )}

            {a.body && (
              <div className="min-h-0 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                {a.body}
              </div>
            )}

            {a.link_url && (
              <a
                href={a.link_url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex w-fit items-center rounded-md border border-black/5 bg-white/60 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/20"
              >
                {a.link_label || 'Learn more'}
              </a>
            )}
          </section>
        )
      })}

      {(hiddenCount > 0 || visible.length > 1) && (
        <div className="pointer-events-auto flex items-center justify-end gap-2">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-900"
            >
              +{hiddenCount} more
            </button>
          )}
          {visible.length > 1 && (
            <button
              type="button"
              onClick={dismissAll}
              className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:bg-white dark:bg-slate-800/80 dark:text-slate-300"
            >
              Dismiss all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
