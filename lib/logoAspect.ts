export type LogoAspectRatio = 'square' | 'landscape' | 'portrait'

export const LOGO_ASPECT_OPTIONS: {
  key: LogoAspectRatio
  label: string
  hint: string
  ratio: number
  frameClass: string
}[] = [
  { key: 'square', label: 'Square', hint: '1:1', ratio: 1, frameClass: 'h-6 w-6' },
  { key: 'landscape', label: 'Landscape', hint: '3:2 wide', ratio: 3 / 2, frameClass: 'h-6 w-9' },
  { key: 'portrait', label: 'Portrait', hint: '2:3', ratio: 2 / 3, frameClass: 'h-9 w-6' },
]

export function normalizeLogoAspectRatio(value: unknown): LogoAspectRatio {
  if (value === 'landscape' || value === 'portrait' || value === 'square') return value
  return 'square'
}

export function logoAspectRatioValue(value: unknown): number {
  const key = normalizeLogoAspectRatio(value)
  return LOGO_ASPECT_OPTIONS.find((opt) => opt.key === key)?.ratio ?? 1
}

export function logoPreviewBoxClass(value: unknown): string {
  switch (normalizeLogoAspectRatio(value)) {
    case 'landscape':
      return 'h-full max-h-28 aspect-[3/2]'
    case 'portrait':
      return 'h-full max-h-28 aspect-[2/3]'
    default:
      return 'h-full max-h-28 aspect-square'
  }
}

export function invoiceLogoClass(value: unknown): string {
  switch (normalizeLogoAspectRatio(value)) {
    case 'landscape':
      return 'h-12 w-[72px] rounded object-contain'
    case 'portrait':
      return 'h-[72px] w-12 rounded object-contain'
    default:
      return 'h-12 w-12 rounded object-contain'
  }
}
