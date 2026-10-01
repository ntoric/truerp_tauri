'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useBankAccounts, type BankAccountOption } from '@/hooks/useBankAccounts'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import PageSkeleton from '@/components/layout/PageSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
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
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
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
  income_count?: number
  expenses_count?: number
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
  assets_count?: number
  liabilities_count?: number
  equity_count?: number
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

const ACCOUNTING_TABS = [
  'accounts',
  'journal',
  'ledger',
  'general-ledger',
  'trial-balance',
  'pnl',
  'balance-sheet',
  'bank-recon',
] as const
type AccountingTab = (typeof ACCOUNTING_TABS)[number]

const PAGE_SIZE = DEFAULT_PAGE_SIZE

interface PagedData<T> {
  items: T[]
  total: number
  page: number
}

const emptyPaged = <T,>(): PagedData<T> => ({ items: [], total: 0, page: 1 })

const totalPagesFor = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE))

interface AccountingStats {
  total_assets: number
  total_liabilities: number
  total_income: number
  total_expense: number
  net_profit: number
}

/** Pulsing placeholder rows rendered inside a <TableBody> while a tab fetches. */
function SkeletonTableRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** Skeleton matching the two/three-card report layouts (P&L, balance sheet). */
function ReportCardsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function AccountingPage() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<AccountingTab>(
    (ACCOUNTING_TABS as readonly string[]).includes(requestedTab ?? '')
      ? (requestedTab as AccountingTab)
      : 'accounts'
  )
  const { confirm, confirmDialog } = useConfirmDialog()
  // Bank accounts are only needed on the bank-recon tab; the hook fetches lazily.
  const { accounts: bankAccounts } = useBankAccounts({ enabled: activeTab === 'bank-recon' })

  // Server-paginated tab data — each slice is fetched on demand when its tab
  // is opened; `page`/`total` mirror the server response.
  const [accountsData, setAccountsData] = useState<PagedData<Account>>(emptyPaged)
  const [journalData, setJournalData] = useState<PagedData<JournalEntry>>(emptyPaged)
  const [ledgerData, setLedgerData] = useState<PagedData<LedgerEntry>>(emptyPaged)
  const [reconData, setReconData] = useState<PagedData<BankReconciliation>>(emptyPaged)
  const [trialBalance, setTrialBalance] = useState<PagedData<TrialBalanceItem>>(emptyPaged)
  const [trialTotals, setTrialTotals] = useState({ debit: 0, credit: 0, balanced: true })
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null)
  const [plIncomePage, setPlIncomePage] = useState(1)
  const [plExpensePage, setPlExpensePage] = useState(1)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [bsAssetsPage, setBsAssetsPage] = useState(1)
  const [bsLiabilitiesPage, setBsLiabilitiesPage] = useState(1)
  const [bsEquityPage, setBsEquityPage] = useState(1)
  const [generalLedger, setGeneralLedger] = useState<{
    opening_balance: number
    closing_balance: number
    entries: LedgerEntry[]
    account?: Account
    total: number
  } | null>(null)
  const [glPage, setGlPage] = useState(1)
  // Full chart of accounts, fetched lazily for dropdowns and the journal dialog.
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const allAccountsStatus = useRef<'idle' | 'loading' | 'loaded'>('idle')
  const [stats, setStats] = useState<AccountingStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsKey, setStatsKey] = useState(0)
  const [loadingTabs, setLoadingTabs] = useState<Partial<Record<AccountingTab, boolean>>>({})
  const [reloadKey, setReloadKey] = useState(0)

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

  // Full account list for dropdowns — fetched once, on first need.
  const ensureAllAccounts = useCallback(async (force = false) => {
    if (!force && allAccountsStatus.current !== 'idle') return
    allAccountsStatus.current = 'loading'
    try {
      const res = await apiFetch('/accounting/accounts')
      if (res.ok) {
        const d = await res.json()
        setAllAccounts(Array.isArray(d) ? d : d.data ?? [])
      }
      allAccountsStatus.current = 'loaded'
    } catch (err) {
      allAccountsStatus.current = 'idle'
      console.error(err)
    }
  }, [])

  const fetchAccountsPage = useCallback(async (page: number) => {
    setLoadingTabs((prev) => ({ ...prev, accounts: true }))
    try {
      const res = await apiFetch(`/accounting/accounts?page=${page}&per_page=${PAGE_SIZE}`)
      if (res.ok) {
        const d = await res.json()
        const items: Account[] = Array.isArray(d) ? d : d.data ?? []
        const total = d.total ?? items.length
        const maxPage = totalPagesFor(total)
        if (page > maxPage) setAccountsData((p) => ({ ...p, page: maxPage }))
        else setAccountsData({ items, total, page })
      } else {
        notifyError('Failed to load accounts')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load accounts')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, accounts: false }))
    }
  }, [])

  const fetchJournalPage = useCallback(async (page: number) => {
    setLoadingTabs((prev) => ({ ...prev, journal: true }))
    try {
      const res = await apiFetch(`/accounting/journal?page=${page}&per_page=${PAGE_SIZE}`)
      if (res.ok) {
        const d = await res.json()
        const items: JournalEntry[] = d.data ?? []
        const total = d.total ?? items.length
        const maxPage = totalPagesFor(total)
        if (page > maxPage) setJournalData((p) => ({ ...p, page: maxPage }))
        else setJournalData({ items, total, page })
      } else {
        notifyError('Failed to load journal entries')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load journal entries')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, journal: false }))
    }
  }, [])

  const fetchLedgerPage = useCallback(async (page: number) => {
    setLoadingTabs((prev) => ({ ...prev, ledger: true }))
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) })
      if (ledgerAccountFilter) params.set('account_id', ledgerAccountFilter)
      if (ledgerFromDate) params.set('from_date', ledgerFromDate)
      if (ledgerToDate) params.set('to_date', ledgerToDate)
      const res = await apiFetch(`/accounting/ledgers?${params.toString()}`)
      if (res.ok) {
        const d = await res.json()
        const items: LedgerEntry[] = d.data ?? []
        const total = d.total ?? items.length
        const maxPage = totalPagesFor(total)
        if (page > maxPage) setLedgerData((p) => ({ ...p, page: maxPage }))
        else setLedgerData({ items, total, page })
      } else {
        notifyError('Failed to load ledger entries')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load ledger entries')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, ledger: false }))
    }
  }, [ledgerAccountFilter, ledgerFromDate, ledgerToDate])

  const fetchGeneralLedger = useCallback(async (page: number) => {
    if (!glAccountId) {
      setGeneralLedger(null)
      return
    }
    setLoadingTabs((prev) => ({ ...prev, 'general-ledger': true }))
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) })
      if (glFromDate) params.set('from_date', glFromDate)
      if (glToDate) params.set('to_date', glToDate)
      const res = await apiFetch(`/accounting/general-ledger/${glAccountId}?${params.toString()}`)
      if (res.ok) {
        const d = await res.json()
        const entries: LedgerEntry[] = d.entries ?? []
        const total = d.total ?? entries.length
        const maxPage = totalPagesFor(total)
        if (page > maxPage) {
          setGlPage(maxPage)
        } else {
          setGeneralLedger({
            opening_balance: d.opening_balance ?? 0,
            closing_balance: d.closing_balance ?? 0,
            entries,
            account: d.account,
            total,
          })
        }
      } else {
        notifyError('Failed to load general ledger')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load general ledger')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, 'general-ledger': false }))
    }
  }, [glAccountId, glFromDate, glToDate])

  const fetchTrialBalance = useCallback(async (page: number) => {
    setLoadingTabs((prev) => ({ ...prev, 'trial-balance': true }))
    try {
      const res = await apiFetch(`/accounting/trial-balance?page=${page}&per_page=${PAGE_SIZE}`)
      if (res.ok) {
        const d = await res.json()
        const items: TrialBalanceItem[] = d.items ?? []
        const total = d.total ?? items.length
        const maxPage = totalPagesFor(total)
        if (page > maxPage) {
          setTrialBalance((p) => ({ ...p, page: maxPage }))
        } else {
          setTrialBalance({ items, total, page })
          setTrialTotals({
            debit: d.total_debit ?? 0,
            credit: d.total_credit ?? 0,
            balanced: d.is_balanced ?? true,
          })
        }
      } else {
        notifyError('Failed to load trial balance')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load trial balance')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, 'trial-balance': false }))
    }
  }, [])

  const fetchProfitLoss = useCallback(async (incomePage: number, expensePage: number) => {
    setLoadingTabs((prev) => ({ ...prev, pnl: true }))
    try {
      const res = await apiFetch(
        `/accounting/profit-loss?per_page=${PAGE_SIZE}&income_page=${incomePage}&expense_page=${expensePage}`
      )
      if (res.ok) {
        const d = await res.json()
        const incomeCount = d.income_count ?? d.income?.length ?? 0
        const expenseCount = d.expenses_count ?? d.expenses?.length ?? 0
        const maxIncome = totalPagesFor(incomeCount)
        const maxExpense = totalPagesFor(expenseCount)
        if (incomePage > maxIncome || expensePage > maxExpense) {
          if (incomePage > maxIncome) setPlIncomePage(maxIncome)
          if (expensePage > maxExpense) setPlExpensePage(maxExpense)
        } else {
          setProfitLoss(d)
        }
      } else {
        notifyError('Failed to load profit & loss')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load profit & loss')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, pnl: false }))
    }
  }, [])

  const fetchBalanceSheet = useCallback(async (assetsPage: number, liabilitiesPage: number, equityPage: number) => {
    setLoadingTabs((prev) => ({ ...prev, 'balance-sheet': true }))
    try {
      const res = await apiFetch(
        `/accounting/balance-sheet?per_page=${PAGE_SIZE}&assets_page=${assetsPage}&liabilities_page=${liabilitiesPage}&equity_page=${equityPage}`
      )
      if (res.ok) {
        const d = await res.json()
        const assetsCount = d.assets_count ?? d.assets?.length ?? 0
        const liabilitiesCount = d.liabilities_count ?? d.liabilities?.length ?? 0
        const equityCount = d.equity_count ?? d.equity?.length ?? 0
        const maxAssets = totalPagesFor(assetsCount)
        const maxLiabilities = totalPagesFor(liabilitiesCount)
        const maxEquity = totalPagesFor(equityCount)
        if (assetsPage > maxAssets || liabilitiesPage > maxLiabilities || equityPage > maxEquity) {
          if (assetsPage > maxAssets) setBsAssetsPage(maxAssets)
          if (liabilitiesPage > maxLiabilities) setBsLiabilitiesPage(maxLiabilities)
          if (equityPage > maxEquity) setBsEquityPage(maxEquity)
        } else {
          setBalanceSheet(d)
        }
      } else {
        notifyError('Failed to load balance sheet')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load balance sheet')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, 'balance-sheet': false }))
    }
  }, [])

  const fetchReconciliations = useCallback(async (page: number) => {
    setLoadingTabs((prev) => ({ ...prev, 'bank-recon': true }))
    try {
      const res = await apiFetch(`/accounting/bank-reconciliation?page=${page}&per_page=${PAGE_SIZE}`)
      if (res.ok) {
        const d = await res.json()
        const items: BankReconciliation[] = Array.isArray(d) ? d : d.data ?? []
        const total = d.total ?? items.length
        const maxPage = totalPagesFor(total)
        if (page > maxPage) setReconData((p) => ({ ...p, page: maxPage }))
        else setReconData({ items, total, page })
      } else {
        notifyError('Failed to load reconciliations')
      }
    } catch (err) {
      console.error(err)
      notifyError('Failed to load reconciliations')
    } finally {
      setLoadingTabs((prev) => ({ ...prev, 'bank-recon': false }))
    }
  }, [])

  // Lazy per-tab loading: only the active tab's data is fetched; reopening a
  // tab refetches it so mutations elsewhere never show stale numbers.
  useEffect(() => {
    if (!user) return
    switch (activeTab) {
      case 'accounts':
        void fetchAccountsPage(accountsData.page)
        break
      case 'journal':
        void fetchJournalPage(journalData.page)
        break
      case 'ledger':
        void ensureAllAccounts()
        void fetchLedgerPage(ledgerData.page)
        break
      case 'general-ledger':
        void ensureAllAccounts()
        void fetchGeneralLedger(glPage)
        break
      case 'trial-balance':
        void fetchTrialBalance(trialBalance.page)
        break
      case 'pnl':
        void fetchProfitLoss(plIncomePage, plExpensePage)
        break
      case 'balance-sheet':
        void fetchBalanceSheet(bsAssetsPage, bsLiabilitiesPage, bsEquityPage)
        break
      case 'bank-recon':
        void fetchReconciliations(reconData.page)
        break
    }
  }, [
    user, activeTab, reloadKey,
    accountsData.page, journalData.page, ledgerData.page, trialBalance.page,
    glPage, plIncomePage, plExpensePage, bsAssetsPage, bsLiabilitiesPage, bsEquityPage,
    reconData.page,
    fetchAccountsPage, fetchJournalPage, fetchLedgerPage, fetchGeneralLedger,
    fetchTrialBalance, fetchProfitLoss, fetchBalanceSheet, fetchReconciliations,
    ensureAllAccounts,
  ])

  // Stats widgets load separately from the tab data, each time the panel opens.
  useEffect(() => {
    if (!user || !showStats) return
    let cancelled = false
    setStatsLoading(true)
    apiFetch('/accounting/stats')
      .then(async (res) => {
        if (res.ok && !cancelled) setStats(await res.json())
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setStatsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, showStats, statsKey])

  // The journal dialog needs the full account list for its line-item selects.
  useEffect(() => {
    if (journalDialogOpen && user) void ensureAllAccounts()
  }, [journalDialogOpen, user, ensureAllAccounts])

  useEffect(() => {
    if (bankAccounts.length && !reconForm.bank_account_id) {
      const primary = bankAccounts.find((b) => b.is_primary) || bankAccounts[0]
      if (primary) setReconForm((f) => ({ ...f, bank_account_id: primary.id }))
    }
  }, [bankAccounts, reconForm.bank_account_id])

  // After a mutation, refetch the visible tab (reloadKey) plus any shared
  // data already loaded; other tabs refetch when reopened.
  const refreshAll = async () => {
    if (allAccountsStatus.current === 'loaded') void ensureAllAccounts(true)
    setStatsKey((k) => k + 1)
    setReloadKey((k) => k + 1)
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
    if (selectedAccounts.size === accountsData.items.length) {
      setSelectedAccounts(new Set())
    } else {
      setSelectedAccounts(new Set(accountsData.items.map(a => a.id)))
    }
  }

  const handleBulkDeleteAccounts = async () => {
    const eligible = accountsData.items.filter(a => selectedAccounts.has(a.id) && !a.is_default)
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
    const selected = accountsData.items.filter(a => selectedAccounts.has(a.id))
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
    if (selectedJournals.size === journalData.items.length) {
      setSelectedJournals(new Set())
    } else {
      setSelectedJournals(new Set(journalData.items.map(j => j.id)))
    }
  }

  const handleBulkPostJournals = async () => {
    const eligible = journalData.items.filter(j => selectedJournals.has(j.id) && j.status === 'draft')
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
    const eligible = journalData.items.filter(j => selectedJournals.has(j.id) && j.status === 'draft')
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
    const selected = journalData.items.filter(j => selectedJournals.has(j.id))
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
    if (selectedReconciliations.size === reconData.items.length) {
      setSelectedReconciliations(new Set())
    } else {
      setSelectedReconciliations(new Set(reconData.items.map(r => r.id)))
    }
  }

  const handleBulkCompleteReconciliations = async () => {
    const eligible = reconData.items.filter(r => selectedReconciliations.has(r.id) && r.status === 'draft')
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
    const selected = reconData.items.filter(r => selectedReconciliations.has(r.id))
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

  const bankAccountNameFor = (list: BankAccountOption[], id: string) =>
    list.find((b) => b.id === id)?.account_name || id.slice(0, 8)
  const bankAccountName = (id: string) => bankAccountNameFor(bankAccounts, id)

  const exportStamp = accountingExportDateStamp()

  // Full-dataset fetchers used by exports (per_page=0 returns every row).
  const fetchAllAccounts = async (): Promise<Account[]> => {
    const res = await apiFetch('/accounting/accounts?per_page=0')
    if (!res.ok) return []
    const d = await res.json()
    return Array.isArray(d) ? d : d.data ?? []
  }

  const fetchAllJournals = async (): Promise<JournalEntry[]> => {
    const res = await apiFetch('/accounting/journal?per_page=0')
    if (!res.ok) return []
    const d = await res.json()
    return d.data ?? []
  }

  const fetchAllLedgers = async (): Promise<LedgerEntry[]> => {
    const params = new URLSearchParams({ per_page: '0' })
    if (ledgerAccountFilter) params.set('account_id', ledgerAccountFilter)
    if (ledgerFromDate) params.set('from_date', ledgerFromDate)
    if (ledgerToDate) params.set('to_date', ledgerToDate)
    const res = await apiFetch(`/accounting/ledgers?${params.toString()}`)
    if (!res.ok) return []
    const d = await res.json()
    return d.data ?? []
  }

  const fetchFullGeneralLedger = async () => {
    if (!glAccountId) return null
    const params = new URLSearchParams({ per_page: '0' })
    if (glFromDate) params.set('from_date', glFromDate)
    if (glToDate) params.set('to_date', glToDate)
    const res = await apiFetch(`/accounting/general-ledger/${glAccountId}?${params.toString()}`)
    return res.ok ? await res.json() : null
  }

  const fetchFullTrialBalance = async () => {
    const res = await apiFetch('/accounting/trial-balance?per_page=0')
    return res.ok ? await res.json() : null
  }

  const fetchFullProfitLoss = async (): Promise<ProfitLoss | null> => {
    const res = await apiFetch('/accounting/profit-loss?per_page=0')
    return res.ok ? await res.json() : null
  }

  const fetchFullBalanceSheet = async (): Promise<BalanceSheet | null> => {
    const res = await apiFetch('/accounting/balance-sheet?per_page=0')
    return res.ok ? await res.json() : null
  }

  const fetchAllReconciliations = async (): Promise<BankReconciliation[]> => {
    const res = await apiFetch('/accounting/bank-reconciliation?per_page=0')
    if (!res.ok) return []
    const d = await res.json()
    return Array.isArray(d) ? d : d.data ?? []
  }

  const fetchBankAccountsList = async (): Promise<BankAccountOption[]> => {
    const res = await apiFetch('/cash-bank/accounts')
    if (!res.ok) return []
    const d = await res.json()
    return Array.isArray(d) ? d : []
  }

  const chartOfAccountsCsvRows = (list: Account[]): (string | number)[][] => [
    ['Code', 'Name', 'Type', 'Balance'],
    ...list.map((a) => [a.code, a.name, a.account_type, a.balance]),
  ]

  const journalCsvRows = (entries: JournalEntry[]): (string | number)[][] => {
    const rows: (string | number)[][] = [
      ['Entry Number', 'Entry Date', 'Entry Description', 'Status', 'Account', 'Debit', 'Credit', 'Line Description'],
    ]
    for (const j of entries) {
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

  const ledgerCsvRows = (entries: LedgerEntry[]): (string | number)[][] => [
    ['Date', 'Account', 'Transaction Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
    ...entries.map((row) => [
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

  const generalLedgerCsvRows = (
    gl: { opening_balance: number; closing_balance: number; entries: LedgerEntry[]; account?: Account } | null
  ): (string | number)[][] => {
    const acct = gl?.account
    const header = acct
      ? [[`Account: ${acct.code} — ${acct.name}`], [`Opening balance: ${gl?.opening_balance ?? 0}`], []]
      : []
    return [
      ...header,
      ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
      ...(gl?.entries || []).map((row) => [
        row.transaction_date,
        row.reference_number,
        row.description,
        row.debit,
        row.credit,
        row.balance,
      ]),
      [],
      ['Closing balance', '', '', '', '', gl?.closing_balance ?? ''],
    ]
  }

  const trialBalanceCsvRows = (
    items: TrialBalanceItem[],
    totals: { debit: number; credit: number }
  ): (string | number)[][] => [
    ['Code', 'Account', 'Type', 'Debit', 'Credit'],
    ...items.map((row) => [row.account_code, row.account_name, row.account_type, row.debit, row.credit]),
    ['', '', 'Total', totals.debit, totals.credit],
  ]

  const profitLossCsvRows = (pl: ProfitLoss | null): (string | number)[][] => {
    const rows: (string | number)[][] = [['Section', 'Account', 'Amount']]
    for (const row of pl?.income || []) {
      rows.push(['Income', row.account_name, row.amount])
    }
    rows.push(['', 'Total income', pl?.total_income ?? 0])
    for (const row of pl?.expenses || []) {
      rows.push(['Expense', row.account_name, row.amount])
    }
    rows.push(['', 'Total expenses', pl?.total_expense ?? 0])
    rows.push(['', 'Net profit', pl?.net_profit ?? 0])
    return rows
  }

  const balanceSheetCsvRows = (bs: BalanceSheet | null): (string | number)[][] => {
    const rows: (string | number)[][] = [['Section', 'Account', 'Amount']]
    for (const row of bs?.assets || []) {
      rows.push(['Assets', row.account_name, row.amount])
    }
    rows.push(['', 'Total assets', bs?.total_assets ?? 0])
    for (const row of bs?.liabilities || []) {
      rows.push(['Liabilities', row.account_name, row.amount])
    }
    rows.push(['', 'Total liabilities', bs?.total_liabilities ?? 0])
    for (const row of bs?.equity || []) {
      rows.push(['Equity', row.account_name, row.amount])
    }
    rows.push(['', 'Total equity', bs?.total_equity ?? 0])
    rows.push(['', 'Liabilities + equity', bs?.total_liabilities_equity ?? 0])
    return rows
  }

  const bankReconCsvRows = (rows: BankReconciliation[], banks: BankAccountOption[]): (string | number)[][] => [
    ['Statement Date', 'Bank Account', 'Statement Balance', 'Book Balance', 'Difference', 'Status', 'Notes'],
    ...rows.map((r) => [
      r.statement_date,
      bankAccountNameFor(banks, r.bank_account_id),
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
      // Exports pull the full datasets (per_page=0) rather than the currently
      // loaded pages.
      const [allAccs, allJournals, allLedgers, tb, pl, bs, allRecons, gl, banks] =
        await Promise.all([
          fetchAllAccounts(),
          fetchAllJournals(),
          fetchAllLedgers(),
          fetchFullTrialBalance(),
          fetchFullProfitLoss(),
          fetchFullBalanceSheet(),
          fetchAllReconciliations(),
          fetchFullGeneralLedger(),
          fetchBankAccountsList(),
        ])
      const zip = new JSZip()
      zip.file('chart-of-accounts.csv', rowsToCsv(chartOfAccountsCsvRows(allAccs)))
      zip.file('journal-entries.csv', rowsToCsv(journalCsvRows(allJournals)))
      zip.file('ledger.csv', rowsToCsv(ledgerCsvRows(allLedgers)))
      zip.file('trial-balance.csv', rowsToCsv(trialBalanceCsvRows(tb?.items ?? [], {
        debit: tb?.total_debit ?? 0,
        credit: tb?.total_credit ?? 0,
      })))
      zip.file('profit-and-loss.csv', rowsToCsv(profitLossCsvRows(pl)))
      zip.file('balance-sheet.csv', rowsToCsv(balanceSheetCsvRows(bs)))
      zip.file('bank-reconciliation.csv', rowsToCsv(bankReconCsvRows(allRecons, banks)))
      if (gl?.account && gl.entries?.length >= 0) {
        const safe = gl.account.code.replace(/[^a-zA-Z0-9-_]/g, '_')
        zip.file(`general-ledger-${safe}.csv`, rowsToCsv(generalLedgerCsvRows(gl)))
      }
      zip.file(
        'summary.json',
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            accounts: allAccs,
            journal_entries: allJournals,
            ledger: allLedgers,
            trial_balance: {
              items: tb?.items ?? [],
              total_debit: tb?.total_debit ?? 0,
              total_credit: tb?.total_credit ?? 0,
              is_balanced: tb?.is_balanced ?? true,
            },
            profit_loss: pl,
            balance_sheet: bs,
            bank_reconciliations: allRecons,
            general_ledger: gl,
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

  if (authLoading) {
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
            {statsLoading && !stats
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-[#e4e6ef] bg-white p-4">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-7 w-28" />
                  </div>
                ))
              : (
                <>
                  <SummaryStat label="Total Assets" value={formatCurrency(stats?.total_assets ?? 0)} />
                  <SummaryStat tone="danger" label="Total Liabilities" value={formatCurrency(stats?.total_liabilities ?? 0)} />
                  <SummaryStat tone="success" label="Total Income" value={formatCurrency(stats?.total_income ?? 0)} />
                  <SummaryStat tone={(stats?.net_profit ?? 0) >= 0 ? 'success' : 'danger'} label="Net Profit" value={formatCurrency(stats?.net_profit ?? 0)} />
                </>
              )}
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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccountingTab)}>
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
                    await downloadCsv(`chart-of-accounts-${exportStamp}.csv`, chartOfAccountsCsvRows(await fetchAllAccounts()))
                    notifyExported('Chart of accounts')
                  }}
                  onJson={async () => {
                    await downloadJson(`chart-of-accounts-${exportStamp}.json`, await fetchAllAccounts())
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
                          checked={accountsData.items.length > 0 && selectedAccounts.size === accountsData.items.length}
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
                    {loadingTabs.accounts && <SkeletonTableRows cols={6} />}
                    {!loadingTabs.accounts && accountsData.items.map((a) => (
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
                              <DropdownMenuItem onClick={() => {
                                setGlAccountId(a.id)
                                setGlPage(1)
                                setActiveTab('general-ledger')
                              }}>
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
                    {!loadingTabs.accounts && accountsData.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          No accounts
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={accountsData.page}
                  totalPages={totalPagesFor(accountsData.total)}
                  totalItems={accountsData.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => {
                    setSelectedAccounts(new Set())
                    setAccountsData((d) => ({ ...d, page: p }))
                  }}
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
                    await downloadCsv(`journal-entries-${exportStamp}.csv`, journalCsvRows(await fetchAllJournals()))
                    notifyExported('Journal entries')
                  }}
                  onJson={async () => {
                    await downloadJson(`journal-entries-${exportStamp}.json`, await fetchAllJournals())
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
                          checked={journalData.items.length > 0 && selectedJournals.size === journalData.items.length}
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
                    {loadingTabs.journal && <SkeletonTableRows cols={8} />}
                    {!loadingTabs.journal && journalData.items.map((j) => (
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
                    {!loadingTabs.journal && journalData.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                          No journal entries yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={journalData.page}
                  totalPages={totalPagesFor(journalData.total)}
                  totalItems={journalData.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => {
                    setSelectedJournals(new Set())
                    setJournalData((d) => ({ ...d, page: p }))
                  }}
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
                      await downloadCsv(`ledger-${exportStamp}.csv`, ledgerCsvRows(await fetchAllLedgers()))
                      notifyExported('Ledger')
                    }}
                    onJson={async () => {
                      await downloadJson(`ledger-${exportStamp}.json`, await fetchAllLedgers())
                      notifyExported('Ledger')
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <select
                    className="rounded border p-2 text-sm"
                    value={ledgerAccountFilter}
                    onChange={(e) => {
                      setLedgerAccountFilter(e.target.value)
                      setLedgerData((d) => ({ ...d, page: 1 }))
                    }}
                  >
                    <option value="">All accounts</option>
                    {allAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={ledgerFromDate} onChange={(e) => {
                    setLedgerFromDate(e.target.value)
                    setLedgerData((d) => ({ ...d, page: 1 }))
                  }} className="w-auto" />
                  <Input type="date" value={ledgerToDate} onChange={(e) => {
                    setLedgerToDate(e.target.value)
                    setLedgerData((d) => ({ ...d, page: 1 }))
                  }} className="w-auto" />
                  <Button variant="outline" size="sm" onClick={() => fetchLedgerPage(ledgerData.page)}>
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
                    {loadingTabs.ledger && <SkeletonTableRows cols={8} />}
                    {!loadingTabs.ledger && ledgerData.items.map((row) => (
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
                    {!loadingTabs.ledger && ledgerData.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                          No ledger entries — post transactions or journal entries to populate
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={ledgerData.page}
                  totalPages={totalPagesFor(ledgerData.total)}
                  totalItems={ledgerData.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => setLedgerData((d) => ({ ...d, page: p }))}
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
                      const gl = await fetchFullGeneralLedger()
                      const code = gl?.account?.code || 'account'
                      await downloadCsv(`general-ledger-${code}-${exportStamp}.csv`, generalLedgerCsvRows(gl))
                      notifyExported('General ledger')
                    }}
                    onJson={async () => {
                      if (!glAccountId) {
                        notifyError('Select an account first')
                        return
                      }
                      await downloadJson(`general-ledger-${exportStamp}.json`, await fetchFullGeneralLedger())
                      notifyExported('General ledger')
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <select
                    className="min-w-[220px] rounded border p-2 text-sm"
                    value={glAccountId}
                    onChange={(e) => {
                      setGlAccountId(e.target.value)
                      setGlPage(1)
                    }}
                  >
                    <option value="">Select account</option>
                    {allAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={glFromDate} onChange={(e) => {
                    setGlFromDate(e.target.value)
                    setGlPage(1)
                  }} className="w-auto" />
                  <Input type="date" value={glToDate} onChange={(e) => {
                    setGlToDate(e.target.value)
                    setGlPage(1)
                  }} className="w-auto" />
                  <Button variant="outline" size="sm" onClick={() => fetchGeneralLedger(glPage)}>
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
                    {loadingTabs['general-ledger'] && <SkeletonTableRows cols={6} />}
                    {!loadingTabs['general-ledger'] && (generalLedger?.entries ?? []).map((row) => (
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
                    {!loadingTabs['general-ledger'] && glAccountId && generalLedger && generalLedger.entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                          No entries in this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {glAccountId && (
                  <PaginationControls
                    page={glPage}
                    totalPages={totalPagesFor(generalLedger?.total ?? 0)}
                    totalItems={generalLedger?.total ?? 0}
                    pageSize={PAGE_SIZE}
                    onPageChange={setGlPage}
                  />
                )}
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
                      const tb = await fetchFullTrialBalance()
                      await downloadCsv(`trial-balance-${exportStamp}.csv`, trialBalanceCsvRows(tb?.items ?? [], {
                        debit: tb?.total_debit ?? 0,
                        credit: tb?.total_credit ?? 0,
                      }))
                      notifyExported('Trial balance')
                    }}
                    onJson={async () => {
                      await downloadJson(`trial-balance-${exportStamp}.json`, await fetchFullTrialBalance())
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
                    {loadingTabs['trial-balance'] && <SkeletonTableRows cols={5} />}
                    {!loadingTabs['trial-balance'] && (
                      <>
                        {trialBalance.items.map((row) => (
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
                      </>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={trialBalance.page}
                  totalPages={totalPagesFor(trialBalance.total)}
                  totalItems={trialBalance.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => setTrialBalance((d) => ({ ...d, page: p }))}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pnl">
            <div className="mb-4 flex justify-end">
              <ExportActions
                onCsv={async () => {
                  await downloadCsv(`profit-and-loss-${exportStamp}.csv`, profitLossCsvRows(await fetchFullProfitLoss()))
                  notifyExported('Profit & loss')
                }}
                onJson={async () => {
                  await downloadJson(`profit-and-loss-${exportStamp}.json`, await fetchFullProfitLoss())
                  notifyExported('Profit & loss')
                }}
              />
            </div>
            {loadingTabs.pnl ? (
              <ReportCardsSkeleton />
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Income</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 p-0">
                      <Table>
                        <TableBody>
                          {(profitLoss?.income ?? []).map((row) => (
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
                        page={plIncomePage}
                        totalPages={totalPagesFor(profitLoss?.income_count ?? profitLoss?.income?.length ?? 0)}
                        totalItems={profitLoss?.income_count ?? profitLoss?.income?.length ?? 0}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPlIncomePage}
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
                          {(profitLoss?.expenses ?? []).map((row) => (
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
                        page={plExpensePage}
                        totalPages={totalPagesFor(profitLoss?.expenses_count ?? profitLoss?.expenses?.length ?? 0)}
                        totalItems={profitLoss?.expenses_count ?? profitLoss?.expenses?.length ?? 0}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPlExpensePage}
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
              </>
            )}
          </TabsContent>

          <TabsContent value="balance-sheet">
            <div className="mb-4 flex justify-end">
              <ExportActions
                onCsv={async () => {
                  await downloadCsv(`balance-sheet-${exportStamp}.csv`, balanceSheetCsvRows(await fetchFullBalanceSheet()))
                  notifyExported('Balance sheet')
                }}
                onJson={async () => {
                  await downloadJson(`balance-sheet-${exportStamp}.json`, await fetchFullBalanceSheet())
                  notifyExported('Balance sheet')
                }}
              />
            </div>
            {loadingTabs['balance-sheet'] ? (
              <ReportCardsSkeleton />
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Assets</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableBody>
                          {(balanceSheet?.assets ?? []).map((row, i) => (
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
                        page={bsAssetsPage}
                        totalPages={totalPagesFor(balanceSheet?.assets_count ?? balanceSheet?.assets?.length ?? 0)}
                        totalItems={balanceSheet?.assets_count ?? balanceSheet?.assets?.length ?? 0}
                        pageSize={PAGE_SIZE}
                        onPageChange={setBsAssetsPage}
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
                            {(balanceSheet?.liabilities ?? []).map((row, i) => (
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
                          page={bsLiabilitiesPage}
                          totalPages={totalPagesFor(balanceSheet?.liabilities_count ?? balanceSheet?.liabilities?.length ?? 0)}
                          totalItems={balanceSheet?.liabilities_count ?? balanceSheet?.liabilities?.length ?? 0}
                          pageSize={PAGE_SIZE}
                          onPageChange={setBsLiabilitiesPage}
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
                            {(balanceSheet?.equity ?? []).map((row, i) => (
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
                          page={bsEquityPage}
                          totalPages={totalPagesFor(balanceSheet?.equity_count ?? balanceSheet?.equity?.length ?? 0)}
                          totalItems={balanceSheet?.equity_count ?? balanceSheet?.equity?.length ?? 0}
                          pageSize={PAGE_SIZE}
                          onPageChange={setBsEquityPage}
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
              </>
            )}
          </TabsContent>

          <TabsContent value="bank-recon">
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <ExportActions
                onCsv={async () => {
                  const banks = bankAccounts.length ? bankAccounts : await fetchBankAccountsList()
                  await downloadCsv(`bank-reconciliation-${exportStamp}.csv`, bankReconCsvRows(await fetchAllReconciliations(), banks))
                  notifyExported('Bank reconciliation')
                }}
                onJson={async () => {
                  await downloadJson(`bank-reconciliation-${exportStamp}.json`, await fetchAllReconciliations())
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
                          checked={reconData.items.length > 0 && selectedReconciliations.size === reconData.items.length}
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
                    {loadingTabs['bank-recon'] && <SkeletonTableRows cols={8} />}
                    {!loadingTabs['bank-recon'] && reconData.items.map((r) => (
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
                    {!loadingTabs['bank-recon'] && reconData.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                          No bank reconciliations yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={reconData.page}
                  totalPages={totalPagesFor(reconData.total)}
                  totalItems={reconData.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => {
                    setSelectedReconciliations(new Set())
                    setReconData((d) => ({ ...d, page: p }))
                  }}
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
                      {allAccounts.map((a) => (
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
