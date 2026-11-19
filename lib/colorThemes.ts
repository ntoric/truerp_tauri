export const COLOR_THEME_STORAGE_KEY = 'truerp-color-theme'

export const THEME_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export type ThemeShade = (typeof THEME_SHADES)[number]
export type ThemeScale = Record<ThemeShade, string>

export const COLOR_THEME_IDS = [
  'crimson',
  'rose',
  'tangerine',
  'amber',
  'emerald',
  'teal',
  'ocean',
  'indigo',
  'plum',
  'graphite',
  'monochrome',
  'custom',
] as const

export type ColorThemeId = (typeof COLOR_THEME_IDS)[number]

/** Ids from earlier releases, mapped to the closest current preset. */
const LEGACY_THEME_IDS: Record<string, ColorThemeId> = {
  runerail: 'crimson',
  blue: 'ocean',
  sky: 'ocean',
  violet: 'indigo',
  purple: 'plum',
  orange: 'tangerine',
  slate: 'graphite',
}

export interface ColorThemeDefinition {
  id: Exclude<ColorThemeId, 'custom'>
  label: string
  description: string
  swatch: string
  scale: ThemeScale
}

export interface StoredColorTheme {
  id: ColorThemeId
  customHex: string
  vars: Record<string, string>
}

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'crimson'
export const DEFAULT_CUSTOM_HEX = '#1a64d1'

/**
 * HSL channels as "H S% L%" — matches the shadcn CSS variable convention.
 * Crimson is the Gooseroot brand ramp: 500 Scarlet #F0140A, 600 Red #D4031A,
 * 700 Crimson #B8002E, 900 Deep Wine #5C0012, 950 heading wine #4A0010.
 */
