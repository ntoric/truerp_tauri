import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normalize API list payloads that may be an array, `{ data: [] }`, or null. */
export function asArray<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data
  }
  return []
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8088/api/v1"

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (date == null || date === '') return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MAX_SKU_BASE_LEN = 24

/** Build a SKU suggestion from a product name (matches backend SKUFromName). */
export function skuFromProductName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''

  let result = ''
  let prevHyphen = true
  for (const char of trimmed.toUpperCase()) {
    if (/[A-Z0-9]/.test(char)) {
      result += char
      prevHyphen = false
    } else if (!prevHyphen && result.length > 0) {
      result += '-'
      prevHyphen = true
    }
  }

  result = result.replace(/^-+|-+$/g, '')
  if (!result) return 'PROD'
  if (result.length > MAX_SKU_BASE_LEN) {
    result = result.slice(0, MAX_SKU_BASE_LEN).replace(/-+$/g, '')
    if (!result) return 'PROD'
  }
  return result
}
