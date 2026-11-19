'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppearance } from '@/hooks/useAppearance'
import { useColorTheme } from '@/hooks/useColorTheme'
import { useThemeMode } from '@/hooks/useThemeMode'
import {
  DASHBOARD_PANELS,
  type AppearancePrefs,
  type ContentWidth,
  type CornerStyle,
  type Density,
  type SidebarPosition,
  type SidebarStyle,
  type TextSize,
} from '@/lib/appearancePrefs'
import { COLOR_THEMES, DEFAULT_COLOR_THEME_ID, DEFAULT_CUSTOM_HEX, normalizeHex } from '@/lib/colorThemes'
import type { ThemeMode } from '@/lib/themeMode'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-gr-sm dark:ring-1 dark:ring-white/[0.06] sm:p-7">
      <h2 className="text-xl font-bold tracking-[-0.02em] text-heading">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 space-y-7">{children}</div>
    </section>
  )
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[15px] font-medium text-heading">{label}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function CheckDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground', className)}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
}

/** Selectable tile: preview well on top, label (and check) underneath. */
function OptionCard({
  selected,
  label,
  onSelect,
  children,
}: {
  selected: boolean
  label: string
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group flex w-full min-w-0 flex-col gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-150 sm:p-4',
        selected
          ? 'border-primary bg-[hsl(var(--theme-500)/0.05)] dark:bg-[hsl(var(--theme-500)/0.1)]'
          : 'border-border bg-card hover:border-[hsl(var(--theme-300))]'
      )}
    >
      <span className="flex h-20 items-center justify-center rounded-xl border border-border bg-surface-2 sm:h-24">
        {children}
      </span>
      <span className="flex min-h-6 items-center justify-between gap-2">
        <span className="truncate text-[15px] font-medium text-heading">{label}</span>
        {selected && <CheckDot />}
      </span>
    </button>
  )
}

function OptionGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-3 sm:gap-4', className)}>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const id = `pref-${label.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <div className="flex items-start gap-4">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[15px] font-medium text-heading">{label}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mini previews drawn inside option tiles                             */
/* ------------------------------------------------------------------ */

function MiniWindow({ dark, split }: { dark?: boolean; split?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-12 w-24 gap-1.5 overflow-hidden rounded-lg p-1.5 ring-1',
        split
          ? 'bg-[linear-gradient(135deg,#ffffff_50%,#161314_50%)] ring-black/10'
          : dark
            ? 'bg-[#161314] ring-black/60'
            : 'bg-white ring-black/[0.06]'
      )}
    >
      <span className="w-2.5 rounded-sm bg-brand-rail" />
      <span className="flex flex-1 flex-col gap-1">
        <span className={cn('h-1.5 w-2/3 rounded-full', dark ? 'bg-white/70' : 'bg-heading/80')} />
        <span className={cn('h-2.5 rounded', dark ? 'bg-white/10' : 'bg-surface-2 ring-1 ring-black/[0.04]')} />
        <span className={cn('h-2.5 rounded', dark ? 'bg-white/10' : 'bg-surface-2 ring-1 ring-black/[0.04]')} />
      </span>
    </span>
  )
}

function MiniLayout({
  side = 'left',
  railWidth = 'w-3',
}: {
  side?: SidebarPosition
  railWidth?: string
}) {
  const rail = <span className={cn('rounded-[3px] bg-brand-rail', railWidth)} />
  return (
    <span className="flex h-14 w-28 gap-1.5">
      {side === 'left' && rail}
      <span className="flex flex-1 flex-col gap-1">
        <span className="h-1.5 rounded-full bg-slate-300" />
        <span className="h-2.5 rounded-[3px] border border-border bg-card" />
        <span className="flex-1 rounded-[3px] border border-border bg-card" />
      </span>
      {side === 'right' && rail}
    </span>
  )
}

