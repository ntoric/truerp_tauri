const STORE_KEY = 'active_store_id'

export function getActiveStoreId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORE_KEY)
  } catch {
    return null
  }
}

export function setActiveStoreId(storeId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORE_KEY, storeId)
  } catch {
    // ignore
  }
}

export function clearActiveStoreId() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORE_KEY)
  } catch {
    // ignore
  }
}
