/** A4 sticker-sheet presets for barcode label printing (4 columns × 11 rows = 44 labels). */

export type A4LabelSheetPresetKey = '48.5x25.4' | '46x24' | 'custom'

export interface A4LabelSheetLayout {
  paperSize: string
  labelWidthMm: number
  labelHeightMm: number
  columns: number
  rows: number
  marginTopMm: number
  marginLeftMm: number
  gapHMm: number
  gapVMm: number
}

export interface A4LabelSheetPreset {
  key: A4LabelSheetPresetKey
  label: string
  description: string
  layout: A4LabelSheetLayout
}

/** 48.5 × 25.4 mm — most common commercial A4 sticker sheet. */
export const A4_PRESET_485x254: A4LabelSheetPreset = {
  key: '48.5x25.4',
  label: '48.5 × 25.4 mm (4×11)',
  description: '44 labels/sheet · 5 mm side margins · 2 mm horizontal gap',
  layout: {
    paperSize: 'A4',
    labelWidthMm: 48.5,
    labelHeightMm: 25.4,
    columns: 4,
    rows: 11,
    marginTopMm: 8.8,
    marginLeftMm: 5,
    gapHMm: 2,
    gapVMm: 0,
  },
}

/** 46 × 24 mm — alternate manufacturer layout with explicit gaps. */
export const A4_PRESET_46x24: A4LabelSheetPreset = {
  key: '46x24',
  label: '46 × 24 mm (4×11)',
  description: '44 labels/sheet · 10 mm sides · 11 mm top/bottom · 2×1.1 mm gaps',
  layout: {
    paperSize: 'A4',
    labelWidthMm: 46,
    labelHeightMm: 24,
    columns: 4,
    rows: 11,
    marginTopMm: 11,
    marginLeftMm: 10,
    gapHMm: 2,
    gapVMm: 1.1,
  },
}

export const A4_LABEL_SHEET_PRESETS: A4LabelSheetPreset[] = [
  A4_PRESET_485x254,
  A4_PRESET_46x24,
]

export function labelsPerSheet(layout: Pick<A4LabelSheetLayout, 'columns' | 'rows'>): number {
  return Math.max(1, layout.columns * layout.rows)
}

export function normalizeA4SheetPreset(value: unknown): A4LabelSheetPresetKey {
  if (value === '48.5x25.4' || value === '46x24' || value === 'custom') {
    return value
  }
  return '48.5x25.4'
}

export function a4PresetByKey(key: A4LabelSheetPresetKey): A4LabelSheetPreset | undefined {
  if (key === 'custom') return undefined
  return A4_LABEL_SHEET_PRESETS.find((p) => p.key === key)
}

export function layoutFromPresetKey(key: A4LabelSheetPresetKey): A4LabelSheetLayout {
  const preset = a4PresetByKey(key)
  return preset?.layout ?? { ...A4_PRESET_485x254.layout }
}

/** 1-based sticker index → row/column on sheet (for UI hints). */
export function stickerPositionToRowCol(
  position: number,
  columns: number
): { row: number; col: number } {
  const idx = Math.max(0, position - 1)
  return {
    row: Math.floor(idx / columns) + 1,
    col: (idx % columns) + 1,
  }
}
