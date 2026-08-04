export type InvoiceThemeId =
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'stylish'
  | 'luxury'
  | 'advanced_gst'
  | 'custom'

export interface InvoiceThemeSettings {
  show_party_balance: boolean
  enable_free_item_quantity: boolean
  show_item_description: boolean
  show_alternate_unit: boolean
  show_phone_on_invoice: boolean
  show_time_on_invoice: boolean
  price_history: boolean
  auto_apply_luxury_theme_for_sharing: boolean
}

export interface InvoiceDetailVisibility {
  show_invoice_number: boolean
  show_invoice_date: boolean
  show_due_date: boolean
  show_place_of_supply: boolean
  show_payment_terms: boolean
  show_notes: boolean
  show_terms_and_conditions: boolean
  show_amount_in_words: boolean
  show_received_amount: boolean
  show_balance_due: boolean
}

export interface PartyDetailVisibility {
  show_party_name: boolean
  show_party_address: boolean
  show_party_phone: boolean
  show_party_gstin: boolean
  show_shipping_address: boolean
}

export interface ItemTableColumnVisibility {
  items: boolean
  hsn: boolean
  qty: boolean
  rate: boolean
  disc: boolean
  tax: boolean
  amount: boolean
  batch: boolean
  mrp: boolean
}

export interface InvoiceMiscVisibility {
  show_bank_details: boolean
  show_signature: boolean
  show_qr_code: boolean
  show_eway_bill: boolean
}

export interface InvoiceTemplateCustomization {
  theme_style_tags: string[]
  use_custom_theme: boolean
  theme_settings: InvoiceThemeSettings
  invoice_details: InvoiceDetailVisibility
  party_details: PartyDetailVisibility
  item_columns: ItemTableColumnVisibility
  miscellaneous: InvoiceMiscVisibility
}

export interface InvoiceSettingsRecord {
  id?: string
  template: string
  primary_color: string
  secondary_color: string
  theme: string
  show_logo: boolean
  show_signature: boolean
  show_bank_details: boolean
  show_terms: boolean
  default_terms: string
  invoice_prefix: string
  starting_number: number
  customization: InvoiceTemplateCustomization | string
}

export const INVOICE_COLOR_SWATCHES = [
  { id: 'black', label: 'Black', primary: '#111827', secondary: '#374151' },
  { id: 'green', label: 'Green', primary: '#166534', secondary: '#14532d' },
  { id: 'blue', label: 'Blue', primary: '#1e3a8a', secondary: '#1e40af' },
  { id: 'purple', label: 'Purple', primary: '#7c3aed', secondary: '#6d28d9' },
  { id: 'red', label: 'Red', primary: '#dc2626', secondary: '#b91c1c' },
  { id: 'teal', label: 'Teal', primary: '#0d9488', secondary: '#0f766e' },
  { id: 'amber', label: 'Yellow', primary: '#ca8a04', secondary: '#a16207' },
  { id: 'brown', label: 'Brown', primary: '#78350f', secondary: '#92400e' },
] as const

export const INVOICE_THEME_PRESETS: { id: InvoiceThemeId; label: string; description: string }[] = [
  { id: 'stylish', label: 'Stylish', description: 'Bold header bar with GST layout' },
  { id: 'luxury', label: 'Luxury', description: 'Premium spacing and accent typography' },
  { id: 'advanced_gst', label: 'Advanced GST (Tally)', description: 'Tally-style tax breakdown' },
  { id: 'classic', label: 'Classic', description: 'Standard table invoice' },
  { id: 'modern', label: 'Modern', description: 'Gradient header' },
  { id: 'minimal', label: 'Minimal', description: 'Clean lines, fewer borders' },
]

export const THEME_STYLE_TAG_OPTIONS = [
  { id: 'uttar_pradesh', label: 'Uttar Pradesh' },
  { id: 'maharashtra', label: 'Maharashtra' },
  { id: 'gujarat', label: 'Gujarat' },
  { id: 'karnataka', label: 'Karnataka' },
] as const

