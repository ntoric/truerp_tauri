'use client'

import { useEffect } from 'react'

const WIDGET_SRC = 'https://goosebot-stgng-api.mohammedshahid.in/widget.js'
const WIDGET_CHANNEL = '9084b70a-5e71-4853-ab82-8e21de5a5c2d'

/**
 * Goosebot chat widget for the public landing page. Appended as the last
 * element of <body> (equivalent to placing the tag before </body>). Skipped
 * when the home gate is redirecting — signed-in users and the desktop app
 * never see the landing page, so they shouldn't load the widget either.
 */
export default function ChatWidget() {
  useEffect(() => {
    if (document.documentElement.hasAttribute('data-home-redirect')) return
    if (document.querySelector(`script[src="${WIDGET_SRC}"]`)) return

    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.setAttribute('data-channel', WIDGET_CHANNEL)
    document.body.appendChild(script)
  }, [])

  return null
}
