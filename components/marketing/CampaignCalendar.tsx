'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Repeat } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import {
  OCCASION_CATEGORIES,
  marketingApi,
  occasionChipClass,
  parseYMD,
  ymd,
  type CalendarEvent,
  type CalendarResponse,
  type Occasion,
  type OccasionCategory,
  type OccasionRegion,
} from '@/lib/marketing'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const REGIONS: { value: OccasionRegion | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'india', label: '🇮🇳 India' },
  { value: 'international', label: '🌍 International' },
]

/** 6-week grid (Sunday first) covering the month of `month`. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function eventTone(e: CalendarEvent): string {
  if (e.projected) return 'border border-dashed border-sky-400 text-sky-800 dark:text-sky-200'
  switch (e.status) {
    case 'scheduled':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100'
    case 'sent':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100'
    case 'partial':
    case 'sending':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100'
    case 'failed':
      return 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100'
    default:
      return 'bg-muted text-foreground'
  }
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const longDate = (s: string) => parseYMD(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function createCampaignHref(date: string, occasion?: string) {
  return `/marketing/editor?date=${date}${occasion ? `&occasion=${occasion}` : ''}`
}

export default function CampaignCalendar() {
  const today = ymd(new Date())
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [region, setRegion] = useState<OccasionRegion | ''>('')
  const [hidden, setHidden] = useState<Set<OccasionCategory>>(new Set())
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [upcoming, setUpcoming] = useState<Occasion[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(today)

  const days = useMemo(() => monthGrid(month), [month])
  const from = ymd(days[0])
  const to = ymd(days[days.length - 1])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await marketingApi.calendar(from, to, region))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load the calendar')
    } finally {
      setLoading(false)
    }
  }, [from, to, region])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const end = new Date()
    end.setDate(end.getDate() + 60)
    marketingApi
      .calendar(today, ymd(end), region)
      .then((r) => setUpcoming(r.occasions))
      .catch(() => setUpcoming([]))
  }, [today, region])

  const visible = useCallback((o: Occasion) => !hidden.has(o.category), [hidden])

  const occasionsByDay = useMemo(() => {
    const m: Record<string, Occasion[]> = {}
    for (const o of data?.occasions ?? []) if (visible(o)) (m[o.date] ||= []).push(o)
    return m
  }, [data, visible])

  const eventsByDay = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {}
    for (const e of data?.events ?? []) (m[ymd(new Date(e.at))] ||= []).push(e)
    return m
  }, [data])

  const toggleCategory = (c: OccasionCategory) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(c)) n.delete(c)
      else n.add(c)
      return n
    })

  const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const goToday = () => {
    const d = new Date()
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelected(today)
  }
  const pick = (date: string) => {
    setSelected(date)
    const d = parseYMD(date)
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  const selOccasions = occasionsByDay[selected] ?? []
  const selEvents = eventsByDay[selected] ?? []
  const selPast = selected < today
  const lunarYears = data?.lunar_years

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0">
        <CardContent className="space-y-3 p-3 sm:p-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="ml-2 min-w-[9rem] text-base font-semibold">
                {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Region">
                {REGIONS.map((r) => (
                  <button
                    key={r.value || 'all'}
                    type="button"
                    onClick={() => setRegion(r.value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      region === r.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {OCCASION_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleCategory(c.value)}
                aria-pressed={!hidden.has(c.value)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-opacity ${c.chip} ${hidden.has(c.value) ? 'opacity-35 line-through' : ''}`}
              >
                {c.label}
              </button>
            ))}
            <span className="ml-auto hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-200" /> Scheduled
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-sky-400" /> Repeats
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> Sent
              </span>
            </span>
          </div>

          {/* Month grid */}
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const key = ymd(d)
                const inMonth = d.getMonth() === month.getMonth()
                const occ = occasionsByDay[key] ?? []
                const evs = eventsByDay[key] ?? []
                const items = occ.length + evs.length
                const isToday = key === today
                const isSel = key === selected
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pick(key)}
                    className={`group relative flex min-h-[64px] flex-col gap-0.5 border-b border-r p-1 text-left align-top transition-colors sm:min-h-[104px] sm:p-1.5 ${
                      (i + 1) % 7 === 0 ? 'border-r-0' : ''
                    } ${i >= 35 ? 'border-b-0' : ''} ${inMonth ? '' : 'bg-muted/30 text-muted-foreground'} ${
                      isSel ? 'bg-primary/5 ring-2 ring-inset ring-primary' : 'hover:bg-muted/50'
                    } ${key < today ? 'opacity-70' : ''}`}
                    aria-label={`${longDate(key)}${items ? `, ${items} item${items === 1 ? '' : 's'}` : ''}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday ? 'bg-primary font-semibold text-primary-foreground' : ''
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {/* Phones: emoji / dots only */}
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {occ.slice(0, 2).map((o) => (
                        <span key={o.key} className="text-xs leading-none" title={o.name}>
                          {o.emoji}
                        </span>
                      ))}
                      {evs.length > 0 && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />}
                    </span>
                    <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {occ.slice(0, 2).map((o) => (
                        <span key={o.key} className={`truncate rounded px-1 py-px text-[10.5px] font-medium ${occasionChipClass(o.category)}`} title={o.name}>
                          {o.emoji} {o.name}
                        </span>
                      ))}
                      {evs.slice(0, Math.max(0, 3 - Math.min(occ.length, 2))).map((e, j) => (
                        <span key={`${e.campaign_id}-${j}`} className={`flex items-center gap-0.5 truncate rounded px-1 py-px text-[10.5px] ${eventTone(e)}`} title={e.name}>
                          {e.recurrence && <Repeat className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate">{e.name}</span>
                        </span>
                      ))}
                      {items > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{items - 3} more</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          {lunarYears && lunarYears.to > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Lunar festival dates (Diwali, Holi, Eid…) are listed for {lunarYears.from}–{lunarYears.to} and follow published Indian calendars. Eid and
              Ramadan depend on the moon sighting and can move by a day, so check before you schedule.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Side panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{longDate(selected)}</CardTitle>
            {selPast && <p className="text-xs text-muted-foreground">This date has passed.</p>}
          </CardHeader>
          <CardContent className="space-y-3">
            {selOccasions.length === 0 && selEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No special day or campaign on this date.</p>
            )}
            {selOccasions.map((o) => (
              <div key={o.key} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{o.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.description}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className={`rounded px-1.5 text-[10px] font-medium ${occasionChipClass(o.category)}`}>
                        {OCCASION_CATEGORIES.find((c) => c.value === o.category)?.label}
                      </span>
                      <span className="rounded bg-muted px-1.5 text-[10px]">{o.region === 'india' ? 'India' : 'International'}</span>
                      {o.lunar && <span className="rounded bg-muted px-1.5 text-[10px]">Date changes yearly</span>}
                    </div>
                  </div>
                </div>
                {!selPast && (
                  <Button asChild size="sm" className="mt-3 w-full">
                    <Link href={createCampaignHref(o.date, o.key)}>
                      <CalendarPlus className="mr-1.5 h-4 w-4" /> Create {o.name} campaign
                    </Link>
                  </Button>
                )}
              </div>
            ))}
            {selEvents.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaigns</div>
                {selEvents.map((e, j) => {
                  const editable = e.status === 'draft' || e.status === 'scheduled'
                  const body = (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{e.name}</span>
                        {e.projected ? <StatusBadge status="upcoming run" tone="info" /> : <StatusBadge status={e.status} />}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{timeOf(e.at)}</span>
                        {e.repeat && (
                          <span className="flex items-center gap-1">
                            <Repeat className="h-3 w-3" /> {e.repeat}
                          </span>
                        )}
                      </div>
                    </>
                  )
                  return editable ? (
                    <Link key={`${e.campaign_id}-${j}`} href={`/marketing/editor?id=${e.campaign_id}`} className="block rounded-lg border p-2.5 text-sm hover:bg-muted/50">
                      {body}
                    </Link>
                  ) : (
                    <div key={`${e.campaign_id}-${j}`} className="rounded-lg border p-2.5 text-sm">
                      {body}
                    </div>
                  )
                })}
              </div>
            )}
            {!selPast && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={createCampaignHref(selected)}>
                  <CalendarPlus className="mr-1.5 h-4 w-4" /> New campaign on this date
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Coming up</CardTitle>
            <p className="text-xs text-muted-foreground">Next 60 days. Plan festival offers early.</p>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-1 overflow-y-auto">
            {upcoming.filter(visible).length === 0 && <p className="text-sm text-muted-foreground">Nothing in the next 60 days.</p>}
            {upcoming.filter(visible).map((o) => {
              const days = Math.round((parseYMD(o.date).getTime() - parseYMD(today).getTime()) / 86400000)
              return (
                <div key={`${o.key}-${o.date}`} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/50">
                  <button type="button" onClick={() => pick(o.date)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="text-lg leading-none">{o.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {parseYMD(o.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
                        {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
                      </span>
                    </span>
                  </button>
                  <Button asChild size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Create ${o.name} campaign`}>
                    <Link href={createCampaignHref(o.date, o.key)}>
                      <CalendarPlus className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