/** Wide frame so full vs boxed reads at a glance: boxed leaves visible gutters. */
function MiniWidth({ side = 'left', boxed }: { side?: SidebarPosition; boxed?: boolean }) {
  const rail = <span className="w-3 shrink-0 rounded-[3px] bg-brand-rail" />
  return (
    <span className="flex h-14 w-44 gap-1.5 rounded-md">
      {side === 'left' && rail}
      <span className={cn('flex flex-1 justify-center rounded-[4px]', boxed && 'bg-slate-200/70 px-2')}>
        <span className={cn('flex flex-col gap-1', boxed ? 'w-16' : 'w-full')}>
          <span className="h-1.5 rounded-full bg-slate-300" />
          <span className="h-2.5 rounded-[3px] border border-border bg-card" />
          <span className="flex-1 rounded-[3px] border border-border bg-card" />
        </span>
      </span>
      {side === 'right' && rail}
    </span>
  )
}

function MiniLines({ gap }: { gap: string }) {
  return (
    <span className={cn('flex w-24 flex-col', gap)}>
      <span className="h-1.5 rounded-full bg-slate-300" />
      <span className="h-1.5 rounded-full bg-slate-300" />
      <span className="h-1.5 rounded-full bg-slate-300" />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Option tables                                                       */
/* ------------------------------------------------------------------ */

const THEME_MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Match system', icon: Monitor },
]

// Sample size in px so the tiles don't grow with the setting itself.
const TEXT_SIZE_OPTIONS: { id: TextSize; label: string; samplePx: number }[] = [
  { id: 'sm', label: 'Small', samplePx: 20 },
  { id: 'md', label: 'Default', samplePx: 24 },
  { id: 'lg', label: 'Large', samplePx: 28 },
  { id: 'xl', label: 'Extra large', samplePx: 32 },
]

const CORNER_OPTIONS: { id: CornerStyle; label: string; box: string; dot: string }[] = [
  { id: 'sharp', label: 'Sharp', box: 'rounded-[2px]', dot: 'rounded-[2px]' },
  { id: 'default', label: 'Default', box: 'rounded-[10px]', dot: 'rounded-[6px]' },
  { id: 'round', label: 'Round', box: 'rounded-full', dot: 'rounded-full' },
]

const DENSITY_OPTIONS: { id: Density; label: string; gap: string }[] = [
  { id: 'compact', label: 'Compact', gap: 'gap-1' },
  { id: 'comfortable', label: 'Comfortable', gap: 'gap-2' },
  { id: 'spacious', label: 'Spacious', gap: 'gap-3' },
]

const SIDEBAR_POSITIONS: { id: SidebarPosition; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

const SIDEBAR_STYLES: { id: SidebarStyle; label: string; rail: string }[] = [
  { id: 'expanded', label: 'Expanded', rail: 'w-5' },
  { id: 'icons', label: 'Icons only', rail: 'w-1.5' },
]

const CONTENT_WIDTHS: { id: ContentWidth; label: string }[] = [
  { id: 'full', label: 'Full width' },
  { id: 'boxed', label: 'Boxed' },
]

const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  sm: 'Small text',
  md: 'Default text',
  lg: 'Large text',
  xl: 'Extra large text',
}

/* ------------------------------------------------------------------ */
/* Live preview                                                        */
/* ------------------------------------------------------------------ */

function LivePreview({ prefs, accentHex }: { prefs: AppearancePrefs; accentHex: string }) {
  const rows = [
    { id: '#1042', total: '₹2,490.00' },
    { id: '#1041', total: '₹4,980.00' },
    { id: '#1040', total: '₹7,470.00' },
  ]
  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-card p-5 shadow-gr-sm dark:ring-1 dark:ring-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Live preview</p>
          <p className="text-xs text-muted-foreground">{TEXT_SIZE_LABEL[prefs.textSize]}</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <div className="relative overflow-hidden bg-brand-gradient px-5 py-4 text-white">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full border-[20px] border-white/[0.08]"
            />
            <p className="relative text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">TruERP</p>
            <p className="relative mt-1 text-lg font-bold tracking-[-0.01em]">Sample panel</p>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" tabIndex={-1}>
                Primary
              </Button>
              <Button type="button" size="sm" variant="outline" tabIndex={-1}>
                Secondary
              </Button>
              <span className="rounded-full bg-tint px-2.5 py-1 text-xs font-medium text-primary">New</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex justify-between bg-surface-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Order</span>
                <span>Total</span>
              </div>
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className={cn(
                    'flex justify-between border-t border-border px-3 text-sm',
                    prefs.density === 'compact' ? 'py-1.5' : prefs.density === 'spacious' ? 'py-3.5' : 'py-2.5',
                    prefs.stripedRows && i % 2 === 1 && 'bg-surface-2'
                  )}
                >
                  <span className="font-medium text-heading">{row.id}</span>
                  <span className="tabular-nums text-foreground">{row.total}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-foreground">
              Body text reads like this. <span className="font-medium text-primary">Links use the accent.</span>
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          The whole app updates as you change settings. This card is a quick reference.
        </p>
      </div>
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: accentHex }} />
        Accent <span className="font-mono uppercase">{accentHex}</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AppearanceSettings({ showHeader = true }: { showHeader?: boolean }) {
  const { prefs, update, reset } = useAppearance()
  const { mode, setMode } = useThemeMode()
  const { themeId, customHex, setTheme } = useColorTheme()
  const [hexDraft, setHexDraft] = useState(customHex)
  const [resetNote, setResetNote] = useState(false)

  useEffect(() => setHexDraft(customHex), [customHex])

  useEffect(() => {
    if (!resetNote) return
    const t = setTimeout(() => setResetNote(false), 2500)
    return () => clearTimeout(t)
  }, [resetNote])

  const accentHex =
    themeId === 'custom' ? customHex : COLOR_THEMES.find((t) => t.id === themeId)?.swatch ?? COLOR_THEMES[0].swatch

  const applyHex = (value: string) => {
    const hex = normalizeHex(value)
    setHexDraft(hex)
    setTheme('custom', hex)
  }

  const resetAll = () => {
    reset()
    setMode('light')
    setTheme(DEFAULT_COLOR_THEME_ID, DEFAULT_CUSTOM_HEX)
    setResetNote(true)
  }

  const panels = prefs.dashboard.panels
  const setDashboard = (patch: Partial<AppearancePrefs['dashboard']>) =>
    update({ dashboard: { ...prefs.dashboard, ...patch } })
  const movePanel = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= panels.length) return
    const next = [...panels]
    ;[next[index], next[target]] = [next[target], next[index]]
    setDashboard({ panels: next })
  }
  const togglePanel = (index: number, visible: boolean) =>
    setDashboard({ panels: panels.map((p, i) => (i === index ? { ...p, visible } : p)) })

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-[-0.025em] text-heading sm:text-[2.125rem] sm:leading-10">
              Appearance
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Choose colours, text size and how content is arranged. Saved automatically for your account on this
              device.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {resetNote && (
              <span role="status" className="text-sm text-success">
                Defaults restored
              </span>
            )}
            <Button type="button" variant="outline" onClick={resetAll} className="rounded-xl">
              <RotateCcw className="h-4 w-4" />
              Reset to defaults
            </Button>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* ---------------- Colours ---------------- */}
          <SectionCard
            title="Colours"
            description="Theme and the accent used for buttons, highlights, the navigation rail and charts."
          >
            <Field label="Theme">
              <OptionGroup label="Theme" className="grid-cols-1 sm:grid-cols-3">
                {THEME_MODES.map((option) => (
                  <OptionCard
                    key={option.id}
                    label={option.label}
                    selected={mode === option.id}
                    onSelect={() => setMode(option.id)}
                  >
                    <MiniWindow dark={option.id === 'dark'} split={option.id === 'system'} />
                  </OptionCard>
                ))}
              </OptionGroup>
            </Field>

            <Field label="Accent colour">
              <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-x-3 gap-y-4">
                {COLOR_THEMES.map((theme) => {
                  const selected = themeId === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={theme.label}
                      title={`${theme.label} · ${theme.description}`}
                      onClick={() => setTheme(theme.id)}
                      className="group flex w-[4.5rem] flex-col items-center gap-1.5"
                    >
                      <span
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform duration-150 group-hover:scale-105',
                          selected && 'ring-2 ring-offset-2 ring-offset-card'
                        )}
                        style={{
                          background:
                            theme.id === 'monochrome'
                              ? 'linear-gradient(135deg, #ffffff 50%, #111111 50%)'
                              : `linear-gradient(135deg, hsl(${theme.scale[500]}), hsl(${theme.scale[700]}))`,
                          ...(theme.id === 'monochrome' ? { boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.15)' } : {}),
                          ...(selected ? { ['--tw-ring-color' as string]: `hsl(${theme.scale[800]})` } : {}),
                        }}
                      >
                        {selected && (
                          <Check
                            className={cn('h-4 w-4', theme.id === 'monochrome' && 'text-white mix-blend-difference')}
                            strokeWidth={3}
                          />
                        )}
                      </span>
                      <span
                        className={cn(
                          'text-[13px]',
                          selected ? 'font-medium text-heading' : 'text-muted-foreground'
                        )}
                      >
                        {theme.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label
                  className={cn(
                    'relative flex h-12 w-16 cursor-pointer items-center justify-center rounded-xl border bg-card p-1.5',
                    themeId === 'custom' ? 'border-primary' : 'border-input'
                  )}
                  title="Pick a custom accent"
                >
                  <span className="h-full w-full rounded-md" style={{ backgroundColor: customHex }} />
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => applyHex(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Custom accent colour"
                  />
                </label>
                <label htmlFor="custom-accent-hex" className="text-[15px] font-medium text-heading">
                  Custom
                </label>
                <input
                  id="custom-accent-hex"
                  value={hexDraft.toUpperCase()}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(e) => {
                    const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                    if (!/^#[0-9a-fA-F]{0,6}$/.test(value)) return
                    setHexDraft(value)
                    if (/^#[0-9a-fA-F]{6}$/.test(value)) setTheme('custom', value)
                  }}
                  onBlur={() => applyHex(hexDraft)}
                  className="h-11 w-32 rounded-xl border border-input bg-card px-3 font-mono text-sm uppercase text-heading outline-none transition-colors focus:border-primary"
                />
                {themeId === 'custom' && <CheckDot />}
              </div>
            </Field>
          </SectionCard>

          {/* ---------------- Text & shape ---------------- */}
          <SectionCard
            title="Text & shape"
            description="Make text easier to read and choose how rounded panels and controls look."
          >
            <Field label="Text size">
              <OptionGroup label="Text size" className="grid-cols-2 lg:grid-cols-4">
                {TEXT_SIZE_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.id}
                    label={option.label}
                    selected={prefs.textSize === option.id}
                    onSelect={() => update({ textSize: option.id })}
                  >
                    <span className="font-bold leading-none text-heading" style={{ fontSize: option.samplePx }}>
                      Aa
                    </span>
                  </OptionCard>
                ))}
              </OptionGroup>
            </Field>

            <Field label="Corner style">
              <OptionGroup label="Corner style" className="grid-cols-1 sm:grid-cols-3">
                {CORNER_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.id}
                    label={option.label}
                    selected={prefs.corners === option.id}
                    onSelect={() => update({ corners: option.id })}
                  >
                    <span className="flex items-end gap-2">
                      <span className={cn('h-10 w-[4.5rem] border-2 border-primary bg-tint', option.box)} />
                      <span className={cn('h-6 w-6 border-2 border-slate-300 bg-card', option.dot)} />
                    </span>
                  </OptionCard>
                ))}
              </OptionGroup>
            </Field>
          </SectionCard>

          {/* ---------------- Layout ---------------- */}
          <SectionCard title="Layout" description="How pages and navigation are arranged.">
            <Field label="Density" hint="Spacing around cards, tables and lists.">
              <OptionGroup label="Density" className="grid-cols-1 sm:grid-cols-3">
                {DENSITY_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.id}
                    label={option.label}
                    selected={prefs.density === option.id}
                    onSelect={() => update({ density: option.id })}
                  >
                    <MiniLines gap={option.gap} />
                  </OptionCard>
                ))}
              </OptionGroup>
            </Field>

            <div className="grid gap-7 lg:grid-cols-2 lg:gap-6">
              <Field label="Sidebar position" hint="On wide screens. Phones always use the bottom menu.">
                <OptionGroup label="Sidebar position" className="grid-cols-2">
                  {SIDEBAR_POSITIONS.map((option) => (
                    <OptionCard
                      key={option.id}
                      label={option.label}
                      selected={prefs.sidebarPosition === option.id}
                      onSelect={() => update({ sidebarPosition: option.id })}
                    >
                      <MiniLayout side={option.id} />
                    </OptionCard>
                  ))}
                </OptionGroup>
              </Field>
              <Field label="Sidebar style" hint="Icons only expands the menu when you hover it.">
                <OptionGroup label="Sidebar style" className="grid-cols-2">
                  {SIDEBAR_STYLES.map((option) => (
                    <OptionCard
                      key={option.id}
                      label={option.label}
                      selected={prefs.sidebarStyle === option.id}
                      onSelect={() => update({ sidebarStyle: option.id })}
                    >
                      <MiniLayout side={prefs.sidebarPosition} railWidth={option.rail} />
                    </OptionCard>
                  ))}
                </OptionGroup>
              </Field>
            </div>

            <Field label="Content width" hint="Boxed caps pages at 1200px and centres them on wide screens.">
              <OptionGroup label="Content width" className="grid-cols-2">
                {CONTENT_WIDTHS.map((option) => (
                  <OptionCard
                    key={option.id}
                    label={option.label}
                    selected={prefs.contentWidth === option.id}
                    onSelect={() => update({ contentWidth: option.id })}
                  >
                    <MiniWidth side={prefs.sidebarPosition} boxed={option.id === 'boxed'} />
                  </OptionCard>
                ))}
              </OptionGroup>
            </Field>

            <div className="grid gap-6 pt-1 lg:grid-cols-2">
              <ToggleRow
                label="Striped table rows"
                description="Alternate row shading for easier scanning."
                checked={prefs.stripedRows}
                onChange={(stripedRows) => update({ stripedRows })}
              />
              <ToggleRow
                label="Reduce motion"
                description="Turn off animations and transitions."
                checked={prefs.reduceMotion}
                onChange={(reduceMotion) => update({ reduceMotion })}
              />
              <ToggleRow
                label="Expand page stats"
                description="Stat cards at the top of list pages (Invoices, Inventory, Parties…) start open instead of behind the Stats button."
                checked={prefs.expandStats}
                onChange={(expandStats) => update({ expandStats })}
              />
            </div>
          </SectionCard>

          {/* ---------------- Dashboard arrangement ---------------- */}
          <SectionCard title="Dashboard arrangement" description="Reorder or hide the panels on your dashboard.">
            <ToggleRow
              label="Quick actions"
              description="Shortcut buttons under the greeting."
              checked={prefs.dashboard.quickActions}
              onChange={(quickActions) => setDashboard({ quickActions })}
            />

            <ol className="space-y-3">
              {panels.map((panel, index) => {
                const meta = DASHBOARD_PANELS[panel.id]
                return (
                  <li
                    key={panel.id}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 transition-opacity sm:gap-4 sm:px-5 sm:py-4',
                      !panel.visible && 'opacity-60'
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-heading">{meta.label}</p>
                      <p className="truncate text-sm text-muted-foreground">{meta.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => movePanel(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${meta.label} up`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePanel(index, 1)}
                        disabled={index === panels.length - 1}
                        aria-label={`Move ${meta.label} down`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <Switch
                        checked={panel.visible}
                        onCheckedChange={(visible) => togglePanel(index, visible)}
                        aria-label={`Show ${meta.label}`}
                        className="ml-1 sm:ml-2"
                      />
                    </div>
                  </li>
                )
              })}
            </ol>
          </SectionCard>
        </div>

        <aside className="xl:sticky xl:top-[calc(var(--app-header-h)+4.5rem)]">
          <LivePreview prefs={prefs} accentHex={accentHex} />
        </aside>
      </div>
    </div>
  )
}
