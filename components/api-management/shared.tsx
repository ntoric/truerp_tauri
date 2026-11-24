'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { notifyError } from '@/lib/notify'
import { RESOURCE_LABELS, groupScopes, type ScopeInfo, type StoreOption } from '@/lib/apiManagement'
import { cn } from '@/lib/utils'

/** Copy text to the clipboard with a short "copied" state. */
export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      notifyError('Could not copy — select the text and copy it manually.')
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className={className}>
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

/** Shows a newly issued secret exactly once. */
export function SecretDialog({
  open,
  onClose,
  title,
  description,
  secrets,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  secrets: { label: string; value: string }[]
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Copy this now and store it in a password manager or secret store. TruERP does not keep a readable copy, so it cannot be shown again.</span>
        </div>
        <div className="space-y-3">
          {secrets.map((s) => (
            <div key={s.label} className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/50 px-3 py-2 font-mono text-[13px]">{s.value}</code>
                <CopyButton value={s.value} />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Read/write permission matrix over the scope catalog. `limitTo` greys out
 * scopes the store's policy does not allow.
 */
export function ScopeMatrix({
  catalog,
  value,
  onChange,
  limitTo,
  disabled,
}: {
  catalog: ScopeInfo[]
  value: string[]
  onChange: (next: string[]) => void
  limitTo?: string[]
  disabled?: boolean
}) {
  const rows = groupScopes(catalog)
  const set = new Set(value)
  const allowed = limitTo ? new Set(limitTo) : null

  const toggle = (scope: string, on: boolean, companion?: { read?: ScopeInfo }) => {
    const next = new Set(set)
    if (on) {
      next.add(scope)
      // Write access implies read access to the same resource.
      if (companion?.read) next.add(companion.read.scope)
    } else {
      next.delete(scope)
    }
    onChange(Array.from(next))
  }
  const setAll = (mode: 'none' | 'read' | 'all') => {
    const next = catalog
      .filter((s) => mode === 'all' || (mode === 'read' && s.access === 'read'))
      .map((s) => s.scope)
      .filter((s) => !allowed || allowed.has(s))
    onChange(next)
  }

  const cell = (info: ScopeInfo | undefined, companion?: { read?: ScopeInfo }) => {
    if (!info) return <span className="text-muted-foreground/50">—</span>
    const blocked = allowed !== null && !allowed.has(info.scope)
    return (
      <label
        className={cn('inline-flex cursor-pointer items-center gap-2', (blocked || disabled) && 'cursor-not-allowed opacity-50')}
        title={blocked ? 'Not allowed by this store\'s API permissions' : info.description}
      >
        <Checkbox
          checked={set.has(info.scope)}
          disabled={blocked || disabled}
          onCheckedChange={(c) => toggle(info.scope, c === true, companion)}
          aria-label={info.scope}
        />
        <code className="text-xs text-muted-foreground">{info.scope}</code>
      </label>
    )
  }

  return (
    <div className="space-y-2">
      {!disabled && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Button type="button" size="sm" variant="outline" onClick={() => setAll('read')}>Read only</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAll('all')}>Full access</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAll('none')}>Clear</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Resource</th>
              <th className="px-3 py-2 font-semibold">Read</th>
              <th className="px-3 py-2 font-semibold">Write / manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.resource} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{RESOURCE_LABELS[row.resource] ?? row.resource}</div>
                  <div className="text-xs text-muted-foreground">{(row.write ?? row.read)?.description}</div>
                </td>
                <td className="px-3 py-2">{cell(row.read)}</td>
                <td className="px-3 py-2">{cell(row.write, row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StoreSelect({
  stores,
  value,
  onChange,
  allowAll,
  allLabel = 'All stores',
  placeholder = 'Select a store',
  className,
}: {
  stores: StoreOption[]
  value: string
  onChange: (v: string) => void
  allowAll?: boolean
  allLabel?: string
  placeholder?: string
  className?: string
}) {
  return (
    <Select value={value || (allowAll ? 'all' : undefined)} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className={cn('w-full sm:w-64', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {stores.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name} {s.code ? <span className="text-muted-foreground">· {s.code}</span> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function StatusDot({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'slate'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
  const dots = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', slate: 'bg-slate-400' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />
      {children}
    </span>
  )
}
