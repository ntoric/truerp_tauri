'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CardElementLayout,
  LoyaltyCardBusiness,
  LoyaltyCardDesign,
  LoyaltyCardStore,
  buildCardBackSvg,
  buildCardFrontSvg,
  resolveCardContent,
  resolveCardLayout,
} from '@/lib/loyaltyCards'

/**
 * Interactive drag/resize overlay on top of the card preview.
 *
 * Coordinates are stored in 0.1 mm viewBox units (916 × 600) — the same units
 * the SVG artwork uses — so what the user drags is exactly what renders.
 */

export type CardSide = 'front' | 'back'

interface CardLayoutEditorProps {
  design: LoyaltyCardDesign
  business: LoyaltyCardBusiness
  store: LoyaltyCardStore | null
  logoDataUri?: string
  side: CardSide
  sampleCardNumber: string
  onElementChange: (side: CardSide, key: string, geom: CardElementLayout) => void
}

type ElKind = 'text' | 'textEnd' | 'box' | 'glyph' | 'stripe'

interface EditableEl {
  key: string
  label: string
  kind: ElKind
}

const FRONT_ELEMENTS: EditableEl[] = [
  { key: 'logo', label: 'Logo', kind: 'box' },
  { key: 'title', label: 'Business name', kind: 'text' },
  { key: 'tagline', label: 'Tagline', kind: 'text' },
  { key: 'store_name', label: 'Store name', kind: 'textEnd' },
  { key: 'chip', label: 'Chip', kind: 'box' },
  { key: 'card_number', label: 'Card number', kind: 'text' },
  { key: 'member', label: 'Member label', kind: 'text' },
  { key: 'footer', label: 'Footer line', kind: 'text' },
  { key: 'barcode', label: 'Barcode panel', kind: 'box' },
  { key: 'graphic', label: 'Emblem', kind: 'glyph' },
  { key: 'mark', label: 'Accent mark', kind: 'glyph' },
]

const BACK_ELEMENTS: EditableEl[] = [
  { key: 'logo', label: 'Logo', kind: 'box' },
  { key: 'business_name', label: 'Business name', kind: 'text' },
  { key: 'store_name', label: 'Store name', kind: 'textEnd' },
  { key: 'mag_stripe', label: 'Mag stripe', kind: 'stripe' },
  { key: 'signature', label: 'Signature strip', kind: 'box' },
  { key: 'back_number', label: 'Card number', kind: 'textEnd' },
  { key: 'terms', label: 'Terms block', kind: 'text' },
  { key: 'footer_left', label: 'Bottom-left line', kind: 'text' },
  { key: 'footer_right', label: 'Bottom-right line', kind: 'textEnd' },
  { key: 'graphic', label: 'Emblem', kind: 'glyph' },
]

const VW = 916
const VH = 600

interface DragState {
  key: string
  kind: ElKind
  mode: 'move' | 'resize'
  startX: number
  startY: number
  orig: CardElementLayout
  origW: number
  origH: number
}

