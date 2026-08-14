'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { accountingExportDateStamp, downloadBlob, downloadCsv, downloadJson, rowsToCsv } from '@/lib/accountingExport'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import JSZip from 'jszip'
import { Plus, Trash2, Info, BookOpen, CheckCircle, Eye, Download, MoreVertical, BarChart3, ChevronDown, ChevronUp, CircleHelp } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import PageHeaderActions from '@/components/layout/PageHeaderActions'

interface Account {
  id: string
  code: string
  name: string
  account_type: string
  balance: number
  is_default: boolean
}

interface JournalEntryLine {
  id: string
  account_id: string
  debit: number
  credit: number
  description: string
  account?: Account
}

interface JournalEntry {
  id: string
  entry_number: string
  entry_date: string
  description: string
  total_debit: number
  total_credit: number
  status: string
  lines?: JournalEntryLine[]
}

interface TrialBalanceItem {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  debit: number
  credit: number
}

interface PLItem {
  account_id: string
  account_code: string
  account_name: string
  amount: number
}

interface ProfitLoss {
  income: PLItem[]
  expenses: PLItem[]
  total_income: number
  total_expense: number
  net_profit: number
}

interface BSItem {
  account_code: string
  account_name: string
  account_type: string
  amount: number
}

interface BalanceSheet {
  assets: BSItem[]
  liabilities: BSItem[]
  equity: BSItem[]
  total_assets: number
  total_liabilities: number
  total_equity: number
  total_liabilities_equity: number
  is_balanced: boolean
}

interface LedgerEntry {
  id: string
  account_id: string
  transaction_date: string
  transaction_type: string
  reference_number: string
  description: string
  debit: number
  credit: number
  balance: number
  account?: Account
}

interface BankReconciliation {
  id: string
  bank_account_id: string
  statement_date: string
  statement_balance: number
  book_balance: number
  difference: number
  status: string
  notes: string
}

interface JournalLineForm {
  account_id: string
  debit: string
  credit: string
  description: string
}

const emptyJournalLine = (): JournalLineForm => ({
  account_id: '',
  debit: '',
  credit: '',
  description: '',
})