export function defaultInvoiceTemplateCustomization(): InvoiceTemplateCustomization {
  return {
    theme_style_tags: [],
    use_custom_theme: false,
    theme_settings: {
      show_party_balance: true,
      enable_free_item_quantity: false,
      show_item_description: false,
      show_alternate_unit: false,
      show_phone_on_invoice: true,
      show_time_on_invoice: false,
      price_history: false,
      auto_apply_luxury_theme_for_sharing: false,
    },
    invoice_details: {
      show_invoice_number: true,
      show_invoice_date: true,
      show_due_date: true,
      show_place_of_supply: true,
      show_payment_terms: true,
      show_notes: true,
      show_terms_and_conditions: true,
      show_amount_in_words: true,
      show_received_amount: true,
      show_balance_due: true,
    },
    party_details: {
      show_party_name: true,
      show_party_address: true,
      show_party_phone: true,
      show_party_gstin: true,
      show_shipping_address: false,
    },
    item_columns: {
      items: true,
      hsn: true,
      qty: true,
      rate: true,
      disc: true,
      tax: true,
      amount: true,
      batch: false,
      mrp: false,
    },
    miscellaneous: {
      show_bank_details: true,
      show_signature: false,
      show_qr_code: false,
      show_eway_bill: false,
    },
  }
}

export function parseCustomization(
  raw: InvoiceTemplateCustomization | string | undefined | null
): InvoiceTemplateCustomization {
  const base = defaultInvoiceTemplateCustomization()
  if (!raw) return base
  if (typeof raw === 'string') {
    if (!raw.trim()) return base
    try {
      const parsed = JSON.parse(raw) as Partial<InvoiceTemplateCustomization>
      return {
        ...base,
        ...parsed,
        theme_settings: { ...base.theme_settings, ...parsed.theme_settings },
        invoice_details: { ...base.invoice_details, ...parsed.invoice_details },
        party_details: { ...base.party_details, ...parsed.party_details },
        item_columns: { ...base.item_columns, ...parsed.item_columns },
        miscellaneous: { ...base.miscellaneous, ...parsed.miscellaneous },
        theme_style_tags: parsed.theme_style_tags ?? base.theme_style_tags,
      }
    } catch {
      return base
    }
  }
  return {
    ...base,
    ...raw,
    theme_settings: { ...base.theme_settings, ...raw.theme_settings },
    invoice_details: { ...base.invoice_details, ...raw.invoice_details },
    party_details: { ...base.party_details, ...raw.party_details },
    item_columns: { ...base.item_columns, ...raw.item_columns },
    miscellaneous: { ...base.miscellaneous, ...raw.miscellaneous },
    theme_style_tags: raw.theme_style_tags ?? base.theme_style_tags,
  }
}

export function defaultInvoiceSettingsRecord(): InvoiceSettingsRecord {
  return {
    template: 'stylish',
    primary_color: '#111827',
    secondary_color: '#374151',
    theme: 'light',
    show_logo: true,
    show_signature: false,
    show_bank_details: true,
    show_terms: true,
    default_terms: '',
    invoice_prefix: 'INV',
    starting_number: 1,
    customization: defaultInvoiceTemplateCustomization(),
  }
}

export function normalizeInvoiceSettingsFromApi(data: Partial<InvoiceSettingsRecord>): InvoiceSettingsRecord {
  const base = defaultInvoiceSettingsRecord()
  return {
    ...base,
    ...data,
    customization: parseCustomization(data.customization),
  }
}

export function serializeInvoiceSettingsForApi(settings: InvoiceSettingsRecord): InvoiceSettingsRecord {
  const customization = parseCustomization(settings.customization)
  return {
    ...settings,
    customization: JSON.stringify(customization),
  }
}

export function swatchIdForColor(hex: string): string {
  const normalized = hex.toLowerCase()
  const match = INVOICE_COLOR_SWATCHES.find((s) => s.primary.toLowerCase() === normalized)
  return match?.id ?? 'black'
}
