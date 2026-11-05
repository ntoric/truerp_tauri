import JSZip from 'jszip'

/**
 * Loyalty card artwork generation.
 *
 * Cards are CR80 / ID-1 "ATM card" size (85.60 × 53.98 mm). Artwork is drawn
 * as SVG with a 3 mm bleed on every edge (91.6 × 59.98 mm) and rasterised to
 * PNG at 300 DPI — the standard requirement for PVC card printing. All text
 * stays inside a 3 mm safe zone within the trim edge.
 */

// ---------------------------------------------------------------------------
// Dimensions (mm) — CR80 with 3 mm bleed
// ---------------------------------------------------------------------------

export const CARD_TRIM_W_MM = 85.6
export const CARD_TRIM_H_MM = 53.98
export const CARD_BLEED_MM = 3
export const CARD_ART_W_MM = CARD_TRIM_W_MM + CARD_BLEED_MM * 2 // 91.6
export const CARD_ART_H_MM = CARD_TRIM_H_MM + CARD_BLEED_MM * 2 // 59.98
export const CARD_DPI = 300
export const CARD_ART_W_PX = Math.round((CARD_ART_W_MM / 25.4) * CARD_DPI) // ~1082
export const CARD_ART_H_PX = Math.round((CARD_ART_H_MM / 25.4) * CARD_DPI) // ~709

// SVG viewBox uses 0.1 mm units so all geometry below is in tenths of a mm.
const VW = 916 // 91.6 mm
const VH = 600 // ~59.98 mm
const TRIM = CARD_BLEED_MM * 10 // 30
const SAFE = TRIM + 30 // trim edge + 3 mm inner safe zone

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

/** Every editable string + visibility switch on the card. Stored server-side
 * as JSON on the design row; absent keys fall back to these defaults. */
export interface LoyaltyCardContent {
  // Front text
  title: string
  tagline: string
  store_label: string
  member_label: string
  footer_text: string
  // Front visibility
  show_title: boolean
  show_tagline: boolean
  show_store_name: boolean
  show_member: boolean
  show_card_number: boolean
  show_footer: boolean
  show_barcode: boolean
  show_barcode_caption: boolean
  // Back text
  signature_label: string
  terms_heading: string
  terms: string
  footer_left: string
  footer_right: string
  // Back visibility
  show_mag_stripe: boolean
  show_signature_strip: boolean
  show_back_number: boolean
  show_back_business_name: boolean
  show_back_store_name: boolean
  show_back_logo: boolean
  show_terms: boolean
  show_footer_left: boolean
  show_footer_right: boolean
}

export const DEFAULT_CARD_CONTENT: LoyaltyCardContent = {
  title: '',
  tagline: 'LOYALTY REWARDS',
  store_label: '',
  member_label: 'MEMBER',
  footer_text: '',
  show_title: true,
  show_tagline: true,
  show_store_name: true,
  show_member: true,
  show_card_number: true,
  show_footer: true,
  show_barcode: true,
  show_barcode_caption: true,
  signature_label: 'Authorized signature — not valid unless signed',
  terms_heading: 'TERMS & CONDITIONS',
  terms:
    'This card is the property of the issuing store and is non-transferable. Present this card to earn and redeem loyalty rewards. If found, please return it to the store.',
  footer_left: 'Powered by TruERP Loyalty',
  footer_right: '',
  show_mag_stripe: true,
  show_signature_strip: true,
  show_back_number: true,
  show_back_business_name: true,
  show_back_store_name: true,
  show_back_logo: true,
  show_terms: true,
  show_footer_left: true,
  show_footer_right: true,
}

export interface LoyaltyCardDesign {
  id?: string
  theme: string
  primary_color: string
  accent_color: string
  card_prefix: string
  card_title: string
  tagline: string
  footer_text: string
  show_logo: boolean
  show_chip: boolean
  include_back: boolean
  back_terms: string
  font_family?: string
  number_font?: string
  decor?: string
  front_graphic?: string
  back_graphic?: string
  layout?: Partial<CardLayout>
  content?: Partial<LoyaltyCardContent>
  next_serial?: number
  store_id?: string | null
}

// ---------------------------------------------------------------------------
// Element layout — positions/sizes in 0.1mm viewBox units (916 × 600)
// ---------------------------------------------------------------------------

export interface CardElementLayout {
  x: number
  y: number
  /** box width/height (panel, logo, chip, stripe) */
  w?: number
  h?: number
  /** font size for text elements, uniform dimension for glyphs */
  size?: number
}

export type CardSideLayout = Record<string, CardElementLayout>

export interface CardLayout {
  front: CardSideLayout
  back: CardSideLayout
}

