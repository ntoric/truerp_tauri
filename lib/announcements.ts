import { apiFetch } from '@/hooks/useAuth'
import { API_BASE } from '@/lib/utils'

/** Types and API helpers for platform announcements (super admin backoffice). */

/**
 * Local storage returns relative paths (/uploads/...). Prefix the API origin
 * so images also load when the frontend calls the API cross-origin (without
 * the same-origin proxy).
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${API_BASE.replace(/\/api\/v1\/?$/, '')}${url}`
  return url
}

export type AnnouncementType =
  | 'announcement'
  | 'reminder'
  | 'release_note'
  | 'maintenance'
  | 'urgent'
  | 'note'

export const ANNOUNCEMENT_TYPES: { value: AnnouncementType; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'release_note', label: 'Release Notes' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'note', label: 'Note' },
]

export interface Announcement {
  id: string
  title: string
  body: string
  type: AnnouncementType
  image_url: string
  link_url: string
  link_label: string
  is_active: boolean
  starts_at?: string | null
  ends_at?: string | null
  created_by_id?: string
  created_at: string
  updated_at: string
}

export interface AnnouncementPayload {
  title: string
  body: string
  type: AnnouncementType
  image_url: string
  link_url: string
  link_label: string
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

/** Announcements currently visible to the signed-in user. */
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  const res = await apiFetch('/announcements/active')
  if (!res.ok) throw new Error('Failed to load announcements')
  return res.json()
}

export async function adminListAnnouncements(): Promise<Announcement[]> {
  const res = await apiFetch('/admin/announcements')
  if (!res.ok) throw new Error('Failed to load announcements')
  return res.json()
}

export async function adminCreateAnnouncement(payload: AnnouncementPayload): Promise<Announcement> {
  const res = await apiFetch('/admin/announcements', { method: 'POST', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create announcement')
  return data
}

export async function adminUpdateAnnouncement(id: string, payload: AnnouncementPayload): Promise<Announcement> {
  const res = await apiFetch(`/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update announcement')
  return data
}

export async function adminDeleteAnnouncement(id: string): Promise<void> {
  const res = await apiFetch(`/admin/announcements/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to delete announcement')
  }
}

/** Upload a (cropped/resized) image for an announcement; returns its public URL. */
export async function uploadAnnouncementImage(image: Blob, filename = 'announcement.jpg'): Promise<string> {
  const form = new FormData()
  form.append('image', image, filename)
  const res = await apiFetch('/admin/announcements/image', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to upload image')
  return data.image_url as string
}
