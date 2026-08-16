export const COLOR_THEME_STORAGE_KEY = 'truerp-color-theme'

export const THEME_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export type ThemeShade = (typeof THEME_SHADES)[number]
export type ThemeScale = Record<ThemeShade, string>

export const COLOR_THEME_IDS = [
  'blue',
  'sky',
  'teal',
  'emerald',
  'violet',
  'purple',
  'rose',
  'orange',
  'amber',
  'slate',
  'custom',
] as const

export type ColorThemeId = (typeof COLOR_THEME_IDS)[number]

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

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = 'blue'
export const DEFAULT_CUSTOM_HEX = '#2563eb'

/** HSL channels as "H S% L%" — matches shadcn CSS variable convention. */
export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'blue',
    label: 'Blue',
    description: 'Default',
    swatch: '#2563eb',
    scale: {
      50: '214 100% 97%',
      100: '214 95% 93%',
      200: '213 97% 87%',
      300: '212 96% 78%',
      400: '213 94% 68%',
      500: '217 91% 60%',
      600: '221 83% 53%',
      700: '224 76% 48%',
      800: '226 71% 40%',
      900: '224 64% 33%',
      950: '226 57% 21%',
    },
  },
  {
    id: 'sky',
    label: 'Sky',
    description: 'Cool',
    swatch: '#0284c7',
    scale: {
      50: '204 100% 97%',
      100: '204 94% 94%',
      200: '201 94% 86%',
      300: '199 95% 74%',
      400: '198 93% 60%',
      500: '199 89% 48%',
      600: '200 98% 39%',
      700: '201 96% 32%',
      800: '201 90% 27%',
      900: '202 80% 24%',
      950: '204 80% 16%',
    },
  },
  {
    id: 'teal',
    label: 'Teal',
    description: 'Fresh',
    swatch: '#0d9488',
    scale: {
      50: '166 76% 97%',
      100: '167 85% 89%',
      200: '168 84% 78%',
      300: '171 77% 64%',
      400: '172 66% 50%',
      500: '173 80% 40%',
      600: '175 84% 32%',
      700: '175 77% 26%',
      800: '176 69% 22%',
      900: '176 61% 19%',
      950: '179 84% 10%',
    },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    description: 'Growth',
    swatch: '#059669',
    scale: {
      50: '152 81% 96%',
      100: '149 80% 90%',
      200: '152 76% 80%',
      300: '156 72% 67%',
      400: '158 64% 52%',
      500: '160 84% 39%',
      600: '161 94% 30%',
      700: '163 94% 24%',
      800: '163 88% 20%',
      900: '164 86% 16%',
      950: '166 91% 9%',
    },
  },
  {
    id: 'violet',
    label: 'Violet',
    description: 'Bold',
    swatch: '#7c3aed',
    scale: {
      50: '250 100% 98%',
      100: '251 91% 95%',
      200: '251 95% 92%',
      300: '252 95% 85%',
      400: '255 92% 76%',
      500: '258 90% 66%',
      600: '262 83% 58%',
      700: '263 70% 50%',
      800: '263 69% 42%',
      900: '264 67% 35%',
      950: '261 73% 23%',
    },
  },
  {
    id: 'purple',
    label: 'Purple',
    description: 'Rich',
    swatch: '#9333ea',
    scale: {
      50: '270 100% 98%',
      100: '269 100% 95%',
      200: '269 100% 92%',
      300: '269 97% 85%',
      400: '270 95% 75%',
      500: '271 91% 65%',
      600: '271 81% 56%',
      700: '272 72% 47%',
      800: '273 67% 39%',
      900: '274 66% 32%',
      950: '274 87% 21%',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Warm',
    swatch: '#e11d48',
    scale: {
      50: '356 100% 97%',
      100: '356 100% 95%',
      200: '353 96% 90%',
      300: '353 96% 82%',
      400: '351 95% 71%',
      500: '350 89% 60%',
      600: '347 77% 50%',
      700: '345 83% 41%',
      800: '343 80% 35%',
      900: '342 75% 30%',
      950: '343 88% 16%',
    },
  },
  {
    id: 'orange',
    label: 'Orange',
    description: 'Energy',
    swatch: '#ea580c',
    scale: {
      50: '33 100% 96%',
      100: '34 100% 92%',
      200: '32 98% 83%',
      300: '31 97% 72%',
      400: '27 96% 61%',
      500: '25 95% 53%',
      600: '21 90% 48%',
      700: '17 88% 40%',
      800: '15 79% 34%',
      900: '15 75% 28%',
      950: '13 81% 14%',
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    description: 'Bright',
    swatch: '#d97706',
    scale: {
      50: '48 100% 96%',
      100: '48 96% 89%',
      200: '48 97% 77%',
      300: '46 97% 65%',
      400: '43 96% 56%',
      500: '38 92% 50%',
      600: '32 95% 44%',
      700: '26 90% 37%',
      800: '23 83% 31%',
      900: '22 78% 26%',
      950: '21 92% 14%',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral',
    swatch: '#475569',
    scale: {
      50: '210 40% 98%',
      100: '210 40% 96%',
      200: '214 32% 91%',
      300: '213 27% 84%',
      400: '215 20% 65%',
      500: '215 16% 47%',
      600: '215 19% 35%',
      700: '215 25% 27%',
      800: '217 33% 17%',
      900: '222 47% 11%',
      950: '229 84% 5%',
    },
  },
]

const THEME_BY_ID = new Map(COLOR_THEMES.map((theme) => [theme.id, theme]))

export function isColorThemeId(value: string | null | undefined): value is ColorThemeId {
  return !!value && (COLOR_THEME_IDS as readonly string[]).includes(value)
}

export function normalizeHex(hex: string): string {
  const value = hex.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(value)
  if (short) {
    const [r, g, b] = short[1]
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
    900: hslString(h, sat, Math.max(l - 22, 14)),
    950: hslString(h, Math.min(sat + 6, 100), Math.max(l - 32, 8)),
  }
}

export function resolveThemeScale(id: ColorThemeId, customHex = DEFAULT_CUSTOM_HEX): ThemeScale {
  if (id === 'custom') return scaleFromHex(customHex)
  return THEME_BY_ID.get(id)?.scale ?? THEME_BY_ID.get('blue')!.scale
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
    const parsed = JSON.parse(raw) as Partial<StoredColorTheme>
    if (!isColorThemeId(parsed.id)) return null
    return {
      id: parsed.id,
      customHex: normalizeHex(parsed.customHex || DEFAULT_CUSTOM_HEX),
      vars: parsed.vars && typeof parsed.vars === 'object' ? parsed.vars : themeToCssVars(resolveThemeScale(parsed.id, parsed.customHex)),
    }
  } catch {
    return null
  }
}

export const COLOR_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var raw=localStorage.getItem('${COLOR_THEME_STORAGE_KEY}');if(!raw)return;var data=JSON.parse(raw);if(!data||!data.vars)return;var root=document.documentElement;for(var key in data.vars){if(Object.prototype.hasOwnProperty.call(data.vars,key)){root.style.setProperty(key,data.vars[key]);}}if(data.id)root.setAttribute('data-color-theme',data.id);}catch(e){}})();`
