/** Shared types and display helpers for in-app support requests. */

export interface SupportRequestAuthor {
  id: string
  name: string
  email: string
}

export interface SupportRequestReply {
  id: string
  support_request_id: string
  author_id: string
  author?: SupportRequestAuthor | null
  is_admin: boolean
  message: string
  created_at: string
}

export interface SupportRequest {
  id: string
  request_number: string
  owner_user_id: string
  requester_id: string
  requester?: SupportRequestAuthor | null
  store_id?: string | null
  store?: { id: string; name: string } | null
  subject: string
  category: string
  message: string
  status: string
  admin_notes?: string
  replies?: SupportRequestReply[]
  last_reply_at?: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
}

export const SUPPORT_REQUEST_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const

export const SUPPORT_REQUEST_CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'billing', label: 'Billing & subscription' },
  { value: 'bug', label: 'Report a bug' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'account', label: 'Account & access' },
] as const

export function supportStatusLabel(status: string): string {
  return SUPPORT_REQUEST_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function supportStatusBadgeClass(status: string): string {
  switch (status) {
    case 'open':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'in_progress':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'resolved':
      return 'border-green-200 bg-green-50 text-green-700'
    case 'closed':
      return 'border-gray-200 bg-gray-100 text-gray-600'
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600'
  }
}

export function supportCategoryLabel(category: string): string {
  return SUPPORT_REQUEST_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export interface SupportContactSettings {
  id: string
  support_email: string
  whatsapp_number: string
}

export const DEFAULT_SUPPORT_EMAIL = 'support@runerail.com'
export const DEFAULT_SUPPORT_WHATSAPP = '918606490227'

/** Builds a wa.me chat link from a stored number (strips non-digits). */
export function supportWhatsAppLink(number?: string | null): string {
  const digits = (number || '').replace(/\D/g, '') || DEFAULT_SUPPORT_WHATSAPP
  return `https://wa.me/${digits}`
}