export const DEFAULT_CARD_LAYOUT: CardLayout = {
  front: {
    logo: { x: 64, y: 56, w: 84, h: 84 },
    title: { x: 170, y: 100, size: 34 },
    tagline: { x: 170, y: 130, size: 15 },
    store_name: { x: 852, y: 150, size: 13 },
    chip: { x: 64, y: 176, w: 122, h: 96 },
    card_number: { x: 64, y: 352, size: 48 },
    member: { x: 64, y: 390, size: 14 },
    footer: { x: 64, y: 412, size: 15 },
    barcode: { x: 64, y: 424, w: 788, h: 112 },
    mark: { x: 812, y: 92, size: 27 },
    graphic: { x: 750, y: 280, size: 90 },
  },
  back: {
    logo: { x: 64, y: 36, w: 56, h: 56 },
    business_name: { x: 64, y: 74, size: 22 },
    store_name: { x: 852, y: 74, size: 14 },
    mag_stripe: { x: 0, y: 120, w: 916, h: 108 },
    signature: { x: 64, y: 270, w: 788, h: 66 },
    back_number: { x: 800, y: 304, size: 26 },
    terms: { x: 64, y: 378, size: 15.5 },
    footer_left: { x: 64, y: 560, size: 15 },
    footer_right: { x: 852, y: 560, size: 15 },
    graphic: { x: 790, y: 420, size: 80 },
  },
}

export function resolveCardLayout(design: LoyaltyCardDesign): CardLayout {
  const merge = (side: keyof CardLayout): CardSideLayout => {
    const out: CardSideLayout = {}
    const base = DEFAULT_CARD_LAYOUT[side]
    for (const key of Object.keys(base)) out[key] = { ...base[key] }
    const patch = design.layout?.[side] || {}
    for (const key of Object.keys(patch)) {
      out[key] = { ...out[key], ...(patch[key] || {}) }
    }
    return out
  }
  return { front: merge('front'), back: merge('back') }
}

// ---------------------------------------------------------------------------
// Typography — web-safe stacks that rasterise identically everywhere
// ---------------------------------------------------------------------------

export interface CardFontOption {
  key: string
  label: string
  stack: string
}

export const FONT_OPTIONS: CardFontOption[] = [
  { key: 'sans', label: 'Modern Sans', stack: `'Helvetica Neue', Arial, sans-serif` },
  { key: 'serif', label: 'Classic Serif', stack: `Georgia, 'Times New Roman', serif` },
  { key: 'rounded', label: 'Rounded', stack: `'Trebuchet MS', Verdana, sans-serif` },
  { key: 'display', label: 'Bold Display', stack: `'Arial Black', Impact, sans-serif` },
  { key: 'mono', label: 'Typewriter', stack: `'Courier New', Courier, monospace` },
]

export const NUMBER_FONT_OPTIONS: CardFontOption[] = [
  { key: 'mono', label: 'Card Mono', stack: `Consolas, Menlo, monospace` },
  { key: 'courier', label: 'Courier', stack: `'Courier New', Courier, monospace` },
  { key: 'sans', label: 'Sans digits', stack: `'Helvetica Neue', Arial, sans-serif` },
  { key: 'serif', label: 'Serif digits', stack: `Georgia, 'Times New Roman', serif` },
]

export function bodyFontStack(design: LoyaltyCardDesign): string {
  return (FONT_OPTIONS.find((f) => f.key === design.font_family) || FONT_OPTIONS[0]).stack
}

export function numberFontStack(design: LoyaltyCardDesign): string {
  return (NUMBER_FONT_OPTIONS.find((f) => f.key === design.number_font) || NUMBER_FONT_OPTIONS[0]).stack
}

// ---------------------------------------------------------------------------
// Background decoration styles
// ---------------------------------------------------------------------------

export interface CardOption {
  key: string
  label: string
}

export const DECOR_OPTIONS: CardOption[] = [
  { key: 'orbits', label: 'Orbit circles' },
  { key: 'waves', label: 'Silk waves' },
  { key: 'dots', label: 'Dot matrix' },
  { key: 'stripes', label: 'Diagonal stripes' },
  { key: 'none', label: 'Plain gradient' },
]

function decorSvg(key: string | undefined, theme: CardTheme): string {
  switch (key) {
    case 'waves':
      return `<path d="M0 470 Q230 400 458 460 T916 430 V600 H0 Z" fill="${theme.accent}" opacity="0.10"/>
<path d="M0 510 Q260 445 480 500 T916 480 V600 H0 Z" fill="#ffffff" opacity="0.05"/>
<path d="M0 60 Q300 -30 560 40 T916 20" fill="none" stroke="${theme.accent}" stroke-width="2.5" opacity="0.30"/>`
    case 'dots': {
      const dots: string[] = []
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 12; c++) {
          dots.push(
            `<circle cx="${660 + c * 24}" cy="${10 + r * 24}" r="3.4" fill="${theme.accent}" opacity="${(0.32 - r * 0.035).toFixed(2)}"/>`
          )
        }
      }
      return dots.join('') + `<circle cx="60" cy="620" r="180" fill="${theme.accent}" opacity="0.07"/>`
    }
    case 'stripes': {
      const lines: string[] = []
      for (let i = 0; i < 14; i++) {
        const x = 560 + i * 28
        lines.push(
          `<line x1="${x}" y1="0" x2="${x - 200}" y2="600" stroke="${theme.accent}" stroke-width="7" opacity="0.10"/>`
        )
      }
      return lines.join('') + `<circle cx="60" cy="620" r="180" fill="${theme.accent}" opacity="0.07"/>`
    }
    case 'none':
      return `<polygon points="0,0 430,0 130,600 0,600" fill="url(#gloss)"/>`
    default: // orbits
      return `<circle cx="872" cy="-60" r="250" fill="${theme.accent}" opacity="0.14"/>
<circle cx="952" cy="110" r="170" fill="#ffffff" opacity="0.06"/>
<circle cx="780" cy="70" r="150" fill="none" stroke="${theme.accent}" stroke-width="2" opacity="0.28"/>
<circle cx="40" cy="640" r="200" fill="${theme.accent}" opacity="0.08"/>
<polygon points="0,0 430,0 130,600 0,600" fill="url(#gloss)"/>`
  }
}