export default function CardLayoutEditor({
  design,
  business,
  store,
  logoDataUri,
  side,
  sampleCardNumber,
  onElementChange,
}: CardLayoutEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [scale, setScale] = useState(1)

  const content = useMemo(() => resolveCardContent(design), [design])
  const layout = useMemo(() => resolveCardLayout(design)[side], [design, side])

  const svg = useMemo(() => {
    if (side === 'front') {
      return buildCardFrontSvg({
        design,
        business,
        store,
        cardNumber: sampleCardNumber,
        logoDataUri,
        showGuides: true,
      })
    }
    return buildCardBackSvg({
      design,
      business,
      store,
      cardNumber: sampleCardNumber,
      logoDataUri,
      showGuides: true,
    })
  }, [design, business, store, side, sampleCardNumber, logoDataUri])

  // Track the preview's pixel size so pointer deltas map to viewBox units.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / VW)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Which elements are currently visible → get drag handles.
  const visibleKeys = useMemo(() => {
    const hasText = (v: string) => v.trim().length > 0
    if (side === 'front') {
      const footer = (content.footer_text || business.phone || '').trim()
      const storeName = (content.store_label || store?.name || '').trim()
      const member = (content.member_label || '').trim()
      const tagline = (content.tagline || '').trim()
      return new Set(
        FRONT_ELEMENTS.filter((el) => {
          switch (el.key) {
            case 'logo':
              return design.show_logo && !!logoDataUri
            case 'title':
              return content.show_title
            case 'tagline':
              return content.show_tagline && hasText(tagline)
            case 'store_name':
              return content.show_store_name && hasText(storeName)
            case 'chip':
              return design.show_chip
            case 'card_number':
              return content.show_card_number
            case 'member':
              return content.show_member && hasText(member)
            case 'footer':
              return content.show_footer && hasText(footer)
            case 'barcode':
              return content.show_barcode
            case 'graphic':
              return (design.front_graphic || 'none') !== 'none'
            case 'mark':
              return true
            default:
              return false
          }
        }).map((el) => el.key)
      )
    }
    const storeName = (content.store_label || store?.name || '').trim()
    const right = (content.footer_right || business.phone || '').trim()
    return new Set(
      BACK_ELEMENTS.filter((el) => {
        switch (el.key) {
          case 'logo':
            return content.show_back_logo && design.show_logo && !!logoDataUri
          case 'business_name':
            return content.show_back_business_name
          case 'store_name':
            return content.show_back_store_name && hasText(storeName)
          case 'mag_stripe':
            return content.show_mag_stripe
          case 'signature':
            return content.show_signature_strip
          case 'back_number':
            return content.show_back_number
          case 'terms':
            return content.show_terms
          case 'footer_left':
            return content.show_footer_left && hasText(content.footer_left || '')
          case 'footer_right':
            return content.show_footer_right && hasText(right)
          case 'graphic':
            return (design.back_graphic || 'none') !== 'none'
          default:
            return false
        }
      }).map((el) => el.key)
    )
  }, [side, design, content, business, store, logoDataUri])

  const elementText = useCallback(
    (key: string): string => {
      const title = (content.title || business.name || '').toUpperCase()
      const storeName = (content.store_label || store?.name || '').toUpperCase()
      const map: Record<string, string> = {
        title,
        tagline: (content.tagline || '').toUpperCase(),
        store_name: storeName,
        business_name: business.name.toUpperCase(),
        card_number: sampleCardNumber.replace('-', ' '),
        member: (content.member_label || '').toUpperCase(),
        footer: content.footer_text || business.phone || '',
        back_number: sampleCardNumber,
        terms: content.terms_heading || 'TERMS',
        footer_left: content.footer_left || '',
        footer_right: content.footer_right || business.phone || '',
      }
      return map[key] || '■'
    },
    [content, business, store, sampleCardNumber]
  )

  /** Bounding rect (viewBox units) used to draw the drag handle. */
  const handleRect = useCallback(
    (el: EditableEl): { x: number; y: number; w: number; h: number } => {
      const g = layout[el.key] || { x: 0, y: 0 }
      const size = g.size ?? 16
      if (el.kind === 'box' || el.kind === 'stripe') {
        return { x: g.x, y: g.y, w: g.w ?? 80, h: g.h ?? 60 }
      }
      if (el.kind === 'glyph') {
        const s = g.size ?? 80
        return { x: g.x, y: g.y, w: s, h: s }
      }
      const estW = Math.max(30, elementText(el.key).length * size * 0.78)
      const h = size * 1.35
      const top = g.y - size * 1.05
      return el.kind === 'textEnd'
        ? { x: g.x - estW, y: top, w: estW, h }
        : { x: g.x, y: top, w: estW, h }
    },
    [layout, elementText]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current
      const wrap = wrapRef.current
      if (!drag || !wrap) return
      const k = VW / wrap.clientWidth
      const dx = (e.clientX - drag.startX) * k
      const dy = (e.clientY - drag.startY) * k
      const next: CardElementLayout = { ...drag.orig }
      if (drag.mode === 'move') {
        next.x = Math.round(Math.min(VW + 60, Math.max(-120, drag.orig.x + dx)))
        next.y = Math.round(Math.min(VH + 30, Math.max(-60, drag.orig.y + dy)))
      } else {
        if (drag.kind === 'text' || drag.kind === 'textEnd') {
          const factor = Math.max(0.25, (drag.origW + dx) / Math.max(drag.origW, 10))
          next.size = Math.round(Math.min(120, Math.max(8, (drag.orig.size ?? 16) * factor)))
        } else if (drag.kind === 'glyph') {
          next.size = Math.round(
            Math.min(300, Math.max(16, (drag.orig.size ?? 80) + dx))
          )
        } else if (drag.kind === 'stripe') {
          next.h = Math.round(Math.min(300, Math.max(20, (drag.orig.h ?? 108) + dy)))
        } else {
          next.w = Math.round(Math.min(VW, Math.max(30, (drag.orig.w ?? 80) + dx)))
          next.h = Math.round(Math.min(VH, Math.max(16, (drag.orig.h ?? 60) + dy)))
        }
      }
      onElementChange(side, drag.key, next)
    },
    [onElementChange, side]
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
  }, [onPointerMove])

  const startDrag = (e: React.PointerEvent, el: EditableEl, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    setSelected(el.key)
    const g = layout[el.key] || { x: 0, y: 0 }
    const rect = handleRect(el)
    dragRef.current = {
      key: el.key,
      kind: el.kind,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...g },
      origW: rect.w,
      origH: rect.h,
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
  }

  useEffect(() => endDrag, [endDrag])

  const elements = side === 'front' ? FRONT_ELEMENTS : BACK_ELEMENTS

  return (
    <div ref={wrapRef} className="relative select-none" onPointerDown={() => setSelected(null)}>
      <div
        className="overflow-hidden rounded-xl shadow-lg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {elements
        .filter((el) => visibleKeys.has(el.key))
        .map((el) => {
          const r = handleRect(el)
          const isSel = selected === el.key
          return (
            <div
              key={el.key}
              title={el.label}
              onPointerDown={(e) => startDrag(e, el, 'move')}
              className={`absolute cursor-move border transition-colors ${
                isSel
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/60 bg-white/5 hover:border-blue-400 hover:bg-blue-400/10'
              }`}
              style={{
                left: r.x * scale,
                top: r.y * scale,
                width: r.w * scale,
                height: r.h * scale,
                borderStyle: 'dashed',
              }}
            >
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {el.label}
              </span>
              <div
                onPointerDown={(e) => startDrag(e, el, 'resize')}
                className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-white bg-blue-500"
              />
            </div>
          )
        })}
    </div>
  )
}