function ExportActions({
  onCsv,
  onJson,
}: {
  onCsv: () => void | Promise<void>
  onJson: () => void | Promise<void>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void onCsv()
          }}
        >
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void onJson()
          }}
        >
          Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function AccountingPage() {
  const { user, loading: authLoading } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { accounts: bankAccounts, refresh: refreshBankAccounts } = useBankAccounts()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [trialBalance, setTrialBalance] = useState<TrialBalanceItem[]>([])
  const [trialTotals, setTrialTotals] = useState({ debit: 0, credit: 0, balanced: true })
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [generalLedger, setGeneralLedger] = useState<{
    opening_balance: number
    closing_balance: number
    entries: LedgerEntry[]
    account?: Account
  } | null>(null)
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([])

  const accountsPagination = usePagination(accounts)
  const journalPagination = usePagination(journalEntries)
  const ledgerPagination = usePagination(ledgerEntries)
  const generalLedgerPagination = usePagination(generalLedger?.entries ?? [])
  const trialBalancePagination = usePagination(trialBalance)
  const plIncomePagination = usePagination(profitLoss?.income ?? [])
  const plExpensesPagination = usePagination(profitLoss?.expenses ?? [])
  const bsAssetsPagination = usePagination(balanceSheet?.assets ?? [])
  const bsLiabilitiesPagination = usePagination(balanceSheet?.liabilities ?? [])
  const bsEquityPagination = usePagination(balanceSheet?.equity ?? [])
  const reconciliationsPagination = usePagination(reconciliations)

  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [journalDialogOpen, setJournalDialogOpen] = useState(false)
  const [reconDialogOpen, setReconDialogOpen] = useState(false)
  const [viewJournal, setViewJournal] = useState<JournalEntry | null>(null)

  const [accountForm, setAccountForm] = useState({ name: '', account_type: 'asset', opening_balance: 0 })
  const [journalForm, setJournalForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [emptyJournalLine(), emptyJournalLine()] as JournalLineForm[],
  })
  const [reconForm, setReconForm] = useState({
    bank_account_id: '',
    statement_date: new Date().toISOString().split('T')[0],
    statement_balance: '',
    notes: '',
  })

  const [ledgerAccountFilter, setLedgerAccountFilter] = useState('')
  const [ledgerFromDate, setLedgerFromDate] = useState('')
  const [ledgerToDate, setLedgerToDate] = useState('')
  const [glAccountId, setGlAccountId] = useState('')
  const [glFromDate, setGlFromDate] = useState('')
  const [glToDate, setGlToDate] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [selectedJournals, setSelectedJournals] = useState<Set<string>>(new Set())
  const [selectedReconciliations, setSelectedReconciliations] = useState<Set<string>>(new Set())

  const journalLineTotals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const line of journalForm.lines) {
      debit += parseFloat(line.debit) || 0
      credit += parseFloat(line.credit) || 0
    }
    return { debit, credit, balanced: debit === credit && debit > 0 }
  }, [journalForm.lines])

  const fetchCore = useCallback(async () => {
    const [a, j, tb, pl, bs, recon] = await Promise.all([
      apiFetch('/accounting/accounts'),
      apiFetch('/accounting/journal'),
      apiFetch('/accounting/trial-balance'),
      apiFetch('/accounting/profit-loss'),
      apiFetch('/accounting/balance-sheet'),
      apiFetch('/accounting/bank-reconciliation'),
    ])
    if (a.ok) setAccounts(await a.json())
    if (j.ok) {
      const d = await j.json()
      setJournalEntries(d.data || d)
    }
    if (tb.ok) {
      const data = await tb.json()
      setTrialBalance(data.items || [])
      setTrialTotals({
        debit: data.total_debit ?? 0,
        credit: data.total_credit ?? 0,
        balanced: data.is_balanced ?? true,
      })
    }
    if (pl.ok) setProfitLoss(await pl.json())
    if (bs.ok) setBalanceSheet(await bs.json())
    if (recon.ok) setReconciliations(await recon.json())
  }, [])

  const fetchLedgers = useCallback(async () => {
    const params = new URLSearchParams()
    if (ledgerAccountFilter) params.set('account_id', ledgerAccountFilter)
    if (ledgerFromDate) params.set('from_date', ledgerFromDate)
    if (ledgerToDate) params.set('to_date', ledgerToDate)
    const res = await apiFetch(`/accounting/ledgers?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setLedgerEntries(data.data || [])
    }
  }, [ledgerAccountFilter, ledgerFromDate, ledgerToDate])

  const fetchGeneralLedger = useCallback(async () => {
    if (!glAccountId) {
      setGeneralLedger(null)
      return
    }
    const params = new URLSearchParams()
    if (glFromDate) params.set('from_date', glFromDate)
    if (glToDate) params.set('to_date', glToDate)
    const res = await apiFetch(`/accounting/general-ledger/${glAccountId}?${params.toString()}`)
    if (res.ok) setGeneralLedger(await res.json())
  }, [glAccountId, glFromDate, glToDate])

  useEffect(() => {
    if (!authLoading && user) {
      setLoading(true)
      Promise.all([fetchCore(), refreshBankAccounts()])
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [authLoading, user, fetchCore, refreshBankAccounts])

  useEffect(() => {
    if (user) fetchLedgers()
  }, [user, fetchLedgers])

  useEffect(() => {
    if (user && glAccountId) fetchGeneralLedger()
  }, [user, glAccountId, fetchGeneralLedger])

  useEffect(() => {
    if (bankAccounts.length && !reconForm.bank_account_id) {
      const primary = bankAccounts.find((b) => b.is_primary) || bankAccounts[0]
      if (primary) setReconForm((f) => ({ ...f, bank_account_id: primary.id }))
    }
  }, [bankAccounts, reconForm.bank_account_id])

  const refreshAll = async () => {
    await fetchCore()
    await fetchLedgers()
    if (glAccountId) await fetchGeneralLedger()
  }

  const handleCreateAccount = async () => {
    const res = await apiFetch('/accounting/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountForm),
    })
    if (res.ok) {
      setAccountDialogOpen(false)
      setAccountForm({ name: '', account_type: 'asset', opening_balance: 0 })
      await refreshAll()
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!(await confirm({
      title: 'Delete account?',
      description: 'Are you sure you want to delete this account? This action cannot be undone.',
    }))) return
    const res = await apiFetch(`/accounting/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) await refreshAll()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to delete account')
    }
  }

  const handleCreateJournal = async () => {
    if (!journalLineTotals.balanced) {
      alert('Debits and credits must match and be greater than zero')
      return
    }
    const lines = journalForm.lines
      .filter((l) => l.account_id)
      .map((l) => ({
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
      }))
    const res = await apiFetch('/accounting/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_date: journalForm.entry_date,
        description: journalForm.description,
        lines,
      }),
    })
    if (res.ok) {
      setJournalDialogOpen(false)
      setJournalForm({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [emptyJournalLine(), emptyJournalLine()],
      })
      await refreshAll()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to create journal entry')
    }
  }

  const handlePostJournal = async (id: string) => {
    const res = await apiFetch(`/accounting/journal/${id}/post`, { method: 'POST' })
    if (res.ok) await refreshAll()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to post entry')
    }
  }

  const handleDeleteJournal = async (id: string) => {
    if (!(await confirm({
      title: 'Delete draft journal entry?',
      description: 'Are you sure you want to delete this draft journal entry? This action cannot be undone.',
    }))) return
    const res = await apiFetch(`/accounting/journal/${id}`, { method: 'DELETE' })
    if (res.ok) await refreshAll()
  }

  const openJournalDetail = async (id: string) => {
    const res = await apiFetch(`/accounting/journal/${id}`)
    if (res.ok) setViewJournal(await res.json())
  }

  const handleCreateReconciliation = async () => {
    const res = await apiFetch('/accounting/bank-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_account_id: reconForm.bank_account_id,
        statement_date: reconForm.statement_date,
        statement_balance: parseFloat(reconForm.statement_balance) || 0,
        notes: reconForm.notes,
      }),
    })
    if (res.ok) {
      setReconDialogOpen(false)
      setReconForm((f) => ({ ...f, statement_balance: '', notes: '' }))
      await refreshAll()
    }
  }

  const handleCompleteReconciliation = async (id: string) => {
    const res = await apiFetch(`/accounting/bank-reconciliation/${id}/complete`, { method: 'PUT' })
    if (res.ok) await refreshAll()
  }

  const toggleSelectAccount = (id: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllAccounts = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set())
    } else {
      setSelectedAccounts(new Set(accounts.map(a => a.id)))
    }
  }

  const handleBulkDeleteAccounts = async () => {
    const eligible = accounts.filter(a => selectedAccounts.has(a.id) && !a.is_default)
    if (eligible.length === 0) return
    if (!(await confirm({
      title: `Delete ${eligible.length} account(s)?`,
      description: `Are you sure you want to delete ${eligible.length} account(s)? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        eligible.map(a => apiFetch(`/accounting/accounts/${a.id}`, { method: 'DELETE' }))
      )
      setSelectedAccounts(new Set())
      await refreshAll()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkExportAccounts = async () => {
    const selected = accounts.filter(a => selectedAccounts.has(a.id))
    await downloadCsv(`selected-accounts-${exportStamp}.csv`, [
      ['Code', 'Name', 'Type', 'Balance'],
      ...selected.map(a => [a.code, a.name, a.account_type, a.balance]),
    ], { label: 'Exporting selected accounts' })
    notifyExported('Selected accounts')
  }

  const toggleSelectJournal = (id: string) => {
    setSelectedJournals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllJournals = () => {
    if (selectedJournals.size === journalEntries.length) {
      setSelectedJournals(new Set())
    } else {
      setSelectedJournals(new Set(journalEntries.map(j => j.id)))
    }
  }

  const handleBulkPostJournals = async () => {
    const eligible = journalEntries.filter(j => selectedJournals.has(j.id) && j.status === 'draft')
    if (eligible.length === 0) return
    try {
      await Promise.all(
        eligible.map(j => apiFetch(`/accounting/journal/${j.id}/post`, { method: 'POST' }))
      )
      setSelectedJournals(new Set())
      await refreshAll()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkDeleteJournals = async () => {
    const eligible = journalEntries.filter(j => selectedJournals.has(j.id) && j.status === 'draft')
    if (eligible.length === 0) return
    if (!(await confirm({
      title: `Delete ${eligible.length} draft journal entr${eligible.length === 1 ? 'y' : 'ies'}?`,
      description: `Are you sure you want to delete ${eligible.length} draft journal entr${eligible.length === 1 ? 'y' : 'ies'}? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        eligible.map(j => apiFetch(`/accounting/journal/${j.id}`, { method: 'DELETE' }))
      )
      setSelectedJournals(new Set())
      await refreshAll()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkExportJournals = async () => {
    const selected = journalEntries.filter(j => selectedJournals.has(j.id))
    const rows: (string | number)[][] = [
      ['Entry Number', 'Entry Date', 'Description', 'Status', 'Debit', 'Credit'],
    ]
    for (const j of selected) {
      rows.push([j.entry_number, j.entry_date, j.description, j.status, j.total_debit, j.total_credit])
    }
    await downloadCsv(`selected-journal-entries-${exportStamp}.csv`, rows, {
      label: 'Exporting selected journals',
    })
    notifyExported('Selected journal entries')
  }

  const toggleSelectReconciliation = (id: string) => {
    setSelectedReconciliations(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllReconciliations = () => {
    if (selectedReconciliations.size === reconciliations.length) {
      setSelectedReconciliations(new Set())
    } else {
      setSelectedReconciliations(new Set(reconciliations.map(r => r.id)))
    }
  }

  const handleBulkCompleteReconciliations = async () => {
    const eligible = reconciliations.filter(r => selectedReconciliations.has(r.id) && r.status === 'draft')
    if (eligible.length === 0) return
    try {
      await Promise.all(
        eligible.map(r => apiFetch(`/accounting/bank-reconciliation/${r.id}/complete`, { method: 'PUT' }))
      )
      setSelectedReconciliations(new Set())
      await refreshAll()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkExportReconciliations = async () => {
    const selected = reconciliations.filter(r => selectedReconciliations.has(r.id))
    await downloadCsv(`selected-bank-reconciliation-${exportStamp}.csv`, [
      ['Statement Date', 'Bank Account', 'Statement Balance', 'Book Balance', 'Difference', 'Status', 'Notes'],
      ...selected.map(r => [
        r.statement_date,
        bankAccountName(r.bank_account_id),
        r.statement_balance,
        r.book_balance,
        r.difference,
        r.status,
        r.notes,
      ]),
    ], { label: 'Exporting reconciliations' })
    notifyExported('Selected reconciliations')
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'text-blue-600',
      liability: 'text-red-600',
      income: 'text-green-600',
      expense: 'text-orange-600',
      equity: 'text-purple-600',
    }
    return colors[type] || ''
  }

  const bankAccountName = (id: string) =>
    bankAccounts.find((b) => b.id === id)?.account_name || id.slice(0, 8)

  const exportStamp = accountingExportDateStamp()

  const chartOfAccountsCsvRows = (): (string | number)[][] => [
    ['Code', 'Name', 'Type', 'Balance'],
    ...accounts.map((a) => [a.code, a.name, a.account_type, a.balance]),
  ]

  const journalCsvRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [
      ['Entry Number', 'Entry Date', 'Entry Description', 'Status', 'Account', 'Debit', 'Credit', 'Line Description'],
    ]
    for (const j of journalEntries) {
      if (j.lines?.length) {
        for (const line of j.lines) {
          rows.push([
            j.entry_number,
            j.entry_date,
            j.description,
            j.status,
            line.account?.name || line.account_id,
            line.debit ?? 0,
            line.credit ?? 0,
            line.description || '',
          ])
        }
      } else {
        rows.push([
          j.entry_number,
          j.entry_date,
          j.description,
          j.status,
          '',
          j.total_debit,
          j.total_credit,
          '',
        ])
      }
    }
    return rows
  }

  const ledgerCsvRows = (): (string | number)[][] => [
    ['Date', 'Account', 'Transaction Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
    ...ledgerEntries.map((row) => [
      row.transaction_date,
      row.account?.name || '',
      row.transaction_type,
      row.reference_number,
      row.description,
      row.debit,
      row.credit,
      row.balance,
    ]),
  ]

  const generalLedgerCsvRows = (): (string | number)[][] => {
    const acct = generalLedger?.account
    const header = acct
      ? [[`Account: ${acct.code} — ${acct.name}`], [`Opening balance: ${generalLedger?.opening_balance ?? 0}`], []]
      : []
    return [
      ...header,
      ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
      ...(generalLedger?.entries || []).map((row) => [
        row.transaction_date,
        row.reference_number,
        row.description,
        row.debit,
        row.credit,
        row.balance,
      ]),
      [],
      ['Closing balance', '', '', '', '', generalLedger?.closing_balance ?? ''],
    ]
  }

  const trialBalanceCsvRows = (): (string | number)[][] => [
    ['Code', 'Account', 'Type', 'Debit', 'Credit'],
    ...trialBalance.map((row) => [row.account_code, row.account_name, row.account_type, row.debit, row.credit]),
    ['', '', 'Total', trialTotals.debit, trialTotals.credit],
  ]

  const profitLossCsvRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [['Section', 'Account', 'Amount']]
    for (const row of profitLoss?.income || []) {
      rows.push(['Income', row.account_name, row.amount])
    }
    rows.push(['', 'Total income', profitLoss?.total_income ?? 0])
    for (const row of profitLoss?.expenses || []) {
      rows.push(['Expense', row.account_name, row.amount])
    }
    rows.push(['', 'Total expenses', profitLoss?.total_expense ?? 0])
    rows.push(['', 'Net profit', profitLoss?.net_profit ?? 0])
    return rows
  }

  const balanceSheetCsvRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [['Section', 'Account', 'Amount']]
    for (const row of balanceSheet?.assets || []) {
      rows.push(['Assets', row.account_name, row.amount])
    }
    rows.push(['', 'Total assets', balanceSheet?.total_assets ?? 0])
    for (const row of balanceSheet?.liabilities || []) {
      rows.push(['Liabilities', row.account_name, row.amount])
    }
    rows.push(['', 'Total liabilities', balanceSheet?.total_liabilities ?? 0])
    for (const row of balanceSheet?.equity || []) {
      rows.push(['Equity', row.account_name, row.amount])
    }
    rows.push(['', 'Total equity', balanceSheet?.total_equity ?? 0])
    rows.push(['', 'Liabilities + equity', balanceSheet?.total_liabilities_equity ?? 0])
    return rows
  }

  const bankReconCsvRows = (): (string | number)[][] => [
    ['Statement Date', 'Bank Account', 'Statement Balance', 'Book Balance', 'Difference', 'Status', 'Notes'],
    ...reconciliations.map((r) => [
      r.statement_date,
      bankAccountName(r.bank_account_id),
      r.statement_balance,
      r.book_balance,
      r.difference,
      r.status,
      r.notes,
    ]),
  ]

  const notifyExported = (label: string) => notifySuccess(`${label} exported`)

  const exportAllAccountingZip = async () => {
    try {
      const zip = new JSZip()
      zip.file('chart-of-accounts.csv', rowsToCsv(chartOfAccountsCsvRows()))
      zip.file('journal-entries.csv', rowsToCsv(journalCsvRows()))
      zip.file('ledger.csv', rowsToCsv(ledgerCsvRows()))
      zip.file('trial-balance.csv', rowsToCsv(trialBalanceCsvRows()))
      zip.file('profit-and-loss.csv', rowsToCsv(profitLossCsvRows()))
      zip.file('balance-sheet.csv', rowsToCsv(balanceSheetCsvRows()))
      zip.file('bank-reconciliation.csv', rowsToCsv(bankReconCsvRows()))
      if (generalLedger?.account && generalLedger.entries.length >= 0) {
        const safe = generalLedger.account.code.replace(/[^a-zA-Z0-9-_]/g, '_')
        zip.file(`general-ledger-${safe}.csv`, rowsToCsv(generalLedgerCsvRows()))
      }
      zip.file(
        'summary.json',
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            accounts,
            journal_entries: journalEntries,
            ledger: ledgerEntries,
            trial_balance: { items: trialBalance, ...trialTotals },
            profit_loss: profitLoss,
            balance_sheet: balanceSheet,
            bank_reconciliations: reconciliations,
            general_ledger: generalLedger,
          },
          null,
          2
        )
      )
      const blob = await zip.generateAsync({ type: 'blob' })
      await downloadBlob(`accounting-export-${exportStamp}.zip`, blob, {
        label: 'Exporting accounting bundle',
      })
      notifyExported('Accounting bundle')
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'Export failed', 'Export failed')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Accounting</h1>
          <PageHeaderActions>
            <Button
              type="button"
              variant={showHelp ? 'secondary' : 'outline'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowHelp((prev) => !prev)}
              aria-expanded={showHelp}
              aria-controls="accounting-help"
              title={showHelp ? 'Hide help' : 'Show help'}
            >
              <CircleHelp className="h-4 w-4" />
              <span className="sr-only">Help</span>
            </Button>
            <Button
              type="button"
              variant={showStats ? 'secondary' : 'outline'}
              className="gap-1.5"
              onClick={() => setShowStats((prev) => !prev)}
              aria-expanded={showStats}
              aria-controls="accounting-stats"
            >
              <BarChart3 className="h-4 w-4" />
              Stats
              {showStats ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export all
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void exportAllAccountingZip()}>
                  Download ZIP (all reports)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setJournalDialogOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" /> Journal Entry
            </Button>
            <Button onClick={() => setAccountDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Account
            </Button>
          </PageHeaderActions>
        </div>

        {showStats && (
          <div id="accounting-stats" className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrency(balanceSheet?.total_assets ?? accounts.filter((a) => a.account_type === 'asset').reduce((s, a) => s + a.balance, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-red-600">
                  {formatCurrency(balanceSheet?.total_liabilities ?? accounts.filter((a) => a.account_type === 'liability').reduce((s, a) => s + a.balance, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">{formatCurrency(profitLoss?.total_income ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${(profitLoss?.net_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profitLoss?.net_profit ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showHelp && (
          <Card id="accounting-help" className="border-blue-100 bg-blue-50/50">
            <CardContent className="flex gap-3 pt-4 text-sm text-gray-700">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <p>
                Chart of accounts, journal entries, ledger, trial balance, P&amp;L, balance sheet, and bank reconciliation.
                Operational cash movements still live under Cash &amp; Bank; sales, purchases, and payments auto-post to the general ledger.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="accounts">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
            <TabsTrigger value="journal">Journal Entries</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="general-ledger">General Ledger</TabsTrigger>
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="pnl">Profit &amp; Loss</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="bank-recon">Bank Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Chart of accounts</CardTitle>
                <ExportActions
                  onCsv={async () => {
                    await downloadCsv(`chart-of-accounts-${exportStamp}.csv`, chartOfAccountsCsvRows())
                    notifyExported('Chart of accounts')
                  }}
                  onJson={async () => {
                    await downloadJson(`chart-of-accounts-${exportStamp}.json`, accounts)
                    notifyExported('Chart of accounts')
                  }}
                />
              </CardHeader>
              <CardContent className="p-0">
                {selectedAccounts.size > 0 && (
                  <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-2">
                    <span className="text-sm text-gray-600">{selectedAccounts.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExportAccounts}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteAccounts}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={accounts.length > 0 && selectedAccounts.size === accounts.length}
                          onCheckedChange={toggleSelectAllAccounts}
                        />
                      </TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsPagination.paginatedItems.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAccounts.has(a.id)}
                            onCheckedChange={() => toggleSelectAccount(a.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{a.code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>
                          <span className={`capitalize font-medium ${getTypeColor(a.account_type)}`}>{a.account_type}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(a.balance)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setGlAccountId(a.id)}>
                                <BookOpen className="mr-2 h-4 w-4" />
                                View Ledger
                              </DropdownMenuItem>
                              {!a.is_default && (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteAccount(a.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {accounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          No accounts
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={accountsPagination.page}
                  totalPages={accountsPagination.totalPages}
                  totalItems={accountsPagination.totalItems}
                  pageSize={accountsPagination.pageSize}
                  onPageChange={accountsPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Journal entries</CardTitle>
                <ExportActions
                  onCsv={async () => {
                    await downloadCsv(`journal-entries-${exportStamp}.csv`, journalCsvRows())
                    notifyExported('Journal entries')
                  }}
                  onJson={async () => {
                    await downloadJson(`journal-entries-${exportStamp}.json`, journalEntries)
                    notifyExported('Journal entries')
                  }}
                />
              </CardHeader>
              <CardContent className="p-0">
                {selectedJournals.size > 0 && (
                  <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-2">
                    <span className="text-sm text-gray-600">{selectedJournals.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExportJournals}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkPostJournals}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Post
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDeleteJournals}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={journalEntries.length > 0 && selectedJournals.size === journalEntries.length}
                          onCheckedChange={toggleSelectAllJournals}
                        />
                      </TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalPagination.paginatedItems.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedJournals.has(j.id)}
                            onCheckedChange={() => toggleSelectJournal(j.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{j.entry_number}</TableCell>
                        <TableCell>{formatDate(j.entry_date)}</TableCell>
                        <TableCell>{j.description}</TableCell>
                        <TableCell className="text-right">{formatCurrency(j.total_debit)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(j.total_credit)}</TableCell>
                        <TableCell>
                          <span className={`rounded px-2 py-1 text-xs ${j.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {j.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openJournalDetail(j.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              {j.status === 'draft' && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePostJournal(j.id)}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Post
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteJournal(j.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {journalEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                          No journal entries yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={journalPagination.page}
                  totalPages={journalPagination.totalPages}
                  totalItems={journalPagination.totalItems}
                  pageSize={journalPagination.pageSize}
                  onPageChange={journalPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-base">Ledger management</CardTitle>
                  <ExportActions
                    onCsv={async () => {
                      await downloadCsv(`ledger-${exportStamp}.csv`, ledgerCsvRows())
                      notifyExported('Ledger')
                    }}
                    onJson={async () => {
                      await downloadJson(`ledger-${exportStamp}.json`, ledgerEntries)
                      notifyExported('Ledger')
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <select
                    className="rounded border p-2 text-sm"
                    value={ledgerAccountFilter}
                    onChange={(e) => setLedgerAccountFilter(e.target.value)}
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={ledgerFromDate} onChange={(e) => setLedgerFromDate(e.target.value)} className="w-auto" />
                  <Input type="date" value={ledgerToDate} onChange={(e) => setLedgerToDate(e.target.value)} className="w-auto" />
                  <Button variant="outline" size="sm" onClick={() => fetchLedgers()}>
                    Apply
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerPagination.paginatedItems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.transaction_date)}</TableCell>
                        <TableCell>{row.account?.name || '—'}</TableCell>
                        <TableCell className="text-xs capitalize">{row.transaction_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="font-mono text-xs">{row.reference_number || '—'}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                    {ledgerEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                          No ledger entries — post transactions or journal entries to populate
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={ledgerPagination.page}
                  totalPages={ledgerPagination.totalPages}
                  totalItems={ledgerPagination.totalItems}
                  pageSize={ledgerPagination.pageSize}
                  onPageChange={ledgerPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general-ledger">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-base">General ledger (account statement)</CardTitle>
                  <ExportActions
                    onCsv={async () => {
                      if (!glAccountId) {
                        notifyError('Select an account first')
                        return
                      }
                      const code = generalLedger?.account?.code || 'account'
                      await downloadCsv(`general-ledger-${code}-${exportStamp}.csv`, generalLedgerCsvRows())
                      notifyExported('General ledger')
                    }}
                    onJson={async () => {
                      if (!glAccountId) {
                        notifyError('Select an account first')
                        return
                      }
                      await downloadJson(`general-ledger-${exportStamp}.json`, generalLedger)
                      notifyExported('General ledger')
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <select
                    className="min-w-[220px] rounded border p-2 text-sm"
                    value={glAccountId}
                    onChange={(e) => setGlAccountId(e.target.value)}
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={glFromDate} onChange={(e) => setGlFromDate(e.target.value)} className="w-auto" />
                  <Input type="date" value={glToDate} onChange={(e) => setGlToDate(e.target.value)} className="w-auto" />
                  <Button variant="outline" size="sm" onClick={() => fetchGeneralLedger()}>
                    Load
                  </Button>
                </div>
                {generalLedger?.account && (
                  <p className="mt-2 text-sm text-gray-600">
                    Opening: {formatCurrency(generalLedger.opening_balance)} · Closing:{' '}
                    {formatCurrency(generalLedger.closing_balance)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generalLedgerPagination.paginatedItems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.transaction_date)}</TableCell>
                        <TableCell className="font-mono text-xs">{row.reference_number || '—'}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                    {!glAccountId && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          Select an account to view its general ledger
                        </TableCell>
                      </TableRow>
                    )}
                    {glAccountId && generalLedger && generalLedger.entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          No entries in this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={generalLedgerPagination.page}
                  totalPages={generalLedgerPagination.totalPages}
                  totalItems={generalLedgerPagination.totalItems}
                  pageSize={generalLedgerPagination.pageSize}
                  onPageChange={generalLedgerPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trial-balance">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Trial balance</CardTitle>
                    {!trialTotals.balanced && (
                      <p className="mt-1 text-sm text-red-600">Warning: debits and credits do not match</p>
                    )}
                  </div>
                  <ExportActions
                    onCsv={async () => {
                      await downloadCsv(`trial-balance-${exportStamp}.csv`, trialBalanceCsvRows())
                      notifyExported('Trial balance')
                    }}
                    onJson={async () => {
                      await downloadJson(`trial-balance-${exportStamp}.json`, {
                        items: trialBalance,
                        total_debit: trialTotals.debit,
                        total_credit: trialTotals.credit,
                        is_balanced: trialTotals.balanced,
                      })
                      notifyExported('Trial balance')
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalancePagination.paginatedItems.map((row) => (
                      <TableRow key={row.account_id}>
                        <TableCell className="font-mono text-sm">{row.account_code}</TableCell>
                        <TableCell>{row.account_name}</TableCell>
                        <TableCell className="capitalize">{row.account_type}</TableCell>
                        <TableCell className="text-right">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-semibold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(trialTotals.debit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(trialTotals.credit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <PaginationControls
                  page={trialBalancePagination.page}
                  totalPages={trialBalancePagination.totalPages}
                  totalItems={trialBalancePagination.totalItems}
                  pageSize={trialBalancePagination.pageSize}
                  onPageChange={trialBalancePagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pnl">
            <div className="mb-4 flex justify-end">
              <ExportActions
                onCsv={async () => {
                  await downloadCsv(`profit-and-loss-${exportStamp}.csv`, profitLossCsvRows())
                  notifyExported('Profit & loss')
                }}
                onJson={async () => {
                  await downloadJson(`profit-and-loss-${exportStamp}.json`, profitLoss)
                  notifyExported('Profit & loss')
                }}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Income</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-0">
                  <Table>
                    <TableBody>
                      {(plIncomePagination.paginatedItems).map((row) => (
                        <TableRow key={row.account_id}>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell>Total income</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(profitLoss?.total_income ?? 0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={plIncomePagination.page}
                    totalPages={plIncomePagination.totalPages}
                    totalItems={plIncomePagination.totalItems}
                    pageSize={plIncomePagination.pageSize}
                    onPageChange={plIncomePagination.setPage}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Expenses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {(plExpensesPagination.paginatedItems).map((row) => (
                        <TableRow key={row.account_id}>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right text-orange-600">{formatCurrency(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell>Total expenses</TableCell>
                        <TableCell className="text-right text-orange-600">{formatCurrency(profitLoss?.total_expense ?? 0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={plExpensesPagination.page}
                    totalPages={plExpensesPagination.totalPages}
                    totalItems={plExpensesPagination.totalItems}
                    pageSize={plExpensesPagination.pageSize}
                    onPageChange={plExpensesPagination.setPage}
                  />
                </CardContent>
              </Card>
            </div>
            <Card className="mt-4">
              <CardContent className="flex justify-between py-6 text-lg font-semibold">
                <span>Net profit</span>
                <span className={(profitLoss?.net_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(profitLoss?.net_profit ?? 0)}
                </span>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance-sheet">
            <div className="mb-4 flex justify-end">
              <ExportActions
                onCsv={async () => {
                  await downloadCsv(`balance-sheet-${exportStamp}.csv`, balanceSheetCsvRows())
                  notifyExported('Balance sheet')
                }}
                onJson={async () => {
                  await downloadJson(`balance-sheet-${exportStamp}.json`, balanceSheet)
                  notifyExported('Balance sheet')
                }}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assets</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {(bsAssetsPagination.paginatedItems).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell>Total assets</TableCell>
                        <TableCell className="text-right">{formatCurrency(balanceSheet?.total_assets ?? 0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <PaginationControls
                    page={bsAssetsPagination.page}
                    totalPages={bsAssetsPagination.totalPages}
                    totalItems={bsAssetsPagination.totalItems}
                    pageSize={bsAssetsPagination.pageSize}
                    onPageChange={bsAssetsPagination.setPage}
                  />
                </CardContent>
              </Card>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Liabilities</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {(bsLiabilitiesPagination.paginatedItems).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.account_name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell>Total liabilities</TableCell>
                          <TableCell className="text-right">{formatCurrency(balanceSheet?.total_liabilities ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={bsLiabilitiesPagination.page}
                      totalPages={bsLiabilitiesPagination.totalPages}
                      totalItems={bsLiabilitiesPagination.totalItems}
                      pageSize={bsLiabilitiesPagination.pageSize}
                      onPageChange={bsLiabilitiesPagination.setPage}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Equity</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {(bsEquityPagination.paginatedItems).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.account_name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold">
                          <TableCell>Total equity</TableCell>
                          <TableCell className="text-right">{formatCurrency(balanceSheet?.total_equity ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={bsEquityPagination.page}
                      totalPages={bsEquityPagination.totalPages}
                      totalItems={bsEquityPagination.totalItems}
                      pageSize={bsEquityPagination.pageSize}
                      onPageChange={bsEquityPagination.setPage}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Liabilities + equity: {formatCurrency(balanceSheet?.total_liabilities_equity ?? 0)}
              {balanceSheet && (
                <span className={balanceSheet.is_balanced ? ' ml-2 text-green-600' : ' ml-2 text-amber-600'}>
                  {balanceSheet.is_balanced ? '(balanced)' : '(check accounts)'}
                </span>
              )}
            </p>
          </TabsContent>

          <TabsContent value="bank-recon">
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <ExportActions
                onCsv={async () => {
                  await downloadCsv(`bank-reconciliation-${exportStamp}.csv`, bankReconCsvRows())
                  notifyExported('Bank reconciliation')
                }}
                onJson={async () => {
                  await downloadJson(`bank-reconciliation-${exportStamp}.json`, reconciliations)
                  notifyExported('Bank reconciliation')
                }}
              />
              <Button onClick={() => setReconDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New reconciliation
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {selectedReconciliations.size > 0 && (
                  <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-2">
                    <span className="text-sm text-gray-600">{selectedReconciliations.size} selected</span>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleBulkExportReconciliations}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Export
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkCompleteReconciliations}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Mark Reconciled
                      </Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={reconciliations.length > 0 && selectedReconciliations.size === reconciliations.length}
                          onCheckedChange={toggleSelectAllReconciliations}
                        />
                      </TableHead>
                      <TableHead>Statement date</TableHead>
                      <TableHead>Bank account</TableHead>
                      <TableHead className="text-right">Statement balance</TableHead>
                      <TableHead className="text-right">Book balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationsPagination.paginatedItems.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedReconciliations.has(r.id)}
                            onCheckedChange={() => toggleSelectReconciliation(r.id)}
                          />
                        </TableCell>
                        <TableCell>{formatDate(r.statement_date)}</TableCell>
                        <TableCell>{bankAccountName(r.bank_account_id)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.statement_balance)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.book_balance)}</TableCell>
                        <TableCell className={`text-right ${Math.abs(r.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(r.difference)}
                        </TableCell>
                        <TableCell>
                          <span className={`rounded px-2 py-1 text-xs ${r.status === 'reconciled' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {r.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleCompleteReconciliation(r.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Reconciled
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {reconciliations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                          No bank reconciliations yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={reconciliationsPagination.page}
                  totalPages={reconciliationsPagination.totalPages}
                  totalItems={reconciliationsPagination.totalItems}
                  pageSize={reconciliationsPagination.pageSize}
                  onPageChange={reconciliationsPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Account name</Label>
                <Input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Account type</Label>
                <select
                  className="w-full rounded border p-2"
                  value={accountForm.account_type}
                  onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Opening balance</Label>
                <Input
                  type="number"
                  value={accountForm.opening_balance}
                  onChange={(e) => setAccountForm({ ...accountForm, opening_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAccount}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={journalDialogOpen} onOpenChange={setJournalDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manual journal entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={journalForm.entry_date}
                    onChange={(e) => setJournalForm({ ...journalForm, entry_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={journalForm.description}
                    onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lines</Label>
                {journalForm.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <select
                      className="col-span-5 rounded border p-2 text-sm"
                      value={line.account_id}
                      onChange={(e) => {
                        const lines = [...journalForm.lines]
                        lines[idx] = { ...lines[idx], account_id: e.target.value }
                        setJournalForm({ ...journalForm, lines })
                      }}
                    >
                      <option value="">Account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      className="col-span-2"
                      placeholder="Debit"
                      type="number"
                      value={line.debit}
                      onChange={(e) => {
                        const lines = [...journalForm.lines]
                        lines[idx] = { ...lines[idx], debit: e.target.value, credit: e.target.value ? '' : lines[idx].credit }
                        setJournalForm({ ...journalForm, lines })
                      }}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Credit"
                      type="number"
                      value={line.credit}
                      onChange={(e) => {
                        const lines = [...journalForm.lines]
                        lines[idx] = { ...lines[idx], credit: e.target.value, debit: e.target.value ? '' : lines[idx].debit }
                        setJournalForm({ ...journalForm, lines })
                      }}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Memo"
                      value={line.description}
                      onChange={(e) => {
                        const lines = [...journalForm.lines]
                        lines[idx] = { ...lines[idx], description: e.target.value }
                        setJournalForm({ ...journalForm, lines })
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="col-span-1"
                      disabled={journalForm.lines.length <= 2}
                      onClick={() => setJournalForm({ ...journalForm, lines: journalForm.lines.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setJournalForm({ ...journalForm, lines: [...journalForm.lines, emptyJournalLine()] })}
                >
                  Add line
                </Button>
                <p className={`text-sm ${journalLineTotals.balanced ? 'text-green-600' : 'text-red-600'}`}>
                  Debit {formatCurrency(journalLineTotals.debit)} · Credit {formatCurrency(journalLineTotals.credit)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJournalDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateJournal} disabled={!journalLineTotals.balanced}>
                Save draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewJournal} onOpenChange={() => setViewJournal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{viewJournal?.entry_number}</DialogTitle>
            </DialogHeader>
            {viewJournal && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {formatDate(viewJournal.entry_date)} · {viewJournal.description} · {viewJournal.status}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewJournal.lines || []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.account?.name || line.account_id}</TableCell>
                        <TableCell className="text-right">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</TableCell>
                        <TableCell className="text-right">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={reconDialogOpen} onOpenChange={setReconDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bank reconciliation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Bank account</Label>
                <select
                  className="w-full rounded border p-2"
                  value={reconForm.bank_account_id}
                  onChange={(e) => setReconForm({ ...reconForm, bank_account_id: e.target.value })}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.account_name} ({formatCurrency(b.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Statement date</Label>
                <Input
                  type="date"
                  value={reconForm.statement_date}
                  onChange={(e) => setReconForm({ ...reconForm, statement_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Statement balance</Label>
                <Input
                  type="number"
                  value={reconForm.statement_balance}
                  onChange={(e) => setReconForm({ ...reconForm, statement_balance: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={reconForm.notes} onChange={(e) => setReconForm({ ...reconForm, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReconDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReconciliation}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