// ---------------------------------------------------------------------------
// Emblem glyphs — 100×100 path art scaled into place
// ---------------------------------------------------------------------------

export const GRAPHIC_OPTIONS: CardOption[] = [
  { key: 'none', label: 'None' },
  { key: 'star', label: 'Star' },
  { key: 'crown', label: 'Crown' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'award', label: 'Award medal' },
  { key: 'gift', label: 'Gift box' },
  { key: 'contactless', label: 'Contactless' },
  { key: 'sparkles', label: 'Sparkles' },
  { key: 'shield', label: 'Shield' },
  { key: 'heart', label: 'Heart' },
]

function glyphSvg(name: string | undefined, x: number, y: number, size: number, fill: string): string {
  if (!name || name === 'none') return ''
  const s = size / 100
  const inner = (() => {
    switch (name) {
      case 'star':
        return `<path d="M50 4 L62 37 L97 38 L69 59 L78 94 L50 73 L22 94 L31 59 L3 38 L38 37 Z"/>`
      case 'crown':
        return `<path d="M14 74 L9 30 L33 49 L50 14 L67 49 L91 30 L86 74 Z"/><rect x="14" y="79" width="72" height="11" rx="4"/>`
      case 'diamond':
        return `<path d="M50 8 L86 40 L50 92 L14 40 Z"/><path d="M14 40 H86 M50 8 L33 40 L50 92 M50 8 L67 40 L50 92" fill="none" stroke="${fill}" stroke-width="4" opacity="0.55"/>`
      case 'award':
        return `<circle cx="50" cy="38" r="30"/><path d="M50 20 L55.6 32.4 L69 33.8 L59 43 L62.4 56.4 L50 49.4 L37.6 56.4 L41 43 L31 33.8 L44.4 32.4 Z" fill="${'#ffffff'}" opacity="0.85"/><path d="M34 62 L26 94 L44 82 L50 96 L56 82 L74 94 L66 62 Z"/>`
      case 'gift':
        return `<rect x="12" y="34" width="76" height="56" rx="5"/><rect x="45" y="34" width="10" height="56" fill="${'#ffffff'}" opacity="0.55"/><rect x="8" y="26" width="84" height="14" rx="4"/><path d="M50 26 C38 6 22 14 28 26 M50 26 C62 6 78 14 72 26" fill="none" stroke="${fill}" stroke-width="9" stroke-linecap="round"/>`
      case 'contactless':
        return `<g fill="none" stroke="${fill}" stroke-width="9" stroke-linecap="round"><path d="M26 30 Q52 50 26 70"/><path d="M44 20 Q84 50 44 80"/><path d="M62 10 Q116 50 62 90"/></g>`
      case 'sparkles':
        return `<path d="M50 8 L58 42 L92 50 L58 58 L50 92 L42 58 L8 50 L42 42 Z"/><path d="M82 6 L87 21 L102 26 L87 31 L82 46 L77 31 L62 26 L77 21 Z" opacity="0.8"/>`
      case 'shield':
        return `<path d="M50 6 L86 21 V50 C86 72 70 88 50 96 C30 88 14 72 14 50 V21 Z"/><path d="M33 50 L46 63 L70 38" fill="none" stroke="${'#ffffff'}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`
      case 'heart':
        return `<path d="M50 90 C18 66 8 46 14 30 C20 13 41 11 50 28 C59 11 80 13 86 30 C92 46 82 66 50 90 Z"/>`
      default:
        return ''
    }
  })()
  if (!inner) return ''
  return `<g transform="translate(${x} ${y}) scale(${s.toFixed(3)})" fill="${fill}" opacity="0.92">${inner}</g>`
}

/** Merge defaults ← legacy flat fields ← content block. */
export function resolveCardContent(design: LoyaltyCardDesign): LoyaltyCardContent {
  const c: LoyaltyCardContent = { ...DEFAULT_CARD_CONTENT }
  if (design.card_title) c.title = design.card_title
  if (design.tagline) c.tagline = design.tagline
  if (design.footer_text) c.footer_text = design.footer_text
  if (design.back_terms) c.terms = design.back_terms
  return { ...c, ...(design.content || {}) }
}

export interface LoyaltyCardBusiness {
  name: string
  phone: string
  city: string
  state: string
  logo_url: string
  email: string
}

