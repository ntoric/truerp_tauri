import Cookies from 'js-cookie'

const TOKEN_KEY = 'token'

/** Read auth token. Prefer localStorage — cookies are unreliable on wails://. */
export function getAuthToken(): string | undefined {
  if (typeof window !== 'undefined') {
    try {
      const fromStorage = window.localStorage.getItem(TOKEN_KEY)
      if (fromStorage) return fromStorage
    } catch {
      // ignore quota / private mode
    }
  }
  return Cookies.get(TOKEN_KEY)
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // ignore
    }
  }
  Cookies.set(TOKEN_KEY, token, { expires: 1 })
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
  }
  Cookies.remove(TOKEN_KEY)
}
