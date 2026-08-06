import type { FieldErrors } from '@/lib/form-errors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeDigits(value: string): string {
  return value.replace(/[\s-]/g, '')
}

function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_RE.test(trimmed)
}

function isValidPhone(phone: string): boolean {
  const normalized = normalizeDigits(phone)
  if (!normalized) return true
  if (/^(\+91|91)?[6-9]\d{9}$/.test(normalized)) return true
  return /^[6-9]\d{9}$/.test(normalized)
}

export interface LoginFormValues {
  email: string
  password: string
  totpCode?: string
  needs2fa?: boolean
}

export interface RegisterFormValues {
  name: string
  email: string
  password: string
  phone?: string
}

export interface ForgotPasswordFormValues {
  email: string
}

export function validateLoginForm(values: LoginFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!values.password) {
    errors.password = 'Password is required'
  }

  if (values.needs2fa) {
    const code = (values.totpCode || '').trim()
    if (!code) {
      errors.totpCode = 'Authenticator code is required'
    } else if (!/^\d{6}$/.test(code)) {
      errors.totpCode = 'Authenticator code must be 6 digits'
    }
  }

  return errors
}

export function validateRegisterForm(values: RegisterFormValues): FieldErrors {
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
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!values.password) {
    errors.password = 'Password is required'
  } else if (values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  } else if (values.password.length > 128) {
    errors.password = 'Password must be 128 characters or less'
  }

  if (values.phone?.trim() && !isValidPhone(values.phone)) {
    errors.phone = 'Enter a valid 10-digit mobile number'
  }

  return errors
}

export function validateForgotPasswordForm(values: ForgotPasswordFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address'
  }

  return errors
}

export interface ResetOTPFormValues {
  otp: string
}

export interface ResetPasswordFormValues {
  password: string
  confirmPassword: string
}

export function validateResetOTPForm(values: ResetOTPFormValues): FieldErrors {
  const errors: FieldErrors = {}
  const code = values.otp.trim()

  if (!code) {
    errors.otp = 'Verification code is required'
  } else if (!/^\d{6}$/.test(code)) {
    errors.otp = 'Verification code must be 6 digits'
  }

  return errors
}

export function validateResetPasswordForm(values: ResetPasswordFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (!values.password) {
    errors.password = 'Password is required'
  } else if (values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  } else if (values.password.length > 128) {
    errors.password = 'Password must be 128 characters or less'
  }

  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }

  return errors
}

export function firstValidationMessage(errors: FieldErrors): string | undefined {
  return Object.values(errors)[0]
}
