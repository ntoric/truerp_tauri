export function setPOSAuthExpired(expired: boolean) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('pos-auth-expired', { detail: { expired } }))
}

export function subscribePOSAuthExpired(listener: (expired: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ expired?: boolean }>).detail
    listener(Boolean(detail?.expired))
  }
  window.addEventListener('pos-auth-expired', handler)
  return () => window.removeEventListener('pos-auth-expired', handler)
}
