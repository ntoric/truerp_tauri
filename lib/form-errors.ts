export type FieldErrors = Record<string, string>

export interface ApiErrorPayload {
  error?: string
  message?: string
  fields?: FieldErrors
  errors?: FieldErrors | Array<{ field?: string; path?: string; message?: string; error?: string }>
}

const BINDING_FIELD_RE = /(?:struct field|field)\s+[^.]*\.([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/i
const UUID_FIELD_RE = /cannot unmarshal .* into Go (?:struct )?field .*?\.([a-zA-Z0-9_.]+) of type uuid\.UUID/i

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  sku: 'SKU',
  category: 'Category',
  sale_price: 'Sale price',
  purchase_price: 'Purchase price',
  tax_rate: 'GST rate',
  hsn_code: 'HSN code',
  'inventory.outlet_id': 'Warehouse',
  outlet_id: 'Warehouse',
  party_id: 'Party',
  PartyID: 'Party',
  vendor_id: 'Vendor',
  customer_id: 'Customer',
  amount_paid: 'Amount paid',
  payment_out_discount: 'Payment out discount',
  mode: 'Payment mode',
  date: 'Payment date',
  purchase_bill_id: 'Purchase bill',
  unit_price: 'Item unit price',
  UnitPrice: 'Item unit price',
  'Items.UnitPrice': 'Item unit price',
  quantity: 'Quantity',
  Quantity: 'Quantity',
  'Items.Quantity': 'Quantity',
  email: 'Email',
  phone: 'Phone',
  gstin: 'GSTIN',
  pan: 'PAN',
  tan: 'TAN',
  pincode: 'Pincode',
  party_type: 'Party type',
  opening_balance: 'Opening balance',
  credit_limit: 'Credit limit',
  password: 'Password',
  totp_code: 'Authenticator code',
  current_password: 'Current password',
  new_password: 'New password',
  code: 'Store code',
  description: 'Description',
  address: 'Address',
  city: 'City',
  state: 'State',
  role: 'Role',
}

function labelFor(field: string): string {
  return FIELD_LABELS[field] || field.replace(/[_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Convert backend/technical errors into user-friendly copy. */
export function humanizeError(raw: string): string {
  if (!raw) return 'Something went wrong. Please try again.'
  const msg = raw.trim()

  if (/authorization header required|invalid or expired token|unauthorized/i.test(msg)) {
    return 'Your session has expired. Please log in again.'
  }
  if (/cannot unmarshal.*outlet_id.*uuid/i.test(msg) || /inventory\.outlet_id/i.test(msg) && /uuid/i.test(msg)) {
    return 'Please select a valid warehouse, or leave it empty.'
  }
  if (/cannot unmarshal/i.test(msg)) {
    const jsonFieldMatch = msg.match(/\.Items(?:\[\d+])?\.([a-zA-Z0-9_]+)/i)
    if (jsonFieldMatch?.[1]) {
      return `${labelFor(jsonFieldMatch[1])} has an invalid value.`
    }
    const match = msg.match(UUID_FIELD_RE) || msg.match(BINDING_FIELD_RE)
    if (match?.[1]) {
      return `${labelFor(match[1])} has an invalid value.`
    }
    return 'Some fields have invalid values. Please check the form and try again.'
  }
  if (/required/i.test(msg) && /binding/i.test(msg)) {
    return 'Please fill in all required fields.'
  }
  if (/EOF|unexpected end of JSON|invalid character/i.test(msg)) {
    return 'Invalid request data. Please try again.'
  }
  // Strip Go package prefixes / gin binder noise
  return msg
    .replace(/^Key:\s*'[^']+'\s*Error:/i, '')
    .replace(/Error:Field validation for /gi, '')
    .trim() || 'Something went wrong. Please try again.'
}

export function extractFieldFromBindingError(raw: string): string | null {
  const uuidMatch = raw.match(UUID_FIELD_RE)
  if (uuidMatch?.[1]) return uuidMatch[1]
  const fieldMatch = raw.match(BINDING_FIELD_RE)
  if (fieldMatch?.[1]) return fieldMatch[1]
  return null
}

export async function parseApiError(res: Response): Promise<{ message: string; fields: FieldErrors }> {
  let payload: ApiErrorPayload | null = null
  try {
    payload = await res.json()
  } catch {
    return {
      message: res.statusText || `Request failed (${res.status})`,
      fields: {},
    }
  }

  const fields: FieldErrors = {}

  if (payload?.fields && typeof payload.fields === 'object' && !Array.isArray(payload.fields)) {
    Object.assign(fields, payload.fields)
  }

  if (Array.isArray(payload?.errors)) {
    for (const item of payload.errors) {
      const key = item.field || item.path
      const val = item.message || item.error
      if (key && val) fields[key] = humanizeError(val)
    }
  } else if (payload?.errors && typeof payload.errors === 'object') {
    for (const [key, val] of Object.entries(payload.errors)) {
      if (typeof val === 'string') fields[key] = humanizeError(val)
    }
  }

  const rawMessage = payload?.error || payload?.message || `Request failed (${res.status})`
  const fieldFromMsg = extractFieldFromBindingError(rawMessage)
  if (fieldFromMsg && !fields[fieldFromMsg]) {
    fields[fieldFromMsg] = humanizeError(rawMessage)
  }

  return {
    message: humanizeError(rawMessage),
    fields,
  }
}

export function firstFieldError(fields: FieldErrors): string | undefined {
  return Object.keys(fields)[0]
}
