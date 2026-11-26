import { NextRequest, NextResponse } from 'next/server'

// Same-origin proxy to the backend, configurable at container start —
// replaces the old next.config.mjs rewrites(), which are baked into
// routes-manifest.json at build time in production.
//   docker run -e TRUERP_API_PROXY=https://api.example.com ...
// No rebuild needed; unset = no proxying (requests fall through to 404).
export function middleware(req: NextRequest) {
  const proxy = process.env.TRUERP_API_PROXY?.replace(/\/$/, '')
  if (!proxy) return NextResponse.next()
  return NextResponse.rewrite(
    new URL(`${proxy}${req.nextUrl.pathname}${req.nextUrl.search}`),
  )
}

export const config = {
  matcher: ['/api/:path*', '/uploads/:path*', '/health'],
}
