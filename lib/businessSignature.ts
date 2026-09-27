import { apiFetch } from '@/hooks/useAuth'

// fetchBusinessSignature returns the signature image configured under
// Settings → Business (signature_url), converted to a base64 data URL so the
// document keeps an immutable snapshot that works on PDF renderers.
// Falls back to the raw URL when the image can't be fetched (e.g. CORS), and
// to '' when no signature is configured.
export async function fetchBusinessSignature(): Promise<string> {
  try {
    const res = await apiFetch('/business')
    if (!res.ok) return ''
    const business = await res.json()
    const url = String(business?.signature_url || '').trim()
    if (!url) return ''
    return await imageUrlToDataURL(url)
  } catch {
    return ''
  }
}

async function imageUrlToDataURL(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return url
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || url))
      reader.onerror = () => resolve(url)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}
