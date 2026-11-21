'use client'

import { useEffect } from 'react'
import BrandLoader from '@/components/BrandLoader'

/**
 * Runs before the landing page paints (inline script) and decides whether this
 * visitor should see the marketing page at all. Signed-in users go straight to
 * the dashboard. The desktop app (Tauri / Wails) never shows marketing: its
 * start page is /login. Everyone else gets the landing page, server-rendered
 * for SEO.
 *
 * Desktop detection uses both the injected shell globals and the desktop's
 * local proxy address (src-tauri/src/processes.rs PROXY_ADDR, 127.0.0.1:17888),
 * so the landing page can't flash even if the Tauri globals arrive late.
 */
const DESKTOP_ORIGIN_PORT = '17888'

const DETECT_DESKTOP = `var w=window,l=w.location;
var desk=!!(w.__TAURI__||w.__TAURI_INTERNALS__||(w.go&&w.go.main&&w.go.main.App))||
((l.hostname==='127.0.0.1'||l.hostname==='localhost')&&l.port==='${DESKTOP_ORIGIN_PORT}');`

export const HOME_GATE_SCRIPT = `(function(){try{
${DETECT_DESKTOP}
var t=null;
try{t=w.localStorage.getItem('token')}catch(e){}
if(!t&&/(?:^|;\\s*)token=/.test(document.cookie))t='1';
if(t)document.documentElement.setAttribute('data-home-redirect','/dashboard');
else if(desk)document.documentElement.setAttribute('data-home-redirect','/login');
}catch(e){}})();`

// Same check as DETECT_DESKTOP, for use after hydration.
function isDesktopShell(): boolean {
  const w = window as unknown as {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
    go?: { main?: { App?: unknown } }
  }
  if (w.__TAURI__ || w.__TAURI_INTERNALS__ || w.go?.main?.App) return true
  const { hostname, port } = window.location
  return (hostname === '127.0.0.1' || hostname === 'localhost') && port === DESKTOP_ORIGIN_PORT
}

export const HOME_GATE_STYLE = `
html[data-home-redirect] .landing-root{display:none!important}
.landing-gate-loader{display:none}
html[data-home-redirect] .landing-gate-loader{display:flex}
`

export default function HomeRedirect() {
  useEffect(() => {
    let target = document.documentElement.getAttribute('data-home-redirect')
    // Second check after hydration, in case the shell globals were injected
    // after the inline gate script ran.
    if (!target && isDesktopShell()) {
      target = '/login'
      document.documentElement.setAttribute('data-home-redirect', target)
    }
    if (target) window.location.replace(target)
  }, [])

  return (
    <div className="landing-gate-loader min-h-screen items-center justify-center">
      <BrandLoader />
    </div>
  )
}