export interface LoyaltyCardStore {
  id: string
  name: string
  code: string
}

export interface GeneratedLoyaltyCard {
  id?: string
  card_number: string
  serial: number
  batch_id?: string
  status?: string
  created_at?: string
  party_id?: string | null
  party?: { id: string; name: string; phone?: string } | null
}

export interface CardTheme {
  key: string
  label: string
  /** gradient stops for the card background */
  stops: [string, string, string]
  accent: string
  text: string
  sub: string
  /** preview swatch */
  swatch: string
}

export const CARD_THEMES: CardTheme[] = [
  {
    key: 'midnight',
    label: 'Midnight Gold',
    stops: ['#0f172a', '#1e3a5f', '#0b2447'],
    accent: '#f5c05a',
    text: '#ffffff',
    sub: '#b8c4d6',
    swatch: 'linear-gradient(135deg,#0f172a,#1e3a5f,#f5c05a)',
  },
  {
    key: 'royal',
    label: 'Royal Plum',
    stops: ['#2d1b4e', '#4c2a85', '#1a1030'],
    accent: '#e0b3ff',
    text: '#ffffff',
    sub: '#cdbbe8',
    swatch: 'linear-gradient(135deg,#2d1b4e,#4c2a85,#e0b3ff)',
  },
  {
    key: 'emerald',
    label: 'Emerald Luxe',
    stops: ['#022c22', '#065f46', '#013a2c'],
    accent: '#a7f3d0',
    text: '#ffffff',
    sub: '#9fd8c3',
    swatch: 'linear-gradient(135deg,#022c22,#065f46,#a7f3d0)',
  },
  {
    key: 'crimson',
    label: 'Crimson Silk',
    stops: ['#450a0a', '#7f1d1d', '#2b0606'],
    accent: '#fca5a5',
    text: '#ffffff',
    sub: '#eebbbb',
    swatch: 'linear-gradient(135deg,#450a0a,#7f1d1d,#fca5a5)',
  },
  {
    key: 'ocean',
    label: 'Deep Ocean',
    stops: ['#082f49', '#0369a1', '#051f31'],
    accent: '#7dd3fc',
    text: '#ffffff',
    sub: '#a8d4ea',
    swatch: 'linear-gradient(135deg,#082f49,#0369a1,#7dd3fc)',
  },
  {
    key: 'carbon',
    label: 'Carbon Mono',
    stops: ['#18181b', '#3f3f46', '#0a0a0c'],
    accent: '#e4e4e7',
    text: '#fafafa',
    sub: '#a1a1aa',
    swatch: 'linear-gradient(135deg,#18181b,#3f3f46,#e4e4e7)',
  },
]

