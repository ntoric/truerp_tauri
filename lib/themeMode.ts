export const THEME_MODE_STORAGE_KEY = 'truerp-theme-mode'

export const THEME_MODES = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof THEME_MODES)[number]
export type ResolvedThemeMode = 'light' | 'dark'

export const DEFAULT_THEME_MODE: ThemeMode = 'light'

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return !!value && (THEME_MODES as readonly string[]).includes(value)
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }
  return mode
}

/** Toggles the `.dark` class on <html>; returns the resolved mode. */
export function applyThemeModeToDocument(mode: ThemeMode): ResolvedThemeMode {
  const resolved = resolveThemeMode(mode)
  if (typeof document === 'undefined') return resolved
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  root.setAttribute('data-theme-mode', mode)
  return resolved
}

export function persistThemeMode(mode: ThemeMode): ResolvedThemeMode {
  const resolved = applyThemeModeToDocument(mode)
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
  }
  return resolved
}

export function readStoredThemeMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY)
  return isThemeMode(stored) ? stored : null
}

/** Subscribe to OS-level scheme changes; used while mode === 'system'. */
export function watchSystemThemeMode(onChange: (resolved: ResolvedThemeMode) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (event: MediaQueryListEvent) => onChange(event.matches ? 'dark' : 'light')
  media.addEventListener('change', handler)
  return () => media.removeEventListener('change', handler)
}

/**
 * Runs before hydration so dark mode never flashes light. Reads the same
 * storage key as persistThemeMode; defaults to light.
 */
export const THEME_MODE_BOOTSTRAP_SCRIPT = `(function(){try{var mode=localStorage.getItem('${THEME_MODE_STORAGE_KEY}')||'light';var dark=mode==='dark'||(mode==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var root=document.documentElement;root.classList.toggle('dark',dark);root.style.colorScheme=dark?'dark':'light';root.setAttribute('data-theme-mode',mode);}catch(e){}})();`
