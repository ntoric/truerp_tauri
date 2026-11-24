'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Calculator, Layers, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { loyaltyCategoryMatches } from '@/lib/loyalty'
import type { LoyaltyCategory, LoyaltyCondition } from '@/lib/loyalty-types'

type Scope = 'item' | 'invoice'

interface Props {
  categories: LoyaltyCategory[]
  scope: Scope
  isCash: boolean
  onChange: (categories: LoyaltyCategory[]) => void
  onScopeChange: (scope: Scope) => void
}

const OPS: { value: LoyaltyCondition['op']; label: string }[] = [
  { value: 'gte', label: '≥' },
  { value: 'gt', label: '>' },
  { value: 'lte', label: '≤' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '=' },
]
const opLabel = (op: LoyaltyCondition['op']) => OPS.find((o) => o.value === op)?.label ?? op

const newCategory = (n: number): LoyaltyCategory => ({
  name: `Category ${n}`,
  is_active: true,
  conditions: [{ field: 'margin_percent', op: 'gte', value: 20, join: '' }],
  reward_kind: 'percent',
  reward_value: 1,
  reward_on: 'sale',
})

function conditionText(c: LoyaltyCondition): string {
  return c.field === 'margin_percent'
    ? `margin ${opLabel(c.op)} ${c.value}%`
    : `profit ${opLabel(c.op)} ${formatCurrency(c.value)}`
}

/** Plain-language rule, e.g. "When margin ≥ 30% AND profit ≥ ₹100 → 5% of profit as cashback". */
export function describeLoyaltyCategory(cat: LoyaltyCategory, isCash: boolean, scope: Scope): string {
  const per = scope === 'invoice' ? 'bill' : 'item'
  const when = cat.conditions.length
    ? 'When ' +
      cat.conditions.map((c, i) => (i === 0 ? '' : ` ${(c.join || 'and').toUpperCase()} `) + conditionText(c)).join('')
    : `Every ${per}`
  const base = cat.reward_on === 'profit' ? 'profit' : 'sale value'
  const reward =
    cat.reward_kind === 'fixed'
      ? isCash
        ? `${formatCurrency(cat.reward_value)} cashback per ${per}`
        : `${Math.floor(cat.reward_value)} points per ${per}`
      : isCash
        ? `${cat.reward_value}% of ${base} as cashback`
        : `${cat.reward_value} points per ₹100 of ${base}`
  return `${when} → ${reward}`
}

