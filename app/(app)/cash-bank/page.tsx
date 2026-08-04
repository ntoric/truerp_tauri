'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  PaymentMethodMapping,
  savePaymentMethodMappings,
  usePaymentMethodMappings,
} from '@/hooks/usePaymentMethodMappings'

const CASH_IN_HAND_VALUE = 'cash'

function accountIdForApi(selected: string): string | null {
  if (!selected || selected === CASH_IN_HAND_VALUE) return null
  return selected
}
import {
  IndianRupee,
  Plus,
  Minus,
  ArrowRightLeft,
  Building2,
  Download,
  Trash2,
  Edit,
  Filter,
  Calendar,
  Star,
} from 'lucide-react'

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
  bank_accounts: BankAccount[]
  unlinked_count: number
  unlinked_amount: number
}

export default function CashBankPage() {
  const { user, loading: authLoading } = useAuth()
  const [summary, setSummary] = useState<CashBankSummary | null>(null)
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [showReduceMoney, setShowReduceMoney] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [filterUnlinked, setFilterUnlinked] = useState(false)
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

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const row of paymentMethodMappings) {
      next[row.payment_method] = row.bank_account_id || CASH_IN_HAND_VALUE
    }
    setMappingAccounts(next)
  }, [paymentMethodMappings])

  useEffect(() => {
    if (!authLoading && user) {
      fetchData()
    }
  }, [authLoading, user, filterUnlinked, startDate, endDate])

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(transactions)

  useEffect(() => {
    resetPage()
  }, [filterUnlinked, startDate, endDate])

  const fetchData = async () => {
    try {
      const [summaryRes, transRes] = await Promise.all([
        apiFetch('/cash-bank/summary'),
        apiFetch(`/cash-bank/transactions?unlinked=${filterUnlinked}&start_date=${startDate}&end_date=${endDate}`),
      ])
      if (summaryRes.ok) setSummary(await summaryRes.json())
      if (transRes.ok) setTransactions(await transRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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
    if (!confirm('Are you sure you want to delete this account?')) return
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
        bank_account_id:
          mappingAccounts[row.payment_method] &&
          mappingAccounts[row.payment_method] !== CASH_IN_HAND_VALUE
            ? mappingAccounts[row.payment_method]
            : null,
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
    if (!confirm('Are you sure you want to delete this transaction?')) return
    try {
      const res = await apiFetch(`/cash-bank/transactions/${transactionId}`, { method: 'DELETE' })
      if (res.ok) fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleExport = () => {
    const csv = [
      ['Date', 'Type', 'Account', 'Amount', 'Description', 'Reference', 'Linked'].join(','),
      ...transactions.map(t => [
        formatDate(t.date),
        t.transaction_type,
        t.account?.account_name || 'Cash',
        t.amount,
        t.description,
        t.reference,
        t.is_linked ? 'Yes' : 'No',
      ].join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cash-bank-transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      add: 'bg-green-100 text-green-700',
      reduce: 'bg-red-100 text-red-700',
      transfer_in: 'bg-blue-100 text-blue-700',
      transfer_out: 'bg-orange-100 text-orange-700',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[type] || 'bg-gray-100 text-gray-700'}`}>{type.replace('_', ' ')}</span>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cash & Bank</h1>
            <p className="text-sm text-gray-500">Manage your cash and bank accounts</p>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Balance</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{formatCurrency(summary?.total_balance || 0)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <IndianRupee className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Cash in-hand</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{formatCurrency(summary?.cash_in_hand || 0)}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <IndianRupee className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Bank Accounts</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{summary?.bank_accounts.length || 0}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Unlinked Transactions</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{summary?.unlinked_count || 0}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(summary?.unlinked_amount || 0)}</p>
                </div>
                <div className="rounded-lg bg-orange-50 p-3">
                  <Filter className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bank Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.bank_accounts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No bank accounts yet. Add one to get started.</p>
            ) : (
              <div className="space-y-4">
                {summary?.bank_accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-blue-50 p-3">
                        <Building2 className="h-6 w-6 text-blue-600" />
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
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(account.balance)}</p>
                        <p className="text-xs text-gray-500">Balance</p>
                      </div>
                      <Button
                        variant={account.is_primary ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => handleSetPrimary(account.id)}
                        disabled={account.is_primary}
                        title="Set as primary account for sales & purchases"
                      >
                        <Star className={`h-4 w-4 mr-1 ${account.is_primary ? 'fill-amber-500 text-amber-500' : ''}`} />
                        {account.is_primary ? 'Primary' : 'Set Primary'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAccount(account.id)}
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payment method accounts</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Map each payment method used in Sales, Purchase, and POS to a Cash &amp; Bank account.
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
                      <p className="text-xs text-gray-500">{row.payment_method}</p>
                    </div>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-auto"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              <Button
                variant={filterUnlinked ? "default" : "outline"}
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
            <div className="overflow-x-auto">
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
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((trans) => (
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
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTransaction(trans.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