export function themeForDesign(design: LoyaltyCardDesign): CardTheme {
  const preset = CARD_THEMES.find((t) => t.key === design.theme)
  if (preset) {
    // Custom colour overrides are blended into the preset gradient.
    const p = design.primary_color || preset.stops[0]
    const a = design.accent_color || preset.accent
    return { ...preset, stops: [p, mixHex(p, a, 0.18), preset.stops[2]], accent: a }
  }
  const p = design.primary_color || '#0f172a'
  const a = design.accent_color || '#f5c05a'
  return {
    key: 'custom',
    label: 'Custom',
    stops: [p, mixHex(p, a, 0.22), shadeHex(p, -0.35)],
    accent: a,
    text: '#ffffff',
    sub: '#d4d4d8',
    swatch: `linear-gradient(135deg,${p},${a})`,
  }
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Mix two hex colours — t=0 gives a, t=1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Lighten (amount>0) or darken (amount<0) a hex colour. */
export function shadeHex(hex: string, amount: number): string {
  const target = amount >= 0 ? '#ffffff' : '#000000'
  return mixHex(hex, target, Math.abs(amount))
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Code 128 (subset B, with subset C for purely-numeric payloads)
// ---------------------------------------------------------------------------

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
]

/** Module widths for the encoded value — alternating bar/space, starts on a bar. */
export function code128Widths(value: string): number[] {
  const codes: number[] = []
  const digitsOnly = /^[0-9]{4,}$/.test(value) && value.length % 2 === 0
  if (digitsOnly) {
    codes.push(105) // start C
    for (let i = 0; i < value.length; i += 2) {
      codes.push(parseInt(value.substr(i, 2), 10))
    }
  } else {
    codes.push(104) // start B
    for (const ch of value) {
      const cc = ch.charCodeAt(0)
      codes.push(cc >= 32 && cc <= 126 ? cc - 32 : 31)
    }
  }
  let sum = codes[0]
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i
  codes.push(sum % 103)
  codes.push(106) // stop

  const widths: number[] = []
  for (const code of codes) {
    for (const d of CODE128_PATTERNS[code]) widths.push(Number(d))
  }
  return widths
}

/** SVG fragment: Code128 bars inside an implied white quiet-zone panel. */
function barcodeBarsSvg(value: string, x: number, y: number, w: number, h: number): string {
  const widths = code128Widths(value)
  const total = widths.reduce((a, b) => a + b, 0)
  const module = w / total
  let cursor = x
  const parts: string[] = []
  widths.forEach((width, i) => {
    const barW = width * module
    if (i % 2 === 0) {
      parts.push(
        `<rect x="${cursor.toFixed(2)}" y="${y}" width="${barW.toFixed(2)}" height="${h}" fill="#111827"/>`
      )
    }
    cursor += barW
  })
  return parts.join('')
}

// ---------------------------------------------------------------------------
// Card artwork (SVG, 0.1 mm units — 916 × 600)
// ---------------------------------------------------------------------------

export interface CardArtworkInput {
  design: LoyaltyCardDesign
  business: LoyaltyCardBusiness
  store?: LoyaltyCardStore | null
  cardNumber: string
  /** data: URI for the business logo (already fetched & embedded) */
  logoDataUri?: string
  /** render faint trim/safe guides for on-screen preview only */
  showGuides?: boolean
}

function defsSvg(theme: CardTheme): string {
  return `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${theme.stops[0]}"/>
    <stop offset="0.55" stop-color="${theme.stops[1]}"/>
    <stop offset="1" stop-color="${theme.stops[2]}"/>
  </linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
    <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f2e2b8"/>
    <stop offset="0.5" stop-color="#d9b96f"/>
    <stop offset="1" stop-color="#b8934a"/>
  </linearGradient>
  <linearGradient id="holo" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.0"/>
    <stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.35"/>
    <stop offset="1" stop-color="${theme.accent}" stop-opacity="0.0"/>
  </linearGradient>
</defs>`
}

function guidesSvg(): string {
  return `<rect x="${TRIM}" y="${TRIM}" width="${VW - TRIM * 2}" height="${VH - TRIM * 2}" fill="none" stroke="#ff00ff" stroke-width="1" stroke-dasharray="6 4" opacity="0.45"/>
<rect x="${SAFE}" y="${SAFE}" width="${VW - SAFE * 2}" height="${VH - SAFE * 2}" fill="none" stroke="#00e5ff" stroke-width="1" stroke-dasharray="3 5" opacity="0.4"/>`
}

/** Fits text into maxW (0.1mm) via textLength when the estimate overflows. */
function fitText(text: string, fontSize: number, letterSpacing: number, maxW: number): string {
  const est = text.length * (fontSize * 0.62 + letterSpacing)
  return est > maxW ? ` textLength="${maxW.toFixed(0)}" lengthAdjust="spacingAndGlyphs"` : ''
}

export function buildCardFrontSvg(input: CardArtworkInput): string {
  const { design, business, store, cardNumber, logoDataUri, showGuides } = input
  const theme = themeForDesign(design)
  const c = resolveCardContent(design)
  const L = resolveCardLayout(design).front
  const bodyFont = bodyFontStack(design)
  const numFont = numberFontStack(design)
  const title = (c.title || business.name || 'LOYALTY CARD').trim()
  const tagline = (c.tagline || '').trim().toUpperCase()
  const footer = (c.footer_text || business.phone || '').trim()
  const memberLabel = (c.member_label || '').trim().toUpperCase()
  const storeName = (c.store_label || store?.name || '').trim()
  const prettyNumber = prettyCardNumber(cardNumber)
  const e = escapeXml
  const g = (key: string): CardElementLayout => L[key] || { x: 0, y: 0 }

  // Barcode centred inside its panel keeping ≥10-module quiet zones.
  const bp = g('barcode')
  const panelX = bp.x
  const panelW = bp.w ?? 788
  const panelH = bp.h ?? 112
  const modules = code128Widths(cardNumber).reduce((a, b) => a + b, 0)
  const barW = Math.min(panelW * 0.78, modules * 6)
  const barX = panelX + (panelW - barW) / 2
  const barH = panelH * 0.54
  const barY = bp.y + panelH * 0.13

  const hasLogo = design.show_logo && !!logoDataUri
  const lg = g('logo')
  const logoBlock = hasLogo
    ? `<rect x="${lg.x}" y="${lg.y}" width="${lg.w ?? 84}" height="${lg.h ?? 84}" rx="${(lg.w ?? 84) * 0.19}" fill="#ffffff" opacity="0.95"/>
       <image x="${lg.x + (lg.w ?? 84) * 0.07}" y="${lg.y + (lg.h ?? 84) * 0.07}" width="${(lg.w ?? 84) * 0.86}" height="${(lg.h ?? 84) * 0.86}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`
    : ''

  const ch = g('chip')
  const chipW = ch.w ?? 122
  const chipH = ch.h ?? 96
  const chipBlock = design.show_chip
    ? `<g>
        <rect x="${ch.x}" y="${ch.y}" width="${chipW}" height="${chipH}" rx="${chipH * 0.17}" fill="url(#chip)" stroke="#8a6d33" stroke-width="1.5"/>
        <path d="M${ch.x} ${ch.y + chipH * 0.39} H${ch.x + chipW} M${ch.x} ${ch.y + chipH * 0.65} H${ch.x + chipW} M${ch.x + chipW * 0.33} ${ch.y} V${ch.y + chipH} M${ch.x + chipW * 0.66} ${ch.y} V${ch.y + chipH}" stroke="#8a6d33" stroke-width="1.5" fill="none" opacity="0.8"/>
        <rect x="${ch.x}" y="${ch.y}" width="${chipW}" height="${chipH}" rx="${chipH * 0.17}" fill="#ffffff" opacity="0.10"/>
      </g>`
    : ''

  const barcodeBlock = c.show_barcode
    ? `<rect x="${panelX}" y="${bp.y}" width="${panelW}" height="${panelH}" rx="${panelH * 0.125}" fill="#ffffff"/>
<rect x="${panelX}" y="${bp.y}" width="${panelW}" height="${panelH}" rx="${panelH * 0.125}" fill="none" stroke="#000000" stroke-opacity="0.08" stroke-width="1.5"/>
${barcodeBarsSvg(cardNumber, barX, barY, barW, barH)}
${c.show_barcode_caption ? `<text x="${panelX + panelW / 2}" y="${bp.y + panelH * 0.88}" text-anchor="middle" font-family="${numFont}" font-size="${panelH * 0.19}" letter-spacing="${panelH * 0.036}" fill="#111827">${e(cardNumber)}</text>` : ''}`
    : ''

  const mk = g('mark')
  const markSize = mk.size ?? 27
  const t = g('title')
  const tg = g('tagline')
  const sn = g('store_name')
  const cn = g('card_number')
  const mm = g('member')
  const ft = g('footer')
  const gr = g('graphic')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}">
${defsSvg(theme)}
<rect width="${VW}" height="${VH}" fill="url(#bg)"/>
${decorSvg(design.decor, theme)}
<rect x="0" y="0" width="${VW}" height="${VH}" fill="none"/>

<g>
  <circle cx="${mk.x}" cy="${mk.y}" r="${markSize}" fill="${theme.accent}" opacity="0.9"/>
  <circle cx="${mk.x + markSize * 1.48}" cy="${mk.y}" r="${markSize}" fill="${theme.accent}" opacity="0.45"/>
</g>

${logoBlock}
${c.show_title ? `<text x="${t.x}" y="${t.y}" font-family="${bodyFont}" font-size="${t.size ?? 34}" font-weight="700" letter-spacing="${(t.size ?? 34) * 0.06}" fill="${theme.text}"${fitText(title.toUpperCase(), t.size ?? 34, (t.size ?? 34) * 0.06, VW - t.x - 40)}>${e(title.toUpperCase())}</text>` : ''}
${c.show_tagline && tagline ? `<text x="${tg.x}" y="${tg.y}" font-family="${bodyFont}" font-size="${tg.size ?? 15}" font-weight="500" letter-spacing="${(tg.size ?? 15) * 0.33}" fill="${theme.accent}"${fitText(tagline, tg.size ?? 15, (tg.size ?? 15) * 0.33, VW - tg.x - 40)}>${e(tagline)}</text>` : ''}
${c.show_store_name && storeName ? `<text x="${sn.x}" y="${sn.y}" text-anchor="end" font-family="${bodyFont}" font-size="${sn.size ?? 13}" letter-spacing="${(sn.size ?? 13) * 0.19}" fill="${theme.sub}">${e(storeName.toUpperCase())}</text>` : ''}

${chipBlock}

${c.show_card_number ? `<text x="${cn.x}" y="${cn.y}" font-family="${numFont}" font-size="${cn.size ?? 48}" font-weight="700" letter-spacing="${(cn.size ?? 48) * 0.125}" fill="${theme.text}">${e(prettyNumber)}</text>` : ''}
${c.show_member && memberLabel ? `<text x="${mm.x}" y="${mm.y}" font-family="${bodyFont}" font-size="${mm.size ?? 14}" letter-spacing="${(mm.size ?? 14) * 0.14}" fill="${theme.accent}">${e(memberLabel)}</text>` : ''}
${c.show_footer && footer ? `<text x="${ft.x}" y="${ft.y}" font-family="${bodyFont}" font-size="${ft.size ?? 15}" letter-spacing="${(ft.size ?? 15) * 0.13}" fill="${theme.sub}"${fitText(footer, ft.size ?? 15, (ft.size ?? 15) * 0.13, VW - ft.x - 40)}>${e(footer)}</text>` : ''}

${barcodeBlock}
${glyphSvg(design.front_graphic, gr.x, gr.y, gr.size ?? 90, theme.accent)}

<rect x="0" y="576" width="${VW}" height="3" fill="url(#holo)"/>
${showGuides ? guidesSvg() : ''}
</svg>`
}

export function buildCardBackSvg(input: Omit<CardArtworkInput, 'cardNumber'> & { cardNumber?: string }): string {
  const { design, business, store, cardNumber, logoDataUri, showGuides } = input
  const theme = themeForDesign(design)
  const c = resolveCardContent(design)
  const L = resolveCardLayout(design).back
  const bodyFont = bodyFontStack(design)
  const numFont = numberFontStack(design)
  const terms = (c.terms || '').trim()
  const storeName = (c.store_label || store?.name || '').trim()
  const defaultRight = [
    [business.phone, business.email].filter(Boolean).join('  ·  '),
    [business.city, business.state].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('  ·  ')
  const footerRight = (c.footer_right || defaultRight).trim()
  const e = escapeXml
  const g = (key: string): CardElementLayout => L[key] || { x: 0, y: 0 }

  const tm = g('terms')
  const termSize = tm.size ?? 15.5
  const termLines = wrapText(terms, 78).slice(0, 5)
  const termsBlock = c.show_terms
    ? `${c.terms_heading ? `<text x="${tm.x}" y="${tm.y}" font-family="${bodyFont}" font-size="${termSize * 0.97}" font-weight="700" letter-spacing="${termSize * 0.19}" fill="${theme.accent}">${e(c.terms_heading.toUpperCase())}</text>` : ''}
${termLines
  .map(
    (line, i) =>
      `<text x="${tm.x}" y="${tm.y + 22 + i * termSize * 1.55}" font-family="${bodyFont}" font-size="${termSize}" fill="${theme.sub}">${e(line)}</text>`
  )
  .join('')}`
    : ''

  const sg = g('signature')
  const sgW = sg.w ?? 788
  const sgH = sg.h ?? 66
  const bn = g('back_number')
  const signatureBlock = c.show_signature_strip
    ? `<rect x="${sg.x}" y="${sg.y}" width="${sgW}" height="${sgH}" rx="${sgH * 0.12}" fill="#f8fafc"/>
<line x1="${sg.x + 16}" y1="${sg.y + sgH * 0.5}" x2="${sg.x + sgW * 0.81}" y2="${sg.y + sgH * 0.5}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2 6"/>
${c.signature_label ? `<text x="${sg.x + 16}" y="${sg.y + sgH * 0.27}" font-family="${bodyFont}" font-size="${sgH * 0.2}" font-style="italic" fill="#64748b">${e(c.signature_label)}</text>` : ''}`
    : ''
  const backNumberBlock =
    c.show_back_number && cardNumber
      ? `<text x="${bn.x}" y="${bn.y}" text-anchor="end" font-family="${numFont}" font-size="${bn.size ?? 26}" font-weight="700" letter-spacing="${(bn.size ?? 26) * 0.12}" fill="#1f2937">${e(cardNumber)}</text>`
      : ''

  const lg = g('logo')
  const logoBlock =
    c.show_back_logo && design.show_logo && logoDataUri
      ? `<rect x="${lg.x}" y="${lg.y}" width="${lg.w ?? 56}" height="${lg.h ?? 56}" rx="${(lg.w ?? 56) * 0.21}" fill="#ffffff" opacity="0.95"/>
         <image x="${lg.x + (lg.w ?? 56) * 0.09}" y="${lg.y + (lg.h ?? 56) * 0.09}" width="${(lg.w ?? 56) * 0.82}" height="${(lg.h ?? 56) * 0.82}" href="${logoDataUri}" preserveAspectRatio="xMidYMid meet"/>`
      : ''

  const ms = g('mag_stripe')
  const bnn = g('business_name')
  const bsn = g('store_name')
  const fl = g('footer_left')
  const fr = g('footer_right')
  const gr = g('graphic')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}">
${defsSvg(theme)}
<rect width="${VW}" height="${VH}" fill="url(#bg)"/>
<rect width="${VW}" height="${VH}" fill="#000000" opacity="0.18"/>
<circle cx="880" cy="620" r="220" fill="${theme.accent}" opacity="0.10"/>

${c.show_mag_stripe ? `<rect x="0" y="${ms.y}" width="${VW}" height="${ms.h ?? 108}" fill="#141417"/>` : ''}

${signatureBlock}
${backNumberBlock}

${termsBlock}
${glyphSvg(design.back_graphic, gr.x, gr.y, gr.size ?? 80, theme.accent)}

${logoBlock}
${c.show_back_business_name ? `<text x="${bnn.x}" y="${bnn.y}" font-family="${bodyFont}" font-size="${bnn.size ?? 22}" font-weight="700" letter-spacing="${(bnn.size ?? 22) * 0.09}" fill="${theme.text}"${fitText(business.name.toUpperCase(), bnn.size ?? 22, (bnn.size ?? 22) * 0.09, VW - bnn.x - 60)}>${e(business.name.toUpperCase())}</text>` : ''}
${c.show_back_store_name && storeName ? `<text x="${bsn.x}" y="${bsn.y}" text-anchor="end" font-family="${bodyFont}" font-size="${bsn.size ?? 14}" letter-spacing="${(bsn.size ?? 14) * 0.14}" fill="${theme.sub}">${e(storeName.toUpperCase())}</text>` : ''}
${c.show_footer_right && footerRight ? `<text x="${fr.x}" y="${fr.y}" text-anchor="end" font-family="${bodyFont}" font-size="${fr.size ?? 15}" fill="${theme.sub}"${fitText(footerRight, fr.size ?? 15, 0.5, 700)}>${e(footerRight)}</text>` : ''}
${c.show_footer_left && c.footer_left ? `<text x="${fl.x}" y="${fl.y}" font-family="${bodyFont}" font-size="${fl.size ?? 15}" fill="${theme.sub}">${e(c.footer_left)}</text>` : ''}

${showGuides ? guidesSvg() : ''}
</svg>`
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length > maxChars && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : ['']
}

