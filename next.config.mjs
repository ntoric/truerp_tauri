/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
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
