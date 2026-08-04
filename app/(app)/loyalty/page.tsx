'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Gift, Users, History, Save, Loader2, Search, Plus, Minus } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

interface LoyaltySettings {
  is_enabled: boolean
  spend_amount: number
  points_per_spend: number
  point_value: number
  min_redeem_points: number
  max_redeem_percent: number
}

interface LoyaltyStats {
  total_members: number
  total_points_outstanding: number
  points_earned_this_month: number
  points_redeemed_this_month: number
}

interface LoyaltyCustomer {
  id: string
  name: string
  phone: string
  loyalty_points: number
}

interface LoyaltyTransaction {
  id: string
  party_id: string
  party?: { name: string; phone: string }
  transaction_type: string
  points: number
  balance_after: number
  reference_number: string
  notes: string
  created_at: string
}

export default function LoyaltyPage() {
  const [settings, setSettings] = useState<LoyaltySettings>({
    is_enabled: false,
    spend_amount: 100,
    points_per_spend: 1,
    point_value: 1,
    min_redeem_points: 50,
    max_redeem_percent: 25,
  })
  const [stats, setStats] = useState<LoyaltyStats | null>(null)
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustCustomer, setAdjustCustomer] = useState<LoyaltyCustomer | null>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [settingsRes, statsRes, customersRes, txRes] = await Promise.all([
        apiFetch('/loyalty/settings'),
        apiFetch('/loyalty/stats'),
        apiFetch('/loyalty/customers'),
        apiFetch('/loyalty/transactions'),
      ])
      if (settingsRes.ok) setSettings(await settingsRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
      if (customersRes.ok) setCustomers(await customersRes.json())
      if (txRes.ok) setTransactions(await txRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/loyalty/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        notifySuccess('Loyalty settings saved')
        setSettings(await res.json())
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

  const openAdjust = (customer: LoyaltyCustomer) => {
    setAdjustCustomer(customer)
    setAdjustPoints('')
    setAdjustNotes('')
    setAdjustOpen(true)
  }

  const submitAdjust = async () => {
    if (!adjustCustomer) return
    const points = parseInt(adjustPoints, 10)
    if (!points || Number.isNaN(points)) {
      notifyError('Enter a valid points amount (use negative to deduct)')
      return
    }
    setAdjusting(true)
    try {
      const res = await apiFetch(`/loyalty/parties/${adjustCustomer.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ points, notes: adjustNotes }),
      })
      if (res.ok) {
        notifySuccess('Points updated')
        setAdjustOpen(false)
        loadAll()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(typeof data.error === 'string' ? data.error : 'Adjustment failed')
      }
    } catch {
      notifyError('Adjustment failed')
    } finally {
      setAdjusting(false)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredCustomers)

  useEffect(() => {
    resetPage()
  }, [search])

  const txnLabel = (type: string) => {
    switch (type) {
      case 'earn':
        return 'Earned'
      case 'redeem':
        return 'Redeemed'
      case 'adjust':
        return 'Adjusted'
      default:
        return type
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Loyalty Program</h1>
            <p className="text-sm text-gray-500">
              Reward repeat customers with points on purchases and let them redeem on future bills.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2">
            <Gift className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium">
              Program {settings.is_enabled ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
            />
          </div>
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Members with points</p>
                <p className="text-2xl font-bold">{stats.total_members}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Outstanding points</p>
                <p className="text-2xl font-bold">{stats.total_points_outstanding.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Earned this month</p>
                <p className="text-2xl font-bold text-green-600">
                  +{stats.points_earned_this_month.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Redeemed this month</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.points_redeemed_this_month.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Earn &amp; redeem rules</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Earn rate — spend amount (₹)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.spend_amount}
                    onChange={(e) =>
                      setSettings({ ...settings, spend_amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-gray-500">Customer spends this amount to earn points below.</p>
                </div>
                <div className="space-y-2">
                  <Label>Points earned per spend amount</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.points_per_spend}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        points_per_spend: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Example: ₹{settings.spend_amount} spent → {settings.points_per_spend} point(s).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Redemption value (₹ per point)</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={settings.point_value}
                    onChange={(e) =>
                      setSettings({ ...settings, point_value: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum points to redeem</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.min_redeem_points}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        min_redeem_points: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Max bill % payable with points</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.max_redeem_percent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_redeem_percent: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={saveSettings} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer balances
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search customers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="py-8 text-center text-gray-500">Loading...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 font-medium">Customer</th>
                          <th className="pb-2 font-medium">Phone</th>
                          <th className="pb-2 font-medium text-right">Points</th>
                          <th className="pb-2 font-medium text-right">Value (₹)</th>
                          <th className="pb-2 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((c) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-3 font-medium">{c.name}</td>
                            <td className="py-3 text-gray-600">{c.phone || '—'}</td>
                            <td className="py-3 text-right font-semibold text-amber-600">
                              {(c.loyalty_points ?? 0).toLocaleString()}
                            </td>
                            <td className="py-3 text-right">
                              {formatCurrency((c.loyalty_points ?? 0) * settings.point_value)}
                            </td>
                            <td className="py-3 text-right">
                              <Button variant="outline" size="sm" onClick={() => openAdjust(c)}>
                                Adjust
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredCustomers.length === 0 && (
                      <p className="py-8 text-center text-gray-500">No customers found</p>
                    )}
                  </div>
                )}
                {!loading && (
                  <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{tx.party?.name || 'Customer'}</p>
                        <p className="text-xs text-gray-500">
                          {txnLabel(tx.transaction_type)}
                          {tx.reference_number ? ` · ${tx.reference_number}` : ''}
                          {tx.notes ? ` — ${tx.notes}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            tx.points >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600'
                          }
                        >
                          {tx.points >= 0 ? '+' : ''}
                          {tx.points.toLocaleString()} pts
                        </p>
                        <p className="text-xs text-gray-500">
                          Balance: {tx.balance_after.toLocaleString()} · {formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && !loading && (
                    <p className="py-8 text-center text-gray-500">No loyalty activity yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust points — {adjustCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Current balance:{' '}
              <strong>{(adjustCustomer?.loyalty_points ?? 0).toLocaleString()} points</strong>
            </p>
            <div className="space-y-2">
              <Label>Points change</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustPoints(String(-Math.abs(parseInt(adjustPoints, 10) || 100)))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  placeholder="e.g. 100 or -50"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustPoints(String(Math.abs(parseInt(adjustPoints, 10) || 100)))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">Use negative values to deduct points.</p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAdjust} disabled={adjusting}>
              {adjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