// ---------------------------------------------------------------------------
// Rasterisation — SVG → PNG at 300 DPI, with pHYs DPI metadata
// ---------------------------------------------------------------------------

export async function svgToPngBlob(svg: string, widthPx = CARD_ART_W_PX, heightPx = CARD_ART_H_PX): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to rasterise card artwork'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = widthPx
    canvas.height = heightPx
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is unavailable')
    ctx.drawImage(img, 0, 0, widthPx, heightPx)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Failed to encode PNG')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Minimal CRC32 + pHYs chunk so the PNG reports 300 DPI to print software.
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export async function pngWithDpi(blob: Blob, dpi = CARD_DPI): Promise<Blob> {
  const data = new Uint8Array(await blob.arrayBuffer())
  // PNG signature (8) + IHDR chunk (4 len + 4 type + 13 data + 4 crc) = 33 bytes before next chunk.
  const insertAt = 33
  const ppm = Math.round(dpi / 0.0254)
  const phys = new Uint8Array(4 + 4 + 9 + 4)
  const view = new DataView(phys.buffer)
  view.setUint32(0, 9)
  phys.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, ppm)
  view.setUint32(12, ppm)
  phys[16] = 1 // unit = metre
  view.setUint32(17, crc32(phys.subarray(4, 17)))
  const out = new Uint8Array(data.length + phys.length)
  out.set(data.subarray(0, insertAt), 0)
  out.set(phys, insertAt)
  out.set(data.subarray(insertAt), insertAt + phys.length)
  return new Blob([out], { type: 'image/png' })
}