export default function LoyaltyCategoriesEditor({ categories, scope, isCash, onChange, onScopeChange }: Props) {
  const [testSale, setTestSale] = useState('1000')
  const [testCost, setTestCost] = useState('750')

  const update = (i: number, patch: Partial<LoyaltyCategory>) =>
    onChange(categories.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const updateCondition = (i: number, j: number, patch: Partial<LoyaltyCondition>) =>
    update(i, { conditions: categories[i].conditions.map((c, idx) => (idx === j ? { ...c, ...patch } : c)) })
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= categories.length) return
    const next = [...categories]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const test = useMemo(() => {
    const sale = parseFloat(testSale) || 0
    const cost = parseFloat(testCost) || 0
    const f = { sale, profit: sale - cost, costKnown: cost > 0 && sale > 0 }
    const idx = categories.findIndex((c) => c.is_active && loyaltyCategoryMatches(c, f))
    if (idx < 0) return { f, idx, reward: 0 }
    const cat = categories[idx]
    const base = cat.reward_on === 'profit' ? f.profit : f.sale
    const raw = cat.reward_kind === 'fixed' ? cat.reward_value : base > 0 ? (base * cat.reward_value) / 100 : 0
    return { f, idx, reward: isCash ? Math.round(raw * 100) / 100 : Math.floor(raw + 1e-9) }
  }, [categories, testSale, testCost, isCash])

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Label>Apply categories to</Label>
          <Select value={scope} onValueChange={(v) => onScopeChange(v === 'invoice' ? 'invoice' : 'item')}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="item">Each item on the bill separately</SelectItem>
              <SelectItem value="invoice">The whole bill (combined margin)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange([...categories, newCategory(categories.length + 1)])}>
          <Plus className="mr-2 h-4 w-4" />
          Add category
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        {scope === 'item'
          ? 'Every item is checked against the categories from top to bottom and earns from the first one it qualifies for, so a bill with items in different categories earns from each. '
          : 'The whole bill is checked once on its combined profit and margin, and earns from the first category it qualifies for. '}
        Margin is profit ÷ selling price (after discounts, before tax). Items without a purchase price only match categories that have no criteria.
      </p>

      {categories.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <Layers className="h-6 w-6 text-gray-400" />
          <p className="text-sm font-medium">No categories yet</p>
          <p className="max-w-md text-xs text-gray-500">
            Create categories such as “High margin” (margin ≥ 30%) or “Big profit” (profit ≥ ₹500), each with its own{' '}
            {isCash ? 'cashback' : 'points'} reward.
          </p>
        </div>
      )}

      {categories.map((cat, i) => (
        <div key={i} className={`rounded-lg border p-4 ${cat.is_active ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {i + 1}
            </span>
            <Input
              className="h-9 min-w-0 flex-1 font-medium sm:max-w-xs"
              value={cat.name}
              placeholder="Category name"
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <div className="flex items-center gap-2 px-2">
              <Switch checked={cat.is_active} onCheckedChange={(v) => update(i, { is_active: v })} />
              <span className="text-xs text-gray-500">{cat.is_active ? 'Active' : 'Off'}</span>
            </div>
            <div className="ml-auto flex items-center">
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} title="Higher priority">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === categories.length - 1} onClick={() => move(i, 1)} title="Lower priority">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(categories.filter((_, idx) => idx !== i))} title="Delete category">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-500">Criteria</Label>
              {cat.conditions.length === 0 && (
                <p className="text-xs text-gray-500">No criteria — matches every {scope === 'invoice' ? 'bill' : 'item'} (catch-all).</p>
              )}
              {cat.conditions.map((c, j) => (
                <div key={j} className="flex flex-wrap items-center gap-2">
                  {j === 0 ? (
                    <span className="w-20 text-xs font-medium text-gray-500">When</span>
                  ) : (
                    <Select value={c.join === 'or' ? 'or' : 'and'} onValueChange={(v) => updateCondition(i, j, { join: v === 'or' ? 'or' : 'and' })}>
                      <SelectTrigger className="h-9 w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">AND</SelectItem>
                        <SelectItem value="or">OR</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Select
                    value={c.field}
                    onValueChange={(v) => updateCondition(i, j, { field: v === 'profit_amount' ? 'profit_amount' : 'margin_percent' })}
                  >
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="margin_percent">Profit margin %</SelectItem>
                      <SelectItem value="profit_amount">Profit amount ₹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={c.op} onValueChange={(v) => updateCondition(i, j, { op: v as LoyaltyCondition['op'] })}>
                    <SelectTrigger className="h-9 w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step={0.01}
                    className="h-9 w-24"
                    value={c.value}
                    onChange={(e) => updateCondition(i, j, { value: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-gray-500">{c.field === 'margin_percent' ? '%' : '₹'}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => update(i, { conditions: cat.conditions.filter((_, idx) => idx !== j) })}
                    title="Remove criterion"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {cat.conditions.length < 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    update(i, {
                      conditions: [
                        ...cat.conditions,
                        { field: 'profit_amount', op: 'gte', value: 100, join: cat.conditions.length ? 'and' : '' },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add criterion
                </Button>
              )}
              {cat.conditions.some((c, j) => j > 0 && c.join === 'or') && cat.conditions.some((c, j) => j > 0 && c.join !== 'or') && (
                <p className="text-xs text-gray-500">AND is checked before OR: “A AND B OR C” means (A and B) or C.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-500">Reward</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={cat.reward_kind} onValueChange={(v) => update(i, { reward_kind: v === 'fixed' ? 'fixed' : 'percent' })}>
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">{isCash ? 'Cashback %' : 'Points per ₹100'}</SelectItem>
                    <SelectItem value="fixed">{isCash ? 'Fixed cashback ₹' : 'Fixed points'}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={isCash || cat.reward_kind === 'percent' ? 0.01 : 1}
                  className="h-9 w-24"
                  value={cat.reward_value}
                  onChange={(e) => update(i, { reward_value: parseFloat(e.target.value) || 0 })}
                />
                {cat.reward_kind === 'percent' ? (
                  <>
                    <span className="text-xs text-gray-500">of</span>
                    <Select value={cat.reward_on} onValueChange={(v) => update(i, { reward_on: v === 'profit' ? 'profit' : 'sale' })}>
                      <SelectTrigger className="h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Sale value</SelectItem>
                        <SelectItem value="profit">Profit</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">per matching {scope === 'invoice' ? 'bill' : 'item'}</span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            {describeLoyaltyCategory(cat, isCash, scope)}
          </p>
        </div>
      ))}

      {categories.length > 0 && (
        <div className="rounded-lg border border-dashed p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4 text-gray-500" />
            Try it
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Sale value (₹)</Label>
              <Input type="number" className="h-9 w-32" value={testSale} onChange={(e) => setTestSale(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Purchase cost (₹)</Label>
              <Input type="number" className="h-9 w-32" value={testCost} onChange={(e) => setTestCost(e.target.value)} />
            </div>
            <p className="pb-2 text-sm">
              {test.f.costKnown && (
                <span className="text-gray-500">
                  Profit {formatCurrency(test.f.profit)} · margin {((test.f.profit / test.f.sale) * 100).toFixed(1)}% →{' '}
                </span>
              )}
              {test.idx < 0 ? (
                <span className="text-gray-500">no category matches, earns nothing</span>
              ) : (
                <span>
                  <strong>{categories[test.idx].name}</strong>, earns{' '}
                  <strong>{isCash ? formatCurrency(test.reward) : `${test.reward} points`}</strong>
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
