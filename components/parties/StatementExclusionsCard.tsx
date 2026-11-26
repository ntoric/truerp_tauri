'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Search, UserX, X } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  excludeFromStatements,
  fetchStatementExclusions,
  includeInStatements,
  type StatementExclusion,
} from '@/lib/partyStatement'

interface PartyHit {
  id: string
  name: string
  phone?: string
  party_type?: string
}

/** Store-wide list of parties left out of bulk statement sends and schedules. */
export default function StatementExclusionsCard() {
  const [rows, setRows] = useState<StatementExclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PartyHit[]>([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await fetchStatementExclusions())
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load excluded parties')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Debounced party search for adding.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await apiFetch(`/parties?${new URLSearchParams({ search: q, page: '1', per_page: '8' })}`)
        const data = res.ok ? await res.json() : null
        const list: PartyHit[] = Array.isArray(data) ? data : (data?.parties ?? [])
        if (!cancelled) setHits(list)
      } catch {
        if (!cancelled) setHits([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const excludedIds = new Set(rows.map((r) => r.party_id))

  const add = async (p: PartyHit) => {
    setBusyId(p.id)
    try {
      await excludeFromStatements({ party_ids: [p.id] })
      notifySuccess(`${p.name} won't get bulk or scheduled statements`)
      setQuery('')
      setHits([])
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to exclude party')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (r: StatementExclusion) => {
    setBusyId(r.party_id)
    try {
      await includeInStatements(r.party_id)
      setRows((rs) => rs.filter((x) => x.party_id !== r.party_id))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update excluded parties')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserX className="h-4 w-4" /> Excluded parties
          {rows.length > 0 && <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          These parties are skipped by bulk sends and schedules on every channel. You can still send one of them a
          statement on its own. You can also exclude parties from the Parties list.
        </p>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a party to exclude…"
            aria-label="Search a party to exclude"
            className="pl-8"
          />
          {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {hits.length > 0 && (
          <ul className="divide-y rounded-md border">
            {hits.map((p) => {
              const already = excludedIds.has(p.id)
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {p.name}
                    {p.phone && <span className="ml-2 text-xs text-muted-foreground">{p.phone}</span>}
                  </span>
                  {already ? (
                    <span className="text-xs text-muted-foreground">Excluded</span>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => void add(p)}>
                      {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span className="ml-1">Exclude</span>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {query.trim().length >= 2 && !searching && hits.length === 0 && (
          <p className="text-xs text-muted-foreground">No parties match &quot;{query.trim()}&quot;.</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parties excluded. Everyone gets statements.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {rows.map((r) => (
              <li
                key={r.party_id}
                className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-3 pr-1 text-sm"
              >
                <Link href={`/parties/ledger?party_id=${r.party_id}`} className="hover:underline">
                  {r.name}
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(r)}
                  disabled={busyId === r.party_id}
                  aria-label={`Include ${r.name} again`}
                  title="Include again"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-gray-200 hover:text-gray-900"
                >
                  {busyId === r.party_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
