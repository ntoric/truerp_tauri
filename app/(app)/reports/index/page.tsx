'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  loadReportFavourites,
  saveReportFavourites,
  REPORT_FILTER_OPTIONS,
  REPORT_GROUPS,
  type ReportEntry,
  type ReportTag,
} from '@/lib/reportsDirectory'
import {
  ArrowLeftRight,
  BookOpen,
  Package,
  Search,
  Share2,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react'

const GROUP_ICONS: Record<string, LucideIcon> = {
  sales: TrendingUp,
  purchases: ShoppingBag,
  gst: ReceiptText,
  transaction: ArrowLeftRight,
  item: Package,
  party: Users,
  accounting: BookOpen,
  favourites: Star,
}

const COLLAPSED_COUNT = 7

function ReportRow({
  entry,
  favourite,
  onToggleFavourite,
}: {
  entry: ReportEntry
  favourite: boolean
  onToggleFavourite: (key: string) => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-gray-100 py-2.5 last:border-0">
      <Link
        href={entry.href}
        className="flex-1 text-sm text-gray-800 transition-colors hover:text-blue-600"
      >
        {entry.name}
      </Link>
      <button
        type="button"
        onClick={() => onToggleFavourite(entry.key)}
        className="p-1 text-gray-300 transition-colors hover:text-amber-400"
        aria-label={favourite ? `Remove ${entry.name} from favourites` : `Add ${entry.name} to favourites`}
      >
        <Star className={cn('h-4 w-4', favourite && 'fill-amber-400 text-amber-400')} />
      </button>
    </li>
  )
}

function GroupCard({
  icon: Icon,
  label,
  entries,
  favourites,
  onToggleFavourite,
}: {
  icon: LucideIcon
  label: string
  entries: ReportEntry[]
  favourites: Set<string>
  onToggleFavourite: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT)
  const hiddenCount = entries.length - COLLAPSED_COUNT

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Icon className="h-4 w-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
      </header>
      <ul className="flex-1 px-4 py-1.5">
        {visible.map((entry) => (
          <ReportRow
            key={entry.key}
            entry={entry}
            favourite={favourites.has(entry.key)}
            onToggleFavourite={onToggleFavourite}
          />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-4 pb-3 pt-1 text-left text-xs font-medium text-blue-600 hover:underline"
        >
          {expanded ? 'See less ↑' : `See ${hiddenCount} more ↓`}
        </button>
      )}
    </section>
  )
}

export default function ReportsIndexPage() {
  const [filter, setFilter] = useState<ReportTag | 'all'>('all')
  const [query, setQuery] = useState('')
  const [favourites, setFavourites] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFavourites(new Set(loadReportFavourites()))
  }, [])

  // Ctrl/Cmd+F focuses the in-page report search (mirrors the reference UI).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggleFavourite = (key: string) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveReportFavourites(Array.from(next))
      return next
    })
  }

  const needle = query.trim().toLowerCase()
  const visibleGroups = useMemo(
    () =>
      REPORT_GROUPS.map((group) => ({
        ...group,
        entries: group.entries.filter(
          (entry) =>
            (filter === 'all' || entry.tags.includes(filter)) &&
            (!needle || entry.name.toLowerCase().includes(needle))
        ),
      })).filter((group) => group.entries.length > 0),
    [filter, needle]
  )

  const favouriteEntries = useMemo(
    () =>
      REPORT_GROUPS.flatMap((g) => g.entries).filter(
        (entry) =>
          favourites.has(entry.key) &&
          (filter === 'all' || entry.tags.includes(filter)) &&
          (!needle || entry.name.toLowerCase().includes(needle))
      ),
    [favourites, filter, needle]
  )

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="app-page-title">Reports</h1>
          <Link href="/settings/ca-share">
            <Button type="button" className="gap-2">
              <Share2 className="h-4 w-4" />
              CA Reports Sharing
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Filter By</span>
            {REPORT_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filter === opt.value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find Report"
              className="pl-8"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 sm:block">
              Ctrl F
            </kbd>
          </div>
        </div>

        {visibleGroups.length === 0 && favouriteEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center">
            <p className="text-sm text-gray-500">No reports match your search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favouriteEntries.length > 0 && (
              <GroupCard
                icon={GROUP_ICONS.favourites}
                label="Favourites"
                entries={favouriteEntries}
                favourites={favourites}
                onToggleFavourite={toggleFavourite}
              />
            )}
            {visibleGroups.map((group) => (
              <GroupCard
                key={group.key}
                icon={GROUP_ICONS[group.icon] ?? BookOpen}
                label={group.label}
                entries={group.entries}
                favourites={favourites}
                onToggleFavourite={toggleFavourite}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
