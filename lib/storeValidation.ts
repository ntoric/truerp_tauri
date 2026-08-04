import type { FieldErrors } from '@/lib/form-errors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PINCODE_RE = /^[1-9][0-9]{5}$/
const STORE_CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface StoreFormValues {
  name: string
  code: string
  description: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
}

export interface StoreUserFormValues {
  name: string
  email: string
  password: string
  phone: string
  role: string
}

function normalizeDigits(value: string): string {
  return value.replace(/[\s-]/g, '')
}

function isValidPhone(phone: string): boolean {
  const normalized = normalizeDigits(phone)
  if (!normalized) return true
  if (/^(\+91|91)?[6-9]\d{9}$/.test(normalized)) return true
  return /^[6-9]\d{9}$/.test(normalized)
}

function normalizeStoreCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
}

export function validateStoreForm(values: StoreFormValues): FieldErrors {
  const errors: FieldErrors = {}
  const name = values.name.trim()

  if (!name) {
    errors.name = 'Store name is required'
  } else if (name.length < 2) {
    errors.name = 'Store name must be at least 2 characters'
  } else if (name.length > 120) {
    errors.name = 'Store name must be 120 characters or less'
  }

  if (values.code.trim()) {
    const code = normalizeStoreCode(values.code)
    if (!code || !STORE_CODE_RE.test(code)) {
      errors.code = 'Store code may only contain letters, numbers, and hyphens'
    } else if (code.length > 32) {
      errors.code = 'Store code must be 32 characters or less'
    }
  }

  if (values.description.trim().length > 500) {
    errors.description = 'Description must be 500 characters or less'
  }

  if (values.address.trim().length > 300) {
    errors.address = 'Address must be 300 characters or less'
  }

  if (values.city.trim().length > 100) {
    errors.city = 'City must be 100 characters or less'
  }

  if (values.state.trim().length > 100) {
    errors.state = 'State must be 100 characters or less'
  }

  if (values.pincode.trim() && !PINCODE_RE.test(values.pincode.trim())) {
    errors.pincode = 'Enter a valid 6-digit pincode'
  }

  if (values.phone.trim() && !isValidPhone(values.phone)) {
    errors.phone = 'Enter a valid 10-digit mobile number'
  }

  if (values.email.trim()) {
    if (!EMAIL_RE.test(values.email.trim()) || values.email.trim().length > 254) {
      errors.email = 'Enter a valid email address'
    }
  }

  return errors
}

export function validateStoreUserForm(values: StoreUserFormValues): FieldErrors {
  const errors: FieldErrors = {}
  const name = values.name.trim()

  if (!name) {
    errors.name = 'Name is required'
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  } else if (name.length > 100) {
    errors.name = 'Name must be 100 characters or less'
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(values.email.trim()) || values.email.trim().length > 254) {
    errors.email = 'Enter a valid email address'
  }

  if (!values.password) {
    errors.password = 'Password is required'
  } else if (values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  } else if (values.password.length > 128) {
    errors.password = 'Password must be 128 characters or less'
  }

  if (values.phone.trim() && !isValidPhone(values.phone)) {
    errors.phone = 'Enter a valid 10-digit mobile number'
  }

  if (!values.role.trim()) {
    errors.role = 'Role is required'
  } else if (!['admin', 'manager', 'accountant', 'staff'].includes(values.role)) {
    errors.role = 'Select a valid role'
  }

  return errors
}

export function firstValidationMessage(errors: FieldErrors): string | undefined {
  return Object.values(errors)[0]
}
