/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is used by the Docker image (frontend/Dockerfile).
  // Desktop packaging is unaffected — scripts/prepare-frontend.sh writes
  // its own next.config.mjs into the staged copy.
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Same build tolerances as the desktop staging config: the repo has
  // upstream type/lint debt and client pages that use useSearchParams
  // without a Suspense boundary.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  async rewrites() {
    // Optional same-origin proxy to the cloud/Docker API.
    // Enable with: TRUERP_API_PROXY=http://localhost:8088 and NEXT_PUBLIC_API_URL=/api/v1
    const proxy = process.env.TRUERP_API_PROXY?.replace(/\/$/, '')
    if (!proxy) return []
    return [
      { source: '/api/:path*', destination: `${proxy}/api/:path*` },
      { source: '/uploads/:path*', destination: `${proxy}/uploads/:path*` },
      { source: '/health', destination: `${proxy}/health` },
    ]
  },
}

export default nextConfig
