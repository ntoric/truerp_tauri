'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadCsv } from '@/lib/accountingExport'
import { notifyError, notifySuccess } from '@/lib/notify'
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  PaymentMethodMapping,
  savePaymentMethodMappings,
  usePaymentMethodMappings,
} from '@/hooks/usePaymentMethodMappings'
import {
  IndianRupee,
  Plus,
  Minus,
  ArrowRightLeft,
  Building2,
  Download,
  Trash2,
  Filter,
  Calendar,
  Star,
  List,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Landmark,
  Banknote,
} from 'lucide-react'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import { isSuperAdmin } from '@/lib/roles'
import { isInitialInvestmentMethod } from '@/lib/paymentSplits'

const CASH_IN_HAND_VALUE = 'cash'
const OWNER_EQUITY_VALUE = 'owner_equity'

type CashBankPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'year' | 'custom'

const PERIOD_OPTIONS: { value: CashBankPeriod; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
]

const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Preset periods resolve to a concrete [start, end] range; 'all'/'custom' return empty.
function periodDateRange(period: CashBankPeriod): { start: string; end: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayStr = toDateInput(today)
  switch (period) {
    case 'today':
      return { start: todayStr, end: todayStr }
    case 'yesterday': {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const s = toDateInput(d)
      return { start: s, end: s }
    }
    case 'week': {
      const day = today.getDay() === 0 ? 7 : today.getDay()
      const start = new Date(today)
      start.setDate(start.getDate() - (day - 1))
      return { start: toDateInput(start), end: todayStr }
    }
    case 'month':
      return { start: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayStr }
    case 'last_month':
      return {
        start: toDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        end: toDateInput(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
    case 'year':
      return { start: toDateInput(new Date(today.getFullYear(), 0, 1)), end: todayStr }
    default:
      return { start: '', end: '' }
  }
}

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'add', label: 'Add' },
  { value: 'reduce', label: 'Reduce' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'expense', label: 'Expense' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'profit_distribution', label: 'Profit Distribution' },
]

function accountIdForApi(selected: string): string | null {
  if (!selected || selected === CASH_IN_HAND_VALUE || selected === OWNER_EQUITY_VALUE) return null
  return selected
}

interface BankAccount {
  id: string
  account_name: string
  account_number: string
  bank_name: string
  ifsc_code: string
  account_type: string
  opening_balance: number
  balance: number
  is_active: boolean
  is_primary: boolean
  notes: string
}

interface CashTransaction {
  id: string
  account_id: string | null
  account: BankAccount | null
  transaction_type: string
  amount: number
  date: string
  description: string
  reference: string
  is_linked: boolean
}

interface CashBankSummary {
  total_balance: number
  cash_in_hand: number
  initial_investment: number
  bank_accounts: BankAccount[]
  unlinked_count: number
  unlinked_amount: number
  cash_net_change: number
  bank_net_change: number
}

