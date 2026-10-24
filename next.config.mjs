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
  // Same-origin API proxying lives in middleware.ts — it reads
  // TRUERP_API_PROXY at runtime, unlike rewrites() which is baked into
  // routes-manifest.json during `next build`.
}

export default nextConfig