export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'crimson',
    label: 'Crimson',
    description: 'Brand default',
    swatch: '#d4031a',
    scale: {
      50: '352 79% 96%',
      100: '352 79% 93%',
      200: '352 79% 85%',
      300: '353 80% 75%',
      400: '355 81% 62%',
      500: '3 92% 49%',
      600: '353 97% 42%',
      700: '345 100% 36%',
      800: '344 100% 28%',
      900: '348 100% 18%',
      950: '347 100% 15%',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Warm',
    swatch: '#be2a60',
    scale: {
      50: '337 76% 97%',
      100: '338 77% 93%',
      200: '337 75% 86%',
      300: '337 74% 76%',
      400: '339 70% 64%',
      500: '338 66% 53%',
      600: '338 64% 45%',
      700: '338 67% 37%',
      800: '337 66% 30%',
      900: '336 66% 22%',
      950: '335 73% 14%',
    },
  },
  {
    id: 'tangerine',
    label: 'Tangerine',
    description: 'Energetic',
    swatch: '#cc4a10',
    scale: {
      50: '22 100% 96%',
      100: '22 100% 91%',
      200: '22 98% 82%',
      300: '20 96% 71%',
      400: '19 91% 60%',
      500: '19 83% 50%',
      600: '19 85% 43%',
      700: '17 83% 36%',
      800: '15 76% 29%',
      900: '14 71% 22%',
      950: '15 77% 14%',
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    description: 'Golden',
    swatch: '#a66914',
    scale: {
      50: '41 83% 95%',
      100: '43 83% 88%',
      200: '42 82% 76%',
      300: '41 80% 63%',
      400: '38 72% 52%',
      500: '37 76% 44%',
      600: '35 78% 36%',
      700: '33 75% 30%',
      800: '32 69% 24%',
      900: '31 64% 18%',
      950: '32 71% 11%',
    },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Growth',
    swatch: '#1b724f',
    scale: {
      50: '150 46% 95%',
      100: '151 48% 88%',
      200: '152 46% 76%',
      300: '154 43% 61%',
      400: '155 45% 45%',
      500: '156 58% 34%',
      600: '156 62% 28%',
      700: '157 60% 22%',
      800: '157 57% 18%',
      900: '156 54% 14%',
      950: '156 63% 8%',
    },
  },
  {
    id: 'teal',
    label: 'Teal',
    description: 'Fresh',
    swatch: '#1f6b77',
    scale: {
      50: '185 48% 95%',
      100: '186 50% 87%',
      200: '186 49% 75%',
      300: '186 46% 60%',
      400: '187 47% 45%',
      500: '188 56% 36%',
      600: '188 59% 29%',
      700: '189 56% 24%',
      800: '189 53% 20%',
      900: '189 51% 15%',
      950: '189 58% 9%',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Calm',
    swatch: '#2a54bd',
    scale: {
      50: '216 79% 96%',
      100: '217 80% 92%',
      200: '218 78% 84%',
      300: '219 75% 73%',
      400: '220 70% 62%',
      500: '222 63% 53%',
      600: '223 64% 45%',
      700: '224 62% 37%',
      800: '223 58% 30%',
      900: '223 56% 23%',
      950: '223 57% 15%',
    },
  },
  {
    id: 'indigo',
    label: 'Indigo',
    description: 'Deep',
    swatch: '#4c3fc4',
    scale: {
      50: '240 76% 97%',
      100: '240 77% 93%',
      200: '241 74% 86%',
      300: '242 73% 77%',
      400: '244 69% 67%',
      500: '245 63% 59%',
      600: '246 53% 51%',
      700: '247 52% 42%',
      800: '247 49% 34%',
      900: '246 46% 25%',
      950: '246 48% 16%',
    },
  },
  {
    id: 'plum',
    label: 'Plum',
    description: 'Rich',
    swatch: '#7e30b6',
    scale: {
      50: '277 68% 96%',
      100: '277 71% 92%',
      200: '278 69% 84%',
      300: '277 67% 73%',
      400: '277 63% 62%',
      500: '276 58% 53%',
      600: '275 58% 45%',
      700: '275 56% 37%',
      800: '274 53% 30%',
      900: '275 52% 22%',
      950: '275 58% 14%',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Neutral',
    swatch: '#3a3a3f',
    scale: {
      50: '240 5% 96%',
      100: '240 5% 92%',
      200: '240 5% 84%',
      300: '240 5% 70%',
      400: '240 3% 55%',
      500: '240 3% 43%',
      600: '240 4% 24%',
      700: '240 4% 18%',
      800: '240 3% 14%',
      900: '240 3% 11%',
      950: '240 4% 8%',
    },
  },
  {
    // Pure greys. In dark mode globals.css flips the accent to white
    // (see [data-color-theme='monochrome']), since black would vanish.
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Black & white',
    swatch: '#1f1f1f',
    scale: {
      50: '0 0% 96%',
      100: '0 0% 92%',
      200: '0 0% 85%',
      300: '0 0% 72%',
      400: '0 0% 56%',
      500: '0 0% 28%',
      600: '0 0% 12%',
      700: '0 0% 6%',
      800: '0 0% 5%',
      900: '0 0% 4%',
      950: '0 0% 4%',
    },
  },
]

const THEME_BY_ID = new Map(COLOR_THEMES.map((theme) => [theme.id, theme]))

export function isColorThemeId(value: string | null | undefined): value is ColorThemeId {
  return !!value && (COLOR_THEME_IDS as readonly string[]).includes(value)
}

/** Resolves current and legacy ids; returns null for anything unknown. */
export function normalizeColorThemeId(value: string | null | undefined): ColorThemeId | null {
  if (!value) return null
  if (isColorThemeId(value)) return value
  return LEGACY_THEME_IDS[value] ?? null
}

export function normalizeHex(hex: string): string {
  const value = hex.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(value)
  if (short) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase()
  return DEFAULT_CUSTOM_HEX
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = normalizeHex(hex).slice(1)
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

function hslString(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(Math.min(100, Math.max(0, s)))}% ${Math.round(Math.min(100, Math.max(0, l)))}%`
}

export function scaleFromHex(hex: string): ThemeScale {
  const { h, s, l } = hexToHsl(hex)
  const sat = Math.max(s, 35)
  return {
    50: hslString(h, Math.min(sat, 100), 97),
    100: hslString(h, Math.min(sat, 95), 93),
    200: hslString(h, Math.min(sat, 90), 86),
    300: hslString(h, Math.min(sat, 88), 76),
    400: hslString(h, Math.min(sat, 86), 66),
    500: hslString(h, sat, Math.min(58, Math.max(l, 42))),
    600: hslString(h, sat, l),
    700: hslString(h, Math.min(sat + 4, 100), Math.max(l - 8, 22)),
    800: hslString(h, Math.min(sat + 2, 100), Math.max(l - 16, 18)),
    // 900/950 double as ink + heading colours, so keep them dark for any input.
    900: hslString(h, sat, Math.min(24, Math.max(l - 22, 14))),
    950: hslString(h, Math.min(sat + 6, 100), Math.min(16, Math.max(l - 32, 8))),
  }
}

export function resolveThemeScale(id: ColorThemeId, customHex = DEFAULT_CUSTOM_HEX): ThemeScale {
  if (id === 'custom') return scaleFromHex(customHex)
  return THEME_BY_ID.get(id)?.scale ?? THEME_BY_ID.get(DEFAULT_COLOR_THEME_ID as Exclude<ColorThemeId, 'custom'>)!.scale
}

function lightnessOf(hsl: string): number {
  const match = /([\d.]+)%\s*$/.exec(hsl)
  return match ? Number(match[1]) : 50
}

export function themeToCssVars(scale: ThemeScale): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const shade of THEME_SHADES) {
    vars[`--theme-${shade}`] = scale[shade]
  }
  vars['--primary'] = scale[600]
  vars['--ring'] = scale[600]
  vars['--primary-foreground'] = lightnessOf(scale[600]) > 58 ? '222.2 47.4% 11.2%' : '210 40% 98%'
  return vars
}

export function applyColorThemeToDocument(id: ColorThemeId, customHex = DEFAULT_CUSTOM_HEX): Record<string, string> {
  const vars = themeToCssVars(resolveThemeScale(id, customHex))
  if (typeof document === 'undefined') return vars
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  root.setAttribute('data-color-theme', id)
  return vars
}

export function persistColorTheme(id: ColorThemeId, customHex = DEFAULT_CUSTOM_HEX): StoredColorTheme {
  const stored: StoredColorTheme = {
    id,
    customHex: normalizeHex(customHex),
    vars: applyColorThemeToDocument(id, customHex),
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, JSON.stringify(stored))
  }
  return stored
}

export function readStoredColorTheme(): StoredColorTheme | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(COLOR_THEME_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredColorTheme> & { id?: string }
    const id = normalizeColorThemeId(parsed.id)
    if (!id) return null
    const customHex = normalizeHex(parsed.customHex || DEFAULT_CUSTOM_HEX)
    return {
      id,
      customHex,
      // Recompute so palette updates (and migrated legacy ids) take effect.
      vars: themeToCssVars(resolveThemeScale(id, customHex)),
    }
  } catch {
    return null
  }
}

export const COLOR_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var raw=localStorage.getItem('${COLOR_THEME_STORAGE_KEY}');if(!raw)return;var data=JSON.parse(raw);if(!data||!data.vars)return;var root=document.documentElement;for(var key in data.vars){if(Object.prototype.hasOwnProperty.call(data.vars,key)){root.style.setProperty(key,data.vars[key]);}}if(data.id)root.setAttribute('data-color-theme',data.id);}catch(e){}})();`
