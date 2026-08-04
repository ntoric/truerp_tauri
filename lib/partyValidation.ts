import type { FieldErrors } from '@/lib/form-errors'

export interface PartyFormValues {
  name: string
  phone: string
  email: string
  category: string
  party_type: string
  opening_balance: number
  credit_limit: number
  gstin: string
  address: string
  city: string
  state: string
  pincode: string
  tan: string
  pan: string
  notes: string
}

export const EMPTY_PARTY_FORM: PartyFormValues = {
  name: '',
  phone: '',
  email: '',
  category: '',
  party_type: 'customer',
  opening_balance: 0,
  credit_limit: 0,
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  tan: '',
  pan: '',
  notes: '',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/
const PINCODE_RE = /^[1-9][0-9]{5}$/

function normalizeDigits(value: string): string {
  return value.replace(/[\s-]/g, '')
}

function isValidPhone(phone: string): boolean {
  const normalized = normalizeDigits(phone)
  if (!normalized) return true
  if (/^(\+91|91)?[6-9]\d{9}$/.test(normalized)) return true
  return /^[6-9]\d{9}$/.test(normalized)
}

export function validatePartyForm(values: PartyFormValues): FieldErrors {
  const errors: FieldErrors = {}
  const name = values.name.trim()

  if (!name) {
    errors.name = 'Name is required'
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  } else if (name.length > 200) {
    errors.name = 'Name must be 200 characters or less'
  }

  if (!values.party_type) {
    errors.party_type = 'Party type is required'
  } else if (!['customer', 'vendor'].includes(values.party_type)) {
    errors.party_type = 'Party type must be Customer or Vendor'
  }

  if (values.phone.trim() && !isValidPhone(values.phone)) {
    errors.phone = 'Enter a valid 10-digit mobile number'
  }

  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  const gstin = values.gstin.trim().toUpperCase()
  if (gstin && !GSTIN_RE.test(gstin)) {
    errors.gstin = 'Enter a valid 15-character GSTIN'
  }

  const pan = values.pan.trim().toUpperCase()
  if (pan && !PAN_RE.test(pan)) {
    errors.pan = 'Enter a valid PAN (e.g. ABCDE1234F)'
  }

  const tan = values.tan.trim().toUpperCase()
  if (tan && !TAN_RE.test(tan)) {
    errors.tan = 'Enter a valid TAN (e.g. ABCD12345E)'
  }

  const pincode = values.pincode.trim()
  if (pincode && !PINCODE_RE.test(pincode)) {
    errors.pincode = 'Enter a valid 6-digit pincode'
  }

  if (Number.isNaN(values.opening_balance)) {
    errors.opening_balance = 'Opening balance must be a valid number'
  }

  if (Number.isNaN(values.credit_limit)) {
    errors.credit_limit = 'Credit limit must be a valid number'
  } else if (values.credit_limit < 0) {
    errors.credit_limit = 'Credit limit cannot be negative'
  }

  return errors
}

export function firstValidationMessage(errors: FieldErrors): string | undefined {
  return Object.values(errors)[0]
}
