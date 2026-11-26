/**
 * Layout & readability preferences (text size, corners, density, sidebar,
 * dashboard arrangement). Colour theme and light/dark mode live in
 * colorThemes.ts / themeMode.ts and sync to the server; these prefs are kept
 * per account on this device.
 *
 * Each pref is mirrored onto <html> as a data attribute so plain CSS in
 * globals.css can react without re-rendering the tree.
 */

export const APPEARANCE_STORAGE_KEY = 'truerp-appearance'

export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export const CORNER_STYLES = ['sharp', 'default', 'round'] as const
export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export const SIDEBAR_POSITIONS = ['left', 'right'] as const
export const SIDEBAR_STYLES = ['expanded', 'icons'] as const
export const CONTENT_WIDTHS = ['full', 'boxed'] as const

export type TextSize = (typeof TEXT_SIZES)[number]
export type CornerStyle = (typeof CORNER_STYLES)[number]
export type Density = (typeof DENSITIES)[number]
export type SidebarPosition = (typeof SIDEBAR_POSITIONS)[number]
export type SidebarStyle = (typeof SIDEBAR_STYLES)[number]
export type ContentWidth = (typeof CONTENT_WIDTHS)[number]

export const DASHBOARD_PANEL_IDS = ['overview', 'kpis', 'trends', 'cashflow', 'leaders'] as const
export type DashboardPanelId = (typeof DASHBOARD_PANEL_IDS)[number]

export const DASHBOARD_PANELS: Record<DashboardPanelId, { label: string; description: string }> = {
  overview: { label: 'Greeting & receivables', description: 'Period sales, quick actions and money to collect' },
  kpis: { label: 'Key metrics', description: 'Invoices, average invoice value, cash flow, net position' },
  trends: { label: 'Sales trend & invoice status', description: 'Trend chart and paid / unpaid split' },
  cashflow: { label: 'Cash flow & payment modes', description: 'Money in and out, and how customers pay' },
  leaders: { label: 'Top debtors, products & customers', description: 'Who owes you, best sellers and best customers' },
}

export interface DashboardPanelPref {
  id: DashboardPanelId
  visible: boolean
}

export interface AppearancePrefs {
  textSize: TextSize
  corners: CornerStyle
  density: Density
  sidebarPosition: SidebarPosition
  sidebarStyle: SidebarStyle
  contentWidth: ContentWidth
  stripedRows: boolean
  reduceMotion: boolean
  /** Stat cards at the top of list pages start expanded. */
  expandStats: boolean
  dashboard: {
    quickActions: boolean
    panels: DashboardPanelPref[]
  }
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  textSize: 'md',
  corners: 'default',
  density: 'comfortable',
  sidebarPosition: 'left',
  sidebarStyle: 'icons',
  contentWidth: 'full',
  stripedRows: false,
  reduceMotion: false,
  expandStats: false,
  dashboard: {
    quickActions: true,
    panels: DASHBOARD_PANEL_IDS.map((id) => ({ id, visible: true })),
  },
}

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Keeps saved order, drops unknown ids, appends panels added in later releases. */
function normalizePanels(value: unknown): DashboardPanelPref[] {
  const seen = new Set<DashboardPanelId>()
  const panels: DashboardPanelPref[] = []
  if (Array.isArray(value)) {
    for (const entry of value) {
      const id = pick(DASHBOARD_PANEL_IDS, (entry as DashboardPanelPref | null)?.id, 'overview')
      if ((entry as DashboardPanelPref | null)?.id !== id || seen.has(id)) continue
      seen.add(id)
      panels.push({ id, visible: bool((entry as DashboardPanelPref).visible, true) })
    }
  }
  for (const id of DASHBOARD_PANEL_IDS) {
    if (!seen.has(id)) panels.push({ id, visible: true })
  }
  return panels
}

export function normalizeAppearance(raw: unknown): AppearancePrefs {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof AppearancePrefs, unknown>>
  const d = DEFAULT_APPEARANCE
  const dash = (v.dashboard && typeof v.dashboard === 'object' ? v.dashboard : {}) as Partial<
    Record<'quickActions' | 'panels', unknown>
  >
  return {
    textSize: pick(TEXT_SIZES, v.textSize, d.textSize),
    corners: pick(CORNER_STYLES, v.corners, d.corners),
    density: pick(DENSITIES, v.density, d.density),
    sidebarPosition: pick(SIDEBAR_POSITIONS, v.sidebarPosition, d.sidebarPosition),
    sidebarStyle: pick(SIDEBAR_STYLES, v.sidebarStyle, d.sidebarStyle),
    contentWidth: pick(CONTENT_WIDTHS, v.contentWidth, d.contentWidth),
    stripedRows: bool(v.stripedRows, d.stripedRows),
    reduceMotion: bool(v.reduceMotion, d.reduceMotion),
    expandStats: bool(v.expandStats, d.expandStats),
    dashboard: {
      quickActions: bool(dash.quickActions, d.dashboard.quickActions),
      panels: normalizePanels(dash.panels),
    },
  }
}

/** Data attributes on <html>; globals.css keys off these. */
export function appearanceAttributes(prefs: AppearancePrefs): Record<string, string> {
  return {
    'data-text-size': prefs.textSize,
    'data-corners': prefs.corners,
    'data-density': prefs.density,
    'data-sidebar-position': prefs.sidebarPosition,
    'data-sidebar-style': prefs.sidebarStyle,
    'data-content-width': prefs.contentWidth,
    'data-striped': String(prefs.stripedRows),
    'data-reduce-motion': String(prefs.reduceMotion),
  }
}

export function applyAppearanceToDocument(prefs: AppearancePrefs) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [key, value] of Object.entries(appearanceAttributes(prefs))) {
    root.setAttribute(key, value)
  }
}

function userKey(userId: string) {
  return `${APPEARANCE_STORAGE_KEY}:${userId}`
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Reads this account's prefs; falls back to the device copy (last signed-in
 * account) so the first visit after an upgrade keeps what the bootstrap painted.
 */
export function readStoredAppearance(userId?: string | null): AppearancePrefs | null {
  if (typeof window === 'undefined') return null
  const raw = (userId ? readJson(userKey(userId)) : null) ?? readJson(APPEARANCE_STORAGE_KEY)
  return raw ? normalizeAppearance(raw) : null
}

export function persistAppearance(prefs: AppearancePrefs, userId?: string | null) {
  applyAppearanceToDocument(prefs)
  if (typeof window === 'undefined') return
  try {
    const json = JSON.stringify(prefs)
    localStorage.setItem(APPEARANCE_STORAGE_KEY, json)
    if (userId) localStorage.setItem(userKey(userId), json)
  } catch {
    // Storage full or blocked — prefs still apply for this session.
  }
}

/** Runs before hydration so text size / corners / density never flash. */
export const APPEARANCE_BOOTSTRAP_SCRIPT = `(function(){try{var raw=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');if(!raw)return;var p=JSON.parse(raw)||{};var r=document.documentElement;var m={textSize:'data-text-size',corners:'data-corners',density:'data-density',sidebarPosition:'data-sidebar-position',sidebarStyle:'data-sidebar-style',contentWidth:'data-content-width',stripedRows:'data-striped',reduceMotion:'data-reduce-motion'};for(var k in m){if(p[k]!==undefined&&p[k]!==null)r.setAttribute(m[k],String(p[k]));}}catch(e){}})();`
