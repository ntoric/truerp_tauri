'use client'

import { useEffect, useState, type ReactNode } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge, type StatusBadgeTone } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FieldError } from '@/components/ui/field-error'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PaginationControls from '@/components/ui/pagination-controls'
import { COLOR_THEMES, THEME_SHADES } from '@/lib/colorThemes'
import { useColorTheme } from '@/hooks/useColorTheme'
import { useThemeMode } from '@/hooks/useThemeMode'
import { navItems } from '@/components/layout/nav-config'
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { SquaresFour } from '@phosphor-icons/react'
import {
  Check,
  Copy,
  Trash2,
  Plus,
  Download,
  Mail,
  Bell,
  Search,
  Loader2,
  ChevronDown,
  Palette,
  Type,
  Component,
  Shapes,
  Fingerprint,
  Ruler,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an "H S% L%" channel string (shadcn CSS var format) to hex. */
function hslChannelsToHex(hsl: string): string {
  const m = /([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(hsl)
  if (!m) return ''
  const h = Number(m[1])
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const SEMANTIC_TOKENS = [
  { name: '--primary', label: 'Primary' },
  { name: '--primary-foreground', label: 'Primary Foreground' },
  { name: '--background', label: 'Background' },
  { name: '--foreground', label: 'Foreground' },
  { name: '--card', label: 'Card' },
  { name: '--card-foreground', label: 'Card Foreground' },
  { name: '--popover', label: 'Popover' },
  { name: '--popover-foreground', label: 'Popover Foreground' },
  { name: '--secondary', label: 'Secondary' },
  { name: '--secondary-foreground', label: 'Secondary Foreground' },
  { name: '--muted', label: 'Muted' },
  { name: '--muted-foreground', label: 'Muted Foreground' },
  { name: '--accent', label: 'Accent' },
  { name: '--accent-foreground', label: 'Accent Foreground' },
  { name: '--destructive', label: 'Destructive' },
  { name: '--destructive-foreground', label: 'Destructive Foreground' },
  { name: '--border', label: 'Border' },
  { name: '--input', label: 'Input' },
  { name: '--ring', label: 'Ring' },
] as const

const STATUS_TONES: StatusBadgeTone[] = [
  'neutral',
  'brand',
  'info',
  'success',
  'warning',
  'danger',
  'violet',
  'pink',
  'teal',
]

const STATUS_EXAMPLES = ['paid', 'pending', 'overdue', 'partial', 'sent', 'cancelled']

const LUCIDE_ICONS = { Plus, Download, Mail, Bell, Search, Trash2, Check, Loader2 }

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={`Copy ${text}`}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          // Clipboard unavailable (non-secure context) — ignore.
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function DemoLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </p>
  )
}

/** Reads live CSS variable values; re-reads when theme/mode changes. */
function useTokenValues() {
  const { themeId, customHex } = useColorTheme()
  const { resolvedMode } = useThemeMode()
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    const next: Record<string, string> = {}
    for (const token of SEMANTIC_TOKENS) {
      next[token.name] = styles.getPropertyValue(token.name).trim()
    }
    next['--radius'] = styles.getPropertyValue('--radius').trim()
    setValues(next)
  }, [themeId, customHex, resolvedMode])
  return values
}

// ---------------------------------------------------------------------------
// Tab sections
// ---------------------------------------------------------------------------

