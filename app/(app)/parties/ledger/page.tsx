'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import {
  PARTY_LEDGER_PERIODS,
  buildPartyLedgerShareText,
  downloadPartyLedgerExcel,
  fetchPartyLedger,
  partyLedgerModeLabel,
  partyLedgerRange,
  printPartyLedger,
  type PartyLedger,
  type PartyLedgerEntry,
  type PartyLedgerPeriod,
} from '@/lib/partyLedger'
import { loadReportFavourites, saveReportFavourites } from '@/lib/reportsDirectory'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  Download,
  Mail,
  MessageCircle,
  Printer,
  Receipt,
  Star,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from 'lucide-react'

const FAVOURITE_KEY = 'party-ledger'

interface PartyOption {
  id: string
  name: string
  party_type: string
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthStartISO() {
  return `${todayISO().slice(0, 7)}-01`
}

function dueCell(e: PartyLedgerEntry) {
  switch (e.due_status) {
    case 'paid':
      return <span className="font-medium text-emerald-600">Paid</span>
    case 'partial':
      return (
        <span className="font-medium text-amber-600">
          Partially Paid
          {e.overdue_days ? <span className="text-xs"> · {e.overdue_days}d overdue</span> : null}
        </span>
      )
    case 'unpaid':
      return e.overdue_days ? (
        <span className="font-medium text-red-600">Overdue by {e.overdue_days}d</span>
      ) : (
        <span className="font-medium text-red-600">Unpaid</span>
      )
    default:
      return <span className="text-gray-400">—</span>
  }
}

export default function PartyLedgerPage() {
  const searchParams = useSearchParams()
  const [parties, setParties] = useState<PartyOption[]>([])
  const [partyId, setPartyId] = useState('')
  const [period, setPeriod] = useState<PartyLedgerPeriod>('this_month')
  const [customFrom, setCustomFrom] = useState(monthStartISO())
  const [customTo, setCustomTo] = useState(todayISO())
  const [ledger, setLedger] = useState<PartyLedger | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
  const [favourites, setFavourites] = useState<Set<string>>(new Set())

  useEffect(() => {
    setFavourites(new Set(loadReportFavourites()))
  }, [])

  const toggleFavourite = () => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(FAVOURITE_KEY)) next.delete(FAVOURITE_KEY)
      else next.add(FAVOURITE_KEY)
      saveReportFavourites(Array.from(next))
      return next
    })
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/parties')
        if (!res.ok) return
        const data: PartyOption[] = await res.json()
        setParties(data)
        const fromQuery = searchParams.get('party_id')
        if (fromQuery && data.some((p) => p.id === fromQuery)) {
          setPartyId(fromQuery)
        } else if (data.length > 0) {
          setPartyId(data[0].id)
        }
      } catch (err) {
        console.error(err)
      }
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { from_date: fromDate, to_date: toDate } = useMemo(
    () => partyLedgerRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  )

  const loadLedger = useCallback(async () => {
    if (!partyId) return
    setLoading(true)
    try {
      setLedger(await fetchPartyLedger(partyId, fromDate, toDate))
    } catch (err) {
      setLedger(null)
      notifyError(err instanceof Error ? err.message : 'Failed to load party ledger')
    } finally {
      setLoading(false)
    }
  }, [partyId, fromDate, toDate])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger])

  const isVendor = ledger?.party.party_type === 'vendor'
  const balanceLabel = (ledger?.closing_balance ?? 0) < 0 ? 'Total Payable Amount' : 'Total Receivable Amount'
  const docLabel = isVendor ? 'Total Purchase Amount' : 'Total Sales Amount'
  const moneyLabel = isVendor ? 'Total Paid Amount' : 'Total Received Amount'

  const shareText = ledger ? buildPartyLedgerShareText(ledger) : ''

  const shareWhatsApp = () => {
    if (!shareText) return
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
  }

  const shareEmail = () => {
    if (!shareText || !ledger) return
    const subject = `Party Statement — ${ledger.party.name} (${ledger.label})`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`
  }

  const exportExcel = async () => {
    if (!partyId || !ledger) return
    setBusy('excel')
    try {
      await downloadPartyLedgerExcel(partyId, fromDate, toDate, ledger.party.name)
      notifySuccess('Excel exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Excel export failed')
    } finally {
      setBusy(null)
    }
  }

  const printLedger = async () => {
    if (!partyId) return
    setBusy('pdf')
    try {
      await printPartyLedger(partyId, fromDate, toDate)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Print failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader
          title="Party Statement (Ledger)"
          backHref="/parties"
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={toggleFavourite}
                aria-label={favourites.has(FAVOURITE_KEY) ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    favourites.has(FAVOURITE_KEY) ? 'fill-amber-400 text-amber-400' : 'text-gray-400'
                  )}
                />
                Favourite
              </Button>
              <Button variant="outline" size="sm" onClick={shareWhatsApp} disabled={!ledger}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={shareEmail} disabled={!ledger}>
                <Mail className="mr-2 h-4 w-4" />
                Email Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => void exportExcel()} disabled={!ledger || busy !== null}>
                <Download className="mr-2 h-4 w-4" />
                {busy === 'excel' ? 'Exporting…' : 'Download Excel'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void printLedger()} disabled={!ledger || busy !== null}>
                <Printer className="mr-2 h-4 w-4" />
                {busy === 'pdf' ? 'Preparing…' : 'Print PDF'}
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat
            tone={ledger && ledger.closing_balance < 0 ? 'danger' : 'brand'}
            icon={Receipt}
            label={balanceLabel}
            value={formatCurrency(Math.abs(ledger?.closing_balance ?? 0))}
          />
          <SummaryStat
            tone="warning"
            icon={AlertTriangle}
            label="Overdue Amount"
            value={formatCurrency(ledger?.overdue_amount ?? 0)}
          />
          <SummaryStat
            tone="default"
            icon={TrendingUp}
            label={docLabel}
            value={formatCurrency(isVendor ? (ledger?.total_purchases ?? 0) : (ledger?.total_sales ?? 0))}
          />
          <SummaryStat
            tone="success"
            icon={Wallet}
            label={moneyLabel}
            value={formatCurrency(isVendor ? (ledger?.total_paid ?? 0) : (ledger?.total_received ?? 0))}
          />
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-1.5 sm:w-64">
                <Label>Party</Label>
                <SearchableSelect
                  value={partyId}
                  onValueChange={setPartyId}
                  options={parties.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  placeholder="Select party"
                  searchPlaceholder="Search parties…"
                  emptyMessage="No parties found"
                />
              </div>
              <div className="w-full space-y-1.5 sm:w-48">
                <Label>Period</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as PartyLedgerPeriod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTY_LEDGER_PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {period === 'custom' && (
                <>
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>To</Label>
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                </>
              )}
              {ledger && (
                <p className="text-xs text-muted-foreground sm:ml-auto">
                  {ledger.label}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : !ledger ? (
              <div className="flex h-64 items-center justify-center text-sm text-gray-500">
                {partyId ? 'Select a period to view the statement' : 'Select a party to view the statement'}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Voucher</th>
                      <th className="px-4 py-3 font-medium">Sr No</th>
                      <th className="px-4 py-3 font-medium">Payment Mode</th>
                      <th className="px-4 py-3 text-right font-medium">Credit</th>
                      <th className="px-4 py-3 text-right font-medium">Debit</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                      <th className="px-4 py-3 font-medium">Due Date (Overdue by)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.map((e, i) => {
                      const special = e.type === 'opening_balance' || e.type === 'closing_balance'
                      return (
                        <tr
                          key={`${e.type}-${e.ref_id || i}`}
                          className={cn(
                            'border-b last:border-0',
                            special ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                            {e.date ? formatDate(e.date + 'T00:00:00') : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-900">{e.voucher}</td>
                          <td className="px-4 py-3 text-gray-600">{e.ref_number}</td>
                          <td className="px-4 py-3 text-gray-600">{partyLedgerModeLabel(e.payment_mode)}</td>
                          <td className="px-4 py-3 text-right text-gray-900">
                            {e.credit > 0 ? formatCurrency(e.credit) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900">
                            {e.debit > 0 ? formatCurrency(e.debit) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(e.balance)}
                          </td>
                          <td className="px-4 py-3">{dueCell(e)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
