'use client'

import { useMemo, useState } from 'react'
import { Ban, Loader2, Search, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface ExclusionCustomer {
  id: string
  name: string
  phone: string
  loyalty_points: number
  loyalty_cash?: number
  loyalty_excluded?: boolean
}

interface Props {
  customers: ExclusionCustomer[]
  /** Formats a customer's balance in the active unit (points or ₹). */
  balanceLabel: (c: ExclusionCustomer) => string
  onSetExcluded: (customer: ExclusionCustomer, excluded: boolean, reason?: string) => Promise<boolean>
}

export default function ExcludedCustomersCard({ customers, balanceLabel, onSetExcluded }: Props) {
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const excluded = useMemo(
    () => customers.filter((c) => c.loyalty_excluded).sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  )
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return customers
      .filter((c) => !c.loyalty_excluded && (c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)))
      .slice(0, 8)
  }, [customers, query])

  const run = async (c: ExclusionCustomer, value: boolean) => {
    setBusyId(c.id)
    const ok = await onSetExcluded(c, value, value ? reason.trim() || undefined : undefined)
    setBusyId(null)
    if (ok && value) {
      setQuery('')
      setReason('')
    }
  }

  const hasBalance = (c: ExclusionCustomer) => (c.loyalty_points ?? 0) !== 0 || (c.loyalty_cash ?? 0) !== 0

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-gray-500" />
          Excluded customers
        </CardTitle>
        <p className="text-sm text-gray-500">
          Excluded customers don’t earn or redeem rewards on any bill. Their current balance is kept and becomes usable
          again if you include them back. Changes apply immediately and are recorded in the audit log.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Find a customer to exclude</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Name or mobile…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g. Staff member, wholesale buyer"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {query.trim() && (
          <div className="divide-y rounded-lg border">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-500">No matching customers that are still in the program.</p>
            ) : (
              matches.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {c.phone || '—'} · {balanceLabel(c)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => run(c, true)}>
                    {busyId === c.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserX className="mr-1.5 h-3.5 w-3.5" />}
                    Exclude
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {excluded.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-500">
            No customers are excluded. Everyone earns and redeems as per the rules above.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 text-right font-medium">Kept balance</th>
                  <th className="pb-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {excluded.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td className="py-2.5 text-gray-600">{c.phone || '—'}</td>
                    <td className="py-2.5 text-right text-gray-600">{hasBalance(c) ? balanceLabel(c) : '—'}</td>
                    <td className="py-2.5 text-right">
                      <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => run(c, false)}>
                        {busyId === c.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserCheck className="mr-1.5 h-3.5 w-3.5" />}
                        Include again
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
