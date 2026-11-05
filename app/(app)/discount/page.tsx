'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useDiscount } from '@/hooks/useDiscount'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PaginationControls from '@/components/ui/pagination-controls'
import { formatCurrency, formatDate } from '@/lib/utils'
import { isSuperAdmin } from '@/lib/roles'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  type SaleDiscountSettings,
  DEFAULT_SALE_DISCOUNT_SETTINGS,
  normalizeSaleDiscountSettings,
} from '@/lib/saleDiscount'
import { Percent, Save, Loader2, Search, History, Settings2 } from 'lucide-react'

interface DiscountTransaction {
  id: string
  type: string
  type_label: string
  reference: string
  date: string
  party_name: string
  item_discount: number
  document_discount: number
  total_discount: number
  document_total: number
}

interface TransactionsResponse {
  transactions: DiscountTransaction[]
  total: number
  page: number
  per_page: number
  summary: { count: number; total_discount: number }
}

const TXN_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'sale_invoice', label: 'Sale Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'purchase_bill', label: 'Purchase Bill' },
  { value: 'payment_in', label: 'Payment In' },
  { value: 'payment_out', label: 'Payment Out' },
]

const PAGE_SIZE = 25

export default function DiscountPage() {
  const { user } = useAuth()
  const canEdit = isSuperAdmin(user?.role)
  const {
    settings: sharedSettings,
    isDiscountEnabled,
    loading: sharedLoading,
    refresh: refreshDiscountSettings,
  } = useDiscount()

  const [settings, setSettings] = useState<SaleDiscountSettings>({ ...sharedSettings })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [transactions, setTransactions] = useState<DiscountTransaction[]>([])
  const [txnTotal, setTxnTotal] = useState(0)
  const [txnSummary, setTxnSummary] = useState<{ count: number; total_discount: number } | null>(null)
  const [txnLoading, setTxnLoading] = useState(false)
  const [txnPage, setTxnPage] = useState(1)
  const [txnType, setTxnType] = useState('all')
  const [txnSearch, setTxnSearch] = useState('')
  const [txnFrom, setTxnFrom] = useState('')
  const [txnTo, setTxnTo] = useState('')

  useEffect(() => {
    const load = async () => {
      if (sharedLoading) return
      setLoading(true)
      try {
        const res = await apiFetch('/sale-discount-settings')
        if (res.ok) setSettings(normalizeSaleDiscountSettings(await res.json()))
      } catch {
        /* keep provider's copy */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sharedLoading])

  const loadTransactions = useCallback(
    async (page = txnPage) => {
      setTxnLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('per_page', String(PAGE_SIZE))
        if (txnType !== 'all') params.set('type', txnType)
        if (txnSearch.trim()) params.set('search', txnSearch.trim())
        if (txnFrom) params.set('from', txnFrom)
        if (txnTo) params.set('to', txnTo)
        const res = await apiFetch(`/discounts/transactions?${params.toString()}`)
        if (res.ok) {
          const data: TransactionsResponse = await res.json()
          setTransactions(data.transactions || [])
          setTxnTotal(data.total || 0)
          setTxnSummary(data.summary || null)
          setTxnPage(data.page || 1)
        } else {
          notifyError('Failed to load discount transactions')
        }
      } catch {
        notifyError('Failed to load discount transactions')
      } finally {
        setTxnLoading(false)
      }
    },
    [txnPage, txnType, txnSearch, txnFrom, txnTo]
  )

  useEffect(() => {
    loadTransactions(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnType, txnFrom, txnTo])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/sale-discount-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        const saved = normalizeSaleDiscountSettings(await res.json())
        setSettings(saved)
        notifySuccess('Discount settings saved')
        // Push the new flag to every gated surface (POS, invoice form, …).
        refreshDiscountSettings()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(typeof data.error === 'string' ? data.error : 'Failed to save settings')
      }
    } catch {
      notifyError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(txnTotal / PAGE_SIZE))

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="app-page-title">Discount</h1>
            <p className="text-sm text-gray-500">
              Manage how discounts work across billing, POS and payments.
            </p>
          </div>
        </div>

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Discount Settings
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Discount Transactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Discount
                </CardTitle>
                <CardDescription>
                  Master switch and configuration for discounts in this store.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium">
                        Discounts {settings.is_enabled ? 'enabled' : 'disabled'}
                      </p>
                      <p className="text-xs text-gray-500">
                        When disabled, every discount option is hidden across the app —
                        only this page remains accessible.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.is_enabled}
                    disabled={!canEdit}
                    onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
                  />
                </div>

                {!settings.is_enabled && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Discounts are currently off. Line-item, invoice-level, payment and
                    product discount fields are hidden everywhere in the system.
                  </p>
                )}

                {settings.is_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Discount mode</Label>
                      <Select
                        value={settings.mode}
                        disabled={!canEdit}
                        onValueChange={(value) =>
                          setSettings({
                            ...settings,
                            mode: value === 'auto' ? 'auto' : 'manual',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual entry</SelectItem>
                          <SelectItem value="auto">Auto threshold</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Manual: the cashier types any discount amount on invoices and in POS.
                        Auto: the discount is computed automatically from the rule below; when a
                        sale qualifies, invoice creation and POS show an Apply button — the
                        discount only counts once it is applied.
                      </p>
                    </div>

                    {settings.mode === 'auto' && (
                      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Discount type</Label>
                          <Select
                            value={settings.discount_type}
                            disabled={!canEdit}
                            onValueChange={(value) =>
                              setSettings({
                                ...settings,
                                discount_type: value === 'amount' ? 'amount' : 'percent',
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">Percent</SelectItem>
                              <SelectItem value="amount">Flat amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {settings.discount_type === 'percent'
                              ? 'Discount percent (X)'
                              : 'Discount amount (X)'}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!canEdit}
                            value={settings.discount_value}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                discount_value: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Minimum sale amount (Y)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!canEdit}
                            value={settings.min_sale_amount}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                min_sale_amount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!canEdit && (
                  <p className="text-xs text-gray-500">
                    Only super admins can change discount settings.
                  </p>
                )}

                {canEdit && (
                  <div className="flex justify-end">
                    <Button onClick={saveSettings} disabled={saving || loading} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="mt-4 space-y-4">
            {txnSummary && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryStat label="Discounted transactions" value={txnSummary.count} />
                <SummaryStat
                  tone="warning"
                  label="Total discount given"
                  value={formatCurrency(txnSummary.total_discount)}
                />
                <SummaryStat
                  label="Status"
                  value={isDiscountEnabled ? 'Discounts on' : 'Discounts off'}
                />
              </div>
            )}

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Discount transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={txnType} onValueChange={setTxnType}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TXN_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={txnFrom}
                      onChange={(e) => setTxnFrom(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={txnTo}
                      onChange={(e) => setTxnTo(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Reference or party…"
                        value={txnSearch}
                        onChange={(e) => setTxnSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadTransactions(1)}
                        className="w-56 pl-8"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTransactions(1)}
                    disabled={txnLoading}
                  >
                    {txnLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead className="text-right">Item Discount</TableHead>
                        <TableHead className="text-right">Doc Discount</TableHead>
                        <TableHead className="text-right">Total Discount</TableHead>
                        <TableHead className="text-right">Doc Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                          <TableCell>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {t.type_label}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{t.reference || '—'}</TableCell>
                          <TableCell>{t.party_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            {t.item_discount > 0 ? formatCurrency(t.item_discount) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {t.document_discount > 0 ? formatCurrency(t.document_discount) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            -{formatCurrency(t.total_discount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(t.document_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!txnLoading && transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                            No discount transactions found.
                          </TableCell>
                        </TableRow>
                      )}
                      {txnLoading && transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <PaginationControls
                  page={txnPage}
                  totalPages={totalPages}
                  totalItems={txnTotal}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => loadTransactions(p)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