function BrandSection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Logo"
        description="TruERP wordmark — 'Tru' in near-black, 'ERP' in brand RuneRail red."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center rounded-xl border border-border/70 bg-white p-8">
            <BrandLogo />
          </div>
          <div className="flex items-center justify-center rounded-xl bg-slate-900 p-8">
            <BrandLogo wordmarkClassName="text-white" />
          </div>
          <div className="flex items-center gap-6 rounded-xl border border-border/70 p-6">
            <div className="flex flex-col items-center gap-2">
              <BrandLogo showWordmark={false} />
              <span className="text-[11px] text-muted-foreground">Icon only</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <BrandLogo iconClassName="h-6 w-6" wordmarkClassName="text-base" />
              <span className="text-[11px] text-muted-foreground">Compact</span>
            </div>
          </div>
          <DemoLabel>Assets</DemoLabel>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
            {['/logo.svg', '/logo.png', '/apple-touch-icon.png'].map((src) => (
              <div key={src} className="rounded-lg border border-border/70 p-3">
                <img src={src} alt={src} className="mx-auto mb-2 h-8 w-8 object-contain" />
                <code className="font-mono">{src}</code>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard
          title="Brand color — RuneRail"
          description="Default identity color. Powers the primary token, focus rings, gradients and the sidebar dock."
        >
          <div className="overflow-hidden rounded-xl border border-border/70">
            <div className="flex h-28 items-end bg-[#c81e3a] p-4">
              <span className="text-lg font-bold text-white">RuneRail Red</span>
            </div>
            <div className="flex items-center justify-between p-3 text-xs">
              <code className="font-mono">#c81e3a</code>
              <CopyButton text="#c81e3a" />
            </div>
            <div className="flex items-center justify-between border-t border-border/70 p-3 text-xs">
              <code className="font-mono">hsl(350 74% 45%)</code>
              <CopyButton text="hsl(350 74% 45%)" />
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            The primary color is fully themeable — 10 preset scales plus a custom
            hex are available under Settings → Appearance. All semantic tokens,
            the <code className="font-mono">blue-*</code> Tailwind ramp and the
            gradient surfaces derive from the active scale.
          </div>
        </SectionCard>

        <SectionCard title="Voice & product feel">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Dense, compact ERP chrome tuned for ~21" / 1080p displays.</li>
            <li>Semantic status language: paid/success → emerald, pending → amber, overdue → rose.</li>
            <li>Soft surfaces: rounded-2xl cards, hairline borders, layered low-opacity shadows.</li>
            <li>Phosphor duotone icons for navigation; Lucide for in-page actions.</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

function ColorsSection({ values }: { values: Record<string, string> }) {
  const { themeId, setTheme } = useColorTheme()
  return (
    <div className="space-y-4">
      <SectionCard
        title="Semantic tokens"
        description="CSS variables in shadcn convention (H S% L% channels). Values shown resolve live for the active theme and mode — click copy to grab a token."
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SEMANTIC_TOKENS.map((token) => {
            const raw = values[token.name] ?? ''
            const hex = hslChannelsToHex(raw)
            return (
              <div
                key={token.name}
                className="flex items-center gap-3 rounded-lg border border-border/70 p-2"
              >
                <div
                  className="h-9 w-9 shrink-0 rounded-md border border-black/10"
                  style={{ backgroundColor: `hsl(var(${token.name}))` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{token.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {token.name} · {hex || raw || '—'}
                  </div>
                </div>
                <CopyButton text={token.name} />
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Theme scales"
        description="Preset color themes (50–950). shade-600 feeds --primary / --ring. Apply one to preview it live."
      >
        <div className="space-y-3">
          {COLOR_THEMES.map((theme) => (
            <div key={theme.id} className="rounded-xl border border-border/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: theme.swatch }}
                  />
                  <span className="text-sm font-medium">{theme.label}</span>
                  <span className="text-xs text-muted-foreground">{theme.description}</span>
                  {themeId === theme.id && (
                    <StatusBadge tone="success">active</StatusBadge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <code className="font-mono text-[11px] text-muted-foreground">{theme.swatch}</code>
                  <CopyButton text={theme.swatch} />
                  {themeId !== theme.id && (
                    <Button variant="ghost" size="sm" onClick={() => setTheme(theme.id)}>
                      Apply
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-border/60">
                {THEME_SHADES.map((shade) => (
                  <div
                    key={shade}
                    className="flex h-10 flex-1 items-end justify-center pb-1"
                    style={{ backgroundColor: `hsl(${theme.scale[shade]})` }}
                    title={`${shade} — hsl(${theme.scale[shade]})`}
                  >
                    <span
                      className={cn(
                        'text-[9px] font-medium',
                        shade >= 400 ? 'text-white/90' : 'text-black/60'
                      )}
                    >
                      {shade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Status tones"
          description="StatusBadge tone families — dot + tinted chip. Tone is inferred from common status strings."
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_TONES.map((tone) => (
              <StatusBadge key={tone} tone={tone}>
                {tone}
              </StatusBadge>
            ))}
          </div>
          <DemoLabel>Inferred from status</DemoLabel>
          <div className="flex flex-wrap gap-2">
            {STATUS_EXAMPLES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Navigation accents"
          description="Per-module hex accents used to tint duotone icons and active states in the sidebar."
        >
          <div className="grid grid-cols-2 gap-1.5">
            {navItems
              .filter((item) => item.accent)
              .map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                  >
                    <Icon weight="duotone" className="h-4 w-4" style={{ color: item.accent }} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <code className="font-mono text-[10px] text-muted-foreground">
                      {item.accent}
                    </code>
                    <CopyButton text={item.accent!} />
                  </div>
                )
              })}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function TypographySection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Typeface — Inter"
        description="Single family across the product (next/font/google). Compact sizes for ERP density."
      >
        <div className="space-y-5">
          <div className="border-b border-border/60 pb-4">
            <DemoLabel>Wordmark · text-2xl font-bold tracking-tight</DemoLabel>
            <p className="text-2xl font-bold tracking-tight">
              Tru<span className="text-primary">ERP</span>
            </p>
          </div>
          <div className="border-b border-border/60 pb-4">
            <DemoLabel>Page title · .app-page-title</DemoLabel>
            <p className="app-page-title">Sales Invoices — March 2026</p>
          </div>
          <div className="border-b border-border/60 pb-4">
            <DemoLabel>Section heading · text-lg font-semibold</DemoLabel>
            <p className="text-lg font-semibold tracking-tight">Payment summary</p>
          </div>
          <div className="border-b border-border/60 pb-4">
            <DemoLabel>Card title · text-[15px] font-semibold</DemoLabel>
            <p className="text-[15px] font-semibold leading-none tracking-tight">
              Outstanding receivables
            </p>
          </div>
          <div className="border-b border-border/60 pb-4">
            <DemoLabel>Body · text-sm</DemoLabel>
            <p className="text-sm">
              Invoice INV-1024 for Acme Corp was created on 12 Oct 2026 with 3 line
              items totalling ₹18,240.00 including 18% GST.
            </p>
          </div>
          <div className="border-b border-border/60 pb-4">
            <DemoLabel>Secondary · text-sm text-muted-foreground</DemoLabel>
            <p className="text-sm text-muted-foreground">
              Last synced 4 minutes ago · 12 of 128 invoices unpaid
            </p>
          </div>
          <div>
            <DemoLabel>Caption · text-xs text-muted-foreground</DemoLabel>
            <p className="text-xs text-muted-foreground">
              HSN 8523 · Unit PCS · Min stock 5
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Numeric & code">
          <div className="space-y-4">
            <div>
              <DemoLabel>Stat · text-2xl font-semibold tabular-nums</DemoLabel>
              <p className="text-2xl font-semibold tabular-nums">₹4,28,190.50</p>
            </div>
            <div>
              <DemoLabel>Inline code · font-mono</DemoLabel>
              <p className="text-sm">
                Press{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  Ctrl+K
                </code>{' '}
                to search, or check{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  /api/v1/invoices
                </code>
              </p>
            </div>
            <div>
              <DemoLabel>Table numerals · tabular-nums</DemoLabel>
              <div className="flex gap-6 font-mono text-sm tabular-nums">
                <span>1,240.00</span>
                <span>96.50</span>
                <span>18,003.75</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Usage rules">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Page titles use the compact <code className="font-mono text-xs">.app-page-title</code> class, never raw h1 sizing.</li>
            <li>Currency and table numerals use tabular figures for column alignment.</li>
            <li>Muted foreground for metadata, timestamps and secondary text.</li>
            <li>Semibold for titles; medium for controls; regular for body copy.</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

function TokensSection({ values }: { values: Record<string, string> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Radius"
        description={`Base --radius: ${values['--radius'] || '0.375rem'} · sm = −4px, md = −2px, lg = base`}
      >
        <div className="flex flex-wrap items-end gap-3">
          {[
            { cls: 'rounded-sm', label: 'sm' },
            { cls: 'rounded-md', label: 'md' },
            { cls: 'rounded-lg', label: 'lg' },
            { cls: 'rounded-xl', label: 'xl' },
            { cls: 'rounded-2xl', label: '2xl · cards' },
            { cls: 'rounded-full', label: 'full · chips' },
          ].map((r) => (
            <div key={r.cls} className="flex flex-col items-center gap-1.5">
              <div className={cn('h-14 w-14 border-2 border-primary/60 bg-primary/10', r.cls)} />
              <span className="font-mono text-[10px] text-muted-foreground">{r.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Elevation"
        description="Layered low-opacity shadows — hairline base plus a soft drop. Buttons add a tinted glow in the theme color."
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="flex h-16 items-center justify-center rounded-xl border border-border/70 bg-card text-[11px] text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            hairline
          </div>
          <div className="flex h-16 items-center justify-center rounded-xl border border-border/70 bg-card text-[11px] text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.18)]">
            card
          </div>
          <div className="flex h-16 items-center justify-center rounded-xl bg-primary text-[11px] text-primary-foreground shadow-[0_1px_2px_rgba(16,24,40,0.12),0_4px_12px_-4px_hsl(var(--primary)/0.6),inset_0_1px_0_rgba(255,255,255,0.2)]">
            action
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Layout & chrome">
        <div className="space-y-2 font-mono text-xs">
          {[
            ['--app-header-h', '3.5rem · floating header'],
            ['--app-bottom-nav-h', '3.5rem / 3.25rem · mobile menubar'],
            ['sidebar rail', 'w-14 collapsed · md:ml-[4.5rem]'],
            ['app bg', '#f6f7fb light · hsl(224 45% 6%) dark'],
            ['page padding', 'p-3 sm:p-4 lg:p-5 (.app-main)'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
            >
              <span className="text-muted-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Focus & interaction"
        description="No blue focus boxes on click — soft primary-tinted ring on fields; visible outline only after keyboard Tab."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            input:focus → border primary/50<br />
            box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12)<br />
            body[data-keyboard-nav] :focus-visible → outline primary/45
          </div>
          <DemoLabel>Try it — click vs Tab</DemoLabel>
          <Input placeholder="Focus me with mouse, then Tab to another field" />
        </div>
      </SectionCard>
    </div>
  )
}

function ComponentsSection() {
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)
  const [slider, setSlider] = useState([40])
  const [selectVal, setSelectVal] = useState('gst')
  const [searchVal, setSearchVal] = useState('')
  const [page, setPage] = useState(2)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Buttons" description="6 variants · h-8 default density">
          <DemoLabel>Variants</DemoLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button>Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <DemoLabel>Sizes</DemoLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <DemoLabel>States</DemoLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled>Disabled</Button>
            <Button>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Badges" description="Pill chips with inset ring">
          <DemoLabel>Badge variants</DemoLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <DemoLabel>StatusBadge · domain statuses</DemoLabel>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="paid" />
            <StatusBadge status="pending" />
            <StatusBadge status="overdue" />
            <StatusBadge status="partial" />
            <StatusBadge status="sent" />
            <StatusBadge status="cancelled" />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Forms" description="Fields share the soft primary focus treatment">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dk-name">Party name</Label>
              <Input id="dk-name" placeholder="Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dk-gst">GSTIN</Label>
              <Input id="dk-gst" placeholder="29ABCDE1234F1Z5" aria-invalid />
              <FieldError message="Enter a valid 15-character GSTIN" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dk-notes">Notes</Label>
              <Textarea id="dk-notes" placeholder="Delivery instructions…" rows={3} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tax rate</Label>
              <Select value={selectVal} onValueChange={setSelectVal}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exempt">Exempt (0%)</SelectItem>
                  <SelectItem value="gst5">GST 5%</SelectItem>
                  <SelectItem value="gst">GST 18%</SelectItem>
                  <SelectItem value="gst28">GST 28%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <SearchableSelect
                value={searchVal}
                onValueChange={setSearchVal}
                placeholder="Search warehouse…"
                options={[
                  { value: 'main', label: 'Main Warehouse' },
                  { value: 'retail', label: 'Retail Store' },
                  { value: 'godown', label: 'Godown B' },
                ]}
              />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                Track batch
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={switched} onCheckedChange={setSwitched} />
                Low-stock alert
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Discount — {slider[0]}%</Label>
              <Slider value={slider} onValueChange={setSlider} max={100} step={5} />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Data display">
          <DemoLabel>Table</DemoLabel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">INV-1024</TableCell>
                <TableCell>Acme Corp</TableCell>
                <TableCell className="text-right tabular-nums">₹18,240.00</TableCell>
                <TableCell><StatusBadge status="paid" /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV-1025</TableCell>
                <TableCell>Global Traders</TableCell>
                <TableCell className="text-right tabular-nums">₹4,120.50</TableCell>
                <TableCell><StatusBadge status="pending" /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV-1026</TableCell>
                <TableCell>Sunrise Mart</TableCell>
                <TableCell className="text-right tabular-nums">₹9,870.00</TableCell>
                <TableCell><StatusBadge status="overdue" /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <PaginationControls
            page={page}
            totalPages={5}
            totalItems={118}
            pageSize={25}
            onPageChange={setPage}
            className="static border-t-0"
          />
          <DemoLabel>Skeleton</DemoLabel>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton delayMs={90} className="h-3 w-1/3" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Overlays & feedback">
          <DemoLabel>Dialog · Confirm · Tooltip · Popover · Menu</DemoLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record payment</DialogTitle>
                  <DialogDescription>
                    Dialogs use the shared overlay + rounded-2xl card surface.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5 py-2">
                  <Label htmlFor="dk-amt">Amount</Label>
                  <Input id="dk-amt" placeholder="₹0.00" />
                </div>
                <DialogFooter>
                  <Button>Save payment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Delete…
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Delete invoice?"
              description="This permanently removes INV-1026 and its payment records."
              confirmLabel="Delete"
              onConfirm={() => setConfirmOpen(false)}
            />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>3 unread notifications</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="text-sm">
                Quick filters, pickers and mini-forms live in popovers.
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Actions <ChevronDown className="ml-1.5 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Invoice</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuItem>Download PDF</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DemoLabel>Tabs</DemoLabel>
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="pt-2 text-sm text-muted-foreground">
              Tabs keep the underline-style active state in the theme color.
            </TabsContent>
            <TabsContent value="items" className="pt-2 text-sm text-muted-foreground">
              3 items · ₹18,240.00
            </TabsContent>
            <TabsContent value="payments" className="pt-2 text-sm text-muted-foreground">
              Fully paid via UPI on 14 Oct.
            </TabsContent>
          </Tabs>

          <DemoLabel>Toast notifications</DemoLabel>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => notifySuccess('Invoice saved')}>
              Success
            </Button>
            <Button variant="outline" size="sm" onClick={() => notifyInfo('Sync scheduled for 9 PM')}>
              Info
            </Button>
            <Button variant="outline" size="sm" onClick={() => notifyWarning('Stock below minimum')}>
              Warning
            </Button>
            <Button variant="outline" size="sm" onClick={() => notifyError('GSTIN validation failed')}>
              Error
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Card anatomy" description="rounded-2xl · border/70 · hairline + soft layered shadow · p-4 header/content">
        <div className="max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>Monthly sales</CardTitle>
              <CardDescription>Oct 1 – Oct 17, 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">₹4,28,190</p>
              <p className="mt-1 text-xs text-muted-foreground">+12.4% vs September</p>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost" size="sm">Details</Button>
              <Button size="sm">View report</Button>
            </CardFooter>
          </Card>
        </div>
      </SectionCard>
    </div>
  )
}

function IconsSection() {
  const lucideEntries = Object.entries(LUCIDE_ICONS)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Phosphor — navigation"
        description="Duotone weight at rest, fill when active. Tinted with each module's accent color."
      >
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.name}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border/50 p-3"
              >
                <Icon
                  weight="duotone"
                  className="h-6 w-6"
                  style={{ color: item.accent || 'hsl(var(--primary))' }}
                />
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {item.name}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <SquaresFour weight="duotone" className="h-4 w-4 text-primary" /> duotone · rest
          </span>
          <span className="flex items-center gap-1.5">
            <SquaresFour weight="fill" className="h-4 w-4 text-primary" /> fill · active
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Lucide — in-page actions"
        description="h-4 w-4 inside buttons and menus; used for utility/action glyphs."
      >
        <div className="grid grid-cols-4 gap-1.5">
          {lucideEntries.map(([name, Icon]) => (
            <div
              key={name}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/50 p-3"
            >
              <Icon className="h-5 w-5 text-foreground" />
              <span className="text-[10px] text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DesignKitPage() {
  const values = useTokenValues()

  return (
    <TooltipProvider>
      <Tabs defaultValue="brand" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:grid sm:grid-cols-6">
          <TabsTrigger value="brand" className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Brand
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Tokens
          </TabsTrigger>
          <TabsTrigger value="components" className="flex items-center gap-2">
            <Component className="h-4 w-4" />
            Components
          </TabsTrigger>
          <TabsTrigger value="icons" className="flex items-center gap-2">
            <Shapes className="h-4 w-4" />
            Icons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandSection />
        </TabsContent>
        <TabsContent value="colors">
          <ColorsSection values={values} />
        </TabsContent>
        <TabsContent value="typography">
          <TypographySection />
        </TabsContent>
        <TabsContent value="tokens">
          <TokensSection values={values} />
        </TabsContent>
        <TabsContent value="components">
          <ComponentsSection />
        </TabsContent>
        <TabsContent value="icons">
          <IconsSection />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  )
}