// ---------------------------------------------------------------------------
// Batch → ZIP
// ---------------------------------------------------------------------------

export interface CardZipOptions {
  cards: GeneratedLoyaltyCard[]
  design: LoyaltyCardDesign
  business: LoyaltyCardBusiness
  store?: LoyaltyCardStore | null
  batchId?: string
  logoDataUri?: string
  onProgress?: (done: number, total: number) => void
}

export async function generateLoyaltyCardsZip(opts: CardZipOptions): Promise<Blob> {
  const { cards, design, business, store, batchId, logoDataUri, onProgress } = opts
  const zip = new JSZip()
  const frontFolder = zip.folder('card-fronts')

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const svg = buildCardFrontSvg({ design, business, store, cardNumber: card.card_number, logoDataUri })
    const png = await pngWithDpi(await svgToPngBlob(svg))
    frontFolder?.file(`${card.card_number}.png`, png)
    onProgress?.(i + 1, cards.length)
    // Let the UI breathe between renders.
    await new Promise((r) => setTimeout(r, 0))
  }

  if (design.include_back) {
    const backSvg = buildCardBackSvg({
      design,
      business,
      store,
      cardNumber: cards[0]?.card_number,
      logoDataUri,
    })
    const backPng = await pngWithDpi(await svgToPngBlob(backSvg))
    zip.file('card-back.png', backPng)
  }

  const csvRows = [
    ['card_number', 'serial', 'batch_id', 'created_at'],
    ...cards.map((c) => [c.card_number, String(c.serial), batchId || c.batch_id || '', c.created_at || '']),
  ]
  zip.file(
    'card-numbers.csv',
    csvRows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\r\n')
  )

  zip.file(
    'PRINT-README.txt',
    [
      'LOYALTY CARD ARTWORK — PRINT SPECIFICATION',
      '',
      `Store: ${store?.name || business.name}`,
      `Batch: ${batchId || ''}`,
      `Cards: ${cards.length}`,
      '',
      'Card size ........ CR80 / ID-1 (85.60 × 53.98 mm) — standard ATM/credit card',
      'Artwork size ..... 91.6 × 59.98 mm (includes 3 mm bleed on all edges)',
      'Resolution ....... 300 DPI (PNG with pHYs metadata)',
      'Corner radius .... 3.18 mm (standard CR80 die-cut)',
      'Safe zone ........ all text kept ≥3 mm inside the trim edge',
      'Colour ........... artwork is RGB; convert to CMYK before offset printing',
      'Barcode .......... Code 128 encoding the card number, on a white quiet zone',
      '',
      'Files:',
      '  card-fronts/<CARD-NUMBER>.png — one unique front artwork per card',
      design.include_back ? '  card-back.png — shared reverse artwork' : '',
      '  card-numbers.csv — serial / card-number listing for reconciliation',
      '',
    ]
      .filter((l) => l !== '')
      .join('\r\n')
  )

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

/** Display helper: "000142" → "000 142"; legacy "LC-000142" → "LC 000142". */
export function prettyCardNumber(cardNumber: string): string {
  if (/^\d{6,}$/.test(cardNumber)) {
    return `${cardNumber.slice(0, cardNumber.length - 3)} ${cardNumber.slice(-3)}`
  }
  return cardNumber.replace('-', ' ')
}
