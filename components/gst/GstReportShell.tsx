'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  buildGstScopeQuery,
  currentIndianFY,
  currentQuarter,
  defaultGstScope,
  fyOptions,
  gstGet,
  type GstRegistration,
  type GstScope,
} from '@/lib/gstComposition'
import { RefreshCw } from 'lucide-react'

export const GST_REPORT_TABS = [
  { name: 'Dashboard', href: '/gst-reports' },
  { name: 'Sales', href: '/gst-reports/sales' },
  { name: 'Purchases', href: '/gst-reports/purchases' },
  { name: 'CMP-08', href: '/gst-reports/cmp08' },
  { name: 'GSTR-4', href: '/gst-reports/gstr4' },
  { name: 'Validation', href: '/gst-reports/validation' },
  { name: 'Payments', href: '/gst-reports/payments' },
  { name: 'Exports', href: '/gst-reports/exports' },
  { name: 'Configuration', href: '/gst-reports/config' },
]

export interface GstScopeState {
  scope: GstScope
  setScope: (s: GstScope) => void
  query: string
  registrations: GstRegistration[]
  registration?: GstRegistration
  reloadRegistrations: () => Promise<void>
  reloadKey: number
  reload: () => void
}

export function useGstScope(): GstScopeState {
  const [scope, setScope] = useState<GstScope>(defaultGstScope)
  const [registrations, setRegistrations] = useState<GstRegistration[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const reloadRegistrations = useCallback(async () => {
    try {
      const data = await gstGet<GstRegistration[]>('/registrations')
      const regs = data || []
      setRegistrations(regs)
      setScope((s) => {
        if (s.registrationId && regs.some((r) => r.id === s.registrationId)) return s
        const active = regs.find((r) => r.status === 'active' && r.registration_type === 'composition') || regs.find((r) => r.status === 'active')
        return { ...s, registrationId: active?.id || '' }
      })
    } catch {
      // handled by pages displaying data errors
    }
  }, [])

  useEffect(() => {
    reloadRegistrations()
  }, [reloadRegistrations])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const query = useMemo(() => buildGstScopeQuery(scope), [scope])
  const registration = useMemo(
    () => registrations.find((r) => r.id === scope.registrationId),
    [registrations, scope.registrationId],
  )

  return { scope, setScope, query, registrations, registration, reloadRegistrations, reloadKey, reload }
}

export function GstScopeControls({ gst }: { gst: GstScopeState }) {
  const { scope, setScope, registrations } = gst
  const update = (patch: Partial<GstScope>) => setScope({ ...scope, ...patch })
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px]">
        <Label className="text-xs text-muted-foreground">GST Registration</Label>
        <Select value={scope.registrationId || 'none'} onValueChange={(v) => update({ registrationId: v === 'none' ? '' : v })}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select GSTIN" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Auto / none configured</SelectItem>
            {registrations.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.gstin} — {r.trade_name || r.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Period</Label>
        <div className="flex rounded-md border overflow-hidden h-9">
          {(['quarter', 'annual', 'custom'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ mode: m })}
              className={cn(
                'px-3 text-sm capitalize transition-colors',
                scope.mode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {m === 'quarter' ? 'Quarterly' : m === 'annual' ? 'Annual' : 'Custom'}
            </button>
          ))}
        </div>
      </div>
      {scope.mode !== 'custom' && (
        <div>
          <Label className="text-xs text-muted-foreground">Financial Year</Label>
          <Select value={scope.fy} onValueChange={(v) => update({ fy: v })}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fyOptions().map((fy) => (
                <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {scope.mode === 'quarter' && (
        <div>
          <Label className="text-xs text-muted-foreground">Quarter</Label>
          <Select value={String(scope.quarter)} onValueChange={(v) => update({ quarter: Number(v) })}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Q1 (Apr–Jun)</SelectItem>
              <SelectItem value="2">Q2 (Jul–Sep)</SelectItem>
              <SelectItem value="3">Q3 (Oct–Dec)</SelectItem>
              <SelectItem value="4">Q4 (Jan–Mar)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {scope.mode === 'custom' && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" className="h-9 w-[150px]" value={scope.startDate} onChange={(e) => update({ startDate: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" className="h-9 w-[150px]" value={scope.endDate} onChange={(e) => update({ endDate: e.target.value })} />
          </div>
        </>
      )}
      <Button variant="outline" size="sm" className="h-9" onClick={gst.reload} title="Reload data">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default function GstReportShell({
  gst,
  title,
  description,
  children,
  actions,
}: {
  gst: GstScopeState
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions}
        </div>

        <nav className="flex flex-wrap gap-1 border-b pb-2">
          {GST_REPORT_TABS.map((t) => {
            const active = t.href === '/gst-reports' ? pathname === t.href : pathname.startsWith(t.href)
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {t.name}
              </Link>
            )
          })}
        </nav>

        <GstScopeControls gst={gst} />

        {children}
      </div>
    </DashboardLayout>
  )
}

export { currentIndianFY, currentQuarter }
