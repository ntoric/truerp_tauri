'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  clearPortalToken,
  getPortalToken,
  portalFetch,
} from '@/lib/portalApi'
import {
  FileText,
  CreditCard,
  Gift,
  ScrollText,
  LifeBuoy,
  LogOut,
  Download,
  Loader2,
  Plus,
} from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'

interface PortalProfile {
  customer: {
    name: string
    phone: string
    balance: number
    loyalty_points: number
  }
  business: { name: string; logo_url?: string }
  portal: {
    welcome_message: string
    allow_support_tickets: boolean
    loyalty_enabled: boolean
    slug: string
  }
}

interface PortalInvoice {
  id: string
  invoice_number: string
  date: string
  due_date?: string
  status: string
  total_amount: number
  amount_paid: number
}

interface PortalPayment {
  id: string
  payment_in_number: string
  date: string
  amount_received: number
  mode: string
}

interface PortalStatement {
  id: string
  statement_number: string
  from_date: string
  to_date: string
  closing_balance: number
  generated_at: string
}

interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  description: string
  status: string
  admin_notes?: string
  created_at: string
}

export default function CustomerPortalHomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [invoices, setInvoices] = useState<PortalInvoice[]>([])
  const [payments, setPayments] = useState<PortalPayment[]>([])
  const [statements, setStatements] = useState<PortalStatement[]>([])
  const [loyalty, setLoyalty] = useState<{ enabled: boolean; points?: number; transactions?: unknown[] } | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/portal/login')
      return
    }
    loadAll()
  }, [router])

  const invoicesPagination = usePagination(invoices)
  const paymentsPagination = usePagination(payments)
  const statementsPagination = usePagination(statements)
  const ticketsPagination = usePagination(tickets)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [meRes, invRes, payRes, stmtRes, loyaltyRes, ticketRes] = await Promise.all([
        portalFetch('/me'),
        portalFetch('/invoices'),
        portalFetch('/payments'),
        portalFetch('/statements'),
        portalFetch('/loyalty'),
        portalFetch('/tickets'),
      ])
      if (meRes.ok) setProfile(await meRes.json())
      if (invRes.ok) setInvoices(await invRes.json())
      if (payRes.ok) setPayments(await payRes.json())
      if (stmtRes.ok) setStatements(await stmtRes.json())
      if (loyaltyRes.ok) setLoyalty(await loyaltyRes.json())
      if (ticketRes.ok) setTickets(await ticketRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    const slug = profile?.portal.slug
    clearPortalToken()
    router.push(slug ? `/portal/login?slug=${encodeURIComponent(slug)}` : '/portal/login')
  }

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      notifyError('Subject and description are required')
      return
    }
    setSubmittingTicket(true)
    try {
      const res = await portalFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: ticketSubject,
          description: ticketDescription,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit ticket')
      notifySuccess('Support ticket submitted')
      setTicketSubject('')
      setTicketDescription('')
      setTickets((prev) => [data, ...prev])
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Failed to submit ticket')
    } finally {
      setSubmittingTicket(false)
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const statusClass: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700',
    overdue: 'bg-red-100 text-red-700',
    open: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">{profile.business.name}</p>
            <h1 className="text-xl font-semibold">Hi, {profile.customer.name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {profile.portal.welcome_message && (
          <p className="mb-6 text-sm text-muted-foreground">{profile.portal.welcome_message}</p>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{formatCurrency(profile.customer.balance)}</CardContent>
          </Card>
          {profile.portal.loyalty_enabled && loyalty?.enabled && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Loyalty points</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {(loyalty.points ?? profile.customer.loyalty_points).toLocaleString()}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open tickets</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="invoices" className="gap-1">
              <FileText className="h-4 w-4" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1">
              <CreditCard className="h-4 w-4" /> Payments
            </TabsTrigger>
            {profile.portal.loyalty_enabled && (
              <TabsTrigger value="loyalty" className="gap-1">
                <Gift className="h-4 w-4" /> Loyalty
              </TabsTrigger>
            )}
            <TabsTrigger value="statements" className="gap-1">
              <ScrollText className="h-4 w-4" /> Statements
            </TabsTrigger>
            {profile.portal.allow_support_tickets && (
              <TabsTrigger value="support" className="gap-1">
                <LifeBuoy className="h-4 w-4" /> Support
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your invoices</CardTitle>
              </CardHeader>
              <CardContent className="table-scroll">
                {invoices.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">No invoices yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Invoice</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4 text-right">Amount</th>
                        <th className="pb-2 text-right">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesPagination.paginatedItems.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{inv.invoice_number}</td>
                          <td className="py-3 pr-4">{formatDate(inv.date)}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[inv.status] || statusClass.sent}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right">{formatCurrency(inv.total_amount)}</td>
                          <td className="py-3 text-right">
                            <Link
                              href={`/portal/invoices/${inv.id}/pdf`}
                              target="_blank"
                              className="inline-flex items-center text-blue-600 hover:underline"
                            >
                              <Download className="mr-1 h-4 w-4" />
                              PDF
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {invoices.length > 0 && (
                  <PaginationControls
                    page={invoicesPagination.page}
                    totalPages={invoicesPagination.totalPages}
                    totalItems={invoicesPagination.totalItems}
                    pageSize={invoicesPagination.pageSize}
                    onPageChange={invoicesPagination.setPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment history</CardTitle>
              </CardHeader>
              <CardContent className="table-scroll">
                {payments.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">No payments recorded</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Receipt</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Mode</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsPagination.paginatedItems.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">{p.payment_in_number}</td>
                          <td className="py-3 pr-4">{formatDate(p.date)}</td>
                          <td className="py-3 pr-4 capitalize">{p.mode?.replace('_', ' ') || '—'}</td>
                          <td className="py-3 text-right">{formatCurrency(p.amount_received)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {payments.length > 0 && (
                  <PaginationControls
                    page={paymentsPagination.page}
                    totalPages={paymentsPagination.totalPages}
                    totalItems={paymentsPagination.totalItems}
                    pageSize={paymentsPagination.pageSize}
                    onPageChange={paymentsPagination.setPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {profile.portal.loyalty_enabled && (
            <TabsContent value="loyalty">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Loyalty points</CardTitle>
                </CardHeader>
                <CardContent>
                  {!loyalty?.enabled ? (
                    <p className="text-muted-foreground">Loyalty program is not active.</p>
                  ) : (
                    <>
                      <p className="mb-4 text-2xl font-bold">{(loyalty.points ?? 0).toLocaleString()} points</p>
                      <p className="text-sm text-muted-foreground">
                        Points are earned on eligible purchases and can be redeemed on future bills.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="statements">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account statements</CardTitle>
              </CardHeader>
              <CardContent className="table-scroll">
                {statements.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">
                    No statements available yet. Ask your supplier to generate one from TruERP.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Statement</th>
                        <th className="pb-2 pr-4">Period</th>
                        <th className="pb-2 pr-4 text-right">Closing balance</th>
                        <th className="pb-2 text-right">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementsPagination.paginatedItems.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">{s.statement_number}</td>
                          <td className="py-3 pr-4">
                            {formatDate(s.from_date)} – {formatDate(s.to_date)}
                          </td>
                          <td className="py-3 pr-4 text-right">{formatCurrency(s.closing_balance)}</td>
                          <td className="py-3 text-right">
                            <Link
                              href={`/portal/statements/${s.id}/pdf`}
                              target="_blank"
                              className="inline-flex items-center text-blue-600 hover:underline"
                            >
                              <Download className="mr-1 h-4 w-4" />
                              PDF
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {statements.length > 0 && (
                  <PaginationControls
                    page={statementsPagination.page}
                    totalPages={statementsPagination.totalPages}
                    totalItems={statementsPagination.totalItems}
                    pageSize={statementsPagination.pageSize}
                    onPageChange={statementsPagination.setPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {profile.portal.allow_support_tickets && (
            <TabsContent value="support" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Raise a support ticket</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitTicket} className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="Brief summary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        rows={4}
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="Describe your issue or question"
                      />
                    </div>
                    <Button type="submit" disabled={submittingTicket}>
                      {submittingTicket ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Submit ticket
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your tickets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tickets.length === 0 ? (
                    <p className="text-muted-foreground">No tickets yet</p>
                  ) : (
                    ticketsPagination.paginatedItems.map((t) => (
                      <div key={t.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {t.ticket_number} — {t.subject}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[t.status] || statusClass.open}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
                        {t.admin_notes && (
                          <p className="mt-2 rounded bg-blue-50 p-2 text-sm">
                            <span className="font-medium">Response: </span>
                            {t.admin_notes}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                      </div>
                    ))
                  )}
                  {tickets.length > 0 && (
                    <PaginationControls
                      page={ticketsPagination.page}
                      totalPages={ticketsPagination.totalPages}
                      totalItems={ticketsPagination.totalItems}
                      pageSize={ticketsPagination.pageSize}
                      onPageChange={ticketsPagination.setPage}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}