export default function CashBankPage() {
  const { user, loading: authLoading } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const canDeleteTransactions = isSuperAdmin(user?.role)
  const [summary, setSummary] = useState<CashBankSummary | null>(null)
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [showReduceMoney, setShowReduceMoney] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [filterUnlinked, setFilterUnlinked] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterAccount, setFilterAccount] = useState('all')
  const [period, setPeriod] = useState<CashBankPeriod>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [addMoneyAccountId, setAddMoneyAccountId] = useState(CASH_IN_HAND_VALUE)
  const [reduceMoneyAccountId, setReduceMoneyAccountId] = useState(CASH_IN_HAND_VALUE)
  const [transferFromAccountId, setTransferFromAccountId] = useState('')
  const [transferToAccountId, setTransferToAccountId] = useState('')
  const [newAccountType, setNewAccountType] = useState('savings')
  const { mappings: paymentMethodMappings, refresh: refreshPaymentMappings } = usePaymentMethodMappings()
  const [mappingAccounts, setMappingAccounts] = useState<Record<string, string>>({})
  const [savingMappings, setSavingMappings] = useState(false)
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'settings'>('accounts')
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const row of paymentMethodMappings) {
      next[row.payment_method] = isInitialInvestmentMethod(row.payment_method)
        ? OWNER_EQUITY_VALUE
        : row.bank_account_id || CASH_IN_HAND_VALUE
    }
    setMappingAccounts(next)
  }, [paymentMethodMappings])

  const [page, setPage] = useState(1)
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [transactionsTotalIn, setTransactionsTotalIn] = useState(0)
  const [transactionsTotalOut, setTransactionsTotalOut] = useState(0)
  const pageSize = DEFAULT_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(transactionsTotal / pageSize))

  useEffect(() => {
    if (!authLoading && user) {
      fetchSummary()
    }
  }, [authLoading, user, startDate, endDate])

  useEffect(() => {
    if (!authLoading && user) {
      fetchTransactions()
    }
  }, [authLoading, user, filterUnlinked, filterType, filterAccount, startDate, endDate, page])

  useEffect(() => {
    setPage(1)
  }, [filterUnlinked, filterType, filterAccount, startDate, endDate])

  const buildTransactionParams = (targetPage: number, perPage: number) => {
    const params = new URLSearchParams()
    params.append('unlinked', String(filterUnlinked))
    if (filterType !== 'all') params.append('transaction_type', filterType)
    if (filterAccount !== 'all') params.append('account_id', filterAccount)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    params.append('page', String(targetPage))
    params.append('per_page', String(perPage))
    return params
  }

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const qs = params.toString()
      const res = await apiFetch(`/cash-bank/summary${qs ? `?${qs}` : ''}`)
      if (res.ok) setSummary(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchTransactions = async () => {
    try {
      const res = await apiFetch(`/cash-bank/transactions?${buildTransactionParams(page, pageSize).toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rows: CashTransaction[] = Array.isArray(data) ? data : data?.transactions ?? []
        const nextTotal = typeof data?.total === 'number' ? data.total : rows.length
        // The current page may no longer exist after deletions or filter changes.
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (page > maxPage) {
          setPage(maxPage)
          return
        }
        const moneyIn = (t: CashTransaction) =>
          t.transaction_type === 'add' || t.transaction_type === 'transfer_in'
        setTransactions(rows)
        setTransactionsTotal(nextTotal)
        setTransactionsTotalIn(
          typeof data?.total_in === 'number'
            ? data.total_in
            : rows.reduce((sum, t) => sum + (moneyIn(t) ? t.amount : 0), 0)
        )
        setTransactionsTotalOut(
          typeof data?.total_out === 'number'
            ? data.total_out
            : rows.reduce((sum, t) => sum + (moneyIn(t) ? 0 : t.amount), 0)
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = () => {
    fetchSummary()
    fetchTransactions()
  }

  const handlePeriodChange = (next: CashBankPeriod) => {
    setPeriod(next)
    if (next === 'custom') return
    const { start, end } = periodDateRange(next)
    setStartDate(start)
    setEndDate(end)
  }

  // Manual date edits flip the period to custom (or back to all when cleared).
  const applyDateRange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
    setPeriod(start || end ? 'custom' : 'all')
  }

  const handleAddMoney = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value)
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const description = (form.elements.namedItem('description') as HTMLInputElement).value
    const reference = (form.elements.namedItem('reference') as HTMLInputElement).value

    if (!amount || amount <= 0) {
      notifyError('Enter a valid amount')
      return
    }

    try {
      const res = await apiFetch('/cash-bank/transactions/add', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountIdForApi(addMoneyAccountId),
          amount,
          date: new Date(date).toISOString(),
          description,
          reference,
        }),
      })
      if (res.ok) {
        notifySuccess('Money added successfully')
        setShowAddMoney(false)
        setAddMoneyAccountId(CASH_IN_HAND_VALUE)
        fetchData()
        form.reset()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to add money')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to add money')
    }
  }

  const handleReduceMoney = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value)
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const description = (form.elements.namedItem('description') as HTMLInputElement).value
    const reference = (form.elements.namedItem('reference') as HTMLInputElement).value

    if (!amount || amount <= 0) {
      notifyError('Enter a valid amount')
      return
    }

    try {
      const res = await apiFetch('/cash-bank/transactions/reduce', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountIdForApi(reduceMoneyAccountId),
          amount,
          date: new Date(date).toISOString(),
          description,
          reference,
        }),
      })
      if (res.ok) {
        notifySuccess('Money reduced successfully')
        setShowReduceMoney(false)
        setReduceMoneyAccountId(CASH_IN_HAND_VALUE)
        fetchData()
        form.reset()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to reduce money')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to reduce money')
    }
  }

  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value)
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const description = (form.elements.namedItem('description') as HTMLInputElement).value
    const reference = (form.elements.namedItem('reference') as HTMLInputElement).value

    if (!transferFromAccountId || !transferToAccountId) {
      notifyError('Select both source and destination accounts')
      return
    }
    if (!amount || amount <= 0) {
      notifyError('Enter a valid amount')
      return
    }

    try {
      const res = await apiFetch('/cash-bank/transactions/transfer', {
        method: 'POST',
        body: JSON.stringify({
          from_account_id: transferFromAccountId,
          to_account_id: transferToAccountId,
          amount,
          date: new Date(date).toISOString(),
          description,
          reference,
        }),
      })
      if (res.ok) {
        notifySuccess('Transfer completed')
        setShowTransfer(false)
        setTransferFromAccountId('')
        setTransferToAccountId('')
        fetchData()
        form.reset()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to transfer money')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to transfer money')
    }
  }

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const account_name = (form.elements.namedItem('account_name') as HTMLInputElement).value
    const account_number = (form.elements.namedItem('account_number') as HTMLInputElement).value
    const bank_name = (form.elements.namedItem('bank_name') as HTMLInputElement).value
    const ifsc_code = (form.elements.namedItem('ifsc_code') as HTMLInputElement).value
    const account_type = newAccountType
    const opening_balance = parseFloat((form.elements.namedItem('opening_balance') as HTMLInputElement).value) || 0
    const notes = (form.elements.namedItem('notes') as HTMLInputElement).value

    try {
      const res = await apiFetch('/cash-bank/accounts', {
        method: 'POST',
        body: JSON.stringify({
          account_name,
          account_number,
          bank_name,
          ifsc_code,
          account_type,
          opening_balance,
          notes,
        }),
      })
      if (res.ok) {
        setShowAddAccount(false)
        fetchData()
        form.reset()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!(await confirm({
      title: 'Delete account?',
      description: 'Are you sure you want to delete this account? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/cash-bank/accounts/${accountId}`, { method: 'DELETE' })
      if (res.ok) fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSetPrimary = async (accountId: string) => {
    try {
      const res = await apiFetch(`/cash-bank/accounts/${accountId}/set-primary`, { method: 'PUT' })
      if (res.ok) fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSavePaymentMappings = async () => {
    setSavingMappings(true)
    try {
      const payload = paymentMethodMappings.map((row: PaymentMethodMapping) => ({
        payment_method: row.payment_method,
        bank_account_id: isInitialInvestmentMethod(row.payment_method)
          ? null
          : accountIdForApi(mappingAccounts[row.payment_method] || CASH_IN_HAND_VALUE),
      }))
      const res = await savePaymentMethodMappings(payload)
      if (res.ok) {
        notifySuccess('Payment method accounts saved')
        refreshPaymentMappings()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to save mappings')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to save mappings')
    } finally {
      setSavingMappings(false)
    }
  }

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!(await confirm({
      title: 'Delete transaction?',
      description: 'Are you sure you want to delete this transaction? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/cash-bank/transactions/${transactionId}`, { method: 'DELETE' })
      if (res.ok) fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExport = async () => {
    try {
      // Export every transaction matching the active filters, not just this page.
      const res = await apiFetch(
        `/cash-bank/transactions?${buildTransactionParams(1, 0).toString()}`,
        { timeoutMs: 30000 }
      )
      if (!res.ok) {
        notifyError('Failed to export transactions')
        return
      }
      const data = await res.json()
      const exportRows: CashTransaction[] = Array.isArray(data) ? data : data?.transactions ?? []
      await downloadCsv(
        `cash-bank-transactions-${accountingExportDateStamp()}.csv`,
        [
          ['Date', 'Type', 'Account', 'Amount', 'Description', 'Reference', 'Linked'],
          ...exportRows.map((t) => [
            formatDate(t.date),
            t.transaction_type,
            t.account?.account_name || 'Cash',
            t.amount,
            t.description,
            t.reference,
            t.is_linked ? 'Yes' : 'No',
          ]),
        ],
        { label: 'Exporting cash & bank' }
      )
      notifySuccess('Transactions exported')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export transactions')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  // In/out totals come from the server and cover the whole filtered set.
  const filteredTotalIn = transactionsTotalIn
  const filteredTotalOut = transactionsTotalOut
  const filteredNetTotal = filteredTotalIn - filteredTotalOut
  const cashInBank = (summary?.bank_accounts || []).reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const periodActive = startDate !== '' || endDate !== ''
  const netChangeInPeriod = (summary?.cash_net_change || 0) + (summary?.bank_net_change || 0)
  const formatSigned = (v: number) => `${v > 0 ? '+' : ''}${formatCurrency(v)}`

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      add: 'bg-green-100 text-green-700',
      reduce: 'bg-red-100 text-red-700',
      transfer_in: 'bg-blue-100 text-blue-700',
      transfer_out: 'bg-orange-100 text-orange-700',
      payroll: 'bg-violet-100 text-violet-700',
      expense: 'bg-amber-100 text-amber-700',
      profit_distribution: 'bg-teal-100 text-teal-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[type] || 'bg-gray-100 text-gray-700'}`}>{type.replace('_', ' ')}</span>
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Cash & Bank</h1>
          </div>
          <PageHeaderActions>
            <Select value={period} onValueChange={(v) => handlePeriodChange(v as CashBankPeriod)}>
              <SelectTrigger className="w-[140px]" aria-label="Period filter">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => applyDateRange(e.target.value, endDate)}
                  className="w-auto"
                  aria-label="Start date"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => applyDateRange(startDate, e.target.value)}
                  className="w-auto"
                  aria-label="End date"
                />
              </div>
            )}
            <Button
              type="button"
              variant={showStats ? 'secondary' : 'outline'}
              className="gap-1.5"
              onClick={() => setShowStats((prev) => !prev)}
              aria-expanded={showStats}
              aria-controls="cash-bank-stats"
            >
              <BarChart3 className="h-4 w-4" />
              Stats
              {showStats ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Dialog
              open={showAddMoney}
              onOpenChange={(open) => {
                setShowAddMoney(open)
                if (!open) setAddMoneyAccountId(CASH_IN_HAND_VALUE)
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add Money
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Money</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddMoney} className="space-y-4">
                  <div>
                    <Label htmlFor="account_id">Account (Optional)</Label>
                    <Select value={addMoneyAccountId} onValueChange={setAddMoneyAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account or cash in-hand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CASH_IN_HAND_VALUE}>Cash in-hand</SelectItem>
                        {summary?.bank_accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_name} - {acc.bank_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input name="amount" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input name="description" />
                  </div>
                  <div>
                    <Label htmlFor="reference">Reference</Label>
                    <Input name="reference" />
                  </div>
                  <Button type="submit" className="w-full">Add Money</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={showReduceMoney}
              onOpenChange={(open) => {
                setShowReduceMoney(open)
                if (!open) setReduceMoneyAccountId(CASH_IN_HAND_VALUE)
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Minus className="h-4 w-4" /> Reduce Money
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reduce Money</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleReduceMoney} className="space-y-4">
                  <div>
                    <Label htmlFor="account_id">Account (Optional)</Label>
                    <Select value={reduceMoneyAccountId} onValueChange={setReduceMoneyAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account or cash in-hand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CASH_IN_HAND_VALUE}>Cash in-hand</SelectItem>
                        {summary?.bank_accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_name} - {acc.bank_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input name="amount" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input name="description" />
                  </div>
                  <div>
                    <Label htmlFor="reference">Reference</Label>
                    <Input name="reference" />
                  </div>
                  <Button type="submit" className="w-full">Reduce Money</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={showTransfer}
              onOpenChange={(open) => {
                setShowTransfer(open)
                if (!open) {
                  setTransferFromAccountId('')
                  setTransferToAccountId('')
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowRightLeft className="h-4 w-4" /> Transfer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transfer Money</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTransfer} className="space-y-4">
                  <div>
                    <Label htmlFor="from_account_id">From Account</Label>
                    <Select value={transferFromAccountId} onValueChange={setTransferFromAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {summary?.bank_accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_name} - {acc.bank_name} ({formatCurrency(acc.balance)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="to_account_id">To Account</Label>
                    <Select value={transferToAccountId} onValueChange={setTransferToAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>
                        {summary?.bank_accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_name} - {acc.bank_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input name="amount" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input name="description" />
                  </div>
                  <div>
                    <Label htmlFor="reference">Reference</Label>
                    <Input name="reference" />
                  </div>
                  <Button type="submit" className="w-full">Transfer Money</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Building2 className="h-4 w-4" /> Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Bank Account</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div>
                    <Label htmlFor="account_name">Account Name</Label>
                    <Input name="account_name" required />
                  </div>
                  <div>
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input name="account_number" required />
                  </div>
                  <div>
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input name="bank_name" required />
                  </div>
                  <div>
                    <Label htmlFor="ifsc_code">IFSC Code</Label>
                    <Input name="ifsc_code" />
                  </div>
                  <div>
                    <Label htmlFor="account_type">Account Type</Label>
                    <Select value={newAccountType} onValueChange={setNewAccountType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="opening_balance">Opening Balance</Label>
                    <Input name="opening_balance" type="number" step="0.01" defaultValue={0} />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input name="notes" />
                  </div>
                  <Button type="submit" className="w-full">Add Account</Button>
                </form>
              </DialogContent>
            </Dialog>
          </PageHeaderActions>
        </div>

        {/* Summary Cards — 2 cols until xl so values aren't crushed beside the sidebar */}
        {showStats && (
        <div id="cash-bank-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <SummaryStat
            label="Total Balance"
            icon={IndianRupee}
            value={formatCurrency(summary?.total_balance || 0)}
            hint={periodActive ? `Net ${formatSigned(netChangeInPeriod)} in period` : undefined}
          />
          <SummaryStat
            tone="success"
            label="Cash in-hand"
            icon={IndianRupee}
            value={formatCurrency(summary?.cash_in_hand || 0)}
            hint={periodActive ? `Net ${formatSigned(summary?.cash_net_change || 0)} in period` : undefined}
          />
          <SummaryStat
            label="Cash in Bank"
            icon={Banknote}
            value={formatCurrency(cashInBank)}
            hint={periodActive ? `Net ${formatSigned(summary?.bank_net_change || 0)} in period` : undefined}
          />
          <SummaryStat tone="warning" label="Initial Investment" icon={Landmark} value={formatCurrency(summary?.initial_investment || 0)} hint="Capital investment" />
          <SummaryStat label="Bank Accounts" icon={Building2} value={summary?.bank_accounts.length || 0} />
          <div
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => {
              setActiveTab('transactions')
              setFilterUnlinked(true)
            }}
          >
            <SummaryStat
              tone="warning"
              label="Unlinked Transactions"
              icon={Filter}
              value={summary?.unlinked_count || 0}
              hint={formatCurrency(summary?.unlinked_amount || 0)}
            />
          </div>
        </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'accounts' | 'transactions' | 'settings')}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="accounts" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5">
              <List className="h-3.5 w-3.5" />
              Transactions
              {(summary?.unlinked_count || 0) > 0 && (
                <span className="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                  {summary?.unlinked_count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bank Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.bank_accounts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No bank accounts yet. Add one to get started.</p>
                ) : (
                  <div className="space-y-3">
                    {summary?.bank_accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                        title="View transactions for this account"
                        onClick={() => {
                          setFilterAccount(account.id)
                          setActiveTab('transactions')
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-blue-50 p-2.5">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{account.account_name}</p>
                              {account.is_primary && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{account.bank_name} - {account.account_type}</p>
                            <p className="text-xs text-gray-400">{account.account_number} | {account.ifsc_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-base font-bold text-gray-900">{formatCurrency(account.balance)}</p>
                            <p className="text-xs text-gray-500">Balance</p>
                          </div>
                          <Button
                            variant={account.is_primary ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSetPrimary(account.id)
                            }}
                            disabled={account.is_primary}
                            title="Set as primary account for sales & purchases"
                          >
                            <Star className={`h-4 w-4 mr-1 ${account.is_primary ? 'fill-amber-500 text-amber-500' : ''}`} />
                            {account.is_primary ? 'Primary' : 'Set Primary'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteAccount(account.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Account Transactions</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    Cash and bank movements across all accounts
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => applyDateRange(e.target.value, endDate)}
                      className="w-auto"
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => applyDateRange(startDate, e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      <SelectItem value={CASH_IN_HAND_VALUE}>Cash in-hand</SelectItem>
                      {summary?.bank_accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} - {acc.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {TRANSACTION_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={filterUnlinked ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterUnlinked(!filterUnlinked)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Unlinked Only
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Account</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium">Reference</th>
                        <th className="pb-3 font-medium">Linked</th>
                        {canDeleteTransactions && <th className="pb-3 font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((trans) => (
                        <tr key={trans.id} className="border-b last:border-0">
                          <td className="py-3 text-gray-600">{formatDate(trans.date)}</td>
                          <td className="py-3">{getTransactionTypeBadge(trans.transaction_type)}</td>
                          <td className="py-3 text-gray-600">{trans.account?.account_name || 'Cash in-hand'}</td>
                          <td className="py-3 font-medium text-gray-900">{formatCurrency(trans.amount)}</td>
                          <td className="py-3 text-gray-600">{trans.description || '-'}</td>
                          <td className="py-3 text-gray-600">{trans.reference || '-'}</td>
                          <td className="py-3">
                            {trans.is_linked ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Yes</span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">No</span>
                            )}
                          </td>
                          {canDeleteTransactions && (
                            <td className="py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTransaction(trans.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={canDeleteTransactions ? 8 : 7} className="py-8 text-center text-gray-500">
                            No transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {transactionsTotal > 0 && (
                      <tfoot>
                        <tr className="border-t bg-gray-50 font-semibold">
                          <td className="py-3 text-gray-700" colSpan={3}>
                            Total ({transactionsTotal}{' '}
                            {transactionsTotal === 1 ? 'transaction' : 'transactions'})
                          </td>
                          <td
                            className={`py-3 ${
                              filteredNetTotal >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {formatCurrency(filteredNetTotal)}
                          </td>
                          <td className="py-3 text-xs font-normal text-gray-500" colSpan={canDeleteTransactions ? 4 : 3}>
                            In {formatCurrency(filteredTotalIn)} · Out {formatCurrency(filteredTotalOut)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  totalItems={transactionsTotal}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Payment method accounts</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    Map each payment method used in Sales, Purchase, and POS to a Cash &amp; Bank account.
                    Initial Investment settles against Owner&apos;s Equity and does not change cash or bank balances.
                  </p>
                </div>
                <Button onClick={handleSavePaymentMappings} disabled={savingMappings || paymentMethodMappings.length === 0}>
                  {savingMappings ? 'Saving…' : 'Save mappings'}
                </Button>
              </CardHeader>
              <CardContent>
                {paymentMethodMappings.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading payment methods…</p>
                ) : (
                  <div className="space-y-3">
                    {paymentMethodMappings.map((row) => (
                      <div key={row.payment_method} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center border rounded-lg p-3">
                        <div>
                          <p className="font-medium text-gray-900">{row.label}</p>
                          <p className="text-xs text-gray-500">
                            {isInitialInvestmentMethod(row.payment_method)
                              ? 'Used for opening stock and capital contributions. Does not affect cash in-hand.'
                              : row.payment_method}
                          </p>
                        </div>
                        {isInitialInvestmentMethod(row.payment_method) ? (
                          <Select value={OWNER_EQUITY_VALUE} disabled>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={OWNER_EQUITY_VALUE}>
                                Owner&apos;s Equity — no cash movement
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={mappingAccounts[row.payment_method] ?? CASH_IN_HAND_VALUE}
                            onValueChange={(value) =>
                              setMappingAccounts((prev) => ({ ...prev, [row.payment_method]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={CASH_IN_HAND_VALUE}>Cash in-hand</SelectItem>
                              {summary?.bank_accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.account_name} — {acc.bank_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
